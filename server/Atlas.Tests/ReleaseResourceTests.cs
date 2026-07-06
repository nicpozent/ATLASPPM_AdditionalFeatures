using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace Atlas.Tests;

// Release field editing (available to anyone with Edit on Projects & tasks) and
// the allocation-derived Resources views (by person / by project / by product).
public class ReleaseResourceTests : IClassFixture<AtlasApiFactory>
{
    readonly AtlasApiFactory _factory;
    public ReleaseResourceTests(AtlasApiFactory factory) => _factory = factory;

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

    [Fact]
    public async Task Release_fields_can_be_edited()
    {
        var c = Admin();
        var relId = await Id(await c.PostAsJsonAsync("/api/v1/releases", new { name = "Storefront 24.5" }));

        var patch = await c.PatchAsJsonAsync($"/api/v1/releases/{relId}", new
        {
            name = "Storefront 24.6", owner = "Mette Sørensen", scope = "Project",
            env = "Production", risk = "Medium", reqs = 7, crs = 3, progress = 60, status = "In progress",
        });
        Assert.Equal(HttpStatusCode.OK, patch.StatusCode);
        using var doc = JsonDocument.Parse(await patch.Content.ReadAsStringAsync());
        var r = doc.RootElement;
        Assert.Equal("Storefront 24.6", r.GetProperty("name").GetString());
        Assert.Equal("Project", r.GetProperty("scope").GetString());
        Assert.Equal("In progress", r.GetProperty("status").GetString());
        Assert.Equal(60, r.GetProperty("progress").GetInt32());
        Assert.Equal(7, r.GetProperty("reqs").GetInt32());
    }

    [Fact]
    public async Task Editing_a_release_rejects_an_unknown_status()
    {
        var c = Admin();
        var relId = await Id(await c.PostAsJsonAsync("/api/v1/releases", new { name = "R" }));
        Assert.Equal(HttpStatusCode.BadRequest, (await c.PatchAsJsonAsync($"/api/v1/releases/{relId}", new { status = "Nope" })).StatusCode);
    }

    [Fact]
    public async Task Editing_a_release_needs_edit_rights()
    {
        var c = _factory.CreateClient();
        c.DefaultRequestHeaders.Add("X-Atlas-Role", "stakeholder");   // no cap-projects Edit
        Assert.Equal(HttpStatusCode.Forbidden, (await c.PatchAsJsonAsync("/api/v1/releases/REL-X", new { name = "X" })).StatusCode);
    }

    static async Task<int> IntId(HttpResponseMessage res)
    {
        using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
        return doc.RootElement.GetProperty("id").GetInt32();
    }

    [Fact]
    public async Task Resources_are_derived_from_project_team_allocations()
    {
        var c = Admin();
        var projId = await Id(await c.PostAsJsonAsync("/api/v1/projects", new { name = "Allocation project" }));
        var subId = await IntId(await c.PostAsJsonAsync("/api/v1/subteams", new { name = "Squad A", managerKey = "teammgr" }));
        // Attach the sub-team (with Grace) to the project.
        await c.PostAsJsonAsync($"/api/v1/teams/assignments/project/{projId}",
            new { subTeamId = subId, members = new[] { new { name = "Grace Hopper", title = "Engineer" } } });

        // The member shows under the project; find their allocation-member id.
        var byProject = await c.GetFromJsonAsync<JsonElement>("/api/v1/resources/by-project");
        var proj = byProject.EnumerateArray().First(p => p.GetProperty("id").GetString() == projId);
        var member = proj.GetProperty("members").EnumerateArray().First(m => m.GetProperty("name").GetString() == "Grace Hopper");
        Assert.True(proj.GetProperty("canEdit").GetBoolean());
        var memberId = member.GetProperty("memberId").GetInt32();

        // Set the allocation and confirm it flows to the by-project view and the roster.
        var set = await c.PatchAsJsonAsync($"/api/v1/resources/project-members/{memberId}", new { alloc = 40 });
        Assert.Equal(HttpStatusCode.OK, set.StatusCode);

        var roster = await c.GetFromJsonAsync<JsonElement>("/api/v1/resources");
        var grace = roster.EnumerateArray().First(r => r.GetProperty("name").GetString() == "Grace Hopper");
        Assert.Equal(40, grace.GetProperty("projectPct").GetInt32());
    }

    [Fact]
    public async Task Unonboarded_assignees_are_surfaced_and_can_be_onboarded()
    {
        var c = Admin();
        var projId = await Id(await c.PostAsJsonAsync("/api/v1/projects", new { name = "Imported project" }));
        // A task with an assignee who isn't in the directory (as if synced from Jira).
        await c.PostAsJsonAsync($"/api/v1/projects/{projId}/tasks", new { name = "From Jira", assignee = "Ghost Person" });

        var before = await c.GetFromJsonAsync<JsonElement>("/api/v1/resources/unonboarded");
        var ghost = before.EnumerateArray().First(u => u.GetProperty("name").GetString() == "Ghost Person");
        Assert.Contains("Imported project", ghost.GetProperty("projects").EnumerateArray().Select(p => p.GetString()));

        // Onboard them → they drop off the unonboarded list.
        var onboarded = await c.PostAsJsonAsync("/api/v1/resources/onboard", new { name = "Ghost Person" });
        Assert.Equal(HttpStatusCode.OK, onboarded.StatusCode);

        var after = await c.GetFromJsonAsync<JsonElement>("/api/v1/resources/unonboarded");
        Assert.DoesNotContain("Ghost Person", after.EnumerateArray().Select(u => u.GetProperty("name").GetString()));
    }

    [Fact]
    public async Task Onboarding_needs_directory_rights()
    {
        var c = _factory.CreateClient();
        c.DefaultRequestHeaders.Add("X-Atlas-Role", "pm");   // no cap-users-roles Edit
        Assert.Equal(HttpStatusCode.Forbidden, (await c.PostAsJsonAsync("/api/v1/resources/onboard", new { name = "X" })).StatusCode);
    }
}
