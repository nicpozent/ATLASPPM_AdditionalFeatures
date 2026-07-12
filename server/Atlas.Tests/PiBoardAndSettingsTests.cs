using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace Atlas.Tests;

// End-to-end coverage for the surface added in #1/#2: the secret-redaction on
// GET /settings, the PI board placement roundtrip, and the Teams connector's
// masked status (the raw webhook URL must never come back). Hosts the real API
// on an in-memory DB via AtlasApiFactory; no role header ⇒ the dev full-access
// identity, so cap-schedule / cap-integrations writes are permitted.
public class PiBoardAndSettingsTests : IClassFixture<AtlasApiFactory>
{
    readonly AtlasApiFactory _factory;
    public PiBoardAndSettingsTests(AtlasApiFactory factory) => _factory = factory;

    async Task<HttpResponseMessage> Send(HttpMethod method, string path, object? body = null)
    {
        var client = _factory.CreateClient();
        var req = new HttpRequestMessage(method, path);
        if (body is not null) req.Content = JsonContent.Create(body);
        return await client.SendAsync(req);
    }

    static async Task<JsonElement> Json(HttpResponseMessage res) =>
        await res.Content.ReadFromJsonAsync<JsonElement>();

    // ---- GET /settings must not leak secret-valued keys ---------------------
    [Fact]
    public async Task Settings_redacts_secret_keys_but_returns_toggles()
    {
        // A non-secret toggle and a secret webhook URL, both stored the same way.
        Assert.Equal(HttpStatusCode.NoContent,
            (await Send(HttpMethod.Patch, "/api/v1/settings/integration.email", new { value = "true" })).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent,
            (await Send(HttpMethod.Patch, "/api/v1/settings/teams.webhookUrl", new { value = "https://prod.example.com/hooks/super-secret" })).StatusCode);

        var res = await Send(HttpMethod.Get, "/api/v1/settings");
        res.EnsureSuccessStatusCode();
        var map = await res.Content.ReadFromJsonAsync<Dictionary<string, string>>();

        Assert.NotNull(map);
        Assert.Equal("true", map!["integration.email"]);          // non-secret toggle returned
        Assert.False(map.ContainsKey("teams.webhookUrl"));         // secret redacted
        Assert.DoesNotContain("super-secret", await (await Send(HttpMethod.Get, "/api/v1/settings")).Content.ReadAsStringAsync());
    }

    // ---- PI board placement roundtrip --------------------------------------
    [Fact]
    public async Task Board_placement_roundtrips_and_unschedules()
    {
        var incId = (await Json(await Send(HttpMethod.Post, "/api/v1/increments", new { name = "PI 2026.1" }))).GetProperty("id").GetInt32();
        var objId = (await Json(await Send(HttpMethod.Post, $"/api/v1/increments/{incId}/objectives", new { title = "Ship checkout", entityType = "project", entityId = "PRJ-1" }))).GetProperty("id").GetInt32();
        var iterId = (await Json(await Send(HttpMethod.Post, $"/api/v1/increments/{incId}/iterations", new { name = "Iteration 1" }))).GetProperty("id").GetInt32();

        // Place the objective in the iteration → it appears in the placement map.
        Assert.Equal(HttpStatusCode.NoContent,
            (await Send(HttpMethod.Put, $"/api/v1/increments/{incId}/board/placement", new { objectiveId = objId, iterationId = iterId })).StatusCode);
        var placed = (await Json(await Send(HttpMethod.Get, $"/api/v1/increments/{incId}/board"))).GetProperty("placements");
        Assert.Equal(iterId, placed.GetProperty(objId.ToString()).GetInt32());

        // Clear it (iterationId null) → the objective drops out of the map.
        Assert.Equal(HttpStatusCode.NoContent,
            (await Send(HttpMethod.Put, $"/api/v1/increments/{incId}/board/placement", new { objectiveId = objId, iterationId = (int?)null })).StatusCode);
        var cleared = (await Json(await Send(HttpMethod.Get, $"/api/v1/increments/{incId}/board"))).GetProperty("placements");
        Assert.False(cleared.TryGetProperty(objId.ToString(), out _));
    }

    [Fact]
    public async Task Board_placement_rejects_objective_from_another_increment()
    {
        var incA = (await Json(await Send(HttpMethod.Post, "/api/v1/increments", new { name = "PI A" }))).GetProperty("id").GetInt32();
        var incB = (await Json(await Send(HttpMethod.Post, "/api/v1/increments", new { name = "PI B" }))).GetProperty("id").GetInt32();
        var objA = (await Json(await Send(HttpMethod.Post, $"/api/v1/increments/{incA}/objectives", new { title = "A obj" }))).GetProperty("id").GetInt32();
        var iterB = (await Json(await Send(HttpMethod.Post, $"/api/v1/increments/{incB}/iterations", new { name = "B-1" }))).GetProperty("id").GetInt32();

        // Placing incA's objective onto incB's board is a bad request, not a 500.
        var bad = await Send(HttpMethod.Put, $"/api/v1/increments/{incB}/board/placement", new { objectiveId = objA, iterationId = iterB });
        Assert.Equal(HttpStatusCode.BadRequest, bad.StatusCode);
    }

    // ---- Teams connector status masks the webhook, never returns it ---------
    [Fact]
    public async Task Teams_status_exposes_masked_host_not_the_secret_url()
    {
        var secret = "https://prod-12.westeurope.logic.azure.com/workflows/abc123/triggers/manual/paths/invoke?sig=TOKEN";
        Assert.Equal(HttpStatusCode.NoContent,
            (await Send(HttpMethod.Post, "/api/v1/integrations/teams/config", new { webhookUrl = secret, enabled = true })).StatusCode);

        var res = await Send(HttpMethod.Get, "/api/v1/integrations/teams/status");
        res.EnsureSuccessStatusCode();
        var raw = await res.Content.ReadAsStringAsync();
        var status = JsonDocument.Parse(raw).RootElement;

        Assert.True(status.GetProperty("configured").GetBoolean());
        Assert.True(status.GetProperty("enabled").GetBoolean());
        Assert.Equal("https://prod-12.westeurope.logic.azure.com", status.GetProperty("host").GetString());
        // The secret path/token must not appear anywhere in the response.
        Assert.DoesNotContain("workflows", raw);
        Assert.DoesNotContain("TOKEN", raw);
    }
}
