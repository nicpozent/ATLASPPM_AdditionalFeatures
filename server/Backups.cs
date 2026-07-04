using System.Text.Json;
using Microsoft.EntityFrameworkCore;

namespace Atlas.Api;

public record SettingReq(string Value);

// ============================================================================
//  Backups & restore. "Back up all now" generates a real JSON snapshot of the
//  portfolio's live data (the downloadable backup file) and records the run.
//  Recent runs and the component summary are read from real data — nothing is
//  fabricated. Requires Full on "Backups & restore" (Platform Admin) to run or
//  download; View to see the history. Also hosts the operator settings toggles.
// ============================================================================
public static class Backups
{
    // Build the snapshot object from live data. Returns (json bytes, record count).
    static async Task<(byte[] Bytes, int Records)> SnapshotAsync(AtlasDbContext db)
    {
        var data = new Dictionary<string, object>
        {
            ["projects"] = await db.Projects.ToListAsync(),
            ["blockers"] = await db.Blockers.ToListAsync(),
            ["demands"] = await db.Demands.ToListAsync(),
            ["programs"] = await db.Programs.ToListAsync(),
            ["products"] = await db.Products.ToListAsync(),
            ["objectives"] = await db.Objectives.ToListAsync(),
            ["releases"] = await db.Releases.ToListAsync(),
            ["resources"] = await db.Resources.ToListAsync(),
            ["tasks"] = await db.ProjectTasks.ToListAsync(),
            ["epics"] = await db.Epics.ToListAsync(),
            ["gates"] = await db.Gates.ToListAsync(),
            ["raid"] = await db.RaidItems.ToListAsync(),
            ["costLines"] = await db.CostLines.ToListAsync(),
            ["operational"] = await db.OperationalItems.ToListAsync(),
            ["assignments"] = await db.RoleAssignments.ToListAsync(),
            ["roles"] = await db.RoleDefs.ToListAsync(),
            ["permissions"] = await db.RolePermissions.ToListAsync(),
            ["audit"] = await db.AuditEvents.ToListAsync(),
        };
        var records = data.Values.Sum(v => ((System.Collections.ICollection)v).Count);
        var envelope = new { generatedAt = DateTime.UtcNow.ToString("o"), records, data };
        // EF fixes up navigation properties (e.g. Project.Blockers ↔ Blocker.Project)
        // within the tracked context, so ignore cycles when serialising the snapshot.
        var bytes = JsonSerializer.SerializeToUtf8Bytes(envelope, new JsonSerializerOptions
        {
            WriteIndented = true,
            ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles,
        });
        return (bytes, records);
    }

    static string HumanSize(long bytes) => bytes switch
    {
        >= 1 << 30 => $"{bytes / (double)(1 << 30):N1} GB",
        >= 1 << 20 => $"{bytes / (double)(1 << 20):N1} MB",
        >= 1 << 10 => $"{bytes / (double)(1 << 10):N1} KB",
        _ => $"{bytes} B",
    };

    public static void MapBackupEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/backups", async (AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-backups", "V") is { } denied) return denied;
            var runs = await db.BackupRuns.OrderByDescending(r => r.At).Take(20).ToListAsync();
            var last = runs.FirstOrDefault();
            var lastLabel = last is null ? "Never" : last.At.ToString("dd MMM yyyy HH:mm 'UTC'");

            var components = new List<BackupComponentDto>
            {
                new("Database · portfolio data", "Nightly 03:00", "30 days",
                    await db.Projects.CountAsync() + await db.Demands.CountAsync() + await db.ProjectTasks.CountAsync()
                    + await db.CostLines.CountAsync() + await db.OperationalItems.CountAsync(), lastLabel),
                new("Artifacts & files", "Nightly 03:00", "90 days",
                    await db.Artifacts.CountAsync() + await db.ArtifactVersions.CountAsync(), lastLabel),
                new("Configuration & roles", "On change", "1 year",
                    await db.RoleDefs.CountAsync() + await db.RolePermissions.CountAsync(), lastLabel),
                new("Audit log", "Continuous", "7 years", await db.AuditEvents.CountAsync(), lastLabel),
            };
            var auto = (await db.Settings.FindAsync("backups.auto"))?.Value != "false";
            var canManage = await Permissions.Allows(http, db, cfg, "cap-backups", "F");
            return Results.Ok(new BackupsDto(canManage, auto, lastLabel, last?.SizeBytes ?? 0, components,
                runs.Select(r => new BackupRunDto(r.At.ToString("dd MMM yyyy HH:mm 'UTC'"), r.Actor, r.Role,
                    HumanSize(r.SizeBytes), r.Records, r.Status)).ToList()));
        });

        // Back up all now — generate the snapshot, record the run.
        api.MapPost("/backups/run", async (AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-backups", "F") is { } denied) return denied;
            var (bytes, records) = await SnapshotAsync(db);
            var run = new BackupRun
            {
                At = DateTime.UtcNow, Actor = Permissions.ActorName(http, cfg),
                Role = Permissions.ResolveRoleId(http.User, http.Request, cfg.GetValue("Auth:Enabled", false)) ?? "dev",
                SizeBytes = bytes.LongLength, Records = records, Status = "Completed",
            };
            db.BackupRuns.Add(run);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Backups", "Ran full backup", $"{records} records · {HumanSize(bytes.LongLength)}"));
            await db.SaveChangesAsync();
            return Results.Ok(new BackupRunDto(run.At.ToString("dd MMM yyyy HH:mm 'UTC'"), run.Actor, run.Role,
                HumanSize(run.SizeBytes), run.Records, run.Status));
        });

        // Download the current snapshot (the actual backup file).
        api.MapGet("/backups/snapshot.json", async (AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-backups", "F") is { } denied) return denied;
            var (bytes, _) = await SnapshotAsync(db);
            var name = $"atlas-backup-{DateTime.UtcNow:yyyyMMdd-HHmmss}.json";
            return Results.File(bytes, "application/json", name);
        });

        // ---- Operator settings (integration/backup toggles) ----------------
        api.MapGet("/settings", async (AtlasDbContext db) =>
            Results.Ok(await db.Settings.ToDictionaryAsync(s => s.Key, s => s.Value)));

        api.MapPatch("/settings/{key}", async (string key, SettingReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            // Integration/platform settings are Platform-Admin territory.
            if (await Permissions.Deny(http, db, cfg, "cap-integrations", "E") is { } denied) return denied;
            var s = await db.Settings.FindAsync(key);
            if (s is null) { s = new Setting { Key = key, Value = req.Value }; db.Settings.Add(s); }
            else s.Value = req.Value;
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Settings", "Updated setting", $"{key} = {req.Value}"));
            await db.SaveChangesAsync();
            return Results.NoContent();
        });
    }
}
