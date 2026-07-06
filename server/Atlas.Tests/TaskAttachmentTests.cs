using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Atlas.Api;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Atlas.Tests;

// The read side of the Jira full-field import: a synced task exposes its rich
// fields, its Jira comments and its mirrored attachments (with a working
// download), seeded directly the way the sync would have written them.
public class TaskAttachmentTests : IClassFixture<AtlasApiFactory>
{
    readonly AtlasApiFactory _factory;
    public TaskAttachmentTests(AtlasApiFactory factory)
    {
        _factory = factory;
        Seed();
    }

    int _taskId;
    int _attId;

    void Seed()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AtlasDbContext>();
        var existing = db.ProjectTasks.FirstOrDefault(t => t.ProjectId == "PRJ-ATT");
        if (existing is not null) { _taskId = existing.Id; _attId = db.TaskAttachments.First(a => a.TaskId == _taskId).Id; return; }

        db.Projects.Add(new Project { Id = "PRJ-ATT", Name = "Jira import fixture", Dept = "Development", Owner = "PM",
            Methodology = "Scrum", Status = "green", Health = "On track", Target = "TBD", Due = "TBD", Phase = "Delivery",
            JiraProjectKey = "GIT" });
        var task = new ProjectTask
        {
            ProjectId = "PRJ-ATT", Code = "GIT-42", Name = "Rich synced issue", JiraKey = "GIT-42", Ord = 1,
            Description = "Full description carried from Jira.", IssueType = "Story", Reporter = "Rowan Reporter",
            StatusName = "In Review", Resolution = "", Labels = new() { "backend", "sync" },
            Components = new() { "API" }, FixVersions = new() { "v1.2" }, ParentKey = "GIT-1", EpicKey = "GIT-1",
            TimeSpentHours = 5, JiraUrl = "https://site.atlassian.net/browse/GIT-42",
            JiraCreated = "2026-01-01T09:00:00.000+0000", JiraUpdated = "2026-02-01T09:00:00.000+0000",
        };
        task.Comments.Add(new TaskComment { Author = "Casey Commenter", Initials = "CC", Body = "Imported comment.", At = DateTime.UtcNow, JiraId = "10001" });
        task.Attachments.Add(new TaskAttachment
        {
            JiraId = "20001", FileName = "spec.txt", ContentType = "text/plain",
            Size = 5, Author = "Ann Author", CreatedAt = "2026-01-05T09:00:00.000+0000",
            Bytes = Encoding.UTF8.GetBytes("hello"),
        });
        db.ProjectTasks.Add(task);
        db.SaveChanges();
        _taskId = task.Id;
        _attId = task.Attachments[0].Id;
    }

    HttpClient Admin()
    {
        var c = _factory.CreateClient();
        c.DefaultRequestHeaders.Add("X-Atlas-Role", "admin");
        return c;
    }

    [Fact]
    public async Task Task_list_exposes_the_rich_jira_fields_and_counts()
    {
        var c = Admin();
        var res = await c.GetFromJsonAsync<JsonElement>("/api/v1/projects/PRJ-ATT/tasks");
        var t = res.GetProperty("tasks").EnumerateArray().First(x => x.GetProperty("code").GetString() == "GIT-42");
        Assert.Equal("Story", t.GetProperty("issueType").GetString());
        Assert.Equal("Rowan Reporter", t.GetProperty("reporter").GetString());
        Assert.Equal("In Review", t.GetProperty("statusName").GetString());
        Assert.Equal("GIT-1", t.GetProperty("epicKey").GetString());
        Assert.Equal(5, t.GetProperty("timeSpentHours").GetInt32());
        Assert.Contains("backend", t.GetProperty("labels").EnumerateArray().Select(x => x.GetString()));
        Assert.Equal(1, t.GetProperty("attachmentCount").GetInt32());
        Assert.Equal(1, t.GetProperty("commentCount").GetInt32());
        Assert.Contains("browse/GIT-42", t.GetProperty("jiraUrl").GetString());
    }

    [Fact]
    public async Task Imported_comment_is_flagged_as_from_jira()
    {
        var c = Admin();
        var res = await c.GetFromJsonAsync<JsonElement>($"/api/v1/tasks/{_taskId}/comments");
        var cm = res.GetProperty("comments").EnumerateArray().First();
        Assert.Equal("Casey Commenter", cm.GetProperty("author").GetString());
        Assert.True(cm.GetProperty("fromJira").GetBoolean());
    }

    [Fact]
    public async Task Attachment_lists_and_downloads()
    {
        var c = Admin();
        var list = await c.GetFromJsonAsync<JsonElement>($"/api/v1/tasks/{_taskId}/attachments");
        var att = list.EnumerateArray().First();
        Assert.Equal("spec.txt", att.GetProperty("fileName").GetString());

        var dl = await c.GetAsync($"/api/v1/task-attachments/{_attId}");
        Assert.Equal(HttpStatusCode.OK, dl.StatusCode);
        Assert.Equal("hello", await dl.Content.ReadAsStringAsync());

        Assert.Equal(HttpStatusCode.NotFound, (await c.GetAsync("/api/v1/task-attachments/99999")).StatusCode);
    }
}
