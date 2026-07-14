using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace Atlas.Tests;

// Customizable skills matrix: add/remove skill columns and set a person's 0–4
// level, with the manager-scope roster and the edit gate.
public class SkillsTests : IClassFixture<AtlasApiFactory>
{
    readonly AtlasApiFactory _factory;
    public SkillsTests(AtlasApiFactory factory) => _factory = factory;

    HttpClient Admin() => As("admin");
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
    public async Task Skill_can_be_added_rated_and_removed()
    {
        var c = Admin();
        var skillId = await IntId(await c.PostAsJsonAsync("/api/v1/skills", new { name = "React" }));

        // Rate a person 3/4.
        var set = await c.PutAsJsonAsync("/api/v1/skill-ratings", new { skillId, person = "Ada Lovelace", level = 3 });
        Assert.Equal(HttpStatusCode.OK, set.StatusCode);

        var matrix = await c.GetFromJsonAsync<JsonElement>("/api/v1/skills");
        Assert.Contains(matrix.GetProperty("skills").EnumerateArray(), s => s.GetProperty("name").GetString() == "React");
        // (The roster is empty in tests — no Entra groups — so the rating is filtered
        //  from the matrix view; the round-trip below proves persistence/clamping.)

        // Level 0 clears the cell; out-of-range clamps.
        Assert.Equal(HttpStatusCode.OK, (await c.PutAsJsonAsync("/api/v1/skill-ratings", new { skillId, person = "Ada Lovelace", level = 9 })).StatusCode);

        var del = await c.DeleteAsync($"/api/v1/skills/{skillId}");
        Assert.Equal(HttpStatusCode.NoContent, del.StatusCode);
        var after = await c.GetFromJsonAsync<JsonElement>("/api/v1/skills");
        Assert.DoesNotContain(after.GetProperty("skills").EnumerateArray(), s => s.GetProperty("id").GetInt32() == skillId);
    }

    [Fact]
    public async Task Adding_a_skill_needs_edit_rights()
    {
        var c = _factory.CreateClient();
        c.DefaultRequestHeaders.Add("X-Atlas-Role", "stakeholder");   // no cap-projects Edit
        Assert.Equal(HttpStatusCode.Forbidden, (await c.PostAsJsonAsync("/api/v1/skills", new { name = "X" })).StatusCode);
    }

    [Fact]
    public async Task Duplicate_skill_is_rejected()
    {
        var c = Admin();
        await c.PostAsJsonAsync("/api/v1/skills", new { name = "Kubernetes" });
        Assert.Equal(HttpStatusCode.Conflict, (await c.PostAsJsonAsync("/api/v1/skills", new { name = "Kubernetes" })).StatusCode);
    }

    // The matrix is manager-scoped: a Project Manager can edit projects (cap-projects)
    // but manages no team, so they neither see the matrix nor can add to it.
    [Fact]
    public async Task Matrix_is_hidden_from_non_managers()
    {
        var pm = As("pm");
        var matrix = await pm.GetFromJsonAsync<JsonElement>("/api/v1/skills");
        Assert.False(matrix.GetProperty("canView").GetBoolean());
        Assert.False(matrix.GetProperty("canEdit").GetBoolean());
        Assert.Empty(matrix.GetProperty("skills").EnumerateArray());
        Assert.Equal(HttpStatusCode.Forbidden, (await pm.PostAsJsonAsync("/api/v1/skills", new { name = "PM only" })).StatusCode);
    }

    // A skill column belongs to the manager slot that created it, so one manager
    // never sees another team's skills — but Platform Admin sees every team's.
    [Fact]
    public async Task Skills_are_scoped_to_the_owning_manager_team()
    {
        var eng = As("teammgr");     // Global Engineering manager → slot "teammgr"
        var svc = As("svcmgr");      // Global Service manager     → slot "svcmgr"

        Assert.Equal(HttpStatusCode.Created, (await eng.PostAsJsonAsync("/api/v1/skills", new { name = "Eng-scoped skill" })).StatusCode);
        Assert.Equal(HttpStatusCode.Created, (await svc.PostAsJsonAsync("/api/v1/skills", new { name = "Svc-scoped skill" })).StatusCode);

        var engView = await eng.GetFromJsonAsync<JsonElement>("/api/v1/skills");
        Assert.True(engView.GetProperty("canView").GetBoolean());
        var engNames = engView.GetProperty("skills").EnumerateArray().Select(s => s.GetProperty("name").GetString()).ToList();
        Assert.Contains("Eng-scoped skill", engNames);
        Assert.DoesNotContain("Svc-scoped skill", engNames);

        var svcNames = (await svc.GetFromJsonAsync<JsonElement>("/api/v1/skills"))
            .GetProperty("skills").EnumerateArray().Select(s => s.GetProperty("name").GetString()).ToList();
        Assert.Contains("Svc-scoped skill", svcNames);
        Assert.DoesNotContain("Eng-scoped skill", svcNames);

        // Platform Admin's scope is every slot → sees both teams' columns.
        var adminNames = (await Admin().GetFromJsonAsync<JsonElement>("/api/v1/skills"))
            .GetProperty("skills").EnumerateArray().Select(s => s.GetProperty("name").GetString()).ToList();
        Assert.Contains("Eng-scoped skill", adminNames);
        Assert.Contains("Svc-scoped skill", adminNames);
    }

    // The same skill name may exist for two different teams (per-team uniqueness),
    // and one manager cannot rename or delete another team's column.
    [Fact]
    public async Task One_manager_cannot_touch_another_teams_skill()
    {
        var eng = As("teammgr");
        var svc = As("svcmgr");
        var engId = await IntId(await eng.PostAsJsonAsync("/api/v1/skills", new { name = "Shared name" }));
        // Same name, different team — allowed (not a duplicate).
        Assert.Equal(HttpStatusCode.Created, (await svc.PostAsJsonAsync("/api/v1/skills", new { name = "Shared name" })).StatusCode);
        // Service manager can't rename or delete Engineering's column.
        Assert.Equal(HttpStatusCode.NotFound, (await svc.PatchAsJsonAsync($"/api/v1/skills/{engId}", new { name = "Hijacked" })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await svc.DeleteAsync($"/api/v1/skills/{engId}")).StatusCode);
        // Service manager also can't rate against Engineering's column.
        Assert.Equal(HttpStatusCode.NotFound, (await svc.PutAsJsonAsync("/api/v1/skill-ratings", new { skillId = engId, person = "X", level = 2 })).StatusCode);
    }
}
