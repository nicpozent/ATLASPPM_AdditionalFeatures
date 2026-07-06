using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace Atlas.Tests;

// End-to-end tests for the Epics overhaul: edit, delete, and multiple typed
// dependencies on other epics in the same project (resolved to names on read).
public class EpicTests : IClassFixture<AtlasApiFactory>
{
    readonly AtlasApiFactory _factory;
    public EpicTests(AtlasApiFactory factory) => _factory = factory;

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
    public async Task Epic_progress_aggregates_from_linked_tasks()
    {
        var c = Admin();
        var projId = await ProjId(await c.PostAsJsonAsync("/api/v1/projects", new { name = "Epic rollup project" }));
        // Manual epic with no stories; two tasks reference it, one Done.
        await c.PostAsJsonAsync($"/api/v1/projects/{projId}/epics", new { name = "Checkout", stories = 0, done = 0 });
        await c.PostAsJsonAsync($"/api/v1/projects/{projId}/tasks", new { name = "T1", epic = "Checkout", status = "Done" });
        await c.PostAsJsonAsync($"/api/v1/projects/{projId}/tasks", new { name = "T2", epic = "Checkout", status = "In Progress" });

        using var doc = JsonDocument.Parse(await (await c.GetAsync($"/api/v1/projects/{projId}/epics")).Content.ReadAsStringAsync());
        var e = doc.RootElement.GetProperty("epics")[0];
        Assert.Equal(2, e.GetProperty("stories").GetInt32());   // counted from tasks
        Assert.Equal(1, e.GetProperty("done").GetInt32());
        Assert.Equal(50, e.GetProperty("pct").GetInt32());
    }

    [Fact]
    public async Task Epic_can_be_edited()
    {
        var c = Admin();
        var projId = await ProjId(await c.PostAsJsonAsync("/api/v1/projects", new { name = "Epic edit project" }));
        var epicId = await IntId(await c.PostAsJsonAsync($"/api/v1/projects/{projId}/epics", new { name = "Checkout", stories = 10, done = 2 }));

        var patch = await c.PatchAsJsonAsync($"/api/v1/epics/{epicId}", new { name = "Checkout & Pay", stories = 12, done = 6, status = "In progress" });
        Assert.Equal(HttpStatusCode.OK, patch.StatusCode);
        using var doc = JsonDocument.Parse(await patch.Content.ReadAsStringAsync());
        var e = doc.RootElement;
        Assert.Equal("Checkout & Pay", e.GetProperty("name").GetString());
        Assert.Equal(12, e.GetProperty("stories").GetInt32());
        Assert.Equal(6, e.GetProperty("done").GetInt32());
        Assert.Equal(50, e.GetProperty("pct").GetInt32());
        Assert.Equal("In progress", e.GetProperty("status").GetString());
    }

    [Fact]
    public async Task Epic_supports_multiple_dependencies_resolved_to_names()
    {
        var c = Admin();
        var projId = await ProjId(await c.PostAsJsonAsync("/api/v1/projects", new { name = "Epic deps project" }));
        var a = await IntId(await c.PostAsJsonAsync($"/api/v1/projects/{projId}/epics", new { name = "Foundation" }));
        var b = await IntId(await c.PostAsJsonAsync($"/api/v1/projects/{projId}/epics", new { name = "Identity" }));
        var cId = await IntId(await c.PostAsJsonAsync($"/api/v1/projects/{projId}/epics", new { name = "Checkout", dependsOnIds = new[] { a, b } }));

        var listed = await c.GetFromJsonAsync<JsonElement>($"/api/v1/projects/{projId}/epics");
        var checkout = listed.GetProperty("epics").EnumerateArray().First(x => x.GetProperty("id").GetInt32() == cId);
        var depNames = checkout.GetProperty("deps").EnumerateArray().Select(d => d.GetProperty("name").GetString()).OrderBy(x => x).ToList();
        Assert.Equal(new[] { "Foundation", "Identity" }, depNames);
    }

    [Fact]
    public async Task Self_and_unknown_dependencies_are_filtered_out()
    {
        var c = Admin();
        var projId = await ProjId(await c.PostAsJsonAsync("/api/v1/projects", new { name = "Epic filter project" }));
        var a = await IntId(await c.PostAsJsonAsync($"/api/v1/projects/{projId}/epics", new { name = "Solo" }));

        // Depend on self + a non-existent id — both should be dropped.
        var patch = await c.PatchAsJsonAsync($"/api/v1/epics/{a}", new { dependsOnIds = new[] { a, 999999 } });
        Assert.Equal(HttpStatusCode.OK, patch.StatusCode);
        using var doc = JsonDocument.Parse(await patch.Content.ReadAsStringAsync());
        Assert.Empty(doc.RootElement.GetProperty("deps").EnumerateArray());
    }

    [Fact]
    public async Task Deleting_an_epic_clears_it_from_other_dependency_lists()
    {
        var c = Admin();
        var projId = await ProjId(await c.PostAsJsonAsync("/api/v1/projects", new { name = "Epic delete project" }));
        var a = await IntId(await c.PostAsJsonAsync($"/api/v1/projects/{projId}/epics", new { name = "Base" }));
        var b = await IntId(await c.PostAsJsonAsync($"/api/v1/projects/{projId}/epics", new { name = "Feature", dependsOnIds = new[] { a } }));

        var del = await c.DeleteAsync($"/api/v1/epics/{a}");
        Assert.Equal(HttpStatusCode.NoContent, del.StatusCode);

        var listed = await c.GetFromJsonAsync<JsonElement>($"/api/v1/projects/{projId}/epics");
        var feature = listed.GetProperty("epics").EnumerateArray().First(x => x.GetProperty("id").GetInt32() == b);
        Assert.Empty(feature.GetProperty("deps").EnumerateArray());
    }

    [Fact]
    public async Task Editing_an_epic_needs_project_edit_rights()
    {
        var c = _factory.CreateClient();
        c.DefaultRequestHeaders.Add("X-Atlas-Role", "stakeholder");
        Assert.Equal(HttpStatusCode.Forbidden, (await c.PatchAsJsonAsync("/api/v1/epics/999", new { name = "X" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await c.DeleteAsync("/api/v1/epics/999")).StatusCode);
    }
}
