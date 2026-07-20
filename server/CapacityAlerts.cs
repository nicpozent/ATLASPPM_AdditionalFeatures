using Microsoft.EntityFrameworkCore;

namespace Atlas.Api.People;

// ============================================================================
//  Over-allocation alerts. The Capacity insight screen already shows who is
//  loaded past 100%, but that only helps someone who happens to be looking. This
//  turns it into a *delivered* signal: a periodic pass (CapacityAlertService)
//  computes the shared roster and emits an `over_allocation` notification for
//  each newly over-allocated person to everyone who opted into that event.
//
//  De-duplication: the set of currently over-allocated names is persisted in the
//  Settings store (key `capacity.alert.snapshot`). Only people who are over now
//  but weren't at the last pass are notified, so a persistently-overloaded person
//  isn't re-pinged every cycle — but someone who dips under and climbs back over
//  is alerted again. The snapshot is always refreshed, even when nobody has opted
//  in, so opting in later doesn't dump a backlog of already-known overloads.
// ============================================================================
public static class CapacityAlerts
{
    public const string SnapshotKey = "capacity.alert.snapshot";
    const int Threshold = 100; // % — matches the Capacity insight "over" list.

    // Compute newly-over-allocated people vs the stored snapshot, emit a
    // notification for each, and persist the new snapshot. Returns the names that
    // were freshly flagged this pass (may be empty). `actorKey` is excluded from
    // delivery like any other emitter; the background pass passes "system".
    public static async Task<List<string>> RunAsync(AtlasDbContext db, IConfiguration cfg, DateOnly on, string actorKey = "system")
    {
        var roster = await ResourcesData.RosterAsync(db, on);
        var overNow = roster.Where(p => p.Total > Threshold)
            .OrderByDescending(p => p.Total)
            .ToList();
        var overNames = overNow.Select(p => p.Name).ToHashSet(StringComparer.OrdinalIgnoreCase);

        var snap = await db.Settings.FindAsync(SnapshotKey);
        var previous = (snap?.Value ?? "")
            .Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var fresh = overNow.Where(p => !previous.Contains(p.Name)).ToList();

        foreach (var p in fresh)
        {
            var title = $"{p.Name} is over-allocated";
            var body = $"{p.Name} ({p.Title}, {p.Dept}) is allocated {p.Total}% for {on:yyyy-MM-dd} " +
                       $"— {p.Project}% projects, {p.Product}% products, {p.Ops}% ops. Rebalance to bring them under 100%.";
            await Notifications.EmitPortfolioAsync(db, cfg, Notifications.OverAllocation,
                title, body, "person", p.Name, actorKey);
        }

        // Persist the current over-set as the new baseline (sorted for stable diffs).
        var value = string.Join('\n', overNames.OrderBy(n => n, StringComparer.OrdinalIgnoreCase));
        if (snap is null) db.Settings.Add(new Setting { Key = SnapshotKey, Value = value });
        else snap.Value = value;
        await db.SaveChangesAsync();

        if (fresh.Count > 0) AtlasTelemetry.CapacityAlerts.Add(fresh.Count);
        return fresh.Select(p => p.Name).ToList();
    }

    public static void MapCapacityAlertEndpoints(this RouteGroupBuilder api)
    {
        // Manual trigger — run the over-allocation pass now and report what was
        // flagged. Same capability as the rest of the capacity/ops domain.
        api.MapPost("/capacity/alerts/run", async (AtlasDbContext db, IConfiguration cfg, HttpContext http, string? asOf) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-ops", "E") is { } denied) return denied;
            var on = !string.IsNullOrWhiteSpace(asOf) && DateOnly.TryParse(asOf, out var d)
                ? d : DateOnly.FromDateTime(DateTime.UtcNow);
            var me = Permissions.CallerKey(http, cfg);
            var flagged = await CapacityAlerts.RunAsync(db, cfg, on, me);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Capacity", "Ran over-allocation alerts",
                flagged.Count == 0 ? "No new over-allocations" : $"Flagged {flagged.Count}: {string.Join(", ", flagged)}"));
            await db.SaveChangesAsync();
            return Results.Ok(new { flagged, count = flagged.Count });
        });
    }
}

// ----------------------------------------------------------------------------
//  Background pass. Runs on an interval (Capacity:AlertHours, default 24) once
//  the app has settled. Best-effort: a failure is logged and the next tick tries
//  again. Idle-safe — if the roster is empty or nobody is over-allocated it just
//  refreshes the (empty) snapshot and emits nothing.
// ----------------------------------------------------------------------------
public class CapacityAlertService(IServiceProvider sp, IConfiguration cfg, ILogger<CapacityAlertService> log) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var hours = Math.Max(1, cfg.GetValue("Capacity:AlertHours", 24));
        try { await Task.Delay(TimeSpan.FromSeconds(60), stoppingToken); }
        catch (OperationCanceledException) { return; }

        using var timer = new PeriodicTimer(TimeSpan.FromHours(hours));
        do
        {
            try
            {
                using var scope = sp.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AtlasDbContext>();
                var flagged = await CapacityAlerts.RunAsync(db, cfg, DateOnly.FromDateTime(DateTime.UtcNow));
                if (flagged.Count > 0)
                    log.LogInformation("Over-allocation alert pass flagged {Count} person(s): {Names}", flagged.Count, string.Join(", ", flagged));
            }
            catch (Exception ex) { log.LogWarning(ex, "Over-allocation alert pass failed"); }
        }
        while (await SafeWait(timer, stoppingToken));
    }

    static async Task<bool> SafeWait(PeriodicTimer timer, CancellationToken ct)
    {
        try { return await timer.WaitForNextTickAsync(ct); }
        catch (OperationCanceledException) { return false; }
    }
}
