using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace Atlas.Tests;

// End-to-end tests for security review gates (real CRUD entity on the Security
// tab) and decision-log edit/delete.
public class SecurityGateDecisionTests : IClassFixture<AtlasApiFactory>
{
    readonly AtlasApiFactory _factory;
    public SecurityGateDecisionTests(AtlasApiFactory factory) => _factory = factory;

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
    public async Task Review_gate_is_created_edited_and_deleted()
    {
        var c = Admin();
        var projId = await ProjId(await c.PostAsJsonAsync("/api/v1/projects", new { name = "Review gate project" }));
        var gateId = await IntId(await c.PostAsJsonAsync($"/api/v1/projects/{projId}/security/review-gates",
            new { name = "G2 Security review", type = "Security", reviewer = "CISO", status = "Scheduled", date = "2026-08-01" }));

        var patch = await c.PatchAsJsonAsync($"/api/v1/security/review-gates/{gateId}", new { status = "Passed", note = "No highs open" });
        Assert.Equal(HttpStatusCode.OK, patch.StatusCode);
        using var doc = JsonDocument.Parse(await patch.Content.ReadAsStringAsync());
        Assert.Equal("Passed", doc.RootElement.GetProperty("status").GetString());
        Assert.Equal("No highs open", doc.RootElement.GetProperty("note").GetString());

        var sec = await c.GetFromJsonAsync<JsonElement>($"/api/v1/projects/{projId}/security");
        Assert.Single(sec.GetProperty("reviewGates").EnumerateArray());

        Assert.Equal(HttpStatusCode.NoContent, (await c.DeleteAsync($"/api/v1/security/review-gates/{gateId}")).StatusCode);
        var after = await c.GetFromJsonAsync<JsonElement>($"/api/v1/projects/{projId}/security");
        Assert.Empty(after.GetProperty("reviewGates").EnumerateArray());
    }

    [Fact]
    public async Task Unknown_review_gate_status_and_type_are_rejected()
    {
        var c = Admin();
        var projId = await ProjId(await c.PostAsJsonAsync("/api/v1/projects", new { name = "Gate validation project" }));
        var gateId = await IntId(await c.PostAsJsonAsync($"/api/v1/projects/{projId}/security/review-gates", new { name = "G" }));
        Assert.Equal(HttpStatusCode.BadRequest, (await c.PatchAsJsonAsync($"/api/v1/security/review-gates/{gateId}", new { status = "Maybe" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await c.PatchAsJsonAsync($"/api/v1/security/review-gates/{gateId}", new { type = "Nonsense" })).StatusCode);
    }

    [Fact]
    public async Task Review_gate_edits_need_approve_edit_rights()
    {
        var c = _factory.CreateClient();
        c.DefaultRequestHeaders.Add("X-Atlas-Role", "stakeholder");
        Assert.Equal(HttpStatusCode.Forbidden, (await c.PostAsJsonAsync("/api/v1/projects/PRJ-1/security/review-gates", new { name = "G" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await c.DeleteAsync("/api/v1/security/review-gates/999")).StatusCode);
    }

    [Fact]
    public async Task Decision_can_be_edited_and_deleted()
    {
        var c = Admin();
        var projId = await ProjId(await c.PostAsJsonAsync("/api/v1/projects", new { name = "Decision project" }));
        var post = await c.PostAsJsonAsync($"/api/v1/projects/{projId}/decisions", new { title = "Use Postgres", context = "DB choice", decision = "Postgres", status = "Proposed" });
        Assert.Equal(HttpStatusCode.Created, post.StatusCode);
        var decId = await IntId(post);

        var patch = await c.PatchAsJsonAsync($"/api/v1/decisions/{decId}", new { status = "Approved", decision = "Postgres 16" });
        Assert.Equal(HttpStatusCode.OK, patch.StatusCode);
        using var doc = JsonDocument.Parse(await patch.Content.ReadAsStringAsync());
        Assert.Equal("Approved", doc.RootElement.GetProperty("status").GetString());
        Assert.Equal("Postgres 16", doc.RootElement.GetProperty("decision").GetString());

        Assert.Equal(HttpStatusCode.NoContent, (await c.DeleteAsync($"/api/v1/decisions/{decId}")).StatusCode);
        var listed = await c.GetFromJsonAsync<JsonElement>($"/api/v1/projects/{projId}/decisions");
        Assert.Empty(listed.GetProperty("decisions").EnumerateArray());
    }

    [Fact]
    public async Task Editing_a_decision_needs_full_approve_rights()
    {
        var c = _factory.CreateClient();
        c.DefaultRequestHeaders.Add("X-Atlas-Role", "stakeholder");
        Assert.Equal(HttpStatusCode.Forbidden, (await c.PatchAsJsonAsync("/api/v1/decisions/999", new { status = "Approved" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await c.DeleteAsync("/api/v1/decisions/999")).StatusCode);
    }
}
