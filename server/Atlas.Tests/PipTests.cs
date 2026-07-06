using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace Atlas.Tests;

// End-to-end tests for Program Increment Planning: creating an increment, adding
// objectives/iterations/dependencies, name resolution for linked deliverables,
// validation, and the schedule-edit permission gate.
public class PipTests : IClassFixture<AtlasApiFactory>
{
    readonly AtlasApiFactory _factory;
    public PipTests(AtlasApiFactory factory) => _factory = factory;

    HttpClient Admin()
    {
        var c = _factory.CreateClient();
        c.DefaultRequestHeaders.Add("X-Atlas-Role", "admin");
        return c;
    }

    static async Task<int> IntId(HttpResponseMessage res)
    {
        using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
        return doc.RootElement.GetProperty("id").GetInt32();
    }
    static async Task<string> StrId(HttpResponseMessage res)
    {
        using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
        return doc.RootElement.GetProperty("id").GetString()!;
    }

    [Fact]
    public async Task Increment_is_created_and_listed()
    {
        var c = Admin();
        var res = await c.PostAsJsonAsync("/api/v1/increments", new { key = "2026-Q3", name = "PI 2026.3", startDate = "2026-07-01", endDate = "2026-09-30", state = "Active" });
        Assert.Equal(HttpStatusCode.Created, res.StatusCode);

        var list = await c.GetFromJsonAsync<JsonElement>("/api/v1/increments");
        var names = list.GetProperty("increments").EnumerateArray().Select(i => i.GetProperty("name").GetString()).ToList();
        Assert.Contains("PI 2026.3", names);
    }

    [Fact]
    public async Task Objective_links_resolve_the_deliverable_name()
    {
        var c = Admin();
        var projId = await StrId(await c.PostAsJsonAsync("/api/v1/projects", new { name = "Checkout revamp" }));
        var incId = await IntId(await c.PostAsJsonAsync("/api/v1/increments", new { name = "PI with objective" }));

        var obj = await c.PostAsJsonAsync($"/api/v1/increments/{incId}/objectives", new
        {
            title = "Launch checkout", entityType = "project", entityId = projId,
            businessValue = 8, committed = true, confidence = 4, status = "In Progress",
        });
        Assert.Equal(HttpStatusCode.Created, obj.StatusCode);

        var detail = await c.GetFromJsonAsync<JsonElement>($"/api/v1/increments/{incId}");
        var o = detail.GetProperty("objectiveList").EnumerateArray().First();
        Assert.Equal("Launch checkout", o.GetProperty("title").GetString());
        Assert.Equal("Checkout revamp", o.GetProperty("entityName").GetString());
        Assert.Equal(8, o.GetProperty("businessValue").GetInt32());
        Assert.Equal(4, o.GetProperty("confidence").GetInt32());
        Assert.True(o.GetProperty("committed").GetBoolean());
    }

    [Fact]
    public async Task Objective_links_to_an_okr_and_resolves_its_title()
    {
        var c = Admin();
        var okrId = await StrId(await c.PostAsJsonAsync("/api/v1/okrs", new { title = "Grow Nordic revenue" }));
        var incId = await IntId(await c.PostAsJsonAsync("/api/v1/increments", new { name = "PI okr link" }));
        await c.PostAsJsonAsync($"/api/v1/increments/{incId}/objectives", new { title = "Ship unified checkout", objectiveLink = okrId });

        var detail = await c.GetFromJsonAsync<JsonElement>($"/api/v1/increments/{incId}");
        var o = detail.GetProperty("objectiveList").EnumerateArray().First();
        Assert.Equal(okrId, o.GetProperty("objectiveLink").GetString());
        Assert.Equal("Grow Nordic revenue", o.GetProperty("okrTitle").GetString());
    }

    [Fact]
    public async Task Iterations_and_dependencies_are_counted_on_the_increment()
    {
        var c = Admin();
        var incId = await IntId(await c.PostAsJsonAsync("/api/v1/increments", new { name = "PI counts" }));
        await c.PostAsJsonAsync($"/api/v1/increments/{incId}/iterations", new { name = "Iteration 1", capacity = 40, load = 30 });
        await c.PostAsJsonAsync($"/api/v1/increments/{incId}/dependencies", new { title = "API before UI", status = "Committed" });

        var detail = await c.GetFromJsonAsync<JsonElement>($"/api/v1/increments/{incId}");
        Assert.Single(detail.GetProperty("iterationList").EnumerateArray());
        Assert.Single(detail.GetProperty("dependencyList").EnumerateArray());
        var it = detail.GetProperty("iterationList").EnumerateArray().First();
        Assert.Equal(40, it.GetProperty("capacity").GetInt32());
        Assert.Equal(30, it.GetProperty("load").GetInt32());
    }

    [Fact]
    public async Task Invalid_state_and_status_are_rejected()
    {
        var c = Admin();
        var incId = await IntId(await c.PostAsJsonAsync("/api/v1/increments", new { name = "PI validate" }));
        Assert.Equal(HttpStatusCode.BadRequest, (await c.PatchAsJsonAsync($"/api/v1/increments/{incId}", new { state = "Nope" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await c.PostAsJsonAsync($"/api/v1/increments/{incId}/objectives", new { title = "T", status = "Weird" })).StatusCode);
    }

    [Fact]
    public async Task Deleting_an_increment_cascades_its_children()
    {
        var c = Admin();
        var incId = await IntId(await c.PostAsJsonAsync("/api/v1/increments", new { name = "PI delete" }));
        await c.PostAsJsonAsync($"/api/v1/increments/{incId}/objectives", new { title = "Doomed" });

        var del = await c.DeleteAsync($"/api/v1/increments/{incId}");
        Assert.Equal(HttpStatusCode.NoContent, del.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await c.GetAsync($"/api/v1/increments/{incId}")).StatusCode);
    }

    [Fact]
    public async Task Creating_an_increment_needs_schedule_edit_rights()
    {
        var c = _factory.CreateClient();
        c.DefaultRequestHeaders.Add("X-Atlas-Role", "stakeholder");   // no cap-schedule Edit
        var res = await c.PostAsJsonAsync("/api/v1/increments", new { name = "Blocked" });
        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);
    }
}
