using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace Atlas.Tests;

// End-to-end tests for the security-control lifecycle (edit/archive/delete +
// description/reason) and configurable gate-review criteria (add/edit/remove).
public class GovernanceTests : IClassFixture<AtlasApiFactory>
{
    readonly AtlasApiFactory _factory;
    public GovernanceTests(AtlasApiFactory factory) => _factory = factory;

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
    public async Task Control_can_be_modified_archived_and_deleted_with_a_reason()
    {
        var c = Admin();
        var projId = await ProjId(await c.PostAsJsonAsync("/api/v1/projects", new { name = "Control lifecycle project" }));
        var ctlId = await IntId(await c.PostAsJsonAsync($"/api/v1/projects/{projId}/security/controls",
            new { control = "A.8.24 Cryptography", framework = "ISO 27001", description = "Encrypt at rest" }));

        var patch = await c.PatchAsJsonAsync($"/api/v1/security/controls/{ctlId}",
            new { status = "Archived", reason = "Superseded by platform-wide KMS", owner = "CISO" });
        Assert.Equal(HttpStatusCode.OK, patch.StatusCode);
        using var doc = JsonDocument.Parse(await patch.Content.ReadAsStringAsync());
        Assert.Equal("Archived", doc.RootElement.GetProperty("status").GetString());
        Assert.Equal("Superseded by platform-wide KMS", doc.RootElement.GetProperty("reason").GetString());
        Assert.Equal("Encrypt at rest", doc.RootElement.GetProperty("description").GetString());

        Assert.Equal(HttpStatusCode.NoContent, (await c.DeleteAsync($"/api/v1/security/controls/{ctlId}")).StatusCode);
        var sec = await c.GetFromJsonAsync<JsonElement>($"/api/v1/projects/{projId}/security");
        Assert.Empty(sec.GetProperty("controls").EnumerateArray());
    }

    [Fact]
    public async Task Unknown_control_status_is_rejected()
    {
        var c = Admin();
        var projId = await ProjId(await c.PostAsJsonAsync("/api/v1/projects", new { name = "Control status project" }));
        var ctlId = await IntId(await c.PostAsJsonAsync($"/api/v1/projects/{projId}/security/controls", new { control = "X" }));
        Assert.Equal(HttpStatusCode.BadRequest, (await c.PatchAsJsonAsync($"/api/v1/security/controls/{ctlId}", new { status = "Retired" })).StatusCode);
    }

    [Fact]
    public async Task Control_edits_need_approve_edit_rights()
    {
        var c = _factory.CreateClient();
        c.DefaultRequestHeaders.Add("X-Atlas-Role", "stakeholder");
        Assert.Equal(HttpStatusCode.Forbidden, (await c.PatchAsJsonAsync("/api/v1/security/controls/999", new { status = "Archived" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await c.DeleteAsync("/api/v1/security/controls/999")).StatusCode);
    }

    [Fact]
    public async Task Gate_criteria_can_be_added_edited_and_removed()
    {
        var c = Admin();
        var projId = await ProjId(await c.PostAsJsonAsync("/api/v1/projects", new { name = "Gate criteria project" }));
        // First read seeds the standard G0–G5 rail.
        var gates = await c.GetFromJsonAsync<JsonElement>($"/api/v1/projects/{projId}/gates");
        var g2 = gates.GetProperty("gates").EnumerateArray().First(g => g.GetProperty("code").GetString() == "G2");
        var gateId = g2.GetProperty("id").GetInt32();

        var add = await c.PostAsJsonAsync($"/api/v1/gates/{gateId}/criteria", new { label = "Pen-test booked" });
        Assert.Equal(HttpStatusCode.OK, add.StatusCode);
        var critId = await IntId(add);

        var edit = await c.PatchAsJsonAsync($"/api/v1/gates/criteria/{critId}", new { label = "Pen-test passed", met = true });
        Assert.Equal(HttpStatusCode.OK, edit.StatusCode);
        using var editDoc = JsonDocument.Parse(await edit.Content.ReadAsStringAsync());
        Assert.Equal("Pen-test passed", editDoc.RootElement.GetProperty("label").GetString());
        Assert.True(editDoc.RootElement.GetProperty("met").GetBoolean());

        Assert.Equal(HttpStatusCode.NoContent, (await c.DeleteAsync($"/api/v1/gates/criteria/{critId}")).StatusCode);

        var after = await c.GetFromJsonAsync<JsonElement>($"/api/v1/projects/{projId}/gates");
        var g2after = after.GetProperty("gates").EnumerateArray().First(g => g.GetProperty("code").GetString() == "G2");
        Assert.DoesNotContain(g2after.GetProperty("criteria").EnumerateArray().Select(x => x.GetProperty("id").GetInt32()), x => x == critId);
    }

    [Fact]
    public async Task Configuring_gate_criteria_needs_full_approve_rights()
    {
        var c = _factory.CreateClient();
        c.DefaultRequestHeaders.Add("X-Atlas-Role", "stakeholder");   // lacks Full on cap-approve
        Assert.Equal(HttpStatusCode.Forbidden, (await c.PostAsJsonAsync("/api/v1/gates/1/criteria", new { label = "X" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await c.DeleteAsync("/api/v1/gates/criteria/1")).StatusCode);
    }
}
