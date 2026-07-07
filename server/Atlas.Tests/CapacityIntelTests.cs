using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace Atlas.Tests;

// Capacity intelligence: portfolio insight (over/under/by-dept) and skills-based
// staffing suggestions, both derived from the shared time-phased roster.
public class CapacityIntelTests : IClassFixture<AtlasApiFactory>
{
    readonly AtlasApiFactory _factory;
    public CapacityIntelTests(AtlasApiFactory factory) => _factory = factory;

    HttpClient As(string role)
    {
        var c = _factory.CreateClient();
        c.DefaultRequestHeaders.Add("X-Atlas-Role", role);
        return c;
    }
    static async Task<int> IntId(HttpResponseMessage res)
    {
        using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
        return doc.RootElement.GetProperty("id").GetInt32();
    }

    [Fact]
    public async Task Insight_flags_over_allocation_from_combined_load()
    {
        var c = As("admin");
        var pRes = await c.PostAsJsonAsync("/api/v1/integrations/jira/import", new { jiraProjectKey = "CI1", target = "project", name = "CI target" });
        using var pDoc = JsonDocument.Parse(await pRes.Content.ReadAsStringAsync());
        var pid = pDoc.RootElement.GetProperty("projectId").GetString();

        // 70% project + a 60% ops item = 130% → over-allocated.
        await c.PostAsJsonAsync($"/api/v1/teams/assignments/project/{pid}/individual", new { name = "Rosa Parks", alloc = 70 });
        var svcId = await IntId(await c.PostAsJsonAsync("/api/v1/ops/services", new { name = "CI ops", category = "Support" }));
        await c.PostAsJsonAsync($"/api/v1/ops/services/{svcId}/items", new { title = "Heavy BAU", assignee = "Rosa Parks", alloc = 60 });

        var insight = await c.GetFromJsonAsync<JsonElement>("/api/v1/capacity/insight");
        Assert.True(insight.GetProperty("headcount").GetInt32() >= 1);
        var over = insight.GetProperty("over").EnumerateArray().FirstOrDefault(p => p.GetProperty("name").GetString() == "Rosa Parks");
        Assert.Equal(130, over.GetProperty("total").GetInt32());
        Assert.True(insight.GetProperty("overCount").GetInt32() >= 1);
    }

    [Fact]
    public async Task Staffing_finds_people_with_the_skill_and_free_capacity()
    {
        var c = As("admin");
        var skillId = await IntId(await c.PostAsJsonAsync("/api/v1/skills", new { name = "Kubernetes" }));
        await c.PutAsJsonAsync("/api/v1/skill-ratings", new { skillId, person = "Mae Jemison", level = 4 });

        var res = await c.GetFromJsonAsync<JsonElement>("/api/v1/capacity/staffing?skill=Kubernetes&minFree=20");
        Assert.Equal("Kubernetes", res.GetProperty("skill").GetString());
        // Mae has the skill and (no allocations) 100% free → a candidate.
        Assert.Contains(res.GetProperty("candidates").EnumerateArray(),
            x => x.GetProperty("name").GetString() == "Mae Jemison" && x.GetProperty("free").GetInt32() == 100 && x.GetProperty("level").GetInt32() == 4);

        // Unknown skill → empty, not an error.
        var none = await c.GetFromJsonAsync<JsonElement>("/api/v1/capacity/staffing?skill=Nonexistent");
        Assert.Empty(none.GetProperty("candidates").EnumerateArray());
    }
}
