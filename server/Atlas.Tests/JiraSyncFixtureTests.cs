using System.Net;
using System.Text;
using Atlas.Api;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace Atlas.Tests;

// Fixture-based coverage for the Jira import loop. SyncProjectAsync takes the
// HttpClient as a parameter, so we drive it with a fake handler that returns
// recorded Jira JSON — exercising the real board-less (JQL) sync end to end
// (board discovery → issue search → sprint/epic/task mapping → comments) against
// an in-memory DB, no network. This is where Jira.cs's line coverage was thin.
public class JiraSyncFixtureTests
{
    // A canned Jira endpoint: route by path, return recorded JSON.
    sealed class FakeJira : HttpMessageHandler
    {
        readonly Func<string, (HttpStatusCode, string)> _route;
        public FakeJira(Func<string, (HttpStatusCode, string)> route) => _route = route;
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
            .UseInMemoryDatabase("jira-fx-" + Guid.NewGuid().ToString("N")).Options);

    // Three issues: an Epic (→ Epic row, board-less), a Story in an active sprint
    // (points, assignee, priority, done, a comment), and a backlog Task.
    const string IssuesJson = """
    {
      "issues": [
        {
          "key": "ACME-1",
          "fields": {
            "issuetype": { "name": "Epic" },
            "summary": "Platform epic",
            "status": { "name": "In Progress", "statusCategory": { "key": "indeterminate" } },
            "description": { "type": "doc", "version": 1, "content": [
              { "type": "paragraph", "content": [ { "type": "text", "text": "Epic goal" } ] } ] }
          }
        },
        {
          "key": "ACME-2",
          "fields": {
            "issuetype": { "name": "Story" },
            "summary": "Login flow",
            "status": { "name": "Done", "statusCategory": { "key": "done" } },
            "assignee": { "displayName": "Ada Lovelace" },
            "reporter": { "displayName": "Grace Hopper" },
            "priority": { "name": "High" },
            "duedate": "2026-09-01",
            "resolutiondate": "2026-08-20T10:00:00.000+0000",
            "customfield_10016": 5,
            "customfield_10020": [
              { "id": 42, "name": "Sprint 1", "state": "active",
                "startDate": "2026-08-01T00:00:00.000Z", "endDate": "2026-08-14T00:00:00.000Z" }
            ],
            "comment": { "comments": [
              { "id": "9001", "author": { "displayName": "Grace Hopper" },
                "created": "2026-08-10T09:00:00.000+0000",
                "body": { "type": "doc", "version": 1, "content": [
                  { "type": "paragraph", "content": [ { "type": "text", "text": "Looks good" } ] } ] } }
            ] }
          }
        },
        {
          "key": "ACME-3",
          "fields": {
            "issuetype": { "name": "Task" },
            "summary": "Backlog item",
            "status": { "name": "To Do", "statusCategory": { "key": "new" } }
          }
        }
      ]
    }
    """;

    static HttpClient Client() => new(new FakeJira(path => path switch
    {
        // Board discovery for a key-only mapping — no scrum boards.
        "/rest/agile/1.0/board" => (HttpStatusCode.OK, "{\"values\":[],\"isLast\":true}"),
        // Enhanced JQL issue search (board-less path).
        "/rest/api/3/search/jql" => (HttpStatusCode.OK, IssuesJson),
        _ => (HttpStatusCode.NotFound, "{}"),
    }))
    { BaseAddress = new Uri("https://acme.atlassian.net/") };

    [Fact]
    public async Task Board_less_sync_maps_issues_to_tasks_epics_and_sprints()
    {
        using var db = NewDb();
        var cfg = new ConfigurationBuilder().Build();
        var proj = new Project
        {
            Id = "PRJ-1", Name = "Acme", JiraProjectKey = "ACME",
            Dept = "", Due = "", Methodology = "", Owner = "", Phase = "", Target = "",
        };
        db.Projects.Add(proj);
        await db.SaveChangesAsync();

        var result = await Jira.SyncProjectAsync(db, cfg, Client(), proj);
        await db.SaveChangesAsync();

        // Roll-up counts: 2 tasks (Story + Task), 1 epic, 1 in the backlog (ACME-3).
        Assert.Equal(2, result.Tasks);
        Assert.Equal(1, result.Epics);
        Assert.Equal(1, result.Backlog);

        // Epic-type issue became an Epic row (not a task).
        var epic = Assert.Single(db.Epics.Where(e => e.ProjectId == "PRJ-1").ToList());
        Assert.Equal("ACME-1", epic.JiraKey);
        Assert.Equal("Platform epic", epic.Name);
        Assert.Empty(db.ProjectTasks.Where(t => t.JiraKey == "ACME-1").ToList());

        // Story mapped with full fields, including a derived sprint + a comment.
        var story = db.ProjectTasks.Include(t => t.Comments).Single(t => t.JiraKey == "ACME-2");
        Assert.Equal("Done", story.Status);
        Assert.Equal("Ada Lovelace", story.Assignee);
        Assert.Equal("High", story.Priority);
        Assert.Equal(5, story.Points);
        Assert.Equal("Sprint 1", story.Sprint);
        Assert.Equal("Epic goal", epic.Description);   // ADF description flattened to text
        Assert.Equal("2026-09-01", story.TargetDate);
        Assert.Equal("2026-08-20", story.ResolvedAt);
        Assert.Contains(story.Comments, c => c.Body == "Looks good");

        // Sprint derived from the issue's sprint custom field.
        var sprint = db.Sprints.Single(s => s.ProjectId == "PRJ-1" && s.JiraKey == "42");
        Assert.Equal("Sprint 1", sprint.Name);
        Assert.Equal("Started", sprint.Status);   // MapSprintState("active")

        // Backlog task: unassigned, To Do, no sprint.
        var task = db.ProjectTasks.Single(t => t.JiraKey == "ACME-3");
        Assert.Equal("To Do", task.Status);
        Assert.Equal("Unassigned", task.Assignee);
        Assert.Equal("", task.Sprint);
    }

    [Fact]
    public async Task Re_sync_prunes_issues_that_vanished_from_jira()
    {
        using var db = NewDb();
        var cfg = new ConfigurationBuilder().Build();
        var proj = new Project
        {
            Id = "PRJ-2", Name = "Acme", JiraProjectKey = "ACME",
            Dept = "", Due = "", Methodology = "", Owner = "", Phase = "", Target = "",
        };
        db.Projects.Add(proj);
        // A stale Jira-sourced task that the next full sync won't see → pruned.
        db.ProjectTasks.Add(new ProjectTask { ProjectId = "PRJ-2", JiraKey = "ACME-99", Code = "ACME-99", Name = "Gone", Ord = 1 });
        // A locally-created task (no JiraKey) must survive the prune.
        db.ProjectTasks.Add(new ProjectTask { ProjectId = "PRJ-2", JiraKey = "", Code = "LOCAL-1", Name = "Manual", Ord = 2 });
        await db.SaveChangesAsync();

        await Jira.SyncProjectAsync(db, cfg, Client(), proj);
        await db.SaveChangesAsync();

        Assert.Empty(db.ProjectTasks.Where(t => t.JiraKey == "ACME-99").ToList());          // pruned
        Assert.Single(db.ProjectTasks.Where(t => t.JiraKey == "" && t.Code == "LOCAL-1").ToList()); // kept
        Assert.Equal(2, db.ProjectTasks.Count(t => t.JiraKey.StartsWith("ACME-")));          // ACME-2 + ACME-3
    }
}
