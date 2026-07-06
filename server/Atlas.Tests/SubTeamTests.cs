using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace Atlas.Tests;

// Sub-teams are created by managers (or Platform Admin) and attached by delivery
// managers to a project/program/product/release with a chosen member set.
public class SubTeamTests : IClassFixture<AtlasApiFactory>
{
    readonly AtlasApiFactory _factory;
    public SubTeamTests(AtlasApiFactory factory) => _factory = factory;

    async Task<HttpResponseMessage> As(string role, HttpMethod method, string path, object? body = null)
    {
        var client = _factory.CreateClient();
        var req = new HttpRequestMessage(method, path);
        req.Headers.Add("X-Atlas-Role", role);
        if (body is not null) req.Content = JsonContent.Create(body);
        return await client.SendAsync(req);
    }

    async Task<int> CreateSubTeamAsync(string role = "svcmgr")
    {
        var res = await As(role, HttpMethod.Post, "/api/v1/subteams", new { name = "Payments squad" });
        Assert.True(res.IsSuccessStatusCode, $"create sub-team returned {(int)res.StatusCode}");
        using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
        return doc.RootElement.GetProperty("id").GetInt32();
    }

    async Task<string> CreateProjectAsync()
    {
        var res = await As("admin", HttpMethod.Post, "/api/v1/projects", new { name = "Team target project" });
        Assert.True(res.IsSuccessStatusCode, $"create project returned {(int)res.StatusCode}");
        using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
        return doc.RootElement.GetProperty("id").GetString()!;
    }

    [Fact]
    public async Task A_manager_can_create_a_subteam_but_a_stakeholder_cannot()
    {
        Assert.Equal(HttpStatusCode.Forbidden, (await As("stakeholder", HttpMethod.Post, "/api/v1/subteams", new { name = "Nope" })).StatusCode);
        var id = await CreateSubTeamAsync("svcmgr");
        Assert.True(id > 0);
    }

    [Fact]
    public async Task Members_can_be_added_and_removed()
    {
        var id = await CreateSubTeamAsync();
        var add = await As("svcmgr", HttpMethod.Post, $"/api/v1/subteams/{id}/members", new { name = "Alex Koivu", title = "Engineer" });
        Assert.Equal(HttpStatusCode.Created, add.StatusCode);
        using var doc = JsonDocument.Parse(await add.Content.ReadAsStringAsync());
        var memberId = doc.RootElement.GetProperty("id").GetInt32();
        Assert.Equal(HttpStatusCode.NoContent, (await As("svcmgr", HttpMethod.Delete, $"/api/v1/subteams/members/{memberId}")).StatusCode);
    }

    [Fact]
    public async Task A_subteam_attaches_to_a_project_with_chosen_members()
    {
        var subId = await CreateSubTeamAsync();
        await As("svcmgr", HttpMethod.Post, $"/api/v1/subteams/{subId}/members", new { name = "Alex Koivu", title = "Engineer" });
        await As("svcmgr", HttpMethod.Post, $"/api/v1/subteams/{subId}/members", new { name = "Sam Berg", title = "QA" });
        var projectId = await CreateProjectAsync();

        var attach = await As("pm", HttpMethod.Post, $"/api/v1/teams/assignments/project/{projectId}",
            new { subTeamId = subId, members = new[] { new { name = "Alex Koivu", email = "", title = "Engineer" } } });
        Assert.Equal(HttpStatusCode.Created, attach.StatusCode);

        var list = await As("pm", HttpMethod.Get, $"/api/v1/teams/assignments/project/{projectId}");
        using var doc = JsonDocument.Parse(await list.Content.ReadAsStringAsync());
        Assert.True(doc.RootElement.GetProperty("canEdit").GetBoolean());
        var assignments = doc.RootElement.GetProperty("assignments");
        Assert.Equal(1, assignments.GetArrayLength());
        Assert.Equal(1, assignments[0].GetProperty("members").GetArrayLength());   // only the chosen member
    }

    [Fact]
    public async Task Attaching_a_subteam_requires_project_edit_rights()
    {
        var subId = await CreateSubTeamAsync();
        var projectId = await CreateProjectAsync();
        Assert.Equal(HttpStatusCode.Forbidden, (await As("stakeholder", HttpMethod.Post, $"/api/v1/teams/assignments/project/{projectId}", new { subTeamId = subId })).StatusCode);
    }

    [Fact]
    public async Task Attaching_defaults_to_the_whole_roster_when_no_selection_is_given()
    {
        var subId = await CreateSubTeamAsync();
        await As("svcmgr", HttpMethod.Post, $"/api/v1/subteams/{subId}/members", new { name = "Alex Koivu" });
        await As("svcmgr", HttpMethod.Post, $"/api/v1/subteams/{subId}/members", new { name = "Sam Berg" });
        var projectId = await CreateProjectAsync();

        Assert.Equal(HttpStatusCode.Created, (await As("pm", HttpMethod.Post, $"/api/v1/teams/assignments/project/{projectId}", new { subTeamId = subId })).StatusCode);
        var list = await As("pm", HttpMethod.Get, $"/api/v1/teams/assignments/project/{projectId}");
        using var doc = JsonDocument.Parse(await list.Content.ReadAsStringAsync());
        Assert.Equal(2, doc.RootElement.GetProperty("assignments")[0].GetProperty("members").GetArrayLength());
    }
}
