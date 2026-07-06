using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace Atlas.Tests;

// Jira integration Phase 1 — foundation. Jira is unconfigured in tests, so the
// status reports not-configured and the connection test fails gracefully rather
// than throwing. Both endpoints are gated on the Integrations capability.
public class JiraTests : IClassFixture<AtlasApiFactory>
{
    readonly AtlasApiFactory _factory;
    public JiraTests(AtlasApiFactory factory) => _factory = factory;

    HttpClient Admin()
    {
        var c = _factory.CreateClient();
        c.DefaultRequestHeaders.Add("X-Atlas-Role", "admin");
        return c;
    }

    [Fact]
    public async Task Status_reports_not_configured_by_default()
    {
        var c = Admin();
        var res = await c.GetAsync("/api/v1/integrations/jira/status");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
        Assert.False(doc.RootElement.GetProperty("configured").GetBoolean());
        Assert.True(doc.RootElement.GetProperty("canManage").GetBoolean());
    }

    [Fact]
    public async Task Test_connection_fails_gracefully_when_unconfigured()
    {
        var c = Admin();
        var res = await c.PostAsync("/api/v1/integrations/jira/test", null);
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);   // graceful, not a 500
        using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
        Assert.False(doc.RootElement.GetProperty("ok").GetBoolean());
        Assert.False(string.IsNullOrEmpty(doc.RootElement.GetProperty("error").GetString()));
    }

    [Fact]
    public async Task Endpoints_are_gated_on_the_integrations_capability()
    {
        var c = _factory.CreateClient();
        c.DefaultRequestHeaders.Add("X-Atlas-Role", "stakeholder");
        Assert.Equal(HttpStatusCode.Forbidden, (await c.GetAsync("/api/v1/integrations/jira/status")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await c.PostAsync("/api/v1/integrations/jira/test", null)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await c.PostAsync("/api/v1/integrations/jira/sync", null)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await c.PostAsync("/api/v1/projects/PRJ-1/jira/sync", null)).StatusCode);
    }

    [Fact]
    public async Task Sync_all_reports_not_configured_gracefully()
    {
        var c = Admin();
        var res = await c.PostAsync("/api/v1/integrations/jira/sync", null);
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);   // graceful, not a 500
        using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
        Assert.False(doc.RootElement.GetProperty("ok").GetBoolean());
    }

    [Fact]
    public async Task Project_sync_reports_not_configured_gracefully()
    {
        var c = Admin();
        var res = await c.PostAsync("/api/v1/projects/PRJ-1/jira/sync", null);
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);   // not-configured reported before touching the DB
        using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
        Assert.False(doc.RootElement.GetProperty("ok").GetBoolean());
    }

    [Fact]
    public async Task Discovery_reports_not_configured_but_stays_readable_for_editors()
    {
        var c = Admin();
        var res = await c.GetAsync("/api/v1/integrations/jira/projects");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
        Assert.False(doc.RootElement.GetProperty("configured").GetBoolean());
        Assert.True(doc.RootElement.GetProperty("canManage").GetBoolean());   // admin has Full on projects
    }

    [Fact]
    public async Task Discovery_and_import_are_gated()
    {
        var c = _factory.CreateClient();
        c.DefaultRequestHeaders.Add("X-Atlas-Role", "stakeholder");
        Assert.Equal(HttpStatusCode.Forbidden, (await c.GetAsync("/api/v1/integrations/jira/projects")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await c.PostAsJsonAsync("/api/v1/integrations/jira/import", new { jiraProjectKey = "GIT", target = "project" })).StatusCode);
    }

    [Fact]
    public async Task Import_maps_a_jira_key_to_a_new_project()
    {
        var c = Admin();
        var res = await c.PostAsJsonAsync("/api/v1/integrations/jira/import", new { jiraProjectKey = "git", boardId = 93, target = "project", name = "Imported from Jira" });
        Assert.Equal(HttpStatusCode.Created, res.StatusCode);
        using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
        var pid = doc.RootElement.GetProperty("projectId").GetString();
        Assert.True(doc.RootElement.GetProperty("created").GetBoolean());

        // The new project carries the (upper-cased) Jira mapping.
        var detail = await c.GetAsync($"/api/v1/projects/{pid}");
        using var dd = JsonDocument.Parse(await detail.Content.ReadAsStringAsync());
        Assert.Equal("GIT", dd.RootElement.GetProperty("jiraProjectKey").GetString());
        Assert.Equal(93, dd.RootElement.GetProperty("jiraBoardId").GetInt32());
    }
}
