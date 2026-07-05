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
    public async Task Editing_quality_needs_edit_rights()
    {
        var c = _factory.CreateClient();
        c.DefaultRequestHeaders.Add("X-Atlas-Role", "stakeholder");
        Assert.Equal(HttpStatusCode.Forbidden, (await c.PatchAsJsonAsync("/api/v1/test-plans/999", new { stage = "UAT" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await c.DeleteAsync("/api/v1/defects/999")).StatusCode);
    }
}
