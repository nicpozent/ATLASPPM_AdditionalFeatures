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
    public async Task Rate_card_is_region_scoped_PM_lead_sees_only_sweden_pm_and_po()
    {
        var lead = As("pmlead");
        var before = await lead.GetFromJsonAsync<JsonElement>("/api/v1/labor-rates");
        Assert.True(before.GetProperty("canEdit").GetBoolean());
        var disc = before.GetProperty("disciplines").EnumerateArray().Select(x => x.GetString()).ToList();
        Assert.Contains("pmSweden", disc);
        Assert.Contains("poSweden", disc);
        Assert.DoesNotContain("pmCh", disc);       // CH lines are PMO/CTO/CIO only
        Assert.DoesNotContain("poCh", disc);
        Assert.DoesNotContain("devSweden", disc);   // not owned by PM Lead

        // Owned region lines persist; non-owned ones are silently ignored.
        var put = await lead.PutAsJsonAsync("/api/v1/labor-rates", new { rates = new Dictionary<string, decimal> { ["pmSweden.senior"] = 95m, ["poSweden.expert"] = 110m, ["pmCh.senior"] = 999m } });
        Assert.Equal(HttpStatusCode.NoContent, put.StatusCode);

        var after = await lead.GetFromJsonAsync<JsonElement>("/api/v1/labor-rates");
        Assert.Equal(95m, after.GetProperty("rates").GetProperty("pmSweden.senior").GetDecimal());
        Assert.Equal(110m, after.GetProperty("rates").GetProperty("poSweden.expert").GetDecimal());
        Assert.False(after.GetProperty("rates").TryGetProperty("pmCh.senior", out _)); // not owned → not saved/visible
    }

    [Fact]
    public async Task Rate_card_regional_managers_see_only_their_region()
    {
        // Infrastructure Manager (Sweden) sees Infra · Sweden, not APAC/CH.
        var infra = As("inframgr");
        var iDisc = (await infra.GetFromJsonAsync<JsonElement>("/api/v1/labor-rates")).GetProperty("disciplines").EnumerateArray().Select(x => x.GetString()).ToList();
        Assert.Contains("infraSweden", iDisc);
        Assert.DoesNotContain("infraApac", iDisc);
        Assert.DoesNotContain("infraCh", iDisc);

        // Infrastructure Manager APAC sees only Infra · APAC.
        var apac = As("inframgr_apac");
        var aDisc = (await apac.GetFromJsonAsync<JsonElement>("/api/v1/labor-rates")).GetProperty("disciplines").EnumerateArray().Select(x => x.GetString()).ToList();
        Assert.Contains("infraApac", aDisc);
        Assert.DoesNotContain("infraSweden", aDisc);

        // Global Service Manager sees all three infra regions.
        var svc = As("svcmgr");
        var sDisc = (await svc.GetFromJsonAsync<JsonElement>("/api/v1/labor-rates")).GetProperty("disciplines").EnumerateArray().Select(x => x.GetString()).ToList();
        foreach (var d in new[] { "infraSweden", "infraApac", "infraCh" }) Assert.Contains(d, sDisc);

        // BLOG IT Manager sees only Dev · BLOG.
        var blog = As("blogit");
        var bDisc = (await blog.GetFromJsonAsync<JsonElement>("/api/v1/labor-rates")).GetProperty("disciplines").EnumerateArray().Select(x => x.GetString()).ToList();
        Assert.Contains("devBlog", bDisc);
        Assert.DoesNotContain("devSweden", bDisc);
        Assert.DoesNotContain("devApac", bDisc);
    }

    [Fact]
    public async Task Rate_card_cto_sees_every_region_line()
    {
        var cto = As("cto");
        var disc = (await cto.GetFromJsonAsync<JsonElement>("/api/v1/labor-rates")).GetProperty("disciplines").EnumerateArray().Select(x => x.GetString()).ToList();
        foreach (var d in new[] { "infraSweden", "infraApac", "infraCh", "devSweden", "devApac", "devBlog", "devCh", "architectSweden", "architectCh", "pmSweden", "pmCh", "poSweden", "poCh" })
            Assert.Contains(d, disc);
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
