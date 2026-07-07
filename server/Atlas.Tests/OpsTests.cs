using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace Atlas.Tests;

// Ops module: services + work items, the edit gate, project-impact surfacing,
// and the roll-up of ops allocation into a person's Ops% on Resources.
public class OpsTests : IClassFixture<AtlasApiFactory>
{
    readonly AtlasApiFactory _factory;
    public OpsTests(AtlasApiFactory factory) => _factory = factory;

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
    public async Task Service_and_item_crud_with_impact_and_ops_rollup()
    {
        var c = As("admin");

        // A project to tag impact against.
        var pRes = await c.PostAsJsonAsync("/api/v1/integrations/jira/import", new { jiraProjectKey = "OPSX", target = "project", name = "Ops impact target" });
        using var pDoc = JsonDocument.Parse(await pRes.Content.ReadAsStringAsync());
        var projectId = pDoc.RootElement.GetProperty("projectId").GetString();

        // Create a service, then a work item allocated to a person and impacting the project.
        var svcId = await IntId(await c.PostAsJsonAsync("/api/v1/ops/services", new { name = "Payments support", category = "Support" }));
        var itemRes = await c.PostAsJsonAsync($"/api/v1/ops/services/{svcId}/items",
            new { title = "On-call rotation", type = "Monitoring", priority = "High", assignee = "Ada Lovelace", alloc = 30, impactProjectId = projectId, impactNote = "pulls a dev off delivery" });
        Assert.Equal(HttpStatusCode.Created, itemRes.StatusCode);
        var itemId = await IntId(itemRes);

        // Board shows the service, its active count and allocation, and summary counts.
        var board = await c.GetFromJsonAsync<JsonElement>("/api/v1/ops");
        Assert.True(board.GetProperty("canEdit").GetBoolean());
        var svc = board.GetProperty("services").EnumerateArray().First(s => s.GetProperty("id").GetInt32() == svcId);
        Assert.Equal(1, svc.GetProperty("activeCount").GetInt32());
        Assert.Equal(30, svc.GetProperty("alloc").GetInt32());
        Assert.True(board.GetProperty("summary").GetProperty("impactedProjects").GetInt32() >= 1);

        // Project-impact endpoint surfaces the item and totals its allocation.
        var impact = await c.GetFromJsonAsync<JsonElement>($"/api/v1/projects/{projectId}/ops-impact");
        Assert.Equal(30, impact.GetProperty("alloc").GetInt32());
        Assert.Contains(impact.GetProperty("items").EnumerateArray(), i => i.GetProperty("title").GetString() == "On-call rotation");

        // Ops allocation rolls into the person's Ops% on Resources.
        var resources = await c.GetFromJsonAsync<JsonElement>("/api/v1/resources");
        var ada = resources.EnumerateArray().First(r => r.GetProperty("name").GetString() == "Ada Lovelace");
        Assert.Equal(30, ada.GetProperty("opsPct").GetInt32());

        // Marking the item Done drops it from active load and from Ops%.
        Assert.Equal(HttpStatusCode.OK, (await c.PatchAsJsonAsync($"/api/v1/ops/items/{itemId}", new { status = "Done" })).StatusCode);
        var impact2 = await c.GetFromJsonAsync<JsonElement>($"/api/v1/projects/{projectId}/ops-impact");
        Assert.Equal(0, impact2.GetProperty("alloc").GetInt32());

        // Deleting the service removes its items too.
        Assert.Equal(HttpStatusCode.NoContent, (await c.DeleteAsync($"/api/v1/ops/services/{svcId}")).StatusCode);
        var board2 = await c.GetFromJsonAsync<JsonElement>("/api/v1/ops");
        Assert.DoesNotContain(board2.GetProperty("services").EnumerateArray(), s => s.GetProperty("id").GetInt32() == svcId);
    }

    [Fact]
    public async Task Editing_ops_needs_the_ops_capability()
    {
        // Reading is open; creating is gated on cap-ops Edit (stakeholder lacks it).
        var stk = As("stakeholder");
        Assert.Equal(HttpStatusCode.OK, (await stk.GetAsync("/api/v1/ops")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await stk.PostAsJsonAsync("/api/v1/ops/services", new { name = "X" })).StatusCode);
    }

    [Fact]
    public async Task Board_reports_can_edit_false_for_viewers()
    {
        var stk = As("stakeholder");
        var board = await stk.GetFromJsonAsync<JsonElement>("/api/v1/ops");
        Assert.False(board.GetProperty("canEdit").GetBoolean());
    }

    [Fact]
    public async Task Archiving_hides_a_service_from_the_board_unless_included()
    {
        var c = As("admin");
        var svcId = await IntId(await c.PostAsJsonAsync("/api/v1/ops/services", new { name = "To archive", category = "Support" }));

        Assert.Equal(HttpStatusCode.OK, (await c.PostAsync($"/api/v1/ops/services/{svcId}/archive?on=true", null)).StatusCode);

        // Hidden by default…
        var board = await c.GetFromJsonAsync<JsonElement>("/api/v1/ops");
        Assert.DoesNotContain(board.GetProperty("services").EnumerateArray(), s => s.GetProperty("id").GetInt32() == svcId);
        // …but visible with includeArchived, flagged archived.
        var withArch = await c.GetFromJsonAsync<JsonElement>("/api/v1/ops?includeArchived=true");
        var svc = withArch.GetProperty("services").EnumerateArray().First(s => s.GetProperty("id").GetInt32() == svcId);
        Assert.True(svc.GetProperty("archived").GetBoolean());

        // Restore brings it back.
        Assert.Equal(HttpStatusCode.OK, (await c.PostAsync($"/api/v1/ops/services/{svcId}/archive?on=false", null)).StatusCode);
        var board2 = await c.GetFromJsonAsync<JsonElement>("/api/v1/ops");
        Assert.Contains(board2.GetProperty("services").EnumerateArray(), s => s.GetProperty("id").GetInt32() == svcId);
    }

    [Fact]
    public async Task Importing_to_ops_needs_the_ops_capability()
    {
        // A stakeholder can't import to Ops (needs cap-ops Edit); this fails on the
        // gate before any Jira call.
        var stk = As("stakeholder");
        var res = await stk.PostAsJsonAsync("/api/v1/integrations/jira/import", new { jiraProjectKey = "OPSIMP", target = "ops" });
        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);

        // Admin passes the gate; Jira isn't configured in tests, so it returns a
        // friendly ok:false rather than erroring.
        var admin = As("admin");
        var ok = await admin.PostAsJsonAsync("/api/v1/integrations/jira/import", new { jiraProjectKey = "OPSIMP", target = "ops" });
        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
        using var doc = JsonDocument.Parse(await ok.Content.ReadAsStringAsync());
        Assert.False(doc.RootElement.GetProperty("ok").GetBoolean());
    }
}
