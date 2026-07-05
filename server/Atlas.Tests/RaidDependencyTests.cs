using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace Atlas.Tests;

// End-to-end tests for the RAID lifecycle (edit/delete, auto-item protection)
// and cross-project dependency link/unlink.
public class RaidDependencyTests : IClassFixture<AtlasApiFactory>
{
    readonly AtlasApiFactory _factory;
    public RaidDependencyTests(AtlasApiFactory factory) => _factory = factory;

    HttpClient Admin()
    {
        var c = _factory.CreateClient();
        c.DefaultRequestHeaders.Add("X-Atlas-Role", "admin");
        return c;
    }

    static async Task<string> ProjId(HttpResponseMessage res)
    {
        using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
        return doc.RootElement.GetProperty("id").GetString()!;
    }

    static async Task<int> IntId(HttpResponseMessage res)
    {
        using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
        return doc.RootElement.GetProperty("id").GetInt32();
    }

    [Fact]
    public async Task Raid_item_moves_along_its_lifecycle()
    {
        var c = Admin();
        var projId = await ProjId(await c.PostAsJsonAsync("/api/v1/projects", new { name = "RAID lifecycle project" }));
        var raidId = await IntId(await c.PostAsJsonAsync($"/api/v1/projects/{projId}/raid", new { type = "Risk", title = "Vendor slip", status = "Open" }));

        var patch = await c.PatchAsJsonAsync($"/api/v1/raid/{raidId}", new { status = "Mitigating", owner = "PMO" });
        Assert.Equal(HttpStatusCode.OK, patch.StatusCode);
        using var doc = JsonDocument.Parse(await patch.Content.ReadAsStringAsync());
        Assert.Equal("Mitigating", doc.RootElement.GetProperty("status").GetString());
        Assert.Equal("PMO", doc.RootElement.GetProperty("owner").GetString());

        Assert.Equal(HttpStatusCode.BadRequest, (await c.PatchAsJsonAsync($"/api/v1/raid/{raidId}", new { status = "Frozen" })).StatusCode);

        var del = await c.DeleteAsync($"/api/v1/raid/{raidId}");
        Assert.Equal(HttpStatusCode.NoContent, del.StatusCode);
    }

    [Fact]
    public async Task Editing_a_raid_item_needs_edit_rights()
    {
        var c = _factory.CreateClient();
        c.DefaultRequestHeaders.Add("X-Atlas-Role", "stakeholder");
        Assert.Equal(HttpStatusCode.Forbidden, (await c.PatchAsJsonAsync("/api/v1/raid/999", new { status = "Closed" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await c.DeleteAsync("/api/v1/raid/999")).StatusCode);
    }

    [Fact]
    public async Task Dependency_can_be_linked_and_unlinked()
    {
        var c = Admin();
        var a = await ProjId(await c.PostAsJsonAsync("/api/v1/projects", new { name = "Consumer" }));
        var b = await ProjId(await c.PostAsJsonAsync("/api/v1/projects", new { name = "Provider" }));

        var link = await c.PostAsJsonAsync($"/api/v1/projects/{a}/dependencies", new { dependsOnId = b });
        Assert.Equal(HttpStatusCode.Created, link.StatusCode);

        var listed = await c.GetFromJsonAsync<JsonElement>($"/api/v1/projects/{a}/dependencies");
        Assert.Contains(listed.GetProperty("dependsOn").EnumerateArray().Select(x => x.GetProperty("id").GetString()), x => x == b);

        var unlink = await c.DeleteAsync($"/api/v1/projects/{a}/dependencies/{b}");
        Assert.Equal(HttpStatusCode.NoContent, unlink.StatusCode);

        var after = await c.GetFromJsonAsync<JsonElement>($"/api/v1/projects/{a}/dependencies");
        Assert.Empty(after.GetProperty("dependsOn").EnumerateArray());
    }

    [Fact]
    public async Task Unlinking_an_unknown_dependency_is_not_found()
    {
        var c = Admin();
        var a = await ProjId(await c.PostAsJsonAsync("/api/v1/projects", new { name = "Lonely" }));
        Assert.Equal(HttpStatusCode.NotFound, (await c.DeleteAsync($"/api/v1/projects/{a}/dependencies/PRJ-nope")).StatusCode);
    }

    [Fact]
    public async Task Unlinking_a_dependency_needs_edit_rights()
    {
        var c = _factory.CreateClient();
        c.DefaultRequestHeaders.Add("X-Atlas-Role", "stakeholder");
        Assert.Equal(HttpStatusCode.Forbidden, (await c.DeleteAsync("/api/v1/projects/PRJ-1/dependencies/PRJ-2")).StatusCode);
    }
}
