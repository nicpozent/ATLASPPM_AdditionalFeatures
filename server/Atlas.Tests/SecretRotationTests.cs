using System.Net;
using System.Net.Http.Json;
using Atlas.Api;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace Atlas.Tests;

public class SecretRotationLogicTests
{
    static AtlasDbContext NewDb() =>
        new(new DbContextOptionsBuilder<AtlasDbContext>()
            .UseInMemoryDatabase("rotation-" + Guid.NewGuid().ToString("N")).Options);

    static IConfiguration EmptyCfg() => new ConfigurationBuilder().Build();

    [Fact]
    public void Never_recorded_is_unknown()
    {
        var (days, status) = SecretRotation.Compute(null, DateTime.UtcNow, 90, 180);
        Assert.Null(days);
        Assert.Equal("unknown", status);
    }

    [Theory]
    [InlineData(10, "ok")]
    [InlineData(89, "ok")]
    [InlineData(90, "warn")]
    [InlineData(179, "warn")]
    [InlineData(180, "critical")]
    [InlineData(400, "critical")]
    public void Status_bands_are_correct(int ageDays, string expected)
    {
        var now = DateTime.UtcNow;
        var rotated = now.AddDays(-ageDays).ToString("yyyy-MM-dd");
        var (days, status) = SecretRotation.Compute(rotated, now, 90, 180);
        Assert.Equal(expected, status);
        Assert.Equal(ageDays, days);
    }

    [Fact]
    public async Task Anchor_sets_todays_date_once_then_leaves_it_alone()
    {
        using var db = NewDb();
        await SecretRotation.EnsureAnchorAsync(db);
        var anchored = db.Settings.Single(s => s.Key == "security.rotation.db.rotatedAt").Value;
        Assert.Equal(DateTime.UtcNow.ToString("yyyy-MM-dd"), anchored);

        // A second run must not overwrite an existing (e.g. later-recorded) date.
        db.Settings.Single(s => s.Key == "security.rotation.db.rotatedAt").Value = "2000-01-01";
        await db.SaveChangesAsync();
        await SecretRotation.EnsureAnchorAsync(db);
        Assert.Equal("2000-01-01", db.Settings.Single(s => s.Key == "security.rotation.db.rotatedAt").Value);
    }

    [Fact]
    public async Task Notification_escalates_once_per_level()
    {
        using var db = NewDb();
        db.Settings.Add(new Setting { Key = "security.rotation.db.rotatedAt", Value = DateTime.UtcNow.AddDays(-100).ToString("yyyy-MM-dd") });
        await db.SaveChangesAsync();

        // First check at warn level → one notification.
        Assert.True(await SecretRotation.CheckAndNotifyAsync(db, EmptyCfg()));
        Assert.Equal(1, db.Notifications.Count());
        Assert.Contains("rotation due", db.Notifications.Single().Title);

        // Second check, still warn → no duplicate.
        Assert.False(await SecretRotation.CheckAndNotifyAsync(db, EmptyCfg()));
        Assert.Equal(1, db.Notifications.Count());
    }

    [Fact]
    public async Task Escalation_from_warn_to_critical_notifies_again()
    {
        using var db = NewDb();
        db.Settings.Add(new Setting { Key = "security.rotation.db.notified", Value = "warn" });
        db.Settings.Add(new Setting { Key = "security.rotation.db.rotatedAt", Value = DateTime.UtcNow.AddDays(-200).ToString("yyyy-MM-dd") });
        await db.SaveChangesAsync();

        Assert.True(await SecretRotation.CheckAndNotifyAsync(db, EmptyCfg()));
        Assert.Equal(1, db.Notifications.Count());
        Assert.Contains("change it now", db.Notifications.Single().Title);
    }
}

public class SecretRotationEndpointTests : IClassFixture<AtlasApiFactory>
{
    readonly AtlasApiFactory _factory;
    public SecretRotationEndpointTests(AtlasApiFactory factory) => _factory = factory;

    async Task<HttpResponseMessage> Send(string? role, HttpMethod method, string path)
    {
        var client = _factory.CreateClient();
        var req = new HttpRequestMessage(method, path);
        if (role is not null) req.Headers.Add("X-Atlas-Role", role);
        if (method == HttpMethod.Post) req.Content = JsonContent.Create(new { });
        return await client.SendAsync(req);
    }

    [Theory]
    [InlineData("pmo")]
    [InlineData("pm")]
    [InlineData("stakeholder")]
    public async Task Viewing_rotation_status_needs_platform_access(string role)
    {
        Assert.Equal(HttpStatusCode.Forbidden, (await Send(role, HttpMethod.Get, "/api/v1/admin/secret-rotation")).StatusCode);
    }

    [Fact]
    public async Task Admin_sees_status_and_can_mark_rotated()
    {
        var view = await Send("admin", HttpMethod.Get, "/api/v1/admin/secret-rotation");
        Assert.Equal(HttpStatusCode.OK, view.StatusCode);

        var mark = await Send("admin", HttpMethod.Post, "/api/v1/admin/secret-rotation/mark");
        Assert.Equal(HttpStatusCode.OK, mark.StatusCode);

        // After marking today, status is ok.
        var after = await Send("admin", HttpMethod.Get, "/api/v1/admin/secret-rotation");
        using var doc = System.Text.Json.JsonDocument.Parse(await after.Content.ReadAsStringAsync());
        Assert.Equal("ok", doc.RootElement.GetProperty("status").GetString());
    }

    [Fact]
    public async Task Marking_rotated_needs_full_platform_access()
    {
        Assert.Equal(HttpStatusCode.Forbidden, (await Send("pmo", HttpMethod.Post, "/api/v1/admin/secret-rotation/mark")).StatusCode);
    }
}
