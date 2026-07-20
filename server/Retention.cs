using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;

namespace Atlas.Api.Governance;

// ============================================================================
//  Data retention & the right to erasure — by ANONYMISATION, not deletion.
//
//  Two flows:
//   1. Age-based retention (background + admin "run now"): once historical
//      records pass the retention window (default 10 years), the personal
//      identifiers in them are replaced with a stable pseudonym. The ROWS ARE
//      KEPT, so the audit trail's integrity — who-approved-what sequences,
//      counts — survives; only the personal data is removed. This reconciles
//      GDPR storage-limitation with legitimate long-term audit retention.
//   2. Right to erasure (admin, on request): pseudonymise a single named
//      person everywhere they appear — the companion to the DSAR export.
//
//  Pseudonyms are STABLE (same input → same token via a one-way hash), so the
//  age-based pass keeps "these events had the same actor" without revealing who.
// ============================================================================
public static class Retention
{
    // ---- Pseudonym helpers -------------------------------------------------
    static string Hash8(string s)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(s.Trim().ToLowerInvariant()));
        return Convert.ToHexString(bytes.AsSpan(0, 4)).ToLowerInvariant();
    }
    const string NamePrefix = "Anonymised ";
    static string NameToken(string original) => NamePrefix + Hash8(original);
    static string EmailToken(string original) => Hash8(original) + "@anonymised.invalid";
    static bool IsAnonName(string v) => v.StartsWith(NamePrefix, StringComparison.Ordinal);
    static bool IsAnonEmail(string v) => v.EndsWith("@anonymised.invalid", StringComparison.Ordinal);

    // The retention cut-off from config: Retention:Days wins if set (for tests),
    // else Retention:Years (default 10). Records older than this are anonymised.
    public static DateTime CutoffFromConfig(IConfiguration cfg)
    {
        var days = cfg.GetValue("Retention:Days", 0);
        var window = days > 0 ? TimeSpan.FromDays(days) : TimeSpan.FromDays(365 * cfg.GetValue("Retention:Years", 10));
        return DateTime.UtcNow - window;
    }

    // ---- Age-based anonymisation ------------------------------------------
    // Anonymises the actor on audit events, and the user key on notifications,
    // older than `cutoffUtc`. Idempotent (already-anonymised rows are skipped);
    // returns the number of rows changed. Only saves when something changed.
    public static async Task<int> AnonymizeExpiredAsync(AtlasDbContext db, DateTime cutoffUtc)
    {
        var changed = 0;

        var oldAudits = await db.AuditEvents.Where(e => e.At < cutoffUtc).ToListAsync();
        foreach (var e in oldAudits.Where(e => !string.IsNullOrEmpty(e.Actor) && !IsAnonName(e.Actor)))
        {
            e.Actor = NameToken(e.Actor);
            changed++;
        }

        var oldNotifs = await db.Notifications.Where(n => n.At < cutoffUtc).ToListAsync();
        foreach (var n in oldNotifs.Where(n => !string.IsNullOrEmpty(n.UserKey) && !IsAnonName(n.UserKey)))
        {
            n.UserKey = NameToken(n.UserKey);
            changed++;
        }

        if (changed > 0) await db.SaveChangesAsync();
        return changed;
    }

    // ---- Right to erasure --------------------------------------------------
    // Pseudonymises a single subject (matched exactly, case-insensitively, by
    // name / email / user key) across every table that holds their personal
    // data. Rows are kept; identifiers are tokenised. Returns rows changed.
    public static async Task<int> AnonymizeSubjectAsync(AtlasDbContext db, string subject)
    {
        var s = subject.Trim();
        if (s.Length == 0) return 0;
        bool Eq(string? v) => !string.IsNullOrWhiteSpace(v) && string.Equals(v!.Trim(), s, StringComparison.OrdinalIgnoreCase);
        var changed = 0;

        foreach (var r in (await db.Resources.ToListAsync()).Where(r => Eq(r.Name)))
        { r.Name = NameToken(r.Name); r.Initials = ""; changed++; }

        foreach (var m in (await db.TeamMembers.ToListAsync()).Where(m => Eq(m.DisplayName) || Eq(m.Email)))
        {
            if (!string.IsNullOrEmpty(m.DisplayName) && !IsAnonName(m.DisplayName)) m.DisplayName = NameToken(m.DisplayName);
            if (!string.IsNullOrEmpty(m.Email) && !IsAnonEmail(m.Email)) m.Email = EmailToken(m.Email);
            changed++;
        }

        foreach (var a in (await db.ProductAllocations.ToListAsync()).Where(a => Eq(a.MemberName) || Eq(a.MemberEmail)))
        {
            if (!string.IsNullOrEmpty(a.MemberName) && !IsAnonName(a.MemberName)) a.MemberName = NameToken(a.MemberName);
            if (!string.IsNullOrEmpty(a.MemberEmail) && !IsAnonEmail(a.MemberEmail)) a.MemberEmail = EmailToken(a.MemberEmail);
            changed++;
        }

        foreach (var m in (await db.ProductMembers.ToListAsync()).Where(m => Eq(m.Name)))
        { m.Name = NameToken(m.Name); changed++; }

        foreach (var x in (await db.Subscriptions.ToListAsync()).Where(x => Eq(x.UserKey) || Eq(x.Email)))
        {
            if (!string.IsNullOrEmpty(x.UserKey) && !IsAnonName(x.UserKey)) x.UserKey = NameToken(x.UserKey);
            if (!string.IsNullOrEmpty(x.Email) && !IsAnonEmail(x.Email)) x.Email = EmailToken(x.Email);
            changed++;
        }

        foreach (var x in (await db.NotificationPrefs.ToListAsync()).Where(x => Eq(x.UserKey) || Eq(x.EmailAddr)))
        {
            if (!string.IsNullOrEmpty(x.UserKey) && !IsAnonName(x.UserKey)) x.UserKey = NameToken(x.UserKey);
            if (!string.IsNullOrEmpty(x.EmailAddr) && !IsAnonEmail(x.EmailAddr)) x.EmailAddr = EmailToken(x.EmailAddr);
            changed++;
        }

        foreach (var x in (await db.Notifications.ToListAsync()).Where(x => Eq(x.UserKey)))
        { x.UserKey = NameToken(x.UserKey); changed++; }

        foreach (var e in (await db.AuditEvents.ToListAsync()).Where(e => Eq(e.Actor)))
        { e.Actor = NameToken(e.Actor); changed++; }

        // Free-text ownership / requester references across the portfolio.
        foreach (var p in (await db.Projects.ToListAsync()).Where(p => Eq(p.Owner))) { p.Owner = NameToken(p.Owner); changed++; }
        foreach (var p in (await db.Programs.ToListAsync()).Where(p => Eq(p.Owner))) { p.Owner = NameToken(p.Owner); changed++; }
        foreach (var p in (await db.Products.ToListAsync()).Where(p => Eq(p.Owner))) { p.Owner = NameToken(p.Owner); changed++; }
        foreach (var o in (await db.Objectives.ToListAsync()).Where(o => Eq(o.Owner))) { o.Owner = NameToken(o.Owner); changed++; }
        foreach (var b in (await db.Blockers.ToListAsync()).Where(b => Eq(b.Owner))) { b.Owner = NameToken(b.Owner); changed++; }
        foreach (var d in (await db.Demands.ToListAsync()).Where(d => Eq(d.Requester))) { d.Requester = NameToken(d.Requester); changed++; }

        // A development plan is entirely about the subject (manager's private note),
        // so erase = delete the row rather than tokenise. Keyed by display name in
        // the Setting store (ADR-0062/0063).
        var devPlan = await db.Settings.FindAsync($"devplan.{s}");
        if (devPlan is not null) { db.Settings.Remove(devPlan); changed++; }

        if (changed > 0) await db.SaveChangesAsync();
        return changed;
    }

    // ---- Admin endpoints ---------------------------------------------------
    public static void MapRetentionEndpoints(this RouteGroupBuilder api)
    {
        // Run the age-based retention pass on demand (in addition to the daily
        // background pass). Platform-Administrator only, and audited.
        api.MapPost("/admin/retention/run", async (AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (!Permissions.IsPlatformAdmin(http, cfg)) return AdminOnly("run data retention");
            var cutoff = CutoffFromConfig(cfg);
            var count = await AnonymizeExpiredAsync(db, cutoff);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "GDPR", "Ran data retention", $"{count} record(s) anonymised, cutoff {cutoff:yyyy-MM-dd}"));
            await db.SaveChangesAsync();
            return Results.Ok(new { anonymised = count, cutoff = cutoff.ToString("o") });
        });

        // Right to erasure for a specific person (name / email / user key).
        api.MapPost("/gdpr/erase", async (string? subject, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (!Permissions.IsPlatformAdmin(http, cfg)) return AdminOnly("erase a data subject");
            var s = (subject ?? "").Trim();
            if (s.Length == 0) return Results.BadRequest(new { error = "A subject (name, email or user key) is required." });
            var count = await AnonymizeSubjectAsync(db, s);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "GDPR", "Erased data subject (anonymised)", $"{s} · {count} record(s)"));
            await db.SaveChangesAsync();
            return Results.Ok(new { subject = s, anonymised = count });
        });
    }

    static IResult AdminOnly(string what) => Results.Json(
        new { error = $"Only a Platform Administrator can {what}." },
        statusCode: StatusCodes.Status403Forbidden);
}

// Daily background pass that anonymises records past the retention window.
// Enabled by default (Retention:Enabled); with the 10-year window nothing is
// touched for a decade, but the machinery runs and is verifiable with a short
// window. Failures are logged, never fatal.
public sealed class RetentionHostedService(IServiceProvider services, IConfiguration cfg, ILogger<RetentionHostedService> log)
    : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Let startup migrations/seed settle before the first pass.
        try { await Task.Delay(TimeSpan.FromSeconds(15), stoppingToken); }
        catch (OperationCanceledException) { return; }

        using var timer = new PeriodicTimer(TimeSpan.FromHours(24));
        do
        {
            try
            {
                using var scope = services.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AtlasDbContext>();
                var count = await Retention.AnonymizeExpiredAsync(db, Retention.CutoffFromConfig(cfg));
                if (count > 0) log.LogInformation("Retention pass anonymised {Count} expired record(s).", count);
                // Same daily cadence: nudge the admin if the DB password is due for rotation.
                if (await SecretRotation.CheckAndNotifyAsync(db, cfg))
                    log.LogInformation("Raised a database-password rotation alert.");
            }
            catch (Exception ex)
            {
                log.LogWarning(ex, "Retention pass failed: {Message}. Will retry on the next cycle.", ex.Message);
            }
        }
        while (await SafeWait(timer, stoppingToken));
    }

    static async Task<bool> SafeWait(PeriodicTimer timer, CancellationToken ct)
    {
        try { return await timer.WaitForNextTickAsync(ct); }
        catch (OperationCanceledException) { return false; }
    }
}
