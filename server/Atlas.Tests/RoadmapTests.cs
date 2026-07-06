using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace Atlas.Tests;

// Roadmap module: initiative CRUD across the Now/Next/Later lanes, milestones,
// dependencies, cross-entity links, and the edit gate (cap-roadmap).
public class RoadmapTests : IClassFixture<AtlasApiFactory>
{
    readonly AtlasApiFactory _factory;
    public RoadmapTests(AtlasApiFactory factory) => _factory = factory;

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
    public async Task Item_crud_with_milestones_dependencies_and_links()
    {
        var c = As("admin");

        // A project to link the initiative to.
        var pRes = await c.PostAsJsonAsync("/api/v1/integrations/jira/import", new { jiraProjectKey = "RMX", target = "project", name = "Roadmap link target" });
        using var pDoc = JsonDocument.Parse(await pRes.Content.ReadAsStringAsync());
        var projectId = pDoc.RootElement.GetProperty("projectId").GetString();

        // A predecessor initiative for the dependency.
        var baseId = await IntId(await c.PostAsJsonAsync("/api/v1/roadmap", new { title = "Platform foundations", lane = "Now" }));

        // A richer initiative: Next lane, dates, confidence/effort/value, a
        // milestone, a project link, and a dependency on the predecessor.
        var createRes = await c.PostAsJsonAsync("/api/v1/roadmap", new
        {
            title = "Unified checkout",
            description = "One checkout across all markets",
            lane = "Next",
            status = "Committed",
            theme = "Customer experience",
            owner = "Karin Sandberg",
            startDate = "2026-09-01",
            endDate = "2026-12-15",
            confidence = 70,
            effort = 4,
            value = 5,
            milestones = new[] { new { title = "MVP live", date = "2026-10-01", done = false } },
            links = new[] { new { entityType = "project", entityId = projectId } },
            dependsOn = new[] { baseId },
        });
        Assert.Equal(HttpStatusCode.Created, createRes.StatusCode);
        var itemId = await IntId(createRes);

        // Board reflects it all.
        var board = await c.GetFromJsonAsync<JsonElement>("/api/v1/roadmap");
        Assert.True(board.GetProperty("canEdit").GetBoolean());
        Assert.Contains("Customer experience", board.GetProperty("themes").EnumerateArray().Select(t => t.GetString()));

        var item = board.GetProperty("items").EnumerateArray().First(i => i.GetProperty("id").GetInt32() == itemId);
        Assert.Equal("Next", item.GetProperty("lane").GetString());
        Assert.Equal("Committed", item.GetProperty("status").GetString());
        Assert.Equal(70, item.GetProperty("confidence").GetInt32());
        Assert.StartsWith("RM-", item.GetProperty("ref").GetString());
        Assert.Single(item.GetProperty("milestones").EnumerateArray());
        Assert.Single(item.GetProperty("links").EnumerateArray());
        Assert.Equal("project", item.GetProperty("links")[0].GetProperty("entityType").GetString());
        Assert.Contains(baseId, item.GetProperty("dependsOn").EnumerateArray().Select(x => x.GetInt32()));

        // The predecessor sees the reverse edge ("blocks").
        var predecessor = board.GetProperty("items").EnumerateArray().First(i => i.GetProperty("id").GetInt32() == baseId);
        Assert.Contains(itemId, predecessor.GetProperty("blocks").EnumerateArray().Select(x => x.GetInt32()));

        // Move it to a different lane and complete its milestone via PATCH.
        var patchRes = await c.PatchAsJsonAsync($"/api/v1/roadmap/{itemId}", new
        {
            lane = "Now",
            milestones = new[] { new { title = "MVP live", date = "2026-10-01", done = true } },
        });
        Assert.Equal(HttpStatusCode.OK, patchRes.StatusCode);
        var board2 = await c.GetFromJsonAsync<JsonElement>("/api/v1/roadmap");
        var moved = board2.GetProperty("items").EnumerateArray().First(i => i.GetProperty("id").GetInt32() == itemId);
        Assert.Equal("Now", moved.GetProperty("lane").GetString());
        Assert.True(moved.GetProperty("milestones")[0].GetProperty("done").GetBoolean());

        // Deleting the predecessor clears the dependency edge on the survivor.
        Assert.Equal(HttpStatusCode.NoContent, (await c.DeleteAsync($"/api/v1/roadmap/{baseId}")).StatusCode);
        var board3 = await c.GetFromJsonAsync<JsonElement>("/api/v1/roadmap");
        Assert.DoesNotContain(board3.GetProperty("items").EnumerateArray(), i => i.GetProperty("id").GetInt32() == baseId);
        var survivor = board3.GetProperty("items").EnumerateArray().First(i => i.GetProperty("id").GetInt32() == itemId);
        Assert.Empty(survivor.GetProperty("dependsOn").EnumerateArray());
    }

    [Fact]
    public async Task Phantom_links_and_self_dependencies_are_dropped()
    {
        var c = As("admin");
        var id = await IntId(await c.PostAsJsonAsync("/api/v1/roadmap", new
        {
            title = "Guarded initiative",
            links = new[] { new { entityType = "project", entityId = "does-not-exist" } },
        }));
        // A self-dependency and the phantom link should both be rejected silently.
        await c.PatchAsJsonAsync($"/api/v1/roadmap/{id}", new { dependsOn = new[] { id } });
        var board = await c.GetFromJsonAsync<JsonElement>("/api/v1/roadmap");
        var item = board.GetProperty("items").EnumerateArray().First(i => i.GetProperty("id").GetInt32() == id);
        Assert.Empty(item.GetProperty("links").EnumerateArray());
        Assert.Empty(item.GetProperty("dependsOn").EnumerateArray());
    }

    [Fact]
    public async Task Editing_roadmap_needs_the_roadmap_capability()
    {
        var stk = As("stakeholder");
        Assert.Equal(HttpStatusCode.OK, (await stk.GetAsync("/api/v1/roadmap")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await stk.PostAsJsonAsync("/api/v1/roadmap", new { title = "Nope" })).StatusCode);

        var board = await stk.GetFromJsonAsync<JsonElement>("/api/v1/roadmap");
        Assert.False(board.GetProperty("canEdit").GetBoolean());
    }
}
