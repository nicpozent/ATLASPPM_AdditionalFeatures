using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace Atlas.Tests;

// A key result linked to a deliverable measures itself from that deliverable's
// advancement; unlinked KRs stay on their manual value.
public class OkrProgressTests : IClassFixture<AtlasApiFactory>
{
    readonly AtlasApiFactory _factory;
    public OkrProgressTests(AtlasApiFactory factory) => _factory = factory;

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

    static JsonElement Kr(JsonElement okrs, string objId) =>
        okrs.EnumerateArray().First(o => o.GetProperty("id").GetString() == objId).GetProperty("krs")[0];

    [Fact]
    public async Task Kr_linked_to_a_project_follows_the_project_progress()
    {
        var c = Admin();
        var projId = await Id(await c.PostAsJsonAsync("/api/v1/projects", new { name = "Measured project" }));
        await c.PatchAsJsonAsync($"/api/v1/projects/{projId}", new { progress = 72 });

        var objId = await Id(await c.PostAsJsonAsync("/api/v1/okrs", new { title = "Grow" }));
        await c.PostAsJsonAsync($"/api/v1/okrs/{objId}/krs", new { title = "Ship it", linkType = "project", linkId = projId, progress = 5 });

        var okrs = await c.GetFromJsonAsync<JsonElement>("/api/v1/okrs");
        var kr = Kr(okrs, objId);
        Assert.Equal(72, kr.GetProperty("progress").GetInt32());   // derived, not the manual 5
        Assert.True(kr.GetProperty("auto").GetBoolean());
    }

    [Fact]
    public async Task Kr_linked_to_a_program_averages_its_projects()
    {
        var c = Admin();
        var p1 = await Id(await c.PostAsJsonAsync("/api/v1/projects", new { name = "P1" }));
        var p2 = await Id(await c.PostAsJsonAsync("/api/v1/projects", new { name = "P2" }));
        await c.PatchAsJsonAsync($"/api/v1/projects/{p1}", new { progress = 40 });
        await c.PatchAsJsonAsync($"/api/v1/projects/{p2}", new { progress = 80 });
        var progId = await Id(await c.PostAsJsonAsync("/api/v1/programs", new { name = "Prog", owner = "O", goal = "G" }));
        await c.PatchAsJsonAsync($"/api/v1/programs/{progId}", new { projects = new[] { p1, p2 } });

        var objId = await Id(await c.PostAsJsonAsync("/api/v1/okrs", new { title = "Program objective" }));
        await c.PostAsJsonAsync($"/api/v1/okrs/{objId}/krs", new { title = "KR", linkType = "program", linkId = progId });

        var okrs = await c.GetFromJsonAsync<JsonElement>("/api/v1/okrs");
        Assert.Equal(60, Kr(okrs, objId).GetProperty("progress").GetInt32());   // (40 + 80) / 2
    }

    [Fact]
    public async Task Unlinked_kr_keeps_its_manual_progress()
    {
        var c = Admin();
        var objId = await Id(await c.PostAsJsonAsync("/api/v1/okrs", new { title = "Manual objective" }));
        await c.PostAsJsonAsync($"/api/v1/okrs/{objId}/krs", new { title = "Manual KR", progress = 33 });

        var okrs = await c.GetFromJsonAsync<JsonElement>("/api/v1/okrs");
        var kr = Kr(okrs, objId);
        Assert.Equal(33, kr.GetProperty("progress").GetInt32());
        Assert.False(kr.GetProperty("auto").GetBoolean());
    }
}
