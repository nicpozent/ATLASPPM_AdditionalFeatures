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
    public async Task Rate_card_reads_defaults_and_PM_lead_can_set_rates()
    {
        var lead = As("pmlead");
        var before = await lead.GetFromJsonAsync<JsonElement>("/api/v1/labor-rates");
        Assert.True(before.GetProperty("canEdit").GetBoolean());
        Assert.Contains("dev", before.GetProperty("disciplines").EnumerateArray().Select(x => x.GetString()));

        var put = await lead.PutAsJsonAsync("/api/v1/labor-rates", new { rates = new Dictionary<string, decimal> { ["dev.senior"] = 95m, ["infra.expert"] = 130m } });
        Assert.Equal(HttpStatusCode.NoContent, put.StatusCode);

        var after = await lead.GetFromJsonAsync<JsonElement>("/api/v1/labor-rates");
        Assert.Equal(95m, after.GetProperty("rates").GetProperty("dev.senior").GetDecimal());
        Assert.Equal(130m, after.GetProperty("rates").GetProperty("infra.expert").GetDecimal());
    }

    [Fact]
    public async Task Rate_card_editing_is_denied_for_unprivileged_roles()
    {
        var stk = As("stakeholder");
        var view = await stk.GetFromJsonAsync<JsonElement>("/api/v1/labor-rates");
        Assert.False(view.GetProperty("canEdit").GetBoolean());   // can read, not edit
        var put = await stk.PutAsJsonAsync("/api/v1/labor-rates", new { rates = new Dictionary<string, decimal> { ["dev.junior"] = 10m } });
        Assert.Equal(HttpStatusCode.Forbidden, put.StatusCode);
    }
}
