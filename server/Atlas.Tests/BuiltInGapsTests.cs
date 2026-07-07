using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace Atlas.Tests;

// The three "close built-in gaps": Ops allocation is time-phased, Resources
// by-project editing accepts hours+dates, and the Custom dashboard layout
// persists server-side per user.
public class BuiltInGapsTests : IClassFixture<AtlasApiFactory>
{
    readonly AtlasApiFactory _factory;
    public BuiltInGapsTests(AtlasApiFactory factory) => _factory = factory;

    HttpClient As(string role)
    {
        var c = _factory.CreateClient();
        c.DefaultRequestHeaders.Add("X-Atlas-Role", role);
        return c;
    }
    static async Task<int> IntId(HttpResponseMessage res)
    {
        using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
        return doc.RootElement.GetProperty("id").GetInt32();
    }

    [Fact]
    public async Task Ops_allocation_is_time_phased()
    {
        var c = As("admin");
        var svcId = await IntId(await c.PostAsJsonAsync("/api/v1/ops/services", new { name = "TP support", category = "Support" }));
        // A June-only ops item at 40% for Grace.
        await c.PostAsJsonAsync($"/api/v1/ops/services/{svcId}/items",
            new { title = "June cover", assignee = "Grace Hopper", alloc = 40, startDate = "2026-06-01", endDate = "2026-06-30" });

        // In-window → counts on her Ops%.
        var inWin = await c.GetFromJsonAsync<JsonElement>("/api/v1/resources?asOf=2026-06-15");
        Assert.Equal(40, inWin.EnumerateArray().First(r => r.GetProperty("name").GetString() == "Grace Hopper").GetProperty("opsPct").GetInt32());

        // Out-of-window → not counted (she drops off the roster entirely if she has no other load).
        var outWin = await c.GetFromJsonAsync<JsonElement>("/api/v1/resources?asOf=2026-08-01");
        Assert.DoesNotContain(outWin.EnumerateArray(), r => r.GetProperty("name").GetString() == "Grace Hopper");
    }

    [Fact]
    public async Task By_project_edit_accepts_hours_and_dates()
    {
        var c = As("admin");
        var pRes = await c.PostAsJsonAsync("/api/v1/integrations/jira/import", new { jiraProjectKey = "GAP", target = "project", name = "Gap target" });
        using var pDoc = JsonDocument.Parse(await pRes.Content.ReadAsStringAsync());
        var pid = pDoc.RootElement.GetProperty("projectId").GetString();
        await c.PostAsJsonAsync($"/api/v1/teams/assignments/project/{pid}/individual", new { name = "Ada Lovelace", alloc = 20 });

        // Find the member id from by-project.
        var byProj = await c.GetFromJsonAsync<JsonElement>("/api/v1/resources/by-project");
        var proj = byProj.EnumerateArray().First(p => p.GetProperty("id").GetString() == pid);
        var memberId = proj.GetProperty("members")[0].GetProperty("memberId").GetInt32();

        // Set 20 h/week + a window → 50% and the dates stick.
        var patch = await c.PatchAsJsonAsync($"/api/v1/resources/project-members/{memberId}",
            new { allocHours = 20, startDate = "2026-07-01", endDate = "2026-07-31" });
        Assert.Equal(HttpStatusCode.OK, patch.StatusCode);
        using var pd = JsonDocument.Parse(await patch.Content.ReadAsStringAsync());
        Assert.Equal(50, pd.RootElement.GetProperty("alloc").GetInt32());
        Assert.Equal(20, pd.RootElement.GetProperty("allocHours").GetInt32());
        Assert.Equal("2026-07-01", pd.RootElement.GetProperty("startDate").GetString());
    }

    [Fact]
    public async Task Custom_dashboard_layout_persists_per_user()
    {
        var c = As("pmo");
        // Empty by default.
        var empty = await c.GetFromJsonAsync<JsonElement>("/api/v1/dashboard/custom");
        Assert.Equal("", empty.GetProperty("widgets").GetString());

        // Save a layout, read it back.
        var layout = "[{\"uid\":\"w0\",\"key\":\"health\"}]";
        Assert.Equal(HttpStatusCode.OK, (await c.PutAsJsonAsync("/api/v1/dashboard/custom", new { widgets = layout })).StatusCode);
        var saved = await c.GetFromJsonAsync<JsonElement>("/api/v1/dashboard/custom");
        Assert.Equal(layout, saved.GetProperty("widgets").GetString());
    }
}
