using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace Atlas.Tests;

// Time-phased allocation: assign an individual to a project with weekly hours and
// a date window, and confirm it rolls into Resources' Project% only while live.
public class AllocationTests : IClassFixture<AtlasApiFactory>
{
    readonly AtlasApiFactory _factory;
    public AllocationTests(AtlasApiFactory factory) => _factory = factory;

    HttpClient As(string role)
    {
        var c = _factory.CreateClient();
        c.DefaultRequestHeaders.Add("X-Atlas-Role", role);
        return c;
    }

    [Fact]
    public async Task Individual_hours_allocation_is_time_phased_in_resources()
    {
        var c = As("admin");
        var pRes = await c.PostAsJsonAsync("/api/v1/integrations/jira/import", new { jiraProjectKey = "ALLOC", target = "project", name = "Allocation target" });
        using var pDoc = JsonDocument.Parse(await pRes.Content.ReadAsStringAsync());
        var pid = pDoc.RootElement.GetProperty("projectId").GetString();

        // 20 h/week (= 50%) for June 2026.
        var add = await c.PostAsJsonAsync($"/api/v1/teams/assignments/project/{pid}/individual",
            new { name = "Grace Hopper", allocHours = 20, startDate = "2026-06-01", endDate = "2026-06-30" });
        Assert.Equal(HttpStatusCode.Created, add.StatusCode);

        // In-window: 50% project allocation.
        var inWin = await c.GetFromJsonAsync<JsonElement>("/api/v1/resources?asOf=2026-06-15");
        var g1 = inWin.EnumerateArray().First(r => r.GetProperty("name").GetString() == "Grace Hopper");
        Assert.Equal(50, g1.GetProperty("projectPct").GetInt32());

        // Out-of-window: allocation not counted (still listed, at 0%).
        var outWin = await c.GetFromJsonAsync<JsonElement>("/api/v1/resources?asOf=2026-08-01");
        var g2 = outWin.EnumerateArray().First(r => r.GetProperty("name").GetString() == "Grace Hopper");
        Assert.Equal(0, g2.GetProperty("projectPct").GetInt32());

        // The assignment shows the stored hours + dates back on the entity.
        var team = await c.GetFromJsonAsync<JsonElement>($"/api/v1/teams/assignments/project/{pid}");
        var member = team.GetProperty("assignments").EnumerateArray()
            .SelectMany(a => a.GetProperty("members").EnumerateArray())
            .First(m => m.GetProperty("name").GetString() == "Grace Hopper");
        Assert.Equal(20, member.GetProperty("allocHours").GetInt32());
        Assert.Equal(50, member.GetProperty("alloc").GetInt32());
        Assert.Equal("2026-06-01", member.GetProperty("startDate").GetString());
    }

    [Fact]
    public async Task Duplicate_individual_is_rejected_and_editing_is_gated()
    {
        var admin = As("admin");
        var pRes = await admin.PostAsJsonAsync("/api/v1/integrations/jira/import", new { jiraProjectKey = "ALLOC2", target = "project", name = "Allocation target 2" });
        using var pDoc = JsonDocument.Parse(await pRes.Content.ReadAsStringAsync());
        var pid = pDoc.RootElement.GetProperty("projectId").GetString();

        Assert.Equal(HttpStatusCode.Created, (await admin.PostAsJsonAsync($"/api/v1/teams/assignments/project/{pid}/individual", new { name = "Alan Turing", alloc = 40 })).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await admin.PostAsJsonAsync($"/api/v1/teams/assignments/project/{pid}/individual", new { name = "Alan Turing", alloc = 10 })).StatusCode);

        // Stakeholder can't assign (needs cap-projects Edit).
        Assert.Equal(HttpStatusCode.Forbidden, (await As("stakeholder").PostAsJsonAsync($"/api/v1/teams/assignments/project/{pid}/individual", new { name = "X", alloc = 10 })).StatusCode);
    }
}
