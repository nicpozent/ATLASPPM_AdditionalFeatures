using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace Atlas.Tests;

// The entity-scoped skills read (/skills/entity/{type}/{id}) returns the assigned
// team's ratings without the My-Team roster filter, for the Overview panel.
public class SkillsPanelTests : IClassFixture<AtlasApiFactory>
{
    readonly AtlasApiFactory _factory;
    public SkillsPanelTests(AtlasApiFactory factory) => _factory = factory;

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

    [Fact]
    public async Task Entity_skills_cover_the_assigned_team_regardless_of_roster()
    {
        var c = Admin();
        var pRes = await c.PostAsJsonAsync("/api/v1/integrations/jira/import", new { jiraProjectKey = "SKP", target = "project", name = "Skills panel target" });
        using var pDoc = JsonDocument.Parse(await pRes.Content.ReadAsStringAsync());
        var pid = pDoc.RootElement.GetProperty("projectId").GetString();

        // A skill rated for a person, and that person assigned to the project.
        var skillId = await IntId(await c.PostAsJsonAsync("/api/v1/skills", new { name = "Kubernetes" }));
        await c.PutAsJsonAsync("/api/v1/skill-ratings", new { skillId, person = "Grace Hopper", level = 4 });
        await c.PostAsJsonAsync($"/api/v1/teams/assignments/project/{pid}/individual", new { name = "Grace Hopper", alloc = 20 });

        // The entity view lists the assigned person and their rating — even though
        // the tests have no Entra roster (so plain /skills would hide it).
        var panel = await c.GetFromJsonAsync<JsonElement>($"/api/v1/skills/entity/project/{pid}");
        Assert.Contains(panel.GetProperty("people").EnumerateArray(), p => p.GetString() == "Grace Hopper");
        Assert.Contains(panel.GetProperty("ratings").EnumerateArray(),
            r => r.GetProperty("person").GetString() == "Grace Hopper" && r.GetProperty("level").GetInt32() == 4);
        Assert.False(panel.GetProperty("canEdit").GetBoolean());   // read-only here
    }
}
