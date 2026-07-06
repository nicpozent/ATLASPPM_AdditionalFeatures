using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace Atlas.Tests;

// Project completion % is derived from task state (weighted: Done 100 / In Review
// 70 / In Progress 40 / To Do·Blocked 0); a project with no tasks keeps its
// manually-entered Progress.
public class ProjectProgressTests : IClassFixture<AtlasApiFactory>
{
    readonly AtlasApiFactory _factory;
    public ProjectProgressTests(AtlasApiFactory factory) => _factory = factory;

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
    static async Task<int> TaskId(HttpResponseMessage res)
    {
        using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
        return doc.RootElement.GetProperty("id").GetInt32();
    }

    [Fact]
    public async Task Completion_is_weighted_across_task_states()
    {
        var c = Admin();
        var projId = await Id(await c.PostAsJsonAsync("/api/v1/projects", new { name = "Progress project" }));
        // 2 Done, 1 In Progress, 1 To Do → (1.0*2 + 0.4*1 + 0) / 4 = 0.60 → 60%.
        async Task Add(string name, string status)
        {
            var tid = await TaskId(await c.PostAsJsonAsync($"/api/v1/projects/{projId}/tasks", new { name }));
            await c.PatchAsJsonAsync($"/api/v1/tasks/{tid}", new { status });
        }
        await Add("a", "Done"); await Add("b", "Done"); await Add("c", "In Progress"); await Add("d", "To Do");

        var detail = await c.GetFromJsonAsync<JsonElement>($"/api/v1/projects/{projId}");
        Assert.Equal(60, detail.GetProperty("progress").GetInt32());
    }

    [Fact]
    public async Task Project_without_tasks_keeps_its_manual_progress()
    {
        var c = Admin();
        var projId = await Id(await c.PostAsJsonAsync("/api/v1/projects", new { name = "Manual progress project" }));
        await c.PatchAsJsonAsync($"/api/v1/projects/{projId}", new { progress = 35 });

        var detail = await c.GetFromJsonAsync<JsonElement>($"/api/v1/projects/{projId}");
        Assert.Equal(35, detail.GetProperty("progress").GetInt32());
    }
}
