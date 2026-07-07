using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Atlas.Api;
using Xunit;

namespace Atlas.Tests;

// Azure DevOps connector scaffold (ADR-0035). ADO is unconfigured in tests, so
// status reports not-configured and the connection test fails gracefully rather
// than throwing. Discovery/import are gated on the same capabilities as Jira's.
public class AzureDevOpsTests : IClassFixture<AtlasApiFactory>
{
    readonly AtlasApiFactory _factory;
    public AzureDevOpsTests(AtlasApiFactory factory) => _factory = factory;

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
        var res = await c.GetAsync("/api/v1/integrations/ado/status");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
        Assert.False(doc.RootElement.GetProperty("configured").GetBoolean());
        Assert.True(doc.RootElement.GetProperty("canManage").GetBoolean());
    }

    [Fact]
    public async Task Test_connection_fails_gracefully_when_unconfigured()
    {
        var c = Admin();
        var res = await c.PostAsync("/api/v1/integrations/ado/test", null);
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);   // graceful, not a 500
        using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
        Assert.False(doc.RootElement.GetProperty("ok").GetBoolean());
        Assert.False(string.IsNullOrEmpty(doc.RootElement.GetProperty("error").GetString()));
    }

    [Fact]
    public async Task Endpoints_are_gated_on_the_capabilities()
    {
        var c = _factory.CreateClient();
        c.DefaultRequestHeaders.Add("X-Atlas-Role", "stakeholder");
        Assert.Equal(HttpStatusCode.Forbidden, (await c.GetAsync("/api/v1/integrations/ado/status")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await c.PostAsync("/api/v1/integrations/ado/test", null)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await c.GetAsync("/api/v1/integrations/ado/projects")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await c.PostAsJsonAsync("/api/v1/integrations/ado/import", new { adoProject = "Contoso", target = "project" })).StatusCode);
    }

    [Fact]
    public async Task Discovery_reports_not_configured_but_stays_readable_for_editors()
    {
        var c = Admin();
        var res = await c.GetAsync("/api/v1/integrations/ado/projects");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
        Assert.False(doc.RootElement.GetProperty("configured").GetBoolean());
        Assert.True(doc.RootElement.GetProperty("canManage").GetBoolean());
    }

    [Fact]
    public async Task Import_maps_an_ado_project_to_a_new_atlas_project()
    {
        var c = Admin();
        var res = await c.PostAsJsonAsync("/api/v1/integrations/ado/import", new { adoProject = "Contoso Platform", target = "project", name = "Imported from ADO" });
        Assert.Equal(HttpStatusCode.Created, res.StatusCode);
        using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
        var pid = doc.RootElement.GetProperty("projectId").GetString();
        Assert.True(doc.RootElement.GetProperty("created").GetBoolean());

        // The new project carries the ADO mapping.
        var detail = await c.GetAsync($"/api/v1/projects/{pid}");
        using var dd = JsonDocument.Parse(await detail.Content.ReadAsStringAsync());
        Assert.Equal("Contoso Platform", dd.RootElement.GetProperty("adoProject").GetString());
    }

    [Fact]
    public async Task Import_requires_a_project()
    {
        var c = Admin();
        var res = await c.PostAsJsonAsync("/api/v1/integrations/ado/import", new { adoProject = "", target = "project" });
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task Sync_all_reports_not_configured_gracefully()
    {
        var c = Admin();
        var res = await c.PostAsync("/api/v1/integrations/ado/sync", null);
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);   // graceful, not a 500
        using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
        Assert.False(doc.RootElement.GetProperty("ok").GetBoolean());
    }

    [Fact]
    public async Task Project_sync_reports_not_configured_gracefully()
    {
        var c = Admin();
        var res = await c.PostAsync("/api/v1/projects/PRJ-1/ado/sync", null);
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);   // not-configured reported before touching ADO
        using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
        Assert.False(doc.RootElement.GetProperty("ok").GetBoolean());
    }

    [Fact]
    public async Task Sync_endpoints_are_gated()
    {
        var c = _factory.CreateClient();
        c.DefaultRequestHeaders.Add("X-Atlas-Role", "stakeholder");
        Assert.Equal(HttpStatusCode.Forbidden, (await c.PostAsync("/api/v1/integrations/ado/sync", null)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await c.PostAsync("/api/v1/projects/PRJ-1/ado/sync", null)).StatusCode);
    }
}

// Pure mapping helpers for the ADO sync engine — no HTTP, no DB.
public class AzureDevOpsMappingTests
{
    [Theory]
    [InlineData("Done", "Done")]
    [InlineData("Closed", "Done")]
    [InlineData("Resolved", "Done")]
    [InlineData("Active", "In Progress")]
    [InlineData("Committed", "In Progress")]
    [InlineData("Doing", "In Progress")]
    [InlineData("Removed", "Blocked")]
    [InlineData("New", "To Do")]
    [InlineData("Approved", "To Do")]
    [InlineData("", "To Do")]
    public void MapAdoState_covers_agile_scrum_basic(string state, string expected) =>
        Assert.Equal(expected, AzureDevOps.MapAdoState(state));

    [Theory]
    [InlineData(1, "Critical")]
    [InlineData(2, "High")]
    [InlineData(3, "Medium")]
    [InlineData(4, "Low")]
    [InlineData(0, "Medium")]
    public void MapAdoPriority_maps_1_to_4(int p, string expected) =>
        Assert.Equal(expected, AzureDevOps.MapAdoPriority(p));

    [Theory]
    [InlineData("Proj\\Release 1\\Sprint 3", "Sprint 3")]
    [InlineData("Proj", "Proj")]
    [InlineData("", "")]
    public void LastSegment_takes_iteration_leaf(string path, string expected) =>
        Assert.Equal(expected, AzureDevOps.LastSegment(path));

    [Theory]
    [InlineData("<div>Hello <b>world</b></div>", "Hello world")]
    [InlineData("plain", "plain")]
    [InlineData("", "")]
    public void StripHtml_reduces_to_text(string html, string expected) =>
        Assert.Equal(expected, AzureDevOps.StripHtml(html));

    [Theory]
    [InlineData("contoso", "https://dev.azure.com/contoso")]
    [InlineData("https://dev.azure.com/contoso", "https://dev.azure.com/contoso")]
    [InlineData("https://dev.azure.com/contoso/", "https://dev.azure.com/contoso")]
    [InlineData("", null)]
    public void NormalizeOrgUrl_accepts_name_or_url(string raw, string? expected) =>
        Assert.Equal(expected, AzureDevOps.NormalizeOrgUrl(raw));
}
