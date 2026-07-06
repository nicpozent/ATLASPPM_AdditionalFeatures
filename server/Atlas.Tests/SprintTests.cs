using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace Atlas.Tests;

// End-to-end tests for sprints: create/edit/delete, and the roll-up metrics
// derived from the project's tasks (points, done points, spilled-in count).
public class SprintTests : IClassFixture<AtlasApiFactory>
{
    readonly AtlasApiFactory _factory;
    public SprintTests(AtlasApiFactory factory) => _factory = factory;

    HttpClient Admin()
    {
        var c = _factory.CreateClient();
        c.DefaultRequestHeaders.Add("X-Atlas-Role", "admin");
        return c;
    }

    static async Task<string> ProjId(HttpResponseMessage res)
    {
        using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
        return doc.RootElement.GetProperty("id").GetString()!;
    }

    static async Task<int> IntId(HttpResponseMessage res)
    {
        using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
        return doc.RootElement.GetProperty("id").GetInt32();
    }

    [Fact]
    public async Task Sprint_is_created_edited_and_deleted()
    {
        var c = Admin();
        var projId = await ProjId(await c.PostAsJsonAsync("/api/v1/projects", new { name = "Sprint project" }));

        var create = await c.PostAsJsonAsync($"/api/v1/projects/{projId}/sprints", new { name = "S1", goal = "Ship MVP", startDate = "2026-08-01", endDate = "2026-08-14", status = "Started" });
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);
        var sprintId = await IntId(create);

        var patch = await c.PatchAsJsonAsync($"/api/v1/sprints/{sprintId}", new { status = "Completed", goal = "Shipped" });
        Assert.Equal(HttpStatusCode.OK, patch.StatusCode);
        using var pd = JsonDocument.Parse(await patch.Content.ReadAsStringAsync());
        Assert.Equal("Completed", pd.RootElement.GetProperty("status").GetString());
        Assert.Equal("Shipped", pd.RootElement.GetProperty("goal").GetString());

        var del = await c.DeleteAsync($"/api/v1/sprints/{sprintId}");
        Assert.Equal(HttpStatusCode.NoContent, del.StatusCode);
        var listed = await c.GetFromJsonAsync<JsonElement>($"/api/v1/projects/{projId}/sprints");
        Assert.Empty(listed.GetProperty("sprints").EnumerateArray());
    }

    [Fact]
    public async Task Sprint_metrics_roll_up_from_its_tasks()
    {
        var c = Admin();
        var projId = await ProjId(await c.PostAsJsonAsync("/api/v1/projects", new { name = "Rollup project" }));
        await c.PostAsJsonAsync($"/api/v1/projects/{projId}/sprints", new { name = "PI2 · S5" });

        // Two tasks in the sprint (one Done), one carried in from a different baseline.
        await c.PostAsJsonAsync($"/api/v1/projects/{projId}/tasks", new { name = "A", sprint = "PI2 · S5", baseline = "PI2 · S5", points = 5, status = "Done" });
        await c.PostAsJsonAsync($"/api/v1/projects/{projId}/tasks", new { name = "B", sprint = "PI2 · S5", baseline = "PI2 · S4", points = 3, status = "In Progress" });
        // A task in another sprint should not count.
        await c.PostAsJsonAsync($"/api/v1/projects/{projId}/tasks", new { name = "C", sprint = "PI2 · S6", baseline = "PI2 · S6", points = 8 });

        var listed = await c.GetFromJsonAsync<JsonElement>($"/api/v1/projects/{projId}/sprints");
        var s = listed.GetProperty("sprints").EnumerateArray().First(x => x.GetProperty("name").GetString() == "PI2 · S5");
        Assert.Equal(2, s.GetProperty("taskCount").GetInt32());
        Assert.Equal(1, s.GetProperty("doneCount").GetInt32());
        Assert.Equal(8, s.GetProperty("points").GetInt32());        // 5 + 3
        Assert.Equal(5, s.GetProperty("donePoints").GetInt32());
        Assert.Equal(8, s.GetProperty("committedPoints").GetInt32()); // no manual commitment ⇒ derived from tasks
        Assert.Equal(1, s.GetProperty("spilledCount").GetInt32());   // task B carried from S4
    }

    [Fact]
    public async Task Manual_committed_points_override_the_derived_total()
    {
        var c = Admin();
        var projId = await ProjId(await c.PostAsJsonAsync("/api/v1/projects", new { name = "Committed project" }));
        var sprintId = await IntId(await c.PostAsJsonAsync($"/api/v1/projects/{projId}/sprints", new { name = "S1", committedPoints = 40 }));
        await c.PostAsJsonAsync($"/api/v1/projects/{projId}/tasks", new { name = "A", sprint = "S1", points = 5 });

        var listed = await c.GetFromJsonAsync<JsonElement>($"/api/v1/projects/{projId}/sprints");
        var s = listed.GetProperty("sprints").EnumerateArray().First();
        Assert.Equal(40, s.GetProperty("committedPoints").GetInt32());
        Assert.Equal(5, s.GetProperty("points").GetInt32());
        Assert.Equal(sprintId, s.GetProperty("id").GetInt32());
    }

    [Fact]
    public async Task Creating_a_sprint_needs_schedule_edit_rights()
    {
        var c = _factory.CreateClient();
        c.DefaultRequestHeaders.Add("X-Atlas-Role", "stakeholder");
        var res = await c.PostAsJsonAsync("/api/v1/projects/PRJ-1/sprints", new { name = "S1" });
        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);
    }

    [Fact]
    public async Task Editing_a_sprint_needs_project_edit_rights()
    {
        var c = _factory.CreateClient();
        c.DefaultRequestHeaders.Add("X-Atlas-Role", "stakeholder");
        Assert.Equal(HttpStatusCode.Forbidden, (await c.PatchAsJsonAsync("/api/v1/sprints/999", new { status = "Completed" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await c.DeleteAsync("/api/v1/sprints/999")).StatusCode);
    }

    [Fact]
    public async Task Unknown_sprint_status_is_rejected()
    {
        var c = Admin();
        var projId = await ProjId(await c.PostAsJsonAsync("/api/v1/projects", new { name = "Bad status project" }));
        var sprintId = await IntId(await c.PostAsJsonAsync($"/api/v1/projects/{projId}/sprints", new { name = "S1" }));
        var res = await c.PatchAsJsonAsync($"/api/v1/sprints/{sprintId}", new { status = "Frozen" });
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }
}
