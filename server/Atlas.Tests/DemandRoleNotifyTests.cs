using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace Atlas.Tests;

// Demands auto-notify portfolio leadership (PMO, Chief Architect, CTO, CIO, PM
// Lead) on create and status change — role-addressed, so anyone holding the role
// sees it in their inbox without subscribing to the demand.
public class DemandRoleNotifyTests : IClassFixture<AtlasApiFactory>
{
    readonly AtlasApiFactory _factory;
    public DemandRoleNotifyTests(AtlasApiFactory factory) => _factory = factory;

    HttpClient As(string role)
    {
        var c = _factory.CreateClient();
        c.DefaultRequestHeaders.Add("X-Atlas-Role", role);
        return c;
    }

    static async Task<int> Unread(HttpClient c)
    {
        var inbox = await c.GetFromJsonAsync<JsonElement>("/api/v1/notifications");
        return inbox.GetProperty("unreadCount").GetInt32();
    }

    [Fact]
    public async Task Creating_a_demand_notifies_leadership_roles()
    {
        var pm = As("pm");           // a PM creates the demand
        var before = await Unread(As("cto"));

        var res = await pm.PostAsJsonAsync("/api/v1/demands", new { title = "New ERP module", dept = "Finance" });
        Assert.Equal(System.Net.HttpStatusCode.Created, res.StatusCode);

        // CTO, PMO and Chief Architect each see a fresh notification about it.
        foreach (var role in new[] { "cto", "cio", "pmo", "architect", "pmlead" })
        {
            var inbox = await As(role).GetFromJsonAsync<JsonElement>("/api/v1/notifications");
            Assert.Contains(inbox.GetProperty("items").EnumerateArray(),
                n => n.GetProperty("title").GetString()!.Contains("New ERP module"));
        }
        Assert.True(await Unread(As("cto")) > before);

        // The PM who raised it is not self-notified via the role fan-out.
        var pmInbox = await pm.GetFromJsonAsync<JsonElement>("/api/v1/notifications");
        Assert.DoesNotContain(pmInbox.GetProperty("items").EnumerateArray(),
            n => n.GetProperty("title").GetString()!.Contains("New ERP module"));
    }

    [Fact]
    public async Task Advancing_a_demand_notifies_leadership_roles()
    {
        var admin = As("admin");
        var created = await admin.PostAsJsonAsync("/api/v1/demands", new { title = "Data lake POC", dept = "IT" });
        using var doc = JsonDocument.Parse(await created.Content.ReadAsStringAsync());
        var id = doc.RootElement.GetProperty("id").GetString();

        Assert.Equal(System.Net.HttpStatusCode.OK,
            (await admin.PatchAsJsonAsync($"/api/v1/demands/{id}", new { stage = "approved" })).StatusCode);

        var cio = await As("cio").GetFromJsonAsync<JsonElement>("/api/v1/notifications");
        Assert.Contains(cio.GetProperty("items").EnumerateArray(),
            n => n.GetProperty("title").GetString()!.Contains("Data lake POC") &&
                 n.GetProperty("title").GetString()!.Contains("approved"));
    }
}
