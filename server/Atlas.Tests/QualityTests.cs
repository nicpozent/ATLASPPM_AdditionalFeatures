using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace Atlas.Tests;

// End-to-end tests for the Quality module: test-plan stages, edit/delete of
// plans and defects, and the execution-count validation.
public class QualityTests : IClassFixture<AtlasApiFactory>
{
    readonly AtlasApiFactory _factory;
    public QualityTests(AtlasApiFactory factory) => _factory = factory;

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
    public async Task Test_plan_carries_a_stage_and_can_be_edited()
    {
        var c = Admin();
        var projId = await ProjId(await c.PostAsJsonAsync("/api/v1/projects", new { name = "QA stage project" }));
        var planId = await IntId(await c.PostAsJsonAsync($"/api/v1/projects/{projId}/test-plans", new { name = "Smoke", stage = "UAT", cases = 20, passed = 5 }));

        var patch = await c.PatchAsJsonAsync($"/api/v1/test-plans/{planId}", new { stage = "Regression", passed = 12, name = "Full regression" });
        Assert.Equal(HttpStatusCode.OK, patch.StatusCode);
        using var doc = JsonDocument.Parse(await patch.Content.ReadAsStringAsync());
        Assert.Equal("Regression", doc.RootElement.GetProperty("stage").GetString());
        Assert.Equal("Full regression", doc.RootElement.GetProperty("name").GetString());
        Assert.Equal(12, doc.RootElement.GetProperty("passed").GetInt32());
    }

    [Fact]
    public async Task Editing_a_plan_beyond_its_case_count_is_rejected()
    {
        var c = Admin();
        var projId = await ProjId(await c.PostAsJsonAsync("/api/v1/projects", new { name = "QA overflow project" }));
        var planId = await IntId(await c.PostAsJsonAsync($"/api/v1/projects/{projId}/test-plans", new { name = "P", cases = 10 }));
        var res = await c.PatchAsJsonAsync($"/api/v1/test-plans/{planId}", new { passed = 8, failed = 5 });   // 13 > 10
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task Unknown_stage_is_rejected()
    {
        var c = Admin();
        var projId = await ProjId(await c.PostAsJsonAsync("/api/v1/projects", new { name = "QA badstage project" }));
        var planId = await IntId(await c.PostAsJsonAsync($"/api/v1/projects/{projId}/test-plans", new { name = "P", cases = 5 }));
        Assert.Equal(HttpStatusCode.BadRequest, (await c.PatchAsJsonAsync($"/api/v1/test-plans/{planId}", new { stage = "Chaos" })).StatusCode);
    }

    [Fact]
    public async Task Plan_can_be_deleted()
    {
        var c = Admin();
        var projId = await ProjId(await c.PostAsJsonAsync("/api/v1/projects", new { name = "QA delete plan project" }));
        var planId = await IntId(await c.PostAsJsonAsync($"/api/v1/projects/{projId}/test-plans", new { name = "P", cases = 5 }));
        Assert.Equal(HttpStatusCode.NoContent, (await c.DeleteAsync($"/api/v1/test-plans/{planId}")).StatusCode);
        var q = await c.GetFromJsonAsync<JsonElement>($"/api/v1/projects/{projId}/quality");
        Assert.Empty(q.GetProperty("plans").EnumerateArray());
    }

    [Fact]
    public async Task Defect_can_be_edited_and_deleted()
    {
        var c = Admin();
        var projId = await ProjId(await c.PostAsJsonAsync("/api/v1/projects", new { name = "QA defect project" }));
        var defId = await IntId(await c.PostAsJsonAsync($"/api/v1/projects/{projId}/defects", new { title = "Crash", severity = "High" }));

        var patch = await c.PatchAsJsonAsync($"/api/v1/defects/{defId}", new { status = "Resolved", severity = "Critical" });
        Assert.Equal(HttpStatusCode.OK, patch.StatusCode);
        using var doc = JsonDocument.Parse(await patch.Content.ReadAsStringAsync());
        Assert.Equal("Resolved", doc.RootElement.GetProperty("status").GetString());
        Assert.Equal("Critical", doc.RootElement.GetProperty("severity").GetString());

        Assert.Equal(HttpStatusCode.NoContent, (await c.DeleteAsync($"/api/v1/defects/{defId}")).StatusCode);
    }

    [Fact]
    public async Task Test_plan_tasks_can_be_added_status_changed_and_removed()
    {
        var c = Admin();
        var projId = await ProjId(await c.PostAsJsonAsync("/api/v1/projects", new { name = "Plan tasks project" }));
        var planId = await IntId(await c.PostAsJsonAsync($"/api/v1/projects/{projId}/test-plans", new { name = "Smoke", cases = 10 }));

        var add = await c.PostAsJsonAsync($"/api/v1/test-plans/{planId}/tasks",
            new { title = "Login works", assignee = "QA", description = "Sign in with valid creds", startDate = "2026-03-02", dueDate = "2026-03-05", estimateHours = 2.5 });
        Assert.Equal(HttpStatusCode.OK, add.StatusCode);
        var taskId = await IntId(add);
        using (var d = JsonDocument.Parse(await add.Content.ReadAsStringAsync()))
        {
            Assert.Equal("Sign in with valid creds", d.RootElement.GetProperty("description").GetString());
            Assert.Equal("2026-03-05", d.RootElement.GetProperty("dueDate").GetString());
            Assert.Equal(2.5, d.RootElement.GetProperty("estimateHours").GetDouble());
        }

        var patch = await c.PatchAsJsonAsync($"/api/v1/test-plan-tasks/{taskId}", new { status = "Passed", estimateHours = 4 });
        Assert.Equal(HttpStatusCode.OK, patch.StatusCode);
        using (var d = JsonDocument.Parse(await patch.Content.ReadAsStringAsync()))
        {
            Assert.Equal("Passed", d.RootElement.GetProperty("status").GetString());
            Assert.Equal(4, d.RootElement.GetProperty("estimateHours").GetDouble());
            Assert.Equal("2026-03-02", d.RootElement.GetProperty("startDate").GetString());   // untouched fields persist
        }

        // Shows up nested under its plan in the quality payload.
        var q = await c.GetFromJsonAsync<JsonElement>($"/api/v1/projects/{projId}/quality");
        var plan = q.GetProperty("plans").EnumerateArray().First(p => p.GetProperty("id").GetInt32() == planId);
        Assert.Single(plan.GetProperty("tasks").EnumerateArray());

        Assert.Equal(HttpStatusCode.BadRequest, (await c.PatchAsJsonAsync($"/api/v1/test-plan-tasks/{taskId}", new { status = "Nope" })).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await c.DeleteAsync($"/api/v1/test-plan-tasks/{taskId}")).StatusCode);
    }

    [Fact]
    public async Task Editing_quality_needs_edit_rights()
    {
        var c = _factory.CreateClient();
        c.DefaultRequestHeaders.Add("X-Atlas-Role", "stakeholder");
        Assert.Equal(HttpStatusCode.Forbidden, (await c.PatchAsJsonAsync("/api/v1/test-plans/999", new { stage = "UAT" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await c.DeleteAsync("/api/v1/defects/999")).StatusCode);
    }

    // A plan can carry a linked Jira board id; ingest is guarded on Jira config
    // and a linked board (tests run with Jira unconfigured, so it's a clean 400).
    [Fact]
    public async Task Test_plan_carries_a_jira_board_and_ingest_is_guarded()
    {
        var c = Admin();
        var projId = await ProjId(await c.PostAsJsonAsync("/api/v1/projects", new { name = "Jira QA project" }));
        var planId = await IntId(await c.PostAsJsonAsync($"/api/v1/projects/{projId}/test-plans", new { name = "Board plan", jiraBoardId = 42 }));

        var q = await c.GetFromJsonAsync<JsonElement>($"/api/v1/projects/{projId}/quality");
        var plan = q.GetProperty("plans").EnumerateArray().First(p => p.GetProperty("id").GetInt32() == planId);
        Assert.Equal(42, plan.GetProperty("jiraBoardId").GetInt32());

        // Jira isn't configured in tests → a clear 400 rather than a crash.
        var ingest = await c.PostAsync($"/api/v1/test-plans/{planId}/jira-ingest", null);
        Assert.Equal(HttpStatusCode.BadRequest, ingest.StatusCode);

        // Unlinking the board is a plain patch.
        Assert.Equal(HttpStatusCode.OK, (await c.PatchAsJsonAsync($"/api/v1/test-plans/{planId}", new { jiraBoardId = 0 })).StatusCode);
    }

    [Fact]
    public async Task Jira_ingest_needs_edit_rights()
    {
        var c = _factory.CreateClient();
        c.DefaultRequestHeaders.Add("X-Atlas-Role", "stakeholder");
        Assert.Equal(HttpStatusCode.Forbidden, (await c.PostAsync("/api/v1/test-plans/999/jira-ingest", null)).StatusCode);
    }
}
