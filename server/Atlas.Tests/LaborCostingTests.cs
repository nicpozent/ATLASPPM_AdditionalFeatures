using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace Atlas.Tests;

// Internal-labour costing: the standard cost taxonomy now includes PM & PO
// labour lines (PMO / PM Lead editable), and a rate card (cost/hour by
// discipline & seniority) backs the My Team calculator.
public class LaborCostingTests : IClassFixture<AtlasApiFactory>
{
    readonly AtlasApiFactory _factory;
    public LaborCostingTests(AtlasApiFactory factory) => _factory = factory;

    HttpClient As(string role) { var c = _factory.CreateClient(); c.DefaultRequestHeaders.Add("X-Atlas-Role", role); return c; }
    static async Task<string> Str(HttpResponseMessage r, string prop)
    { using var d = JsonDocument.Parse(await r.Content.ReadAsStringAsync()); return d.RootElement.GetProperty(prop).GetString()!; }

    [Fact]
    public async Task Cost_taxonomy_includes_PM_and_PO_labour_lines_editable_by_PM_lead()
    {
        var admin = As("admin");
        var pid = await Str(await admin.PostAsJsonAsync("/api/v1/projects", new { name = "Labour costed" }), "id");

        var costs = await admin.GetFromJsonAsync<JsonElement>($"/api/v1/projects/{pid}/costs");
        var lines = costs.GetProperty("lines").EnumerateArray().ToList();
        var pm = lines.First(l => l.GetProperty("label").GetString() == "Internal labor · PM");
        var po = lines.First(l => l.GetProperty("label").GetString() == "Internal labor · PO");
        Assert.True(pm.GetProperty("isSystem").GetBoolean());
        Assert.True(po.GetProperty("isSystem").GetBoolean());

        // PM Lead owns them; a non-owning manager does not (PMO/Admin edit all).
        var lead = await (As("pmlead")).GetFromJsonAsync<JsonElement>($"/api/v1/projects/{pid}/costs");
        var pmForLead = lead.GetProperty("lines").EnumerateArray().First(l => l.GetProperty("label").GetString() == "Internal labor · PM");
        Assert.True(pmForLead.GetProperty("canEdit").GetBoolean());

        var infra = await (As("inframgr")).GetFromJsonAsync<JsonElement>($"/api/v1/projects/{pid}/costs");
        var pmForInfra = infra.GetProperty("lines").EnumerateArray().First(l => l.GetProperty("label").GetString() == "Internal labor · PM");
        Assert.False(pmForInfra.GetProperty("canEdit").GetBoolean());
    }

    [Fact]
    public async Task Rate_card_is_need_to_know_PM_lead_sees_and_edits_only_pm_and_po()
    {
        var lead = As("pmlead");
        var before = await lead.GetFromJsonAsync<JsonElement>("/api/v1/labor-rates");
        Assert.True(before.GetProperty("canEdit").GetBoolean());
        var disc = before.GetProperty("disciplines").EnumerateArray().Select(x => x.GetString()).ToList();
        Assert.Contains("pm", disc);
        Assert.Contains("po", disc);
        Assert.DoesNotContain("dev", disc);     // not owned by PM Lead
        Assert.DoesNotContain("infra", disc);

        // Owned disciplines persist; a non-owned one (dev) is silently ignored.
        var put = await lead.PutAsJsonAsync("/api/v1/labor-rates", new { rates = new Dictionary<string, decimal> { ["pm.senior"] = 95m, ["po.expert"] = 110m, ["dev.senior"] = 999m } });
        Assert.Equal(HttpStatusCode.NoContent, put.StatusCode);

        var after = await lead.GetFromJsonAsync<JsonElement>("/api/v1/labor-rates");
        Assert.Equal(95m, after.GetProperty("rates").GetProperty("pm.senior").GetDecimal());
        Assert.Equal(110m, after.GetProperty("rates").GetProperty("po.expert").GetDecimal());
        Assert.False(after.GetProperty("rates").TryGetProperty("dev.senior", out _)); // never visible/saved for PM Lead
    }

    [Fact]
    public async Task Rate_card_infra_visible_to_infra_manager_dev_hidden()
    {
        var infra = As("inframgr");
        var view = await infra.GetFromJsonAsync<JsonElement>("/api/v1/labor-rates");
        Assert.True(view.GetProperty("canEdit").GetBoolean());
        var disc = view.GetProperty("disciplines").EnumerateArray().Select(x => x.GetString()).ToList();
        Assert.Contains("infra", disc);
        Assert.DoesNotContain("dev", disc);
        Assert.DoesNotContain("pm", disc);

        var put = await infra.PutAsJsonAsync("/api/v1/labor-rates", new { rates = new Dictionary<string, decimal> { ["infra.senior"] = 88m } });
        Assert.Equal(HttpStatusCode.NoContent, put.StatusCode);
        var after = await infra.GetFromJsonAsync<JsonElement>("/api/v1/labor-rates");
        Assert.Equal(88m, after.GetProperty("rates").GetProperty("infra.senior").GetDecimal());
    }

    [Fact]
    public async Task Rate_card_cto_sees_every_discipline()
    {
        var cto = As("cto");
        var view = await cto.GetFromJsonAsync<JsonElement>("/api/v1/labor-rates");
        var disc = view.GetProperty("disciplines").EnumerateArray().Select(x => x.GetString()).ToList();
        foreach (var d in new[] { "dev", "infra", "architect", "pm", "po" }) Assert.Contains(d, disc);
    }

    [Fact]
    public async Task Rate_card_hidden_and_uneditable_for_roles_without_an_owned_discipline()
    {
        var stk = As("stakeholder");
        var view = await stk.GetFromJsonAsync<JsonElement>("/api/v1/labor-rates");
        Assert.False(view.GetProperty("canEdit").GetBoolean());
        Assert.Empty(view.GetProperty("disciplines").EnumerateArray());
        var put = await stk.PutAsJsonAsync("/api/v1/labor-rates", new { rates = new Dictionary<string, decimal> { ["dev.junior"] = 10m } });
        Assert.Equal(HttpStatusCode.Forbidden, put.StatusCode);
    }
}
