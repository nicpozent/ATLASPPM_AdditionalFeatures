using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace Atlas.Tests;

// Program & portfolio timelines derive a schedule from projects, their sprints
// and (when undated) their phases/tasks — so timelines aren't empty just because
// nobody typed explicit project dates.
public class GanttTimelineTests : IClassFixture<AtlasApiFactory>
{
    readonly AtlasApiFactory _factory;
    public GanttTimelineTests(AtlasApiFactory factory) => _factory = factory;

    HttpClient Admin() { var c = _factory.CreateClient(); c.DefaultRequestHeaders.Add("X-Atlas-Role", "admin"); return c; }
    static async Task<string> Str(HttpResponseMessage r, string prop)
    {
        using var d = JsonDocument.Parse(await r.Content.ReadAsStringAsync());
        return d.RootElement.GetProperty(prop).GetString()!;
    }

    [Fact]
    public async Task Program_row_carries_project_window_and_sprints()
    {
        var c = Admin();
        var pid = await Str(await c.PostAsJsonAsync("/api/v1/projects", new { name = "PW project", startDate = "1 Feb 2026", target = "1 May 2026" }), "id");
        await c.PostAsJsonAsync($"/api/v1/projects/{pid}/sprints", new { name = "PI1 · S1", startDate = "2026-02-10", endDate = "2026-02-24", status = "Active" });
        var gid = await Str(await c.PostAsJsonAsync("/api/v1/programs", new { name = "PW program", projects = new[] { pid } }), "id");

        var g = await c.GetFromJsonAsync<JsonElement>($"/api/v1/programs/{gid}/gantt");
        var row = g.GetProperty("rows").EnumerateArray().First(r => r.GetProperty("projectId").GetString() == pid);
        Assert.Equal(1, row.GetProperty("startMonth").GetInt32());   // Feb
        Assert.Equal(4, row.GetProperty("endMonth").GetInt32());     // May
        Assert.Contains(row.GetProperty("sprints").EnumerateArray(), s => s.GetProperty("name").GetString() == "PI1 · S1");
    }

    [Fact]
    public async Task Portfolio_derives_an_undated_projects_window_from_its_phases()
    {
        var c = Admin();
        var pid = await Str(await c.PostAsJsonAsync("/api/v1/projects", new { name = "Undated project" }), "id");
        // No project dates — but a phase spanning Apr(3)–Jul(6) should still place it.
        await c.PostAsJsonAsync($"/api/v1/projects/{pid}/phases", new { name = "Build", startMonth = 3, endMonth = 6, progress = 20 });

        var pf = await c.GetFromJsonAsync<JsonElement>("/api/v1/portfolio/gantt");
        var item = pf.GetProperty("items").EnumerateArray().FirstOrDefault(x => x.GetProperty("id").GetString() == pid);
        Assert.Equal(JsonValueKind.Object, item.ValueKind);          // present despite no explicit dates
        Assert.Equal(3, item.GetProperty("startMonth").GetInt32());
        Assert.Equal(6, item.GetProperty("endMonth").GetInt32());
    }
}
