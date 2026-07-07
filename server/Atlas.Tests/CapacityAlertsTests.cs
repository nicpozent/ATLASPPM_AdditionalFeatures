using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace Atlas.Tests;

// Over-allocation alerts: the periodic/manual pass emits an `over_allocation`
// notification for each newly over-allocated person to users who opted in, and
// de-dupes so a persistently-overloaded person isn't re-pinged every pass.
public class CapacityAlertsTests : IClassFixture<AtlasApiFactory>
{
    readonly AtlasApiFactory _factory;
    public CapacityAlertsTests(AtlasApiFactory factory) => _factory = factory;

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
    static int UnreadFor(JsonElement inbox, string namePart) =>
        inbox.GetProperty("items").EnumerateArray()
            .Count(n => n.GetProperty("eventType").GetString() == "over_allocation"
                        && (n.GetProperty("title").GetString() ?? "").Contains(namePart));

    [Fact]
    public async Task Alerts_notify_opted_in_users_once_per_new_over_allocation()
    {
        // PMO opts into over-allocation alerts (in-app).
        var pmo = As("pmo");
        var pref = await pmo.PatchAsJsonAsync("/api/v1/notifications/prefs/over_allocation", new { inApp = true, email = false });
        Assert.Equal(HttpStatusCode.NoContent, pref.StatusCode);

        // Admin creates a 130%-loaded person (70% project + 60% ops).
        var admin = As("admin");
        var pRes = await admin.PostAsJsonAsync("/api/v1/integrations/jira/import", new { jiraProjectKey = "CA1", target = "project", name = "CA target" });
        using var pDoc = JsonDocument.Parse(await pRes.Content.ReadAsStringAsync());
        var pid = pDoc.RootElement.GetProperty("projectId").GetString();
        await admin.PostAsJsonAsync($"/api/v1/teams/assignments/project/{pid}/individual", new { name = "Grace Hopper", alloc = 70 });
        var svcId = await IntId(await admin.PostAsJsonAsync("/api/v1/ops/services", new { name = "CA ops", category = "Support" }));
        await admin.PostAsJsonAsync($"/api/v1/ops/services/{svcId}/items", new { title = "BAU", assignee = "Grace Hopper", alloc = 60 });

        // First pass flags Grace.
        var run1Res = await admin.PostAsync("/api/v1/capacity/alerts/run", null);
        var run1Json = JsonDocument.Parse(await run1Res.Content.ReadAsStringAsync()).RootElement;
        Assert.Contains(run1Json.GetProperty("flagged").EnumerateArray(), x => x.GetString() == "Grace Hopper");

        // PMO's inbox has exactly one over-allocation notice for Grace.
        var inbox1 = await pmo.GetFromJsonAsync<JsonElement>("/api/v1/notifications");
        Assert.Equal(1, UnreadFor(inbox1, "Grace Hopper"));

        // Second pass: Grace is already flagged → no new notice.
        var run2Res = await admin.PostAsync("/api/v1/capacity/alerts/run", null);
        var run2Json = JsonDocument.Parse(await run2Res.Content.ReadAsStringAsync()).RootElement;
        Assert.DoesNotContain(run2Json.GetProperty("flagged").EnumerateArray(), x => x.GetString() == "Grace Hopper");

        var inbox2 = await pmo.GetFromJsonAsync<JsonElement>("/api/v1/notifications");
        Assert.Equal(1, UnreadFor(inbox2, "Grace Hopper")); // still just one — no duplicate
    }
}
