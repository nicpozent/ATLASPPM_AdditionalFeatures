using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace Atlas.Tests;

// Ops services can link existing project tasks (traceability) alongside manual
// items; the Jira-sync endpoint is graceful when Jira isn't configured.
public class OpsTaskLinkTests : IClassFixture<AtlasApiFactory>
{
    readonly AtlasApiFactory _factory;
    public OpsTaskLinkTests(AtlasApiFactory factory) => _factory = factory;

    HttpClient Admin() { var c = _factory.CreateClient(); c.DefaultRequestHeaders.Add("X-Atlas-Role", "admin"); return c; }
    static async Task<int> IntId(HttpResponseMessage r) { using var d = JsonDocument.Parse(await r.Content.ReadAsStringAsync()); return d.RootElement.GetProperty("id").GetInt32(); }
    static async Task<string> StrId(HttpResponseMessage r) { using var d = JsonDocument.Parse(await r.Content.ReadAsStringAsync()); return d.RootElement.GetProperty("id").GetString()!; }

    [Fact]
    public async Task Link_and_unlink_a_project_task_to_an_ops_service()
    {
        var c = Admin();
        var svcId = await IntId(await c.PostAsJsonAsync("/api/v1/ops/services", new { name = "Platform run", category = "Support" }));
        var pid = await StrId(await c.PostAsJsonAsync("/api/v1/projects", new { name = "Task source" }));
        var taskId = await IntId(await c.PostAsJsonAsync($"/api/v1/projects/{pid}/tasks", new { name = "Patch the gateway", assignee = "Grace Hopper", status = "In Progress" }));

        var link = await c.PostAsJsonAsync($"/api/v1/ops/services/{svcId}/tasks", new { taskId });
        Assert.Equal(HttpStatusCode.NoContent, link.StatusCode);

        // Board shows the linked task under the service.
        var board = await c.GetFromJsonAsync<JsonElement>("/api/v1/ops");
        var svc = board.GetProperty("services").EnumerateArray().First(s => s.GetProperty("id").GetInt32() == svcId);
        var linked = svc.GetProperty("linkedTasks").EnumerateArray().ToList();
        Assert.Contains(linked, t => t.GetProperty("taskId").GetInt32() == taskId && t.GetProperty("name").GetString() == "Patch the gateway");

        // Linking again is idempotent (no duplicate).
        await c.PostAsJsonAsync($"/api/v1/ops/services/{svcId}/tasks", new { taskId });
        var board2 = await c.GetFromJsonAsync<JsonElement>("/api/v1/ops");
        var svc2 = board2.GetProperty("services").EnumerateArray().First(s => s.GetProperty("id").GetInt32() == svcId);
        Assert.Single(svc2.GetProperty("linkedTasks").EnumerateArray().Where(t => t.GetProperty("taskId").GetInt32() == taskId));

        // Unlink.
        Assert.Equal(HttpStatusCode.NoContent, (await c.DeleteAsync($"/api/v1/ops/services/{svcId}/tasks/{taskId}")).StatusCode);
        var board3 = await c.GetFromJsonAsync<JsonElement>("/api/v1/ops");
        var svc3 = board3.GetProperty("services").EnumerateArray().First(s => s.GetProperty("id").GetInt32() == svcId);
        Assert.DoesNotContain(svc3.GetProperty("linkedTasks").EnumerateArray(), t => t.GetProperty("taskId").GetInt32() == taskId);
    }

    [Fact]
    public async Task Ops_service_jira_sync_is_graceful_when_unconfigured()
    {
        var c = Admin();
        var svcId = await IntId(await c.PostAsJsonAsync("/api/v1/ops/services", new { name = "Unmapped service", category = "Support" }));
        var res = await c.PostAsync($"/api/v1/ops/services/{svcId}/jira/sync", null);
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        using var d = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
        Assert.False(d.RootElement.GetProperty("ok").GetBoolean());   // not mapped / Jira not configured
    }
}
