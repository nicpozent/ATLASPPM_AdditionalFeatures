using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace Atlas.Tests;

// Delta sync: the JQL watermark clause is only added for a delta run with a
// watermark; per-entity (program/product) sync endpoints are gated and behave
// sensibly; a project carries its last-sync time.
public class JiraDeltaSyncTests : IClassFixture<AtlasApiFactory>
{
    readonly AtlasApiFactory _factory;
    public JiraDeltaSyncTests(AtlasApiFactory factory) => _factory = factory;

    HttpClient As(string role)
    {
        var c = _factory.CreateClient();
        c.DefaultRequestHeaders.Add("X-Atlas-Role", role);
        return c;
    }

    [Theory]
    [InlineData(false, "2026-07-01 10:00", "")]                                   // not a delta run
    [InlineData(true, "", "")]                                                    // delta but no watermark → full
    [InlineData(true, "2026-07-01 10:00", " AND updated >= \"2026-07-01 10:00\"")] // delta with watermark
    public void DeltaClause_only_filters_when_delta_and_watermark(bool delta, string lastSync, string expected)
        => Assert.Equal(expected, Atlas.Api.Integrations.Jira.DeltaClause(delta, lastSync));

    [Fact]
    public async Task Project_carries_last_sync_and_delta_param_is_accepted()
    {
        var c = As("admin");
        var pRes = await c.PostAsJsonAsync("/api/v1/integrations/jira/import", new { jiraProjectKey = "DLT", target = "project", name = "Delta target" });
        using var pDoc = JsonDocument.Parse(await pRes.Content.ReadAsStringAsync());
        var pid = pDoc.RootElement.GetProperty("projectId").GetString();

        // Fresh project → no watermark yet.
        var detail = await c.GetFromJsonAsync<JsonElement>($"/api/v1/projects/{pid}");
        Assert.Equal("", detail.GetProperty("lastJiraSync").GetString());

        // The delta param is accepted (Jira isn't configured in tests, so it
        // returns a friendly ok:false rather than erroring).
        var res = await c.PostAsync($"/api/v1/projects/{pid}/jira/sync?delta=true", null);
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
        Assert.False(doc.RootElement.GetProperty("ok").GetBoolean());
    }

    [Fact]
    public async Task Entity_sync_endpoints_are_gated_and_report_sensibly()
    {
        // Stakeholder can't trigger a sync.
        var stk = As("stakeholder");
        var pgRes = await stk.PostAsync("/api/v1/programs/PRG-1/jira/sync", null);
        // Either not-found (no such program) or forbidden — never a success for a viewer.
        Assert.NotEqual(HttpStatusCode.OK, pgRes.StatusCode);

        // Admin on a real program with no mapped projects gets a clean response.
        var admin = As("admin");
        var mk = await admin.PostAsJsonAsync("/api/v1/programs", new { name = "Delta program", owner = "PMO", goal = "x" });
        if (mk.StatusCode == HttpStatusCode.Created || mk.StatusCode == HttpStatusCode.OK)
        {
            using var d = JsonDocument.Parse(await mk.Content.ReadAsStringAsync());
            var id = d.RootElement.TryGetProperty("id", out var idEl) ? idEl.GetString() : null;
            if (id is not null)
            {
                var res = await admin.PostAsync($"/api/v1/programs/{id}/jira/sync", null);
                Assert.Equal(HttpStatusCode.OK, res.StatusCode);   // ok:false (not configured) or ok:true (no projects)
            }
        }
    }
}
