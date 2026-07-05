using Microsoft.EntityFrameworkCore;

namespace Atlas.Api;

// ============================================================================
//  Secret-rotation tracking — surfaces how long since the database password was
//  last changed, and nudges the admin before it goes stale.
//
//  The app can't observe an out-of-band password change, so rotation is
//  RECORDED by an admin ("Mark as rotated today") and stored in Settings. From
//  that date we compute the age and a status:
//    ok        (< warn window, default 90 days)
//    warn      (>= 90 days)   → "Rotate soon"
//    critical  (>= 180 days)  → "Change it now!"
//    unknown   (never recorded)
//
//  The daily background pass (RetentionHostedService) escalates a one-time admin
//  notification when the status first crosses into warn, then into critical.
// ============================================================================
public static class SecretRotation
{
    const string RotatedKey = "security.rotation.db.rotatedAt";   // ISO date (yyyy-MM-dd)
    const string NotifiedKey = "security.rotation.db.notified";   // "" | "warn" | "critical"

    static int WarnDays(IConfiguration cfg) => cfg.GetValue("Security:PasswordRotation:WarnDays", 90);
    static int CriticalDays(IConfiguration cfg) => cfg.GetValue("Security:PasswordRotation:CriticalDays", 180);

    // Pure status computation (testable). Returns the age in whole days (null if
    // never recorded) and the status band.
    public static (int? DaysSince, string Status) Compute(string? rotatedAtIso, DateTime nowUtc, int warnDays, int criticalDays)
    {
        if (string.IsNullOrWhiteSpace(rotatedAtIso) ||
            !DateTime.TryParse(rotatedAtIso, System.Globalization.CultureInfo.InvariantCulture,
                System.Globalization.DateTimeStyles.AssumeUniversal | System.Globalization.DateTimeStyles.AdjustToUniversal, out var dt))
            return (null, "unknown");
        var days = (int)(nowUtc.Date - dt.Date).TotalDays;
        if (days < 0) days = 0;
        var status = days >= criticalDays ? "critical" : days >= warnDays ? "warn" : "ok";
        return (days, status);
    }

    static int Rank(string s) => s switch { "critical" => 2, "warn" => 1, _ => 0 };

    // Daily check: raise a single admin notification each time the status first
    // escalates (ok→warn, warn→critical). Idempotent between escalations.
    public static async Task<bool> CheckAndNotifyAsync(AtlasDbContext db, IConfiguration cfg)
    {
        var rotated = (await db.Settings.FindAsync(RotatedKey))?.Value;
        var (days, status) = Compute(rotated, DateTime.UtcNow, WarnDays(cfg), CriticalDays(cfg));
        if (status is not ("warn" or "critical")) return false;

        var notified = (await db.Settings.FindAsync(NotifiedKey))?.Value ?? "";
        if (Rank(status) <= Rank(notified)) return false;   // already told them at this (or higher) level

        var title = status == "critical" ? "Database password — change it now" : "Database password — rotation due";
        var body = $"It has been {days} days since the database password was last changed "
                 + $"(warn at {WarnDays(cfg)} days, critical at {CriticalDays(cfg)}). Rotate it and mark it in Administration.";
        db.Notifications.Add(new Notification
        {
            UserKey = "admin", EventType = "security", Title = title, Body = body,
            TargetType = "admin", TargetId = "secret-rotation", At = DateTime.UtcNow,
        });
        await SetAsync(db, NotifiedKey, status);
        await db.SaveChangesAsync();
        return true;
    }

    static async Task SetAsync(AtlasDbContext db, string key, string value)
    {
        var s = await db.Settings.FindAsync(key);
        if (s is null) db.Settings.Add(new Setting { Key = key, Value = value });
        else s.Value = value;
    }

    public static void MapSecretRotationEndpoints(this RouteGroupBuilder api)
    {
        // View the rotation status (Platform & SSO settings — View).
        api.MapGet("/admin/secret-rotation", async (AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-platform", "V") is { } denied) return denied;
            var rotated = (await db.Settings.FindAsync(RotatedKey))?.Value;
            var (days, status) = Compute(rotated, DateTime.UtcNow, WarnDays(cfg), CriticalDays(cfg));
            var canManage = await Permissions.Allows(http, db, cfg, "cap-platform", "F");
            return Results.Ok(new
            {
                rotatedAt = rotated,
                daysSince = days,
                status,
                warnDays = WarnDays(cfg),
                criticalDays = CriticalDays(cfg),
                canManage,
            });
        });

        // Record that the password was rotated today (Full). Audited.
        api.MapPost("/admin/secret-rotation/mark", async (AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-platform", "F") is { } denied) return denied;
            var today = DateTime.UtcNow.ToString("yyyy-MM-dd");
            await SetAsync(db, RotatedKey, today);
            await SetAsync(db, NotifiedKey, "");   // reset the escalation ladder
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Security", "Marked database password rotated", today));
            await db.SaveChangesAsync();
            var (days, status) = Compute(today, DateTime.UtcNow, WarnDays(cfg), CriticalDays(cfg));
            return Results.Ok(new { rotatedAt = today, daysSince = days, status });
        });
    }
}
