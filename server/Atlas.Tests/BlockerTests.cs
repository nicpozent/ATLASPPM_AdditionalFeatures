using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace Atlas.Tests;

// End-to-end tests for the blocker overhaul: description, expanded lifecycle
// statuses, full edit, delete, and the per-project listing.
public class BlockerTests : IClassFixture<AtlasApiFactory>
{
    readonly AtlasApiFactory _factory;
    public BlockerTests(AtlasApiFactory factory) => _factory = factory;

    HttpClient Admin()
    {
        var c = _factory.CreateClient();
        c.DefaultRequestHeaders.Add("X-Atlas-Role", "admin");
        return c;
    }

    static async Task<string> Id(HttpResponseMessage res)
    {
        using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
        return doc.RootElement.GetProperty("id").GetString()!;
    }

    [Fact]
    public async Task Blocker_is_created_with_a_description_and_fully_edited()
    {
        var c = Admin();
        var projId = await Id(await c.PostAsJsonAsync("/api/v1/projects", new { name = "Blocker project" }));
        var res = await c.PostAsJsonAsync("/api/v1/blockers", new { title = "Vendor delay", description = "Awaiting SDK", projectId = projId, owner = "PM" });
        Assert.Equal(HttpStatusCode.Created, res.StatusCode);
        var blkId = await Id(res);

        var patch = await c.PatchAsJsonAsync($"/api/v1/blockers/{blkId}", new { title = "Vendor SDK delay", description = "SDK 2.1 slipped", owner = "Eng lead", status = "In progress" });
        Assert.Equal(HttpStatusCode.OK, patch.StatusCode);
        using var pd = JsonDocument.Parse(await patch.Content.ReadAsStringAsync());
        Assert.Equal("Vendor SDK delay", pd.RootElement.GetProperty("title").GetString());
        Assert.Equal("SDK 2.1 slipped", pd.RootElement.GetProperty("description").GetString());
        Assert.Equal("In progress", pd.RootElement.GetProperty("status").GetString());
    }

    [Fact]
    public async Task Blocker_supports_cancelled_and_archived_states()
    {
        var c = Admin();
        var projId = await Id(await c.PostAsJsonAsync("/api/v1/projects", new { name = "Blocker states project" }));
        var blkId = await Id(await c.PostAsJsonAsync("/api/v1/blockers", new { title = "B", projectId = projId }));

        Assert.Equal(HttpStatusCode.OK, (await c.PatchAsJsonAsync($"/api/v1/blockers/{blkId}", new { status = "Cancelled" })).StatusCode);
        var arch = await c.PatchAsJsonAsync($"/api/v1/blockers/{blkId}", new { status = "Archived" });
        using var doc = JsonDocument.Parse(await arch.Content.ReadAsStringAsync());
        Assert.Equal("Archived", doc.RootElement.GetProperty("status").GetString());

        Assert.Equal(HttpStatusCode.BadRequest, (await c.PatchAsJsonAsync($"/api/v1/blockers/{blkId}", new { status = "Frozen" })).StatusCode);
    }

    [Fact]
    public async Task Per_project_blocker_listing_returns_only_that_projects_blockers()
    {
        var c = Admin();
        var a = await Id(await c.PostAsJsonAsync("/api/v1/projects", new { name = "Proj A" }));
        var b = await Id(await c.PostAsJsonAsync("/api/v1/projects", new { name = "Proj B" }));
        await c.PostAsJsonAsync("/api/v1/blockers", new { title = "A1", projectId = a });
        await c.PostAsJsonAsync("/api/v1/blockers", new { title = "B1", projectId = b });

        var listed = await c.GetFromJsonAsync<JsonElement>($"/api/v1/projects/{a}/blockers");
        var arr = listed.GetProperty("blockers").EnumerateArray().ToList();
        Assert.Single(arr);
        Assert.Equal("A1", arr[0].GetProperty("title").GetString());
        Assert.True(listed.GetProperty("canEdit").GetBoolean());
    }

    [Fact]
    public async Task Blocker_can_be_deleted()
    {
        var c = Admin();
        var projId = await Id(await c.PostAsJsonAsync("/api/v1/projects", new { name = "Blocker delete project" }));
        var blkId = await Id(await c.PostAsJsonAsync("/api/v1/blockers", new { title = "Temp", projectId = projId }));
        Assert.Equal(HttpStatusCode.NoContent, (await c.DeleteAsync($"/api/v1/blockers/{blkId}")).StatusCode);
        var listed = await c.GetFromJsonAsync<JsonElement>($"/api/v1/projects/{projId}/blockers");
        Assert.Empty(listed.GetProperty("blockers").EnumerateArray());
    }

    [Fact]
    public async Task Editing_and_deleting_a_blocker_needs_edit_rights()
    {
        var c = _factory.CreateClient();
        c.DefaultRequestHeaders.Add("X-Atlas-Role", "stakeholder");
        Assert.Equal(HttpStatusCode.Forbidden, (await c.PatchAsJsonAsync("/api/v1/blockers/BLK-1", new { status = "Resolved" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await c.DeleteAsync("/api/v1/blockers/BLK-1")).StatusCode);
    }
}
