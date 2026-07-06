using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace Atlas.Tests;

// Team capacity must count people attached via the Team panel (sub-teams or
// individuals), not only People & roles — and reflect their live allocation.
public class CapacityTests : IClassFixture<AtlasApiFactory>
{
    readonly AtlasApiFactory _factory;
    public CapacityTests(AtlasApiFactory factory) => _factory = factory;

    HttpClient Admin()
    {
        var c = _factory.CreateClient();
        c.DefaultRequestHeaders.Add("X-Atlas-Role", "admin");
        return c;
    }

    [Fact]
    public async Task Attached_team_member_shows_in_capacity_with_allocation()
    {
        var c = Admin();
        var pRes = await c.PostAsJsonAsync("/api/v1/integrations/jira/import", new { jiraProjectKey = "CAP", target = "project", name = "Capacity target" });
        using var pDoc = JsonDocument.Parse(await pRes.Content.ReadAsStringAsync());
        var pid = pDoc.RootElement.GetProperty("projectId").GetString();

        // Before: nobody assigned.
        var before = await c.GetFromJsonAsync<JsonElement>($"/api/v1/projects/{pid}/capacity");
        Assert.Equal(0, before.GetProperty("assigned").GetInt32());

        // Assign an individual at 55% — no People & roles entry at all.
        await c.PostAsJsonAsync($"/api/v1/teams/assignments/project/{pid}/individual", new { name = "Dorothy Vaughan", alloc = 55, title = "Lead Engineer" });

        var after = await c.GetFromJsonAsync<JsonElement>($"/api/v1/projects/{pid}/capacity");
        Assert.Equal(1, after.GetProperty("assigned").GetInt32());
        var row = after.GetProperty("people").EnumerateArray().First(r => r.GetProperty("name").GetString() == "Dorothy Vaughan");
        Assert.Equal(55, row.GetProperty("projectPct").GetInt32());
        Assert.Equal("Lead Engineer", row.GetProperty("role").GetString());
    }
}
