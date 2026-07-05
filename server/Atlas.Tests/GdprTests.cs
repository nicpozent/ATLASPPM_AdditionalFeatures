using System.Net;
using System.Text.Json;
using Atlas.Api;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Atlas.Tests;

// Exercises the GDPR data-subject export end-to-end against the hosted API:
// admin-only access, subject matching, and exact-match isolation between people.
public class GdprTests : IClassFixture<AtlasApiFactory>
{
    readonly AtlasApiFactory _factory;
    public GdprTests(AtlasApiFactory factory)
    {
        _factory = factory;
        Seed();
    }

    void Seed()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AtlasDbContext>();
        if (db.Resources.Any(r => r.Name == "Jane Doe")) return; // seed once
        db.Resources.Add(new Resource { Name = "Jane Doe", Role = "Engineer", Dept = "Development", Initials = "JD", Color = "#000" });
        db.Resources.Add(new Resource { Name = "John Smith", Role = "Analyst", Dept = "PMO", Initials = "JS", Color = "#111" });
        db.Subscriptions.Add(new Subscription { UserKey = "jane.doe@birgma.com", Email = "jane.doe@birgma.com", TargetType = "project", TargetId = "P-1", CreatedAt = DateTime.UtcNow });
        db.SaveChanges();
    }

    async Task<HttpResponseMessage> As(string? role, string path)
    {
        var client = _factory.CreateClient();
        var req = new HttpRequestMessage(HttpMethod.Get, path);
        if (role is not null) req.Headers.Add("X-Atlas-Role", role);
        return await client.SendAsync(req);
    }

    [Theory]
    [InlineData("pmo")]
    [InlineData("pm")]
    [InlineData("teammgr")]
    [InlineData("stakeholder")]
    public async Task Export_is_forbidden_for_non_admins(string role)
    {
        var res = await As(role, "/api/v1/gdpr/export?subject=Jane%20Doe");
        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);
    }

    [Theory]
    [InlineData("pmo")]
    [InlineData("stakeholder")]
    public async Task Subjects_list_is_forbidden_for_non_admins(string role)
    {
        var res = await As(role, "/api/v1/gdpr/subjects");
        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);
    }

    [Fact]
    public async Task Export_requires_a_subject()
    {
        var res = await As("admin", "/api/v1/gdpr/export");
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task Admin_export_returns_a_downloadable_json_document()
    {
        var res = await As("admin", "/api/v1/gdpr/export?subject=Jane%20Doe");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.Equal("application/json", res.Content.Headers.ContentType?.MediaType);
        Assert.Equal("attachment", res.Content.Headers.ContentDisposition?.DispositionType);

        using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
        var root = doc.RootElement;
        Assert.Equal("Jane Doe", root.GetProperty("subject").GetString());
        Assert.True(root.GetProperty("totalRecords").GetInt32() >= 1);
        var resources = root.GetProperty("categories").GetProperty("resourceAllocation");
        Assert.Equal("Jane Doe", resources[0].GetProperty("name").GetString());
    }

    [Fact]
    public async Task Export_matches_a_subject_by_email_too()
    {
        var res = await As("admin", "/api/v1/gdpr/export?subject=jane.doe@birgma.com");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
        var subs = doc.RootElement.GetProperty("categories").GetProperty("subscriptions");
        Assert.Equal(1, subs.GetArrayLength());
    }

    [Fact]
    public async Task Export_does_not_leak_a_different_persons_records()
    {
        // Exporting Jane must not return John's resource row (exact-match isolation).
        var res = await As("admin", "/api/v1/gdpr/export?subject=Jane%20Doe");
        using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
        var resources = doc.RootElement.GetProperty("categories").GetProperty("resourceAllocation");
        Assert.Equal(1, resources.GetArrayLength());
        Assert.Equal("Jane Doe", resources[0].GetProperty("name").GetString());
    }
}
