using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace Atlas.Tests;

// The Admin → Users & Groups directory view and its "Sync now" wiring. Graph is
// unconfigured in tests, so sync reports that gracefully rather than 500-ing.
public class TeamsDirectoryTests : IClassFixture<AtlasApiFactory>
{
    readonly AtlasApiFactory _factory;
    public TeamsDirectoryTests(AtlasApiFactory factory) => _factory = factory;

    HttpClient Admin()
    {
        var c = _factory.CreateClient();
        c.DefaultRequestHeaders.Add("X-Atlas-Role", "admin");
        return c;
    }

    [Fact]
    public async Task Directory_is_admin_gated_and_returns_a_user_list()
    {
        var c = Admin();
        var res = await c.GetAsync("/api/v1/teams/directory");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
        Assert.True(doc.RootElement.GetProperty("canManage").GetBoolean());
        Assert.Equal(JsonValueKind.Array, doc.RootElement.GetProperty("users").ValueKind);
    }

    [Fact]
    public async Task Directory_needs_users_roles_view()
    {
        var c = _factory.CreateClient();
        c.DefaultRequestHeaders.Add("X-Atlas-Role", "stakeholder");
        Assert.Equal(HttpStatusCode.Forbidden, (await c.GetAsync("/api/v1/teams/directory")).StatusCode);
    }

    [Fact]
    public async Task Sync_now_reports_gracefully_when_graph_is_not_configured()
    {
        var c = Admin();
        var res = await c.PostAsync("/api/v1/teams/groups/sync", null);
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
        Assert.False(doc.RootElement.GetProperty("configured").GetBoolean());
        Assert.False(string.IsNullOrEmpty(doc.RootElement.GetProperty("message").GetString()));
    }
}
