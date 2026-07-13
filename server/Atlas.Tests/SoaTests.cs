using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace Atlas.Tests;

// Statement of Applicability (ISO 27001:2022 Annex A): the full catalogue always
// renders, decisions persist and roll up into coverage, and editing is gated by
// cap-approve. Hosts the real API on the in-memory DB (no role header ⇒ dev
// full-access identity).
public class SoaTests : IClassFixture<AtlasApiFactory>
{
    readonly AtlasApiFactory _factory;
    public SoaTests(AtlasApiFactory factory) => _factory = factory;

    async Task<HttpResponseMessage> Send(HttpMethod method, string path, object? body = null, string? role = null)
    {
        var client = _factory.CreateClient();
        var req = new HttpRequestMessage(method, path);
        if (role is not null) req.Headers.Add("X-Atlas-Role", role);
        if (body is not null) req.Content = JsonContent.Create(body);
        return await client.SendAsync(req);
    }
    static async Task<JsonElement> Json(HttpResponseMessage r) => await r.Content.ReadFromJsonAsync<JsonElement>();

    async Task<string> NewProject(string name) =>
        (await Json(await Send(HttpMethod.Post, "/api/v1/projects", new { name }))).GetProperty("id").GetString()!;

    [Fact]
    public async Task Soa_returns_the_full_annex_a_catalogue_with_baseline_coverage()
    {
        var id = await NewProject("SoA baseline");
        var soa = await Json(await Send(HttpMethod.Get, $"/api/v1/projects/{id}/soa"));

        Assert.True(soa.GetProperty("canEdit").GetBoolean());
        Assert.Equal(93, soa.GetProperty("controls").GetArrayLength());
        var cov = soa.GetProperty("coverage");
        Assert.Equal(93, cov.GetProperty("total").GetInt32());
        Assert.Equal(93, cov.GetProperty("applicable").GetInt32());   // baseline: all applicable
        Assert.Equal(0, cov.GetProperty("excluded").GetInt32());
        Assert.Equal(0, cov.GetProperty("implemented").GetInt32());
        Assert.Equal(0, cov.GetProperty("reviewed").GetInt32());
    }

    [Fact]
    public async Task Soa_decisions_persist_and_roll_up_into_coverage()
    {
        var id = await NewProject("SoA decisions");

        // Mark one control Implemented and exclude another with a reason.
        Assert.Equal(HttpStatusCode.OK,
            (await Send(HttpMethod.Put, $"/api/v1/projects/{id}/soa/A.8.28", new { status = "Implemented", owner = "AppSec" })).StatusCode);
        Assert.Equal(HttpStatusCode.OK,
            (await Send(HttpMethod.Put, $"/api/v1/projects/{id}/soa/A.7.1", new { applicable = false, justification = "No owned premises — cloud only." })).StatusCode);

        var cov = (await Json(await Send(HttpMethod.Get, $"/api/v1/projects/{id}/soa"))).GetProperty("coverage");
        Assert.Equal(92, cov.GetProperty("applicable").GetInt32());
        Assert.Equal(1, cov.GetProperty("excluded").GetInt32());
        Assert.Equal(1, cov.GetProperty("implemented").GetInt32());
        Assert.Equal(2, cov.GetProperty("reviewed").GetInt32());
    }

    [Fact]
    public async Task Soa_surfaces_platform_evidence_for_controls_atlas_implements()
    {
        var id = await NewProject("SoA evidence");
        var soa = await Json(await Send(HttpMethod.Get, $"/api/v1/projects/{id}/soa"));

        // The platform evidences a set of controls by construction (audit log, RBAC…).
        Assert.True(soa.GetProperty("coverage").GetProperty("autoEvidenced").GetInt32() >= 15);

        var logging = soa.GetProperty("controls").EnumerateArray().First(c => c.GetProperty("ref").GetString() == "A.8.15");
        Assert.Contains("audit log", logging.GetProperty("autoEvidence").GetString(), StringComparison.OrdinalIgnoreCase);

        // A control with no platform mechanism carries no auto-evidence.
        var physical = soa.GetProperty("controls").EnumerateArray().First(c => c.GetProperty("ref").GetString() == "A.7.1");
        Assert.Equal("", physical.GetProperty("autoEvidence").GetString());
    }

    [Fact]
    public async Task Soa_rejects_unknown_control_and_bad_status()
    {
        var id = await NewProject("SoA validation");
        Assert.Equal(HttpStatusCode.BadRequest,
            (await Send(HttpMethod.Put, $"/api/v1/projects/{id}/soa/A.9.99", new { status = "Implemented" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await Send(HttpMethod.Put, $"/api/v1/projects/{id}/soa/A.5.1", new { status = "Bogus" })).StatusCode);
    }

    [Fact]
    public async Task Soa_editing_requires_cap_approve()
    {
        var id = await NewProject("SoA gated");
        // A Stakeholder holds no cap-approve, so cannot record a decision.
        Assert.Equal(HttpStatusCode.Forbidden,
            (await Send(HttpMethod.Put, $"/api/v1/projects/{id}/soa/A.5.1", new { status = "Planned" }, role: "stkhldr")).StatusCode);
    }
}
