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
    public async Task Project_gantt_returns_sprints_for_the_schedule_tab_including_undated()
    {
        // Proves the Project-timeline Schedule's data source (/projects/{id}/gantt)
        // surfaces a project's sprints — dated and (Jira-style) undated — so the
        // band renders whenever Sprint rows exist. If a real project's Schedule is
        // empty, the sprints aren't in the DB (run the Jira/ADO sync), not a render bug.
        var c = Admin();
        var spid = await Str(await c.PostAsJsonAsync("/api/v1/projects", new { name = "Sched sprints", startDate = "1 Mar 2026", target = "1 Sep 2026" }), "id");
        await c.PostAsJsonAsync($"/api/v1/projects/{spid}/sprints", new { name = "Sprint 1", startDate = "2026-03-10", endDate = "2026-03-24", status = "Active" });
        await c.PostAsJsonAsync($"/api/v1/projects/{spid}/sprints", new { name = "Sprint 2 (undated)", status = "Future" });

        var sg = await c.GetFromJsonAsync<JsonElement>($"/api/v1/projects/{spid}/gantt");
        var sprints = sg.GetProperty("sprints").EnumerateArray().ToList();
        Assert.Contains(sprints, s => s.GetProperty("name").GetString() == "Sprint 1" && !s.GetProperty("undated").GetBoolean());
        // Undated sprints are kept (flagged) via the window fallback, so past/
        // current/future sprints all show rather than being dropped.
        Assert.Contains(sprints, s => s.GetProperty("name").GetString() == "Sprint 2 (undated)" && s.GetProperty("undated").GetBoolean());
        // The dated sprint carries its real ISO dates so the client can place the
        // bar in its true calendar year (not just anchored month-of-year).
        var dated = sprints.Single(s => s.GetProperty("name").GetString() == "Sprint 1");
        Assert.Equal("2026-03-10", dated.GetProperty("startDate").GetString());
        Assert.Equal("2026-03-24", dated.GetProperty("endDate").GetString());
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
