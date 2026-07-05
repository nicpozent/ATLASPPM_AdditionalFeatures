using System.Net;
using System.Net.Http.Json;
using Atlas.Api;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Atlas.Tests;

// Unit tests for the anonymisation logic (a standalone in-memory context) and
// endpoint-level tests for the admin-only retention / erasure routes.
public class RetentionTests
{
    static AtlasDbContext NewDb() =>
        new(new DbContextOptionsBuilder<AtlasDbContext>()
            .UseInMemoryDatabase("retention-" + Guid.NewGuid().ToString("N")).Options);

    [Fact]
    public async Task Expired_audit_actors_are_anonymised_recent_ones_kept()
    {
        using var db = NewDb();
        db.AuditEvents.Add(new AuditEvent { At = DateTime.UtcNow.AddYears(-11), Actor = "Old Person", Role = "pm", Action = "Did a thing" });
        db.AuditEvents.Add(new AuditEvent { At = DateTime.UtcNow.AddDays(-3), Actor = "Recent Person", Role = "pm", Action = "Did a thing" });
        await db.SaveChangesAsync();

        var cutoff = DateTime.UtcNow.AddYears(-10);
        var changed = await Retention.AnonymizeExpiredAsync(db, cutoff);

        Assert.Equal(1, changed);
        var actors = db.AuditEvents.Select(e => e.Actor).ToList();
        Assert.Contains(actors, a => a.StartsWith("Anonymised "));
        Assert.Contains("Recent Person", actors);           // recent row untouched
        Assert.DoesNotContain("Old Person", actors);        // old actor gone
    }

    [Fact]
    public async Task Anonymisation_is_idempotent()
    {
        using var db = NewDb();
        db.AuditEvents.Add(new AuditEvent { At = DateTime.UtcNow.AddYears(-11), Actor = "Old Person", Role = "pm" });
        await db.SaveChangesAsync();

        var cutoff = DateTime.UtcNow.AddYears(-10);
        Assert.Equal(1, await Retention.AnonymizeExpiredAsync(db, cutoff));
        Assert.Equal(0, await Retention.AnonymizeExpiredAsync(db, cutoff)); // nothing left to do
    }

    [Fact]
    public async Task Erasing_a_subject_pseudonymises_them_everywhere_but_keeps_rows()
    {
        using var db = NewDb();
        db.Resources.Add(new Resource { Name = "Jane Doe", Role = "Eng", Dept = "Dev", Initials = "JD", Color = "#000" });
        db.Subscriptions.Add(new Subscription { UserKey = "jane.doe@x.com", Email = "jane.doe@x.com", TargetType = "project", TargetId = "P-1", CreatedAt = DateTime.UtcNow });
        db.Projects.Add(new Project { Id = "P-1", Name = "Alpha", Owner = "Jane Doe", Dept = "Dev", Due = "", Methodology = "", Phase = "", Target = "" });
        db.Resources.Add(new Resource { Name = "John Smith", Role = "Eng", Dept = "Dev", Initials = "JS", Color = "#111" });
        await db.SaveChangesAsync();

        var changed = await Retention.AnonymizeSubjectAsync(db, "Jane Doe");
        Assert.True(changed >= 2, $"expected >=2 rows changed, got {changed}");

        // Rows kept, identity gone.
        Assert.Equal(2, db.Resources.Count());
        Assert.DoesNotContain(db.Resources.Select(r => r.Name), n => n == "Jane Doe");
        Assert.Contains(db.Resources.Select(r => r.Name), n => n == "John Smith"); // other person untouched
        Assert.StartsWith("Anonymised ", db.Projects.Single().Owner);
    }

    [Fact]
    public async Task Erasing_by_email_pseudonymises_the_subscription()
    {
        using var db = NewDb();
        db.Subscriptions.Add(new Subscription { UserKey = "u", Email = "jane.doe@x.com", TargetType = "project", TargetId = "P-1", CreatedAt = DateTime.UtcNow });
        await db.SaveChangesAsync();

        var changed = await Retention.AnonymizeSubjectAsync(db, "jane.doe@x.com");
        Assert.Equal(1, changed);
        Assert.EndsWith("@anonymised.invalid", db.Subscriptions.Single().Email);
    }
}

// Admin-only enforcement on the retention / erasure endpoints.
public class RetentionEndpointTests : IClassFixture<AtlasApiFactory>
{
    readonly AtlasApiFactory _factory;
    public RetentionEndpointTests(AtlasApiFactory factory) => _factory = factory;

    async Task<HttpResponseMessage> As(string? role, string path)
    {
        var client = _factory.CreateClient();
        var req = new HttpRequestMessage(HttpMethod.Post, path);
        if (role is not null) req.Headers.Add("X-Atlas-Role", role);
        req.Content = JsonContent.Create(new { });
        return await client.SendAsync(req);
    }

    [Theory]
    [InlineData("pmo")]
    [InlineData("pm")]
    [InlineData("stakeholder")]
    public async Task Running_retention_is_admin_only(string role)
    {
        Assert.Equal(HttpStatusCode.Forbidden, (await As(role, "/api/v1/admin/retention/run")).StatusCode);
    }

    [Fact]
    public async Task Admin_can_run_retention()
    {
        var res = await As("admin", "/api/v1/admin/retention/run");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
    }

    [Theory]
    [InlineData("pmo")]
    [InlineData("stakeholder")]
    public async Task Erasure_is_admin_only(string role)
    {
        Assert.Equal(HttpStatusCode.Forbidden, (await As(role, "/api/v1/gdpr/erase?subject=Someone")).StatusCode);
    }

    [Fact]
    public async Task Erasure_requires_a_subject()
    {
        Assert.Equal(HttpStatusCode.BadRequest, (await As("admin", "/api/v1/gdpr/erase")).StatusCode);
    }

    [Fact]
    public async Task Admin_can_erase_a_subject()
    {
        var res = await As("admin", "/api/v1/gdpr/erase?subject=Nobody%20Here");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
    }
}
