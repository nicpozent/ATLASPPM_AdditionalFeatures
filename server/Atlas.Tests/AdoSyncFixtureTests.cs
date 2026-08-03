using System.Net;
using System.Text;
using Atlas.Api;
using Atlas.Api.Integrations;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace Atlas.Tests;

// Fixture-based coverage for the Azure DevOps import loop. AzureDevOps.SyncProjectAsync
// takes the HttpClient as a parameter, so a fake handler returns recorded ADO JSON —
// iterations tree → WIQL id query → batched work-item detail → sprint/epic/task
// mapping — end to end against an in-memory DB, no network.
public class AdoSyncFixtureTests
{
    sealed class FakeAdo : HttpMessageHandler
    {
        readonly Func<string, (HttpStatusCode, string)> _route;
        public FakeAdo(Func<string, (HttpStatusCode, string)> route) => _route = route;
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage req, CancellationToken ct)
        {
            var (code, body) = _route(req.RequestUri!.AbsolutePath);
            return Task.FromResult(new HttpResponseMessage(code)
            {
                Content = new StringContent(body, Encoding.UTF8, "application/json"),
            });
        }
    }

    static AtlasDbContext NewDb() =>
        new(new DbContextOptionsBuilder<AtlasDbContext>()
            .UseInMemoryDatabase("ado-fx-" + Guid.NewGuid().ToString("N")).Options);

    const string IterationsJson = """
    {
      "name": "Acme", "identifier": "root",
      "children": [
        { "identifier": "iter-1", "name": "Sprint 1",
          "attributes": { "startDate": "2026-08-01T00:00:00Z", "finishDate": "2026-08-14T00:00:00Z" } }
      ]
    }
    """;

    const string WiqlJson = """{ "workItems": [ { "id": 101 }, { "id": 102 }, { "id": 103 } ] }""";

    const string WorkItemsJson = """
    {
      "value": [
        { "id": 101, "fields": {
            "System.WorkItemType": "Epic", "System.Title": "Platform epic",
            "System.State": "Done", "System.Description": "<p>Epic goal</p>" } },
        { "id": 102, "fields": {
            "System.WorkItemType": "User Story", "System.Title": "Login flow",
            "System.State": "Active", "System.AssignedTo": { "displayName": "Ada Lovelace" },
            "System.IterationPath": "Acme\\Sprint 1", "System.Parent": 101,
            "Microsoft.VSTS.Scheduling.StoryPoints": 5, "Microsoft.VSTS.Common.Priority": 2,
            "System.Description": "<p>Do login</p>" } },
        { "id": 103, "fields": {
            "System.WorkItemType": "Task", "System.Title": "Backlog item",
            "System.State": "New", "System.IterationPath": "Acme" } }
      ]
    }
    """;

    static HttpClient Client() => new(new FakeAdo(path =>
        path.EndsWith("/classificationnodes/iterations") ? (HttpStatusCode.OK, IterationsJson)
        : path.EndsWith("/wiql") ? (HttpStatusCode.OK, WiqlJson)
        : path.EndsWith("/workitems") ? (HttpStatusCode.OK, WorkItemsJson)
        : (HttpStatusCode.NotFound, "{}")))
    { BaseAddress = new Uri("https://dev.azure.com/acme/") };

    [Fact]
    public async Task Sync_maps_work_items_to_tasks_epics_and_iterations()
    {
        using var db = NewDb();
        var cfg = new ConfigurationBuilder().Build();
        var proj = new Project
        {
            Id = "PRJ-1", Name = "Acme", AdoProject = "Acme",
            Dept = "", Due = "", Methodology = "", Owner = "", Phase = "", Target = "",
        };
        db.Projects.Add(proj);
        await db.SaveChangesAsync();

        var result = await AzureDevOps.SyncProjectAsync(db, cfg, Client(), proj);
        await db.SaveChangesAsync();

        Assert.Equal(1, result.Sprints);
        Assert.Equal(1, result.Epics);
        Assert.Equal(2, result.Tasks);
        Assert.Equal(1, result.Backlog);

        var epic = db.Epics.Single(e => e.ProjectId == "PRJ-1");
        Assert.Equal("101", epic.AdoId);
        Assert.Equal("Platform epic", epic.Name);
        Assert.Equal("Complete", epic.Status);
        Assert.Equal(1, epic.Stories);      // rollup: the story links to it by parent
        Assert.Equal(0, epic.Done);

        var story = db.ProjectTasks.Single(t => t.AdoId == "102");
        Assert.Equal("In Progress", story.Status);          // MapAdoState("Active")
        Assert.Equal("Ada Lovelace", story.Assignee);
        Assert.Equal("High", story.Priority);               // MapAdoPriority(2)
        Assert.Equal(5, story.Points);
        Assert.Equal("Sprint 1", story.Sprint);             // iteration leaf
        Assert.Equal("Platform epic", story.Epic);          // linked via System.Parent
        Assert.Equal("Do login", story.Description);        // HTML stripped

        var sprint = db.Sprints.Single(s => s.ProjectId == "PRJ-1");
        Assert.Equal("iter-1", sprint.AdoId);
        Assert.Equal("Sprint 1", sprint.Name);

        var task = db.ProjectTasks.Single(t => t.AdoId == "103");
        Assert.Equal("To Do", task.Status);
        Assert.Equal("Unassigned", task.Assignee);
        Assert.Equal("", task.Sprint);                      // iteration path == project → backlog

        // The watermark is stamped for the next delta pull.
        Assert.False(string.IsNullOrEmpty(proj.LastAdoSync));
    }
}
