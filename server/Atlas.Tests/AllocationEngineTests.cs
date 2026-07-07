using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace Atlas.Tests;

// Task estimate-hours roll into a person's PROJECT allocation (max of planned vs
// task load per project) and surface on Resources + capacity; the assignee
// dropdown is populated even with no sub-team attached.
public class AllocationEngineTests : IClassFixture<AtlasApiFactory>
{
    readonly AtlasApiFactory _factory;
    public AllocationEngineTests(AtlasApiFactory factory) => _factory = factory;

    HttpClient Admin()
    {
        var c = _factory.CreateClient();
        c.DefaultRequestHeaders.Add("X-Atlas-Role", "admin");
        return c;
    }
    static async Task<string> NewProject(HttpClient c, string key, string name)
    {
        var res = await c.PostAsJsonAsync("/api/v1/integrations/jira/import", new { jiraProjectKey = key, target = "project", name });
        using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
        return doc.RootElement.GetProperty("projectId").GetString()!;
    }
    static async Task<JsonElement> Person(HttpClient c, string name)
    {
        var rows = await c.GetFromJsonAsync<JsonElement>("/api/v1/resources");
        return rows.EnumerateArray().First(r => r.GetProperty("name").GetString() == name);
    }

    [Fact]
    public async Task Task_estimate_hours_roll_into_project_allocation_and_resources()
    {
        var c = Admin();
        var pid = await NewProject(c, "ALLOCA", "Alloc engine A");

        // A task estimated at 40h over a one-week window ⇒ 40h/week ⇒ 100%.
        var body = new
        {
            name = "Big spike", assignee = "Grace Hopper", status = "In Progress",
            startDate = "2026-07-06", targetDate = "2026-07-10", estimateHours = 40,
        };
        Assert.Equal(HttpStatusCode.Created, (await c.PostAsJsonAsync($"/api/v1/projects/{pid}/tasks", body)).StatusCode);

        // Grace appears on Resources with a project load from the task alone
        // (she has no team-assignment %), as-of a day inside the task window.
        var rows = await c.GetFromJsonAsync<JsonElement>("/api/v1/resources?asOf=2026-07-08");
        var grace = rows.EnumerateArray().First(r => r.GetProperty("name").GetString() == "Grace Hopper");
        Assert.Equal(100, grace.GetProperty("projectPct").GetInt32());

        // The project's capacity panel counts her too.
        var cap = await c.GetFromJsonAsync<JsonElement>($"/api/v1/projects/{pid}/capacity");
        Assert.Contains(cap.GetProperty("people").EnumerateArray(), r => r.GetProperty("name").GetString() == "Grace Hopper");
    }

    [Fact]
    public async Task Planned_and_task_load_take_the_higher_per_project_not_the_sum()
    {
        var c = Admin();
        var pid = await NewProject(c, "ALLOCB", "Alloc engine B");

        // Plan the person at 50% on the project…
        await c.PostAsJsonAsync($"/api/v1/teams/assignments/project/{pid}/individual",
            new { name = "Katherine Johnson", alloc = 50, title = "Engineer" });
        // …and give them a 20h/2-week task ⇒ 10h/week ⇒ 25% task load. Max(50,25)=50.
        await c.PostAsJsonAsync($"/api/v1/projects/{pid}/tasks",
            new { name = "Small task", assignee = "Katherine Johnson", status = "To Do", startDate = "2026-07-01", targetDate = "2026-07-14", estimateHours = 20 });

        var k = await Person(c, "Katherine Johnson");
        // 50 (planned) not 75 (planned+task): the two never double-count.
        Assert.Equal(50, k.GetProperty("projectPct").GetInt32());
    }

    [Fact]
    public async Task Done_tasks_do_not_consume_allocation()
    {
        var c = Admin();
        var pid = await NewProject(c, "ALLOCC", "Alloc engine C");
        await c.PostAsJsonAsync($"/api/v1/projects/{pid}/tasks",
            new { name = "Finished", assignee = "Annie Easley", status = "Done", startDate = "2026-07-06", targetDate = "2026-07-10", estimateHours = 40 });

        var rows = await c.GetFromJsonAsync<JsonElement>("/api/v1/resources?asOf=2026-07-08");
        Assert.DoesNotContain(rows.EnumerateArray(), r => r.GetProperty("name").GetString() == "Annie Easley");
    }

    [Fact]
    public async Task Assignee_options_are_populated_even_without_an_attached_subteam()
    {
        var c = Admin();
        var pid = await NewProject(c, "ALLOCD", "Alloc engine D");
        // No sub-team attached. Assign an individual — they should be offered.
        await c.PostAsJsonAsync($"/api/v1/teams/assignments/project/{pid}/individual",
            new { name = "Mary Jackson", alloc = 30, title = "Engineer" });

        var opts = await c.GetFromJsonAsync<List<string>>($"/api/v1/projects/{pid}/assignee-options");
        Assert.NotNull(opts);
        Assert.Contains("Mary Jackson", opts!);
    }
}
