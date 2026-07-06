using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace Atlas.Tests;

// End-to-end tests for the Tasks overhaul: creating with the extended fields,
// editing every field, deleting, task comments, and the assignee-on-leave flag
// derived from the project's vacation calendar.
public class TaskTests : IClassFixture<AtlasApiFactory>
{
    readonly AtlasApiFactory _factory;
    public TaskTests(AtlasApiFactory factory) => _factory = factory;

    HttpClient Admin()
    {
        var c = _factory.CreateClient();
        c.DefaultRequestHeaders.Add("X-Atlas-Role", "admin");
        return c;
    }

    static async Task<string> Id(HttpResponseMessage res)
    {
        using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
        return doc.RootElement.GetProperty("id").GetString()!;
    }

    static async Task<int> TaskId(HttpResponseMessage res)
    {
        using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
        return doc.RootElement.GetProperty("id").GetInt32();
    }

    [Fact]
    public async Task Task_is_created_with_the_extended_fields()
    {
        var c = Admin();
        var projId = await Id(await c.PostAsJsonAsync("/api/v1/projects", new { name = "Task fields project" }));

        var res = await c.PostAsJsonAsync($"/api/v1/projects/{projId}/tasks", new
        {
            name = "Build API", assignee = "Ada Lovelace", priority = "High",
            startDate = "2026-08-01", targetDate = "2026-08-10", points = 5, size = "L", estimateHours = 24,
        });
        Assert.Equal(HttpStatusCode.Created, res.StatusCode);
        using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
        var t = doc.RootElement;
        Assert.Equal("High", t.GetProperty("priority").GetString());
        Assert.Equal("2026-08-01", t.GetProperty("startDate").GetString());
        Assert.Equal("2026-08-10", t.GetProperty("targetDate").GetString());
        Assert.Equal(5, t.GetProperty("points").GetInt32());
        Assert.Equal("L", t.GetProperty("size").GetString());
        Assert.Equal(24, t.GetProperty("estimateHours").GetInt32());
        Assert.False(t.GetProperty("assigneeOnLeave").GetBoolean());
    }

    [Fact]
    public async Task Assignee_not_onboarded_is_flagged_on_the_task_list()
    {
        var c = Admin();
        var projId = await Id(await c.PostAsJsonAsync("/api/v1/projects", new { name = "Assignee flag project" }));
        // No Resources/Entra members are seeded in tests, so a named assignee is
        // "not onboarded"; an unassigned task is fine.
        await c.PostAsJsonAsync($"/api/v1/projects/{projId}/tasks", new { name = "From Jira", assignee = "Ghost Person" });
        await c.PostAsJsonAsync($"/api/v1/projects/{projId}/tasks", new { name = "Unowned" });

        using var doc = JsonDocument.Parse(await (await c.GetAsync($"/api/v1/projects/{projId}/tasks")).Content.ReadAsStringAsync());
        var tasks = doc.RootElement.GetProperty("tasks").EnumerateArray().ToList();
        var ghost = tasks.First(t => t.GetProperty("assignee").GetString() == "Ghost Person");
        var unowned = tasks.First(t => t.GetProperty("assignee").GetString() == "Unassigned");
        Assert.False(ghost.GetProperty("assigneeKnown").GetBoolean());   // flagged
        Assert.True(unowned.GetProperty("assigneeKnown").GetBoolean());  // unassigned isn't flagged
    }

    [Fact]
    public async Task Task_fields_can_be_edited()
    {
        var c = Admin();
        var projId = await Id(await c.PostAsJsonAsync("/api/v1/projects", new { name = "Editable task project" }));
        var taskId = await TaskId(await c.PostAsJsonAsync($"/api/v1/projects/{projId}/tasks", new { name = "Draft" }));

        var patch = await c.PatchAsJsonAsync($"/api/v1/tasks/{taskId}", new
        {
            name = "Renamed", epic = "Onboarding", assignee = "Grace Hopper", status = "In Progress",
            priority = "Critical", points = 8, size = "XL", estimateHours = 40, targetDate = "2026-09-01",
        });
        Assert.Equal(HttpStatusCode.OK, patch.StatusCode);
        using var doc = JsonDocument.Parse(await patch.Content.ReadAsStringAsync());
        var t = doc.RootElement;
        Assert.Equal("Renamed", t.GetProperty("name").GetString());
        Assert.Equal("Onboarding", t.GetProperty("epic").GetString());
        Assert.Equal("Grace Hopper", t.GetProperty("assignee").GetString());
        Assert.Equal("In Progress", t.GetProperty("status").GetString());
        Assert.Equal("Critical", t.GetProperty("priority").GetString());
        Assert.Equal(8, t.GetProperty("points").GetInt32());
        Assert.Equal("XL", t.GetProperty("size").GetString());
        Assert.Equal(40, t.GetProperty("estimateHours").GetInt32());
    }

    [Fact]
    public async Task Editing_rejects_unknown_status_and_priority()
    {
        var c = Admin();
        var projId = await Id(await c.PostAsJsonAsync("/api/v1/projects", new { name = "Validation project" }));
        var taskId = await TaskId(await c.PostAsJsonAsync($"/api/v1/projects/{projId}/tasks", new { name = "T" }));

        Assert.Equal(HttpStatusCode.BadRequest, (await c.PatchAsJsonAsync($"/api/v1/tasks/{taskId}", new { status = "Nope" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await c.PatchAsJsonAsync($"/api/v1/tasks/{taskId}", new { priority = "Urgent" })).StatusCode);
    }

    [Fact]
    public async Task Task_can_be_deleted()
    {
        var c = Admin();
        var projId = await Id(await c.PostAsJsonAsync("/api/v1/projects", new { name = "Delete task project" }));
        var taskId = await TaskId(await c.PostAsJsonAsync($"/api/v1/projects/{projId}/tasks", new { name = "Temp" }));

        var del = await c.DeleteAsync($"/api/v1/tasks/{taskId}");
        Assert.Equal(HttpStatusCode.NoContent, del.StatusCode);

        var listed = await c.GetFromJsonAsync<JsonElement>($"/api/v1/projects/{projId}/tasks");
        Assert.Empty(listed.GetProperty("tasks").EnumerateArray());
    }

    [Fact]
    public async Task Task_comment_is_posted_and_listed()
    {
        var c = Admin();
        var projId = await Id(await c.PostAsJsonAsync("/api/v1/projects", new { name = "Task comment project" }));
        var taskId = await TaskId(await c.PostAsJsonAsync($"/api/v1/projects/{projId}/tasks", new { name = "Discuss me" }));

        var post = await c.PostAsJsonAsync($"/api/v1/tasks/{taskId}/comments", new { body = "Looks good" });
        Assert.Equal(HttpStatusCode.Created, post.StatusCode);

        var listed = await c.GetFromJsonAsync<JsonElement>($"/api/v1/tasks/{taskId}/comments");
        var arr = listed.GetProperty("comments").EnumerateArray().ToList();
        Assert.Single(arr);
        Assert.Equal("Looks good", arr[0].GetProperty("body").GetString());
    }

    [Fact]
    public async Task Assignee_on_leave_flag_reflects_an_overlapping_absence()
    {
        var c = Admin();
        var projId = await Id(await c.PostAsJsonAsync("/api/v1/projects", new { name = "Leave overlap project" }));
        await c.PostAsJsonAsync($"/api/v1/projects/{projId}/tasks", new
        {
            name = "Overlaps leave", assignee = "Alan Turing", startDate = "2026-08-05", targetDate = "2026-08-12",
        });
        await c.PostAsJsonAsync($"/api/v1/projects/{projId}/tasks", new
        {
            name = "Outside leave", assignee = "Alan Turing", startDate = "2026-09-01", targetDate = "2026-09-05",
        });
        // Alan is on vacation 2026-08-10 → 2026-08-15 (overlaps the first task only).
        await c.PostAsJsonAsync($"/api/v1/projects/{projId}/vacations", new { person = "Alan Turing", from = "2026-08-10", to = "2026-08-15", type = "vacation" });

        var listed = await c.GetFromJsonAsync<JsonElement>($"/api/v1/projects/{projId}/tasks");
        var tasks = listed.GetProperty("tasks").EnumerateArray().ToList();
        var overlaps = tasks.First(t => t.GetProperty("name").GetString() == "Overlaps leave");
        var outside = tasks.First(t => t.GetProperty("name").GetString() == "Outside leave");
        Assert.True(overlaps.GetProperty("assigneeOnLeave").GetBoolean());
        Assert.False(outside.GetProperty("assigneeOnLeave").GetBoolean());
    }

    [Fact]
    public async Task Editing_and_deleting_a_task_needs_edit_rights()
    {
        var c = _factory.CreateClient();
        c.DefaultRequestHeaders.Add("X-Atlas-Role", "stakeholder");   // no cap-projects Edit
        Assert.Equal(HttpStatusCode.Forbidden, (await c.PatchAsJsonAsync("/api/v1/tasks/999", new { name = "X" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await c.DeleteAsync("/api/v1/tasks/999")).StatusCode);
    }
}
