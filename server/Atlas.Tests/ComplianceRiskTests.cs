using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace Atlas.Tests;

// The deterministic risk engine scores control implementation for ANY framework
// the project logs controls under (NIST CSF, SOC 2, NIS2, ISO 42001, …) — no
// bespoke rule per framework. These tests pin that generic coverage behaviour.
public class ComplianceRiskTests : IClassFixture<AtlasApiFactory>
{
    readonly AtlasApiFactory _factory;
    public ComplianceRiskTests(AtlasApiFactory factory) => _factory = factory;

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

    [Fact]
    public async Task Newly_logged_framework_control_raises_a_coverage_finding()
    {
        var c = Admin();
        var projId = await ProjId(await c.PostAsJsonAsync("/api/v1/projects", new { name = "NIST coverage project" }));

        // A logged-but-unimplemented NIST CSF control → deterministic coverage finding.
        await c.PostAsJsonAsync($"/api/v1/projects/{projId}/security/controls",
            new { control = "PR.AC-1 Identity management", framework = "NIST CSF 2.0", status = "Planned" });

        var findings = await Findings(c, projId);
        var nist = findings.FirstOrDefault(x => x.GetProperty("framework").GetString() == "NIST CSF 2.0");
        Assert.Equal(JsonValueKind.Object, nist.ValueKind);
        Assert.Equal("Compliance", nist.GetProperty("category").GetString());
    }

    [Fact]
    public async Task Fully_implemented_framework_produces_no_coverage_finding()
    {
        var c = Admin();
        var projId = await ProjId(await c.PostAsJsonAsync("/api/v1/projects", new { name = "SOC2 done project" }));
        var post = await c.PostAsJsonAsync($"/api/v1/projects/{projId}/security/controls",
            new { control = "CC6.1 Logical access", framework = "SOC 2", status = "Planned" });
        var ctlId = (await JsonDocument.ParseAsync(await post.Content.ReadAsStreamAsync())).RootElement.GetProperty("id").GetInt32();

        // Mark it Implemented — the coverage gap should clear.
        await c.PatchAsJsonAsync($"/api/v1/security/controls/{ctlId}", new { status = "Implemented" });

        var findings = await Findings(c, projId);
        Assert.DoesNotContain(findings, x => x.GetProperty("framework").GetString() == "SOC 2");
    }
}
