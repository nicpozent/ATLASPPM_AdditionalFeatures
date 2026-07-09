using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace Atlas.Tests;

// EU AI Act risk-tiering + ISO 42001 obligations are derived deterministically
// from the security profile (ADR-0050). These pin the tier → obligation mapping.
public class AiActRiskTests : IClassFixture<AtlasApiFactory>
{
    readonly AtlasApiFactory _factory;
    public AiActRiskTests(AtlasApiFactory factory) => _factory = factory;

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

    static async Task<List<JsonElement>> Findings(HttpClient c, string projId)
    {
        var report = await c.GetFromJsonAsync<JsonElement>($"/api/v1/projects/{projId}/risks");
        return report.GetProperty("findings").EnumerateArray().ToList();
    }

    static bool Has(List<JsonElement> f, string titleContains) =>
        f.Any(x => x.GetProperty("title").GetString()!.Contains(titleContains));

    [Fact]
    public async Task Ai_in_scope_but_unclassified_is_flagged()
    {
        var c = Admin();
        var projId = await ProjId(await c.PostAsJsonAsync("/api/v1/projects", new { name = "AI unclassified" }));
        await c.PatchAsJsonAsync($"/api/v1/projects/{projId}/security", new { aiAct = true });
        Assert.True(Has(await Findings(c, projId), "not risk-classified"));
    }

    [Fact]
    public async Task High_risk_without_human_oversight_raises_art14()
    {
        var c = Admin();
        var projId = await ProjId(await c.PostAsJsonAsync("/api/v1/projects", new { name = "AI high risk" }));
        await c.PatchAsJsonAsync($"/api/v1/projects/{projId}/security", new { aiAct = true, aiRiskTier = "high" });
        var f = await Findings(c, projId);
        Assert.True(Has(f, "without human oversight"));
        Assert.True(Has(f, "management controls incomplete"));
    }

    [Fact]
    public async Task Prohibited_tier_is_high_severity()
    {
        var c = Admin();
        var projId = await ProjId(await c.PostAsJsonAsync("/api/v1/projects", new { name = "AI prohibited" }));
        await c.PatchAsJsonAsync($"/api/v1/projects/{projId}/security", new { aiAct = true, aiRiskTier = "prohibited" });
        var f = await Findings(c, projId);
        var prohibited = f.FirstOrDefault(x => x.GetProperty("title").GetString()!.Contains("Prohibited"));
        Assert.Equal(JsonValueKind.Object, prohibited.ValueKind);
        Assert.Equal("High", prohibited.GetProperty("severity").GetString());
    }

    [Fact]
    public async Task High_risk_with_oversight_and_implemented_control_clears_obligations()
    {
        var c = Admin();
        var projId = await ProjId(await c.PostAsJsonAsync("/api/v1/projects", new { name = "AI high compliant" }));
        await c.PatchAsJsonAsync($"/api/v1/projects/{projId}/security", new { aiAct = true, aiRiskTier = "high", aiHumanOversight = true });
        await c.PostAsJsonAsync($"/api/v1/projects/{projId}/security/controls",
            new { control = "AI risk-management system", framework = "ISO 42001", status = "Implemented" });
        var f = await Findings(c, projId);
        Assert.False(Has(f, "without human oversight"));
        Assert.False(Has(f, "management controls incomplete"));
    }

    [Fact]
    public async Task Invalid_tier_is_rejected_by_patch()
    {
        var c = Admin();
        var projId = await ProjId(await c.PostAsJsonAsync("/api/v1/projects", new { name = "AI bad tier" }));
        await c.PatchAsJsonAsync($"/api/v1/projects/{projId}/security", new { aiRiskTier = "nonsense" });
        var sec = await c.GetFromJsonAsync<JsonElement>($"/api/v1/projects/{projId}/security");
        // Rejected value is ignored → tier stays empty (unclassified).
        Assert.Equal("", sec.GetProperty("profile").GetProperty("aiRiskTier").GetString());
    }
}
