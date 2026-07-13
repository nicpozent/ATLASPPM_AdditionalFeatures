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
    // Snapshot serialisation. EF fixes up navigation properties within the
    // tracked context, so ignore cycles. Attachment file bytes are omitted (see
    // OmitBytesConverter) — the data snapshot stays a data backup; file contents
    // are the separate "Artifacts & files" backup stream.
    static readonly JsonSerializerOptions SnapshotJson = new()
    {
        WriteIndented = true,
        ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles,
        Converters = { new OmitBytesConverter() },
    };

    // A complete JSON snapshot of every table's structured data. Attachment rows
    // are included (so the catalogue is complete) but their raw `byte[]` payloads
    // are omitted to keep the JSON a data backup, not a multi-GB blob dump.
    // Returns (json bytes, record count).
    static async Task<(byte[] Bytes, int Records)> SnapshotAsync(AtlasDbContext db)
    {
        var data = new Dictionary<string, object>
        {
            // Portfolio & delivery
            ["projects"] = await db.Projects.ToListAsync(),
            ["blockers"] = await db.Blockers.ToListAsync(),
            ["projectComments"] = await db.ProjectComments.ToListAsync(),
            ["stakeholderEntries"] = await db.StakeholderEntries.ToListAsync(),
            ["demands"] = await db.Demands.ToListAsync(),
            ["demandAttachments"] = await db.DemandAttachments.ToListAsync(),
            ["demandComments"] = await db.DemandComments.ToListAsync(),
            ["programs"] = await db.Programs.ToListAsync(),
            ["products"] = await db.Products.ToListAsync(),
            ["productTasks"] = await db.ProductTasks.ToListAsync(),
            ["productMembers"] = await db.ProductMembers.ToListAsync(),
            ["productAllocations"] = await db.ProductAllocations.ToListAsync(),
            ["objectives"] = await db.Objectives.ToListAsync(),
            ["keyResults"] = await db.KeyResults.ToListAsync(),
            ["releases"] = await db.Releases.ToListAsync(),
            ["deliveryReports"] = await db.DeliveryReports.ToListAsync(),
            ["dashboardKpis"] = await db.DashboardKpis.ToListAsync(),
            ["activityEvents"] = await db.ActivityEvents.ToListAsync(),
            ["myTasks"] = await db.MyTasks.ToListAsync(),
            ["budgetSnapshots"] = await db.BudgetSnapshots.ToListAsync(),
            ["newsBlocks"] = await db.NewsBlocks.ToListAsync(),
            // Schedule / phases / PI planning
            ["phases"] = await db.Phases.ToListAsync(),
            ["milestones"] = await db.Milestones.ToListAsync(),
            ["increments"] = await db.ProgramIncrements.ToListAsync(),
            ["piIterations"] = await db.PiIterations.ToListAsync(),
            ["piObjectives"] = await db.PiObjectives.ToListAsync(),
            ["piDependencies"] = await db.PiDependencies.ToListAsync(),
            ["roadmapItems"] = await db.RoadmapItems.ToListAsync(),
            ["roadmapMilestones"] = await db.RoadmapMilestones.ToListAsync(),
            ["roadmapDependencies"] = await db.RoadmapDependencies.ToListAsync(),
            ["roadmapLinks"] = await db.RoadmapLinks.ToListAsync(),
            // People, teams & skills
            ["resources"] = await db.Resources.ToListAsync(),
            ["entraGroups"] = await db.EntraGroups.ToListAsync(),
            ["teamMembers"] = await db.TeamMembers.ToListAsync(),
            ["managerNodes"] = await db.ManagerNodes.ToListAsync(),
            ["subTeams"] = await db.SubTeams.ToListAsync(),
            ["subTeamMembers"] = await db.SubTeamMembers.ToListAsync(),
            ["teamAssignments"] = await db.TeamAssignments.ToListAsync(),
            ["teamAssignmentMembers"] = await db.TeamAssignmentMembers.ToListAsync(),
            ["skills"] = await db.Skills.ToListAsync(),
            ["skillRatings"] = await db.SkillRatings.ToListAsync(),
            ["absences"] = await db.Absences.ToListAsync(),
            ["wowOverrides"] = await db.WowOverrides.ToListAsync(),
            // Work items, ops & quality
            ["tasks"] = await db.ProjectTasks.ToListAsync(),
            ["taskComments"] = await db.TaskComments.ToListAsync(),
            ["taskAttachments"] = await db.TaskAttachments.ToListAsync(),
            ["epics"] = await db.Epics.ToListAsync(),
            ["sprints"] = await db.Sprints.ToListAsync(),
            ["opsServices"] = await db.OpsServices.ToListAsync(),
            ["opsItems"] = await db.OpsItems.ToListAsync(),
            ["opsItemComments"] = await db.OpsItemComments.ToListAsync(),
            ["opsItemAttachments"] = await db.OpsItemAttachments.ToListAsync(),
            ["opsTaskLinks"] = await db.OpsTaskLinks.ToListAsync(),
            ["testPlans"] = await db.TestPlans.ToListAsync(),
            ["testPlanTasks"] = await db.TestPlanTasks.ToListAsync(),
            ["defects"] = await db.Defects.ToListAsync(),
            ["projectDependencies"] = await db.ProjectDependencies.ToListAsync(),
            // Governance & architecture
            ["gates"] = await db.Gates.ToListAsync(),
            ["gateCriteria"] = await db.GateCriteria.ToListAsync(),
            ["decisions"] = await db.Decisions.ToListAsync(),
            ["raid"] = await db.RaidItems.ToListAsync(),
            ["securityProfiles"] = await db.SecurityProfiles.ToListAsync(),
            ["securityControls"] = await db.SecurityControls.ToListAsync(),
            ["securityReviewGates"] = await db.SecurityReviewGates.ToListAsync(),
            ["archProfiles"] = await db.ArchProfiles.ToListAsync(),
            ["admPhases"] = await db.AdmPhases.ToListAsync(),
            ["archApprovals"] = await db.ArchApprovals.ToListAsync(),
            ["changeRequests"] = await db.ChangeRequests.ToListAsync(),
            ["requirements"] = await db.Requirements.ToListAsync(),
            ["requirementAttachments"] = await db.RequirementAttachments.ToListAsync(),
            // Financials
            ["costLines"] = await db.CostLines.ToListAsync(),
            // Artifacts (metadata; file bytes omitted — see OmitBytesConverter)
            ["artifacts"] = await db.Artifacts.ToListAsync(),
            ["artifactVersions"] = await db.ArtifactVersions.ToListAsync(),
            // Communications & notifications
            ["communicationEntries"] = await db.CommunicationEntries.ToListAsync(),
            ["subscriptions"] = await db.Subscriptions.ToListAsync(),
            ["notificationPrefs"] = await db.NotificationPrefs.ToListAsync(),
            ["notifications"] = await db.Notifications.ToListAsync(),
            ["helpArticles"] = await db.HelpArticles.ToListAsync(),
            // Config, RBAC, dashboards & platform
            ["roles"] = await db.RoleDefs.ToListAsync(),
            ["capabilities"] = await db.Capabilities.ToListAsync(),
            ["permissions"] = await db.RolePermissions.ToListAsync(),
            ["assignments"] = await db.RoleAssignments.ToListAsync(),
            ["operational"] = await db.OperationalItems.ToListAsync(),
            ["dashboardLayouts"] = await db.DashboardLayouts.ToListAsync(),
            ["deletionRequests"] = await db.DeletionRequests.ToListAsync(),
            ["backupRuns"] = await db.BackupRuns.ToListAsync(),
            ["settings"] = await db.Settings.ToListAsync(),
            ["audit"] = await db.AuditEvents.ToListAsync(),
        };
        var records = data.Values.Sum(v => ((System.Collections.ICollection)v).Count);
        var envelope = new { generatedAt = DateTime.UtcNow.ToString("o"), records, data };
        var bytes = JsonSerializer.SerializeToUtf8Bytes(envelope, SnapshotJson);
        return (bytes, records);
    }

    // Keeps attachment metadata in the snapshot while omitting the raw file bytes
    // (those live in the separate artifact backup stream). Reads are tolerant so
    // an older blob-inclusive backup can still be parsed.
    sealed class OmitBytesConverter : System.Text.Json.Serialization.JsonConverter<byte[]>
    {
        public override byte[] Read(ref Utf8JsonReader reader, Type type, JsonSerializerOptions options) =>
            reader.TokenType == JsonTokenType.String ? reader.GetBytesFromBase64() : Array.Empty<byte>();
        public override void Write(Utf8JsonWriter writer, byte[] value, JsonSerializerOptions options) =>
            writer.WriteNullValue();
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

        // Restore from an uploaded snapshot — a MERGE (upsert by id), never a wipe:
        // it re-creates missing rows and updates existing ones for the string-keyed
        // portfolio entities and settings, and can't delete anything. NOTE: the
        // snapshot now captures every table's structured data (for archival /
        // portability / off-box retention), but this JSON merge only re-applies the
        // string-keyed roots below — identity-keyed / composite-key / FK-ordered
        // rows and file attachments are NOT safely mergeable this way, so a full
        // recovery uses a PostgreSQL dump/PITR (see docs). Platform-Admin only.
        api.MapPost("/backups/restore", async (AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-backups", "F") is { } denied) return denied;
            JsonElement root;
            try
            {
                using var doc = await JsonDocument.ParseAsync(http.Request.Body);
                root = doc.RootElement.Clone();
            }
            catch { return Results.BadRequest(new { error = "That file isn't valid JSON." }); }
            if (!root.TryGetProperty("data", out var data) || data.ValueKind != JsonValueKind.Object)
                return Results.BadRequest(new { error = "Not an Atlas backup — expected a top-level “data” object." });

            var opts = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
            var restored = new Dictionary<string, int>();

            async Task Merge<T>(string key, Func<T, string> keyOf) where T : class
            {
                if (!data.TryGetProperty(key, out var arr) || arr.ValueKind != JsonValueKind.Array) return;
                var items = arr.Deserialize<List<T>>(opts) ?? new();
                var set = db.Set<T>();
                int n = 0;
                foreach (var inc in items)
                {
                    var id = keyOf(inc);
                    if (string.IsNullOrEmpty(id)) continue;
                    var existing = await set.FindAsync(id);
                    if (existing is null) { existing = (T)Activator.CreateInstance(typeof(T))!; set.Add(existing); }
                    // SetValues copies scalar properties only — navigations are left
                    // untouched, so no child rows are double-inserted.
                    db.Entry(existing).CurrentValues.SetValues(inc);
                    n++;
                }
                if (n > 0) restored[key] = n;
            }

            await Merge<Project>("projects", p => p.Id);
            await Merge<Program>("programs", p => p.Id);
            await Merge<Product>("products", p => p.Id);
            await Merge<Release>("releases", r => r.Id);
            await Merge<Objective>("objectives", o => o.Id);
            await Merge<Setting>("settings", s => s.Key);

            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Backups", "Restored from snapshot (merge)",
                string.Join(", ", restored.Select(kv => $"{kv.Value} {kv.Key}"))));
            await db.SaveChangesAsync();
            return Results.Ok(new { ok = true, restored });
        });

        // ---- Operator settings (integration/backup toggles) ----------------
        // Any signed-in user may read the operator toggles, but SECRET values
        // (e.g. the Teams channel webhook URL) must never be returned here — the
        // connector's own status endpoint exposes only a masked host. A key is
        // treated as secret when it ends in "webhookurl"/"secret"/"token"/
        // "password" (case-insensitive), so a new secret setting is redacted by
        // default rather than leaking. See ADR-0060.
        api.MapGet("/settings", async (AtlasDbContext db) =>
            Results.Ok((await db.Settings.ToListAsync())
                .Where(s => !IsSecretSetting(s.Key))
                .ToDictionary(s => s.Key, s => s.Value)));

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

    // A setting whose value must not be returned by the broadly-readable
    // GET /settings. Secrets are matched by suffix (so a new secret key is
    // redacted by default); confidential per-scope blobs (e.g. team SWOT) are
    // matched by prefix and served only through their own scoped endpoints.
    static readonly string[] SecretSettingSuffixes = { "webhookurl", "secret", "token", "password" };
    static readonly string[] ConfidentialSettingPrefixes = { "team.swot.", "devplan.", "whiteboard." };
    static bool IsSecretSetting(string key)
    {
        var k = key.ToLowerInvariant();
        return SecretSettingSuffixes.Any(suffix => k.EndsWith(suffix))
            || ConfidentialSettingPrefixes.Any(prefix => k.StartsWith(prefix));
    }
}
