using System.Globalization;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace Atlas.Api.Integrations;

// ============================================================================
//  Jira integration — pull-only sync (Jira Cloud).
//
//  Phase 1 wired configuration, an authenticated client and a connection test.
//  Phase 2 (this file) adds the sync: each Atlas project may carry a Jira
//  project key + agile board id (Project.JiraProjectKey / JiraBoardId); when
//  set, a sync pulls that board's sprints, epics and issues into the project's
//  Sprints / Epics / Tasks (issues with no sprint land in the backlog).
//
//  Sync is one-way (Jira → Atlas) and idempotent: rows are upserted by their
//  Jira id (Sprint/Epic/Task.JiraKey), locally-created rows (JiraKey == "") are
//  never touched, and synced rows that vanished from Jira are pruned. So a
//  re-sync never clobbers local work and reflects Jira's current state.
//
//  Configuration (env / Docker secret), all empty ⇒ integration stays dormant:
//    • Jira:BaseUrl          e.g. https://yoursite.atlassian.net
//    • Jira:Email            the service account's Atlassian email
//    • Jira:ApiToken         an Atlassian API token (Basic auth)
//    • Jira:StoryPointsField optional custom-field id for story points
//                            (default customfield_10016, Jira Cloud's usual one)
//
//  Auth is HTTP Basic with "email:api-token" — the standard Jira Cloud scheme.
// ============================================================================
public record JiraImportReq(string? JiraProjectKey, int? BoardId, string? Target, string? AtlasId, string? Name);

public static class Jira
{
    // A page cap so a huge board can't run the sync unbounded (50/page ⇒ 5000).
    const int MaxPages = 100;
    const int PageSize = 50;
    public static bool JiraConfigured(IConfiguration cfg) =>
        !string.IsNullOrWhiteSpace(cfg["Jira:BaseUrl"]) &&
        !string.IsNullOrWhiteSpace(cfg["Jira:Email"]) &&
        !string.IsNullOrWhiteSpace(cfg["Jira:ApiToken"]);

    // Normalise a configured site URL to a clean https origin: tolerate a missing
    // scheme (default https) and a pasted full path/query (keep only scheme+host).
    // Returns null when the value can't form an absolute http(s) URL.
    public static string? NormalizeBaseUrl(string? raw)
    {
        var s = (raw ?? "").Trim();
        if (s.Length == 0) return null;
        if (!s.StartsWith("http://", StringComparison.OrdinalIgnoreCase) &&
            !s.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            s = "https://" + s;
        return Uri.TryCreate(s, UriKind.Absolute, out var u) && (u.Scheme == "http" || u.Scheme == "https")
            ? u.GetLeftPart(UriPartial.Authority)
            : null;
    }

    // An HttpClient pinned to the Jira site with Basic auth. Callers dispose it.
    // Operational logger — set once at startup so the best-effort degradation
    // paths (unreadable boards, skipped attachments) leave evidence rather than
    // silently reporting success. No-op until wired in Program.cs.
    static ILogger _log = NullLogger.Instance;
    public static void UseLogger(ILoggerFactory factory) => _log = factory.CreateLogger("Atlas.Jira");

    public static HttpClient Client(IConfiguration cfg)
    {
        var baseUrl = NormalizeBaseUrl(cfg["Jira:BaseUrl"])
            ?? throw new InvalidOperationException("Jira:BaseUrl isn't a valid site URL (expected e.g. https://yoursite.atlassian.net).");
        var http = new HttpClient { BaseAddress = new Uri(baseUrl + "/"), Timeout = TimeSpan.FromSeconds(20) };
        var basic = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{cfg["Jira:Email"]}:{cfg["Jira:ApiToken"]}"));
        http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", basic);
        http.DefaultRequestHeaders.Accept.Add(new("application/json"));
        return http;
    }

    // Attachment "content" URLs come straight from the Jira API response, and the
    // client `c` carries the Jira Basic-auth credential on every request. A
    // compromised/spoofed Jira instance — or a crafted issue — could point that
    // URL at an internal service (SSRF) or a foreign host (credential forwarding).
    // Only fetch when the (absolute or base-relative) URL resolves back to the
    // configured Jira origin: same scheme, host and port. Returns null to skip.
    static Uri? SafeAttachmentUri(HttpClient c, string url)
    {
        var baseAddr = c.BaseAddress;
        if (baseAddr is null || !Uri.TryCreate(baseAddr, url, out var abs)) return null;
        var ok = abs.Scheme == baseAddr.Scheme
            && string.Equals(abs.Host, baseAddr.Host, StringComparison.OrdinalIgnoreCase)
            && abs.Port == baseAddr.Port;
        return ok ? abs : null;
    }

    public static void MapJiraEndpoints(this RouteGroupBuilder api)
    {
        // Config status for the Integrations card — never calls Jira.
        api.MapGet("/integrations/jira/status", async (AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-integrations", "V") is { } denied) return denied;
            var canManage = await Permissions.Allows(http, db, cfg, "cap-integrations", "E");
            return Results.Ok(new { configured = JiraConfigured(cfg), baseUrl = cfg["Jira:BaseUrl"] ?? "", canManage });
        });

        // Live connection test — calls Jira's /myself and reports back. Managing
        // integrations requires Edit on "Integrations & connectors".
        api.MapPost("/integrations/jira/test", async (AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-integrations", "E") is { } denied) return denied;
            if (!JiraConfigured(cfg))
                return Results.Ok(new { ok = false, error = "Jira isn't configured — set Jira:BaseUrl, Jira:Email and Jira:ApiToken (see docs/jira-setup.md)." });
            try
            {
                using var c = Client(cfg);
                var res = await c.GetAsync("rest/api/3/myself");
                if (!res.IsSuccessStatusCode)
                    return Results.Ok(new { ok = false, error = $"Jira returned {(int)res.StatusCode} {res.ReasonPhrase}. Check the site URL, service-account email and API token." });
                using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
                var name = doc.RootElement.TryGetProperty("displayName", out var d) ? d.GetString() ?? "" : "";
                db.AuditEvents.Add(Permissions.Audit(http, cfg, "Integrations", "Tested Jira connection", cfg["Jira:BaseUrl"] ?? ""));
                await db.SaveChangesAsync();
                return Results.Ok(new { ok = true, displayName = name, baseUrl = cfg["Jira:BaseUrl"] ?? "" });
            }
            catch (Exception ex)
            {
                return Results.Ok(new { ok = false, error = $"Couldn't reach Jira: {ex.Message}" });
            }
        });

        // Sync one project from its mapped Jira board — the entity's "Sync from
        // Jira" / "Full re-sync" button. Per-ENTITY sync requires cap-projects E
        // (you can refresh a project you can edit); portfolio-wide bulk sync and
        // connector *configuration* stay behind cap-integrations. Both connectors
        // now share this rule — resolves the Jira(none)/ADO(cap-integrations)
        // divergence (ADR-0083). Gate first, before the background enqueue, so the
        // queued path can't skip the check (the R2 class of bug).
        api.MapPost("/projects/{id}/jira/sync", async (string id, bool? delta, bool? background, AtlasDbContext db, IConfiguration cfg, HttpContext http, SyncQueue<JiraConnector> queue) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            if (!JiraConfigured(cfg))
                return Results.Ok(new { ok = false, error = "Jira isn't configured — set Jira:BaseUrl, Jira:Email and Jira:ApiToken (see docs/jira-setup.md)." });
            var p = await db.Projects.FirstOrDefaultAsync(x => x.Id == id);
            if (p is null) return Results.NotFound();
            if (string.IsNullOrWhiteSpace(p.JiraProjectKey))
                return Results.Ok(new { ok = false, error = "This project isn't mapped to Jira — set its Jira project key first (a board id is optional and adds sprints)." });
            if (background == true) return SyncEndpoints.Queue<JiraConnector>(queue, "jira", "Jira", http, cfg, "project", id, delta ?? false);
            try
            {
                using var c = Client(cfg);
                var watermark = SyncWatermark.Now();
                var r = await SyncProjectAsync(db, cfg, c, p, delta ?? false);
                p.LastJiraSync = watermark;             // stamp AFTER a successful pull
                db.AuditEvents.Add(Permissions.Audit(http, cfg, "Integrations", (delta ?? false) ? "Delta-synced project from Jira" : "Synced project from Jira",
                    $"{p.Id} · {p.JiraProjectKey}/board {p.JiraBoardId} · {r.Sprints} sprints, {r.Epics} epics, {r.Tasks} tasks"));
                await db.SaveChangesAsync();
                return Results.Ok(new { ok = true, r.Sprints, r.Epics, r.Tasks, r.Backlog, truncated = r.Truncated });
            }
            catch (Exception ex)
            {
                return Results.Json(new { ok = false, error = $"Jira sync failed: {ex.Message}" }, statusCode: StatusCodes.Status502BadGateway);
            }
        });

        // Sync every mapped project in one pass — the Integrations "Sync now".
        api.MapPost("/integrations/jira/sync", async (bool? delta, bool? background, AtlasDbContext db, IConfiguration cfg, HttpContext http, SyncQueue<JiraConnector> queue) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-integrations", "E") is { } denied) return denied;
            if (!JiraConfigured(cfg))
                return Results.Ok(new { ok = false, error = "Jira isn't configured — set Jira:BaseUrl, Jira:Email and Jira:ApiToken (see docs/jira-setup.md)." });
            if (background == true) return SyncEndpoints.Queue<JiraConnector>(queue, "jira", "Jira", http, cfg, "all", "", delta ?? false);
            var mapped = await db.Projects
                .Where(p => !p.Archived && p.JiraProjectKey != "")
                .ToListAsync();
            if (mapped.Count == 0)
                return Results.Ok(new { ok = true, projects = 0, sprints = 0, epics = 0, tasks = 0, message = "No projects are mapped to Jira yet." });
            int sp = 0, ep = 0, tk = 0, ok = 0;
            var errors = new List<string>();
            using var c = Client(cfg);
            foreach (var p in mapped)
            {
                try
                {
                    var watermark = SyncWatermark.Now();
                    var r = await SyncProjectAsync(db, cfg, c, p, delta ?? false);
                    p.LastJiraSync = watermark;
                    sp += r.Sprints; ep += r.Epics; tk += r.Tasks; ok++;
                    await db.SaveChangesAsync();
                }
                catch (Exception ex) { errors.Add($"{p.Id}: {ex.Message}"); }
            }
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Integrations", "Synced all mapped projects from Jira",
                $"{ok}/{mapped.Count} projects · {sp} sprints, {ep} epics, {tk} tasks"));
            await db.SaveChangesAsync();
            return Results.Ok(new { ok = errors.Count == 0, projects = ok, sprints = sp, epics = ep, tasks = tk, errors });
        });

        // Sync a program's / product's mapped projects in one pass — powers the
        // "Sync from Jira" button on those entities' Overview. Syncs each linked
        // project (delta by default) and reports the roll-up.
        api.MapPost("/programs/{id}/jira/sync", async (string id, bool? delta, bool? background, AtlasDbContext db, IConfiguration cfg, HttpContext http, SyncQueue<JiraConnector> queue) =>
        {
            // Per-entity sync = cap-projects E (ADR-0083). Gate first — before
            // FindAsync and the background enqueue — so the queued path can't skip it.
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            var pg = await db.Programs.FindAsync(id);
            if (pg is null) return Results.NotFound();
            if (background == true) return SyncEndpoints.Queue<JiraConnector>(queue, "jira", "Jira", http, cfg, "program", id, delta ?? true);
            return await SyncLinkedProjectsAsync(db, cfg, http, "program", pg.Projects, delta ?? true);
        });
        api.MapPost("/products/{id}/jira/sync", async (string id, bool? delta, bool? background, AtlasDbContext db, IConfiguration cfg, HttpContext http, SyncQueue<JiraConnector> queue) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            var pr = await db.Products.FindAsync(id);
            if (pr is null) return Results.NotFound();
            if (background == true) return SyncEndpoints.Queue<JiraConnector>(queue, "jira", "Jira", http, cfg, "product", id, delta ?? true);
            return await SyncLinkedProjectsAsync(db, cfg, http, "product", pr.Projects, delta ?? true);
        });

        // Background sync job status (poll target for the 202 responses above) —
        // registered via the shared helper (ADR-0083).
        api.MapSyncStatus<JiraConnector>("jira");

        // Re-sync a Jira-mapped Ops service (pull its project's issues into items).
        // The one-time import (target=ops) creates the mapping; this keeps it fresh.
        api.MapPost("/ops/services/{id:int}/jira/sync", async (int id, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-integrations", "E") is { } denied) return denied;
            if (!JiraConfigured(cfg))
                return Results.Ok(new { ok = false, error = "Jira isn't configured — set Jira:BaseUrl, Jira:Email and Jira:ApiToken (see docs/jira-setup.md)." });
            var svc = await db.OpsServices.FindAsync(id);
            if (svc is null) return Results.NotFound();
            if (string.IsNullOrWhiteSpace(svc.JiraProjectKey))
                return Results.Ok(new { ok = false, error = "This Ops service isn't mapped to Jira — import a Jira project into Ops from Integrations first." });
            try
            {
                var n = await PullOpsItemsAsync(db, cfg, svc);
                db.AuditEvents.Add(Permissions.Audit(http, cfg, "Integrations", "Synced Ops service from Jira", $"{svc.Ref} · {svc.JiraProjectKey} · {n} items"));
                await db.SaveChangesAsync();
                return Results.Ok(new { ok = true, tasks = n });
            }
            catch (Exception ex)
            {
                return Results.Json(new { ok = false, error = $"Jira sync failed: {ex.Message}" }, statusCode: StatusCodes.Status502BadGateway);
            }
        });

        // ---- Discovery & import --------------------------------------------
        // List every Jira project, flagging which are already mapped in Atlas so
        // an admin/PM/PMO can approve & import the rest. Read needs project Edit.
        api.MapGet("/integrations/jira/projects", async (AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            var canManage = await Permissions.Allows(http, db, cfg, "cap-projects", "F");
            if (!JiraConfigured(cfg))
                return Results.Ok(new { configured = false, canManage, projects = Array.Empty<object>() });
            try
            {
                using var c = Client(cfg);
                var jira = await FetchPagedAsync(c, "rest/api/3/project/search", "values", () => { });
                var mapped = await db.Projects.Where(p => p.JiraProjectKey != "").ToListAsync();
                var byKey = new Dictionary<string, Project>(StringComparer.OrdinalIgnoreCase);
                foreach (var p in mapped) byKey[p.JiraProjectKey] = p;
                var items = jira.Select(j =>
                {
                    var key = Str(j, "key");
                    var has = byKey.TryGetValue(key, out var ap);
                    return new { key, name = Str(j, "name"), jiraId = NumOrStr(j, "id"),
                        mappedProjectId = has ? ap!.Id : null, mappedProjectName = has ? ap!.Name : null,
                        mappedBoardId = has ? ap!.JiraBoardId : null };
                }).ToList();
                return Results.Ok(new { configured = true, canManage, projects = items });
            }
            catch (Exception ex)
            {
                return Results.Json(new { configured = true, canManage, error = $"Couldn't list Jira projects: {ex.Message}", projects = Array.Empty<object>() }, statusCode: StatusCodes.Status502BadGateway);
            }
        });

        // Approve & map a Jira project to a new/existing Atlas project, or to a
        // new project placed under a program. Reserved for Platform Admin / PMO /
        // PM (Full on Projects & tasks). Editable afterwards from project details.
        api.MapPost("/integrations/jira/import", async (JiraImportReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            var key = (req.JiraProjectKey ?? "").Trim().ToUpperInvariant();
            var target = (req.Target ?? "project").Trim().ToLowerInvariant();

            // Import a Jira project as an OPERATIONAL service (run-the-business
            // space/board), pulling its issues as ops work items. Gated on cap-ops.
            if (target == "ops")
            {
                if (await Permissions.Deny(http, db, cfg, "cap-ops", "E") is { } opsDenied) return opsDenied;
                if (key.Length == 0) return Results.BadRequest(new { error = "A Jira project key is required." });
                if (!JiraConfigured(cfg))
                    return Results.Ok(new { ok = false, error = "Jira isn't configured — set Jira:BaseUrl, Jira:Email and Jira:ApiToken (see docs/jira-setup.md)." });
                try { return await ImportOpsFromJiraAsync(db, cfg, http, key, req.Name); }
                catch (Exception ex) { return Results.Json(new { ok = false, error = $"Jira → Ops import failed: {ex.Message}" }, statusCode: StatusCodes.Status502BadGateway); }
            }

            if (await Permissions.Deny(http, db, cfg, "cap-projects", "F") is { } denied) return denied;
            if (key.Length == 0) return Results.BadRequest(new { error = "A Jira project key is required." });
            var board = req.BoardId is int b && b > 0 ? b : (int?)null;

            // Link an existing project.
            if (target == "project" && !string.IsNullOrWhiteSpace(req.AtlasId))
            {
                var p = await db.Projects.FindAsync(req.AtlasId);
                if (p is null) return Results.NotFound();
                p.JiraProjectKey = key; p.JiraBoardId = board;
                db.AuditEvents.Add(Permissions.Audit(http, cfg, "Integrations", "Mapped Jira project to existing project", $"{key} → {p.Id}"));
                await db.SaveChangesAsync();
                return Results.Ok(new { ok = true, projectId = p.Id, created = false });
            }

            // Otherwise create a new project (optionally under a program).
            var name = string.IsNullOrWhiteSpace(req.Name) ? key : req.Name!.Trim();
            var proj = new Project
            {
                Id = await NextProjectIdAsync(db), Name = name, Dept = "Unassigned", Owner = "Unassigned",
                Methodology = "Scrum", Status = "green", Health = "On track", Target = "TBD", Due = "TBD",
                Phase = "Planning", JiraProjectKey = key, JiraBoardId = board,
            };
            db.Projects.Add(proj);
            string? programId = null;
            if (target == "program" && !string.IsNullOrWhiteSpace(req.AtlasId))
            {
                var pg = await db.Programs.FindAsync(req.AtlasId);
                if (pg is null) return Results.NotFound();
                if (!pg.Projects.Contains(proj.Id)) pg.Projects.Add(proj.Id);
                programId = pg.Id;
            }
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Integrations", "Imported Jira project", $"{key} → {proj.Id}{(programId != null ? $" (program {programId})" : "")}"));
            await db.SaveChangesAsync();
            return Results.Created($"/api/v1/projects/{proj.Id}", new { ok = true, projectId = proj.Id, programId, created = true });
        });
    }

    // (Enqueue/202/poll now live in the shared SyncEndpoints/SyncQueue — ADR-0083.)
    // BulkSyncResult moved to WorkItemConnector.cs (shared by both connectors).

    // Sync a concrete list of projects, best-effort (one failure doesn't stop the
    // pass). Shared by the synchronous endpoints and the background worker.
    public static async Task<BulkSyncResult> SyncProjectsCoreAsync(AtlasDbContext db, IConfiguration cfg, List<Project> projects, bool delta)
    {
        int sp = 0, ep = 0, tk = 0, ok = 0;
        var errors = new List<string>();
        using var c = Client(cfg);
        foreach (var p in projects)
        {
            var sw = System.Diagnostics.Stopwatch.StartNew();
            try
            {
                var watermark = SyncWatermark.Now();
                var r = await SyncProjectAsync(db, cfg, c, p, delta);
                p.LastJiraSync = watermark;
                sp += r.Sprints; ep += r.Epics; tk += r.Tasks; ok++;
                await db.SaveChangesAsync();
                AtlasTelemetry.RecordSync("jira", sw.Elapsed.TotalSeconds, ok: true);
            }
            catch (Exception ex) { errors.Add($"{p.Id}: {ex.Message}"); AtlasTelemetry.RecordSync("jira", sw.Elapsed.TotalSeconds, ok: false); }
        }
        return new BulkSyncResult(ok, sp, ep, tk, errors);
    }

    // Resolve which mapped, non-archived projects a background job should sync.
    public static async Task<List<Project>> ResolveSyncTargetsAsync(AtlasDbContext db, string kind, string targetId)
    {
        var mapped = db.Projects.Where(p => !p.Archived && p.JiraProjectKey != "");
        switch (kind)
        {
            case "project": return await mapped.Where(p => p.Id == targetId).ToListAsync();
            case "program":
                var pg = await db.Programs.FindAsync(targetId);
                return pg is null ? new() : await mapped.Where(p => pg.Projects.Contains(p.Id)).ToListAsync();
            case "product":
                var pr = await db.Products.FindAsync(targetId);
                return pr is null ? new() : await mapped.Where(p => pr.Projects.Contains(p.Id)).ToListAsync();
            default: return await mapped.ToListAsync();   // "all"
        }
    }

    static async Task<IResult> SyncLinkedProjectsAsync(AtlasDbContext db, IConfiguration cfg, HttpContext http,
        string scope, List<string> projectIds, bool delta)
    {
        if (await Permissions.Deny(http, db, cfg, "cap-integrations", "E") is { } denied) return denied;
        if (!JiraConfigured(cfg))
            return Results.Ok(new { ok = false, error = "Jira isn't configured — set Jira:BaseUrl, Jira:Email and Jira:ApiToken (see docs/jira-setup.md)." });
        var projects = await db.Projects
            .Where(p => projectIds.Contains(p.Id) && !p.Archived && p.JiraProjectKey != "")
            .ToListAsync();
        if (projects.Count == 0)
            return Results.Ok(new { ok = true, projects = 0, sprints = 0, epics = 0, tasks = 0, message = $"No Jira-mapped projects are linked to this {scope} yet." });
        int sp = 0, ep = 0, tk = 0, ok = 0;
        var errors = new List<string>();
        using var c = Client(cfg);
        foreach (var p in projects)
        {
            var sw = System.Diagnostics.Stopwatch.StartNew();
            try
            {
                var watermark = SyncWatermark.Now();
                var r = await SyncProjectAsync(db, cfg, c, p, delta);
                p.LastJiraSync = watermark;
                sp += r.Sprints; ep += r.Epics; tk += r.Tasks; ok++;
                await db.SaveChangesAsync();
                AtlasTelemetry.RecordSync("jira", sw.Elapsed.TotalSeconds, ok: true);
            }
            catch (Exception ex) { errors.Add($"{p.Id}: {ex.Message}"); AtlasTelemetry.RecordSync("jira", sw.Elapsed.TotalSeconds, ok: false); }
        }
        db.AuditEvents.Add(Permissions.Audit(http, cfg, "Integrations", $"Synced {scope}'s projects from Jira",
            $"{ok}/{projects.Count} projects · {sp} sprints, {ep} epics, {tk} tasks"));
        await db.SaveChangesAsync();
        return Results.Ok(new { ok = errors.Count == 0, projects = ok, sprints = sp, epics = ep, tasks = tk, errors });
    }

    // Import a Jira project as an Ops service and upsert its issues as ops work
    // items (idempotent by Jira issue key). Creates the service on first import,
    // then tops up on re-import. Allocation is left at 0 (assigned by hand).
    static async Task<IResult> ImportOpsFromJiraAsync(AtlasDbContext db, IConfiguration cfg, HttpContext http, string key, string? name)
    {
        var svc = await db.OpsServices.FirstOrDefaultAsync(s => s.JiraProjectKey == key);
        if (svc is null)
        {
            var maxNum = (await db.OpsServices.Select(s => s.Ref).ToListAsync())
                .Select(r => int.TryParse(r.Split('-').Last(), out var n) ? n : 0).DefaultIfEmpty(0).Max();
            var ord = (await db.OpsServices.Select(s => (int?)s.Ord).MaxAsync() ?? 0) + 1;
            svc = new OpsService
            {
                Ref = $"OPS-{maxNum + 1}", Name = string.IsNullOrWhiteSpace(name) ? key : name!.Trim(),
                Category = "Support", Dept = "Unassigned", Owner = "", Status = "Active",
                Description = $"Imported from Jira project {key}.", JiraProjectKey = key, Ord = ord,
            };
            db.OpsServices.Add(svc);
            await db.SaveChangesAsync();     // assign svc.Id
        }

        var imported = await PullOpsItemsAsync(db, cfg, svc);
        db.AuditEvents.Add(Permissions.Audit(http, cfg, "Integrations", "Imported Jira project as Ops service", $"{key} → {svc.Ref} · {imported} items"));
        await db.SaveChangesAsync();
        return Results.Ok(new { ok = true, serviceId = svc.Id, serviceRef = svc.Ref, items = imported });
    }

    // Pull a Jira project's issues into an Ops service's items, upserting by Jira
    // key (idempotent). Mirrors the project importer: the full field set is
    // carried across (description, people, labels, components, versions,
    // resolution, time tracking, points, dates, links), epics come in as items
    // tagged Type="Epic" (with child items linked by epic/parent key), and each
    // issue's comment thread and attachments are pulled too. Shared by the
    // one-time import and the per-service re-sync. Caller owns SaveChanges + audit.
    public static async Task<int> PullOpsItemsAsync(AtlasDbContext db, IConfiguration cfg, OpsService svc)
    {
        var key = svc.JiraProjectKey;
        if (string.IsNullOrWhiteSpace(key)) return 0;
        var existing = await db.OpsItems.Where(i => i.ServiceId == svc.Id).ToListAsync();
        var itemOrd = existing.Select(i => i.Ord).DefaultIfEmpty(0).Max();
        var pointsField = string.IsNullOrWhiteSpace(cfg["Jira:StoryPointsField"]) ? "customfield_10016" : cfg["Jira:StoryPointsField"]!.Trim();
        var browseBase = NormalizeBaseUrl(cfg["Jira:BaseUrl"]) ?? "";
        var importAttachments = !string.Equals(cfg["Jira:ImportAttachments"], "false", StringComparison.OrdinalIgnoreCase);
        var importComments = !string.Equals(cfg["Jira:ImportComments"], "false", StringComparison.OrdinalIgnoreCase);
        var maxAttachmentBytes = long.TryParse(cfg["Jira:MaxAttachmentBytes"], out var mb) && mb > 0 ? mb : 25L * 1024 * 1024;
        var fields = "summary,description,status,issuetype,assignee,reporter,creator,duedate,priority," +
                     "labels,components,fixVersions,resolution,resolutiondate,created,updated," +
                     "timetracking,timespent,timeoriginalestimate,sprint,closedSprints,epic,parent,comment,attachment," +
                     pointsField;
        // Which Jira comment/attachment ids each existing item already holds, so a
        // re-import tops up new ones without re-downloading or duplicating.
        var existingIds = existing.Where(i => i.Id != 0).Select(i => i.Id).ToList();
        var haveCom = (await db.OpsItemComments.Where(c => existingIds.Contains(c.OpsItemId) && c.JiraId != "")
                .Select(c => new { c.OpsItemId, c.JiraId }).ToListAsync())
            .GroupBy(x => x.OpsItemId).ToDictionary(g => g.Key, g => g.Select(x => x.JiraId).ToHashSet());
        var haveAtt = (await db.OpsItemAttachments.Where(a => existingIds.Contains(a.OpsItemId))
                .Select(a => new { a.OpsItemId, a.JiraId }).ToListAsync())
            .GroupBy(x => x.OpsItemId).ToDictionary(g => g.Key, g => g.Select(x => x.JiraId).ToHashSet());
        using var c = Client(cfg);
        var issues = await FetchJqlAsync(c, $"project = \"{key}\" ORDER BY created ASC", fields, () => { });
        int imported = 0;
        foreach (var ji in issues)
        {
            var ikey = Str(ji, "key");
            if (ikey.Length == 0) continue;
            var f = Prop(ji, "fields") ?? default;
            var itype = StrPath(f, "issuetype", "name");
            var isEpic = itype.Equals("Epic", StringComparison.OrdinalIgnoreCase);
            var item = existing.FirstOrDefault(i => i.JiraKey == ikey);
            if (item is null) { item = new OpsItem { ServiceId = svc.Id, JiraKey = ikey, Ord = ++itemOrd, CreatedAt = DateTime.UtcNow.ToString("dd MMM yyyy") }; db.OpsItems.Add(item); existing.Add(item); }
            item.Title = Str(f, "summary");
            item.Type = isEpic ? "Epic" : MapOpsType(itype);
            item.Priority = MapPriority(StrPath(f, "priority", "name"));
            item.Status = MapOpsStatus(StrPath(f, "status", "statusCategory", "key"));
            item.Assignee = StrPath(f, "assignee", "displayName");
            // Rich fields — mirror the project importer.
            item.Description = AdfToText(Prop(f, "description"));
            item.IssueType = itype;
            item.Reporter = StrPath(f, "reporter", "displayName");
            item.StatusName = StrPath(f, "status", "name");
            item.Resolution = StrPath(f, "resolution", "name");
            item.Labels = StrArray(f, "labels");
            item.Components = ObjNameArray(f, "components");
            item.FixVersions = ObjNameArray(f, "fixVersions");
            item.ParentKey = StrPath(f, "parent", "key");
            item.EpicKey = isEpic ? ikey : EpicKeyOf(f);
            item.EpicName = isEpic ? Str(f, "summary") : EpicNameOf(f);
            item.Points = Math.Max(0, IntProp(f, pointsField));
            item.EstimateHours = SecondsToHours(LongProp(f, "timeoriginalestimate"));
            item.TimeSpentHours = SecondsToHours(LongProp(f, "timespent"));
            item.TargetDate = DatePart(Str(f, "duedate"));
            item.JiraCreated = Str(f, "created");
            item.JiraUpdated = Str(f, "updated");
            item.JiraUrl = browseBase.Length > 0 ? $"{browseBase}/browse/{ikey}" : "";

            // Comments — upsert by Jira comment id into the item's thread.
            if (importComments && Prop(f, "comment") is { } cwrap && Prop(cwrap, "comments") is { ValueKind: JsonValueKind.Array } clist)
            {
                var have = item.Id != 0 && haveCom.TryGetValue(item.Id, out var hc) ? hc : new HashSet<string>();
                foreach (var cm in clist.EnumerateArray())
                {
                    var cid = NumOrStr(cm, "id");
                    if (cid.Length == 0 || have.Contains(cid)) continue;
                    var author = StrPath(cm, "author", "displayName");
                    item.Comments.Add(new OpsItemComment
                    {
                        JiraId = cid, Author = author.Length > 0 ? author : "Jira",
                        Initials = Initials(author), Body = AdfToText(Prop(cm, "body")),
                        At = ParseAt(Str(cm, "created")),
                    });
                    have.Add(cid);
                }
            }

            // Attachments — download each new file (within the size cap); best-effort.
            if (importAttachments && Prop(f, "attachment") is { ValueKind: JsonValueKind.Array } alist)
            {
                var have = item.Id != 0 && haveAtt.TryGetValue(item.Id, out var ha) ? ha : new HashSet<string>();
                foreach (var att in alist.EnumerateArray())
                {
                    var aid = NumOrStr(att, "id");
                    var url = Str(att, "content");
                    var size = LongProp(att, "size");
                    if (aid.Length == 0 || url.Length == 0 || have.Contains(aid)) continue;
                    if (size > maxAttachmentBytes) continue;
                    if (SafeAttachmentUri(c, url) is not { } fileUri) continue;   // SSRF / credential-forwarding guard
                    try
                    {
                        using var fileRes = await c.GetAsync(fileUri);
                        if (!fileRes.IsSuccessStatusCode) continue;
                        var bytes = await fileRes.Content.ReadAsByteArrayAsync();
                        if (bytes.LongLength > maxAttachmentBytes) continue;
                        item.Attachments.Add(new OpsItemAttachment
                        {
                            JiraId = aid, FileName = Str(att, "filename"),
                            ContentType = Str(att, "mimeType") is { Length: > 0 } mt ? mt : "application/octet-stream",
                            Size = size > 0 ? size : bytes.LongLength,
                            Author = StrPath(att, "author", "displayName"), CreatedAt = Str(att, "created"),
                            Bytes = bytes,
                        });
                        have.Add(aid);
                    }
                    catch (Exception ex) { _log.LogWarning(ex, "Skipping a Jira attachment ({File}) after a download error during ops import.", Str(att, "filename")); /* keep importing */ }
                }
            }
            imported++;
        }
        return imported;
    }

    // Jira issue type → Ops work-item type.
    static string MapOpsType(string? t) => (t ?? "").ToLowerInvariant() switch
    {
        "bug" or "incident" or "fault" => "Incident",
        "change" or "change request" => "Change",
        "task" or "story" or "sub-task" or "subtask" => "Request",
        _ => "Other",
    };
    // Jira status category → Ops work-item status.
    static string MapOpsStatus(string? cat) => (cat ?? "").ToLowerInvariant() switch
    {
        "done" => "Done",
        "indeterminate" => "In progress",
        _ => "Open",
    };

    // Next "PRJ-N" id (mirrors the create-project numbering).
    static async Task<string> NextProjectIdAsync(AtlasDbContext db)
    {
        var ids = await db.Projects.Select(x => x.Id).ToListAsync();
        var max = ids.Select(x => int.TryParse(x.Split('-').Last(), out var n) ? n : 0).DefaultIfEmpty(0).Max();
        return $"PRJ-{max + 1}";
    }

    // -----------------------------------------------------------------------
    //  Sync engine
    // -----------------------------------------------------------------------
    public record SyncResult(int Sprints, int Epics, int Tasks, int Backlog, bool Truncated);

    static readonly string[] TaskStatuses = { "To Do", "In Progress", "In Review", "Done", "Blocked" };

    // Pull one project's board into Atlas. Adds/updates entities on the tracked
    // db; the caller owns SaveChanges (so a multi-project run can batch/rollback).
    public static async Task<SyncResult> SyncProjectAsync(AtlasDbContext db, IConfiguration cfg, HttpClient c, Project p, bool delta = false)
    {
        int? board = p.JiraBoardId;                     // optional: adds sprints/backlog ordering
        var projectKey = p.JiraProjectKey.Trim();
        // Delta sync only pulls issues changed since the last successful sync, so
        // it must NOT prune (unchanged rows aren't returned) and can't recompute
        // full epic rollups. First delta (no watermark) behaves like a full pull.
        var deltaActive = delta && !string.IsNullOrEmpty(p.LastJiraSync);
        var deltaClause = DeltaClause(delta, p.LastJiraSync);
        var pointsField = string.IsNullOrWhiteSpace(cfg["Jira:StoryPointsField"]) ? "customfield_10016" : cfg["Jira:StoryPointsField"]!.Trim();
        // Jira's Sprint field is a configurable CUSTOM field (default
        // customfield_10020 on Jira Cloud), NOT a field literally named "sprint".
        // Reading it lets board-less / JQL imports derive sprints from the issues
        // themselves, so sprints show even without a mapped or readable board.
        var sprintField = string.IsNullOrWhiteSpace(cfg["Jira:SprintField"]) ? "customfield_10020" : cfg["Jira:SprintField"]!.Trim();
        var truncated = false;
        var browseBase = NormalizeBaseUrl(cfg["Jira:BaseUrl"]) ?? "";
        // Files & comments are pulled by default; opt out or cap file size via config.
        var importAttachments = !string.Equals(cfg["Jira:ImportAttachments"], "false", StringComparison.OrdinalIgnoreCase);
        var importComments = !string.Equals(cfg["Jira:ImportComments"], "false", StringComparison.OrdinalIgnoreCase);
        var maxAttachmentBytes = long.TryParse(cfg["Jira:MaxAttachmentBytes"], out var mb) && mb > 0 ? mb : 25L * 1024 * 1024;

        // --- Sprints: from the board when one is mapped, else derived from the
        // sprint / closedSprints fields on the issues themselves (so past &
        // current sprints show even for board-less, key-only mappings). Upsert by
        // Jira sprint id; pruning happens after the issue scan below.
        var existingSprints = await db.Sprints.Where(s => s.ProjectId == p.Id).ToListAsync();
        var sprintOrd = existingSprints.Select(s => s.Ord).DefaultIfEmpty(0).Max();
        var seenSprints = new HashSet<string>();
        void UpsertSprint(JsonElement js, int fallbackBoard)
        {
            var key = NumOrStr(js, "id");
            if (key.Length == 0) return;
            seenSprints.Add(key);
            var s = existingSprints.FirstOrDefault(x => x.JiraKey == key);
            if (s is null) { s = new Sprint { ProjectId = p.Id, JiraKey = key, Ord = ++sprintOrd }; db.Sprints.Add(s); existingSprints.Add(s); }
            if (Str(js, "name") is { Length: > 0 } nm) s.Name = nm;
            if (Str(js, "goal") is { Length: > 0 } gl) s.Goal = gl;
            if (Str(js, "startDate") is { Length: > 0 } sd) s.StartDate = DatePart(sd);
            if (Str(js, "endDate") is { Length: > 0 } ed) s.EndDate = DatePart(ed);
            if (Str(js, "completeDate") is { Length: > 0 } cd) s.CompleteDate = DatePart(cd);
            var ob = IntProp(js, "originBoardId");
            s.BoardId = ob > 0 ? ob : (fallbackBoard > 0 ? fallbackBoard : s.BoardId);
            if (Str(js, "state") is { Length: > 0 } st) s.Status = MapSprintState(st);
        }
        // Resolve which board(s) to pull sprints from: the mapped board if the
        // user supplied one, else discover the project's scrum boards by key — so
        // a key-only mapping (board id is optional at import) still gets its
        // sprints, past/current/future. Kanban boards have no sprints, so only
        // scrum boards are queried (their /sprint endpoint would 400 otherwise).
        //
        // Sprint import is BEST-EFFORT: the Agile board APIs need Browse-board
        // permission the service account may lack, and can 400/403/404. Any such
        // failure must NOT abort the sync — tasks/epics (and task-derived sprint
        // names) still import — so each Agile call is isolated in try/catch.
        var sprintBoards = new List<int>();
        if (board is int bMapped) sprintBoards.Add(bMapped);
        else
            try
            {
                foreach (var jb in await FetchPagedAsync(c, $"rest/agile/1.0/board?projectKeyOrId={Uri.EscapeDataString(projectKey)}", "values", () => truncated = true))
                    if (string.Equals(Str(jb, "type"), "scrum", StringComparison.OrdinalIgnoreCase) && IntProp(jb, "id") is int bid && bid > 0)
                        sprintBoards.Add(bid);
            }
            catch (Exception ex) { _log.LogWarning(ex, "Jira board listing for project {Key} is unavailable (permission / non-agile project) — falling back to issue-derived sprint names.", projectKey); /* fall back to issue-derived sprint names */ }
        foreach (var sb in sprintBoards.Distinct())
            try
            {
                foreach (var js in await FetchPagedAsync(c, $"rest/agile/1.0/board/{sb}/sprint", "values", () => truncated = true))
                    UpsertSprint(js, sb);
            }
            catch (Exception ex) { _log.LogWarning(ex, "Sprints for Jira board {Board} (project {Key}) are unavailable — skipping that board, continuing the sync.", sb, projectKey); /* skip it, keep syncing the rest */ }

        // --- Epics: board endpoint if available, else derived from issues ----
        var existingEpics = await db.Epics.Where(e => e.ProjectId == p.Id).ToListAsync();
        var epicOrd = existingEpics.Select(e => e.Ord).DefaultIfEmpty(0).Max();
        var seenEpics = new HashSet<string>();
        void UpsertEpic(string ejiraId, string name, bool done, string browseKey = "", string description = "")
        {
            if (ejiraId.Length == 0) return;
            seenEpics.Add(ejiraId);
            var e = existingEpics.FirstOrDefault(x => x.JiraKey == ejiraId);
            if (e is null) { e = new Epic { ProjectId = p.Id, JiraKey = ejiraId, Ord = ++epicOrd }; db.Epics.Add(e); existingEpics.Add(e); }
            if (name.Length > 0) e.Name = name;
            e.Status = done ? "Complete" : "In progress";
            if (browseKey.Length > 0) { e.EpicKey = browseKey; e.JiraUrl = browseBase.Length > 0 ? $"{browseBase}/browse/{browseKey}" : ""; }
            if (description.Length > 0) e.Description = description;
        }
        if (board is int bEpic)
        {
            var jiraEpics = await FetchPagedAsync(c, $"rest/agile/1.0/board/{bEpic}/epic", "values", () => truncated = true);
            foreach (var je in jiraEpics)
                UpsertEpic(NumOrStr(je, "id"), Str(je, "name").Length > 0 ? Str(je, "name") : Str(je, "summary"), Bool(je, "done"), Str(je, "key"));
        }

        // --- Issues: board issue list, or a JQL project search (boardless) ---
        // Pull the full field set so tasks carry description, people, labels,
        // components, versions, resolution, time tracking, timestamps, comments
        // and attachments — not just the summary/status subset.
        var fields = "summary,description,status,issuetype,assignee,reporter,creator,duedate,priority," +
                     "labels,components,fixVersions,resolution,resolutiondate,created,updated," +
                     "timetracking,timespent,timeoriginalestimate,sprint,closedSprints,epic,parent,comment,attachment," +
                     $"{pointsField},{sprintField}";
        // A delta run always uses the JQL search (with the updated-since filter),
        // even when a board is mapped, so the watermark applies; a full run with a
        // board keeps the board issue endpoint for its backlog ordering.
        // `expand=changelog` carries each issue's status history inline so we can
        // derive when work first left the backlog (StartedAt). Best-effort: if an
        // endpoint ignores or omits it, StartedAt just stays empty.
        var jiraIssues = board is int bIssue && !deltaActive
            ? await FetchIssuesAsync(c, $"rest/agile/1.0/board/{bIssue}/issue", fields, () => truncated = true, expand: "changelog")
            : await FetchJqlAsync(c, $"project = \"{projectKey}\"{deltaClause} ORDER BY updated ASC", fields, () => truncated = true, expand: "changelog");
        var existingTasks = await db.ProjectTasks.Where(t => t.ProjectId == p.Id).ToListAsync();
        var taskOrd = existingTasks.Select(t => t.Ord).DefaultIfEmpty(0).Max();
        // Which Jira attachment/comment ids each existing task already holds — so a
        // re-sync tops up new files/comments without re-downloading or duplicating.
        var existingTaskIds = existingTasks.Where(t => t.Id != 0).Select(t => t.Id).ToList();
        var haveAtt = (await db.TaskAttachments.Where(a => existingTaskIds.Contains(a.TaskId))
                .Select(a => new { a.TaskId, a.JiraId }).ToListAsync())
            .GroupBy(x => x.TaskId).ToDictionary(g => g.Key, g => g.Select(x => x.JiraId).ToHashSet());
        var haveCom = (await db.TaskComments.Where(cm => existingTaskIds.Contains(cm.TaskId) && cm.JiraId != "")
                .Select(cm => new { cm.TaskId, cm.JiraId }).ToListAsync())
            .GroupBy(x => x.TaskId).ToDictionary(g => g.Key, g => g.Select(x => x.JiraId).ToHashSet());
        var seenTasks = new HashSet<string>();
        int backlog = 0;
        foreach (var ji in jiraIssues)
        {
            var key = Str(ji, "key");
            if (key.Length == 0) continue;
            var f = Prop(ji, "fields") ?? default;
            var itype = StrPath(f, "issuetype", "name");
            // Epics are not tasks. With no board, derive them from Epic-type issues.
            if (itype.Equals("Epic", StringComparison.OrdinalIgnoreCase))
            {
                if (board is null) UpsertEpic(key, Str(f, "summary"), MapIssueStatus(StrPath(f, "status", "statusCategory", "key")) == "Done",
                    key, AdfToText(Prop(f, "description")));
                continue;
            }
            seenTasks.Add(key);
            var t = existingTasks.FirstOrDefault(x => x.JiraKey == key);
            if (t is null) { t = new ProjectTask { ProjectId = p.Id, JiraKey = key, Code = key, Ord = ++taskOrd }; db.ProjectTasks.Add(t); existingTasks.Add(t); }
            t.Code = key;
            t.Name = Str(f, "summary");
            t.Assignee = StrPath(f, "assignee", "displayName") is { Length: > 0 } a ? a : "Unassigned";
            t.Status = MapIssueStatus(StrPath(f, "status", "statusCategory", "key"));
            t.Priority = MapPriority(StrPath(f, "priority", "name"));
            t.TargetDate = DatePart(Str(f, "duedate"));
            t.Points = Math.Max(0, IntProp(f, pointsField));
            // Board-less: derive the project's sprints from the issues' own sprint
            // fields so past/current sprints exist without a board.
            // Always derive the project's sprints from the issues' own sprint
            // field(s) too — upsert is idempotent by sprint id, so this merges
            // with any board-supplied sprints and covers board-less / JQL imports
            // (and boards whose sprints aren't readable), so sprints aren't 0.
            foreach (var js in SprintsFromIssue(f, sprintField)) UpsertSprint(js, 0);
            var sprintName = SprintNameOf(f, sprintField);
            t.Sprint = sprintName;
            if (sprintName.Length == 0) backlog++;
            t.Epic = EpicNameOf(f);
            // Rich fields.
            t.Description = AdfToText(Prop(f, "description"));
            t.IssueType = itype;
            t.Reporter = StrPath(f, "reporter", "displayName");
            t.StatusName = StrPath(f, "status", "name");
            t.Resolution = StrPath(f, "resolution", "name");
            t.Labels = StrArray(f, "labels");
            t.Components = ObjNameArray(f, "components");
            t.FixVersions = ObjNameArray(f, "fixVersions");
            t.ParentKey = StrPath(f, "parent", "key");
            t.EpicKey = EpicKeyOf(f);
            t.EstimateHours = SecondsToHours(LongProp(f, "timeoriginalestimate"));
            t.TimeSpentHours = SecondsToHours(LongProp(f, "timespent"));
            t.JiraCreated = Str(f, "created");
            t.JiraUpdated = Str(f, "updated");
            // Lifecycle: resolved date from Jira's resolutiondate (fall back to the
            // last-updated stamp for a Done issue that carries no resolution date);
            // started date from the earliest status transition in the changelog.
            t.ResolvedAt = DatePart(Str(f, "resolutiondate"));
            if (t.ResolvedAt.Length == 0 && t.Status == "Done") t.ResolvedAt = DatePart(t.JiraUpdated);
            if (StartedAtFromChangelog(ji) is { Length: > 0 } startedIso) t.StartedAt = startedIso;
            t.JiraUrl = browseBase.Length > 0 ? $"{browseBase}/browse/{key}" : "";

            // Comments — upsert by Jira comment id into the task's thread.
            if (importComments && Prop(f, "comment") is { } cwrap && Prop(cwrap, "comments") is { ValueKind: JsonValueKind.Array } clist)
            {
                var have = t.Id != 0 && haveCom.TryGetValue(t.Id, out var hc) ? hc : new HashSet<string>();
                foreach (var cm in clist.EnumerateArray())
                {
                    var cid = NumOrStr(cm, "id");
                    if (cid.Length == 0 || have.Contains(cid)) continue;
                    var author = StrPath(cm, "author", "displayName");
                    t.Comments.Add(new TaskComment
                    {
                        JiraId = cid, Author = author.Length > 0 ? author : "Jira",
                        Initials = Initials(author), Body = AdfToText(Prop(cm, "body")),
                        At = ParseAt(Str(cm, "created")),
                    });
                    have.Add(cid);
                }
            }

            // Attachments — download each new file (within the size cap) and store
            // its bytes; best-effort so one bad file never fails the whole sync.
            if (importAttachments && Prop(f, "attachment") is { ValueKind: JsonValueKind.Array } alist)
            {
                var have = t.Id != 0 && haveAtt.TryGetValue(t.Id, out var ha) ? ha : new HashSet<string>();
                foreach (var att in alist.EnumerateArray())
                {
                    var aid = NumOrStr(att, "id");
                    var url = Str(att, "content");
                    var size = LongProp(att, "size");
                    if (aid.Length == 0 || url.Length == 0 || have.Contains(aid)) continue;
                    if (size > maxAttachmentBytes) continue;
                    if (SafeAttachmentUri(c, url) is not { } fileUri) continue;   // SSRF / credential-forwarding guard
                    try
                    {
                        using var fileRes = await c.GetAsync(fileUri);
                        if (!fileRes.IsSuccessStatusCode) continue;
                        var bytes = await fileRes.Content.ReadAsByteArrayAsync();
                        if (bytes.LongLength > maxAttachmentBytes) continue;
                        t.Attachments.Add(new TaskAttachment
                        {
                            JiraId = aid, FileName = Str(att, "filename"),
                            ContentType = Str(att, "mimeType") is { Length: > 0 } mt ? mt : "application/octet-stream",
                            Size = size > 0 ? size : bytes.LongLength,
                            Author = StrPath(att, "author", "displayName"), CreatedAt = Str(att, "created"),
                            Bytes = bytes,
                        });
                        have.Add(aid);
                    }
                    catch (Exception ex) { _log.LogWarning(ex, "Skipping a Jira attachment on {Issue} ({File}) after a download error during project sync.", key, Str(att, "filename")); /* keep syncing */ }
                }
            }
        }
        // Pruning + full rollup only on a full sync — a delta doesn't list every
        // issue, so removing "unseen" rows would wrongly delete unchanged ones.
        if (!deltaActive)
        {
            if (seenTasks.Count > 0)
                db.ProjectTasks.RemoveRange(existingTasks.Where(t => t.JiraKey.Length > 0 && !seenTasks.Contains(t.JiraKey)));
            if (seenEpics.Count > 0)
                db.Epics.RemoveRange(existingEpics.Where(e => e.JiraKey.Length > 0 && !seenEpics.Contains(e.JiraKey)));
            if (seenSprints.Count > 0)
                db.Sprints.RemoveRange(existingSprints.Where(s => s.JiraKey.Length > 0 && !seenSprints.Contains(s.JiraKey)));

            // Recompute synced epics' story rollup from the project's surviving tasks
            // (by name) — manual tasks plus synced tasks still present — so the epic
            // progress bar reflects real issue counts and excludes just-pruned rows.
            var liveTasks = existingTasks.Where(t => t.JiraKey.Length == 0 || seenTasks.Contains(t.JiraKey)).ToList();
            foreach (var e in existingEpics.Where(e => e.JiraKey.Length > 0 && seenEpics.Contains(e.JiraKey)))
            {
                var its = liveTasks.Where(t => t.Epic == e.Name).ToList();
                e.Stories = its.Count;
                e.Done = its.Count(t => t.Status == "Done");
            }
        }

        return new SyncResult(seenSprints.Count, seenEpics.Count, seenTasks.Count, backlog, truncated);
    }

    // The JQL fragment appended to a project search for a delta pull — only when
    // delta is requested AND there's a watermark to filter from (first delta with
    // no watermark behaves as a full pull). Pure; unit-tested.
    public static string DeltaClause(bool delta, string? lastSync)
    {
        if (!delta || string.IsNullOrEmpty(lastSync)) return "";
        // Watermarks are stored as UTC ISO (ADR-0083); JQL's date-time literal is
        // "yyyy-MM-dd HH:mm". Reformat when we can parse it; otherwise fall back to
        // the raw value (already JQL-shaped — keeps the legacy format working).
        var jql = DateTime.TryParse(lastSync, CultureInfo.InvariantCulture,
            DateTimeStyles.AdjustToUniversal | DateTimeStyles.AssumeUniversal, out var dt)
            ? dt.ToString("yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture)
            : lastSync;
        return $" AND updated >= \"{jql}\"";
    }

    // ---- Jira → Atlas field mappings (pure; unit-tested) --------------------

    // Jira sprint state (future|active|closed) → Atlas Sprint.Status.
    public static string MapSprintState(string? state) => (state ?? "").ToLowerInvariant() switch
    {
        "active" => "Started",
        "closed" => "Completed",
        _ => "Planned",
    };

    // Jira status category key (new|indeterminate|done) → Atlas task Status.
    public static string MapIssueStatus(string? categoryKey) => (categoryKey ?? "").ToLowerInvariant() switch
    {
        "done" => "Done",
        "indeterminate" => "In Progress",
        _ => "To Do",
    };

    // Atlas task status → a test-plan task status (best-effort; testers refine it).
    public static string MapTestStatus(string taskStatus) => taskStatus switch
    {
        "Done" => "Passed",
        "Blocked" => "Blocked",
        "In Progress" or "In Review" => "In test",
        _ => "Not run",
    };

    public record TestIngestResult(int Added, int Updated, int Removed, bool Truncated);

    // Ingest a linked Jira board's issues into a test plan's tasks — reuses the
    // same authenticated client, paging and field parsing as the project sync.
    // Idempotent: upsert by Jira issue key, prune vanished Jira-sourced tasks,
    // never touch locally-created ones (JiraKey == ""). Caller owns SaveChanges.
    public static async Task<TestIngestResult> IngestTestTasksAsync(AtlasDbContext db, IConfiguration cfg, HttpClient c, TestPlan plan)
    {
        if (plan.JiraBoardId <= 0) throw new InvalidOperationException("This test plan has no linked Jira board.");
        var truncated = false;
        const string fields = "summary,description,status,assignee,duedate,timeoriginalestimate";
        var issues = await FetchIssuesAsync(c, $"rest/agile/1.0/board/{plan.JiraBoardId}/issue", fields, () => truncated = true);
        var existing = await db.TestPlanTasks.Where(t => t.TestPlanId == plan.Id).ToListAsync();
        var ord = existing.Select(t => t.Ord).DefaultIfEmpty(0).Max();
        var seen = new HashSet<string>();
        int added = 0, updated = 0;
        foreach (var ji in issues)
        {
            var key = Str(ji, "key");
            if (key.Length == 0) continue;
            var f = Prop(ji, "fields") ?? default;
            seen.Add(key);
            var t = existing.FirstOrDefault(x => x.JiraKey == key);
            if (t is null) { t = new TestPlanTask { TestPlanId = plan.Id, JiraKey = key, Ord = ++ord }; db.TestPlanTasks.Add(t); existing.Add(t); added++; }
            else updated++;
            t.Title = Str(f, "summary") is { Length: > 0 } s ? s : key;
            t.Status = MapTestStatus(MapIssueStatus(StrPath(f, "status", "statusCategory", "key")));
            t.Assignee = StrPath(f, "assignee", "displayName");
            t.Description = AdfToText(Prop(f, "description"));
            t.DueDate = DatePart(Str(f, "duedate"));
            t.EstimateHours = SecondsToHours(LongProp(f, "timeoriginalestimate"));
        }
        var removed = existing.Where(t => t.JiraKey.Length > 0 && !seen.Contains(t.JiraKey)).ToList();
        db.TestPlanTasks.RemoveRange(removed);
        return new TestIngestResult(added, updated, removed.Count, truncated);
    }

    public record DepIngestResult(int Added, int Removed, bool Truncated);

    // Ingest cross-sprint Jira issue links as sprint→sprint timeline dependencies.
    // A task-level "blocks"/"depends" link whose two issues sit in DIFFERENT
    // sprints of this project implies a sprint dependency (from = the sprint that
    // depends, to = the upstream sprint). Idempotent: replaces this project's
    // Jira-sourced sprint edges with the current Jira state. Reuses the sync
    // client/paging/parsing. Caller owns SaveChanges.
    public static async Task<DepIngestResult> IngestSprintDependenciesAsync(AtlasDbContext db, IConfiguration cfg, HttpClient c, Project p)
    {
        var key = p.JiraProjectKey.Trim();
        if (key.Length == 0) throw new InvalidOperationException("This project has no Jira project key.");
        var sprintField = string.IsNullOrWhiteSpace(cfg["Jira:SprintField"]) ? "customfield_10020" : cfg["Jira:SprintField"]!.Trim();
        var truncated = false;
        var issues = await FetchJqlAsync(c, $"project = \"{key}\" ORDER BY created ASC",
            $"issuelinks,sprint,closedSprints,{sprintField}", () => truncated = true);

        // Jira sprint id → Atlas sprint id, then each issue key → its Atlas sprint.
        var sprintByJiraKey = (await db.Sprints.Where(s => s.ProjectId == p.Id && s.JiraKey != "").ToListAsync())
            .GroupBy(s => s.JiraKey).ToDictionary(g => g.Key, g => g.First().Id);
        var issueSprint = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        var withLinks = new List<(string issue, JsonElement links)>();
        foreach (var ji in issues)
        {
            var ik = Str(ji, "key");
            if (ik.Length == 0) continue;
            var f = Prop(ji, "fields") ?? default;
            var sids = SprintsFromIssue(f, sprintField).Select(js => NumOrStr(js, "id")).Where(x => x.Length > 0).ToList();
            if (sids.Count > 0 && sprintByJiraKey.TryGetValue(sids[^1], out var sid)) issueSprint[ik] = sid;   // most-recent sprint
            if (Prop(f, "issuelinks") is { ValueKind: JsonValueKind.Array } links) withLinks.Add((ik, links));
        }

        var edges = new HashSet<(int from, int to)>();
        foreach (var (issue, links) in withLinks)
        {
            if (!issueSprint.TryGetValue(issue, out var mine)) continue;
            foreach (var lk in links.EnumerateArray())
            {
                var tn = StrPath(lk, "type", "name").ToLowerInvariant();
                if (!tn.Contains("block") && !tn.Contains("depend")) continue;
                // outwardIssue: this issue blocks it ⇒ it depends on this (from = other, to = mine)
                if (Prop(lk, "outwardIssue") is { } outw && Str(outw, "key") is { Length: > 0 } ok
                    && issueSprint.TryGetValue(ok, out var os) && os != mine) edges.Add((os, mine));
                // inwardIssue: it blocks this ⇒ this depends on it (from = mine, to = other)
                if (Prop(lk, "inwardIssue") is { } inw && Str(inw, "key") is { Length: > 0 } ik2
                    && issueSprint.TryGetValue(ik2, out var isid) && isid != mine) edges.Add((mine, isid));
            }
        }

        // Idempotent replace of this project's Jira-sourced sprint edges.
        var mine2 = sprintByJiraKey.Values.Select(x => x.ToString()).ToHashSet();
        var stale = (await db.TimelineDependencies
                .Where(d => d.Source == "jira" && d.FromType == "sprint" && d.ToType == "sprint").ToListAsync())
            .Where(d => mine2.Contains(d.FromId) || mine2.Contains(d.ToId)).ToList();
        db.TimelineDependencies.RemoveRange(stale);
        var ord = await db.TimelineDependencies.Select(d => (int?)d.Ord).MaxAsync() ?? 0;
        foreach (var (from, to) in edges)
            db.TimelineDependencies.Add(new TimelineDependency { FromType = "sprint", FromId = from.ToString(), ToType = "sprint", ToId = to.ToString(), Source = "jira", Ord = ++ord });
        return new DepIngestResult(edges.Count, stale.Count, truncated);
    }

    // Jira priority name → Atlas task Priority (Critical|High|Medium|Low).
    public static string MapPriority(string? name) => (name ?? "").ToLowerInvariant() switch
    {
        "highest" or "critical" or "blocker" => "Critical",
        "high" => "High",
        "low" or "lowest" or "trivial" or "minor" => "Low",
        _ => "Medium",
    };

    // Keep only the yyyy-MM-dd part of a Jira datetime ("2026-03-01T09:00:00.000+0000").
    public static string DatePart(string? iso)
    {
        var s = (iso ?? "").Trim();
        if (s.Length == 0) return "";
        var t = s.IndexOf('T');
        return t > 0 ? s[..t] : s;
    }

    // The date work first left the backlog: the earliest changelog history that
    // includes a status transition. This is workflow-agnostic (no dependency on
    // status names/categories) — the moment an issue first changes status is a
    // solid proxy for "started". Returns "" when the changelog is absent (not
    // expanded / no Browse permission) or the issue never moved. Pure.
    public static string StartedAtFromChangelog(JsonElement issue)
    {
        if (Prop(issue, "changelog") is not { } cl) return "";
        if (Prop(cl, "histories") is not { ValueKind: JsonValueKind.Array } hs) return "";
        DateTime? bestDt = null;
        var best = "";
        foreach (var h in hs.EnumerateArray())
        {
            if (Prop(h, "items") is not { ValueKind: JsonValueKind.Array } items) continue;
            var hasStatus = false;
            foreach (var it in items.EnumerateArray())
                if (string.Equals(Str(it, "field"), "status", StringComparison.OrdinalIgnoreCase)) { hasStatus = true; break; }
            if (!hasStatus) continue;
            var created = Str(h, "created");
            if (created.Length == 0) continue;
            var dt = ParseAt(created);
            if (bestDt is null || dt < bestDt) { bestDt = dt; best = created; }
        }
        return DatePart(best);
    }

    // ---- JSON helpers -------------------------------------------------------

    static JsonElement? Prop(JsonElement e, string name) =>
        e.ValueKind == JsonValueKind.Object && e.TryGetProperty(name, out var v) ? v : null;

    static string Str(JsonElement e, string name) =>
        e.ValueKind == JsonValueKind.Object && e.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String
            ? v.GetString() ?? "" : "";

    static string StrPath(JsonElement e, params string[] path)
    {
        var cur = e;
        foreach (var key in path)
        {
            if (cur.ValueKind != JsonValueKind.Object || !cur.TryGetProperty(key, out var next)) return "";
            cur = next;
        }
        return cur.ValueKind == JsonValueKind.String ? cur.GetString() ?? "" : "";
    }

    // id may serialize as a number (sprints/epics) or string — accept either.
    static string NumOrStr(JsonElement e, string name)
    {
        if (e.ValueKind != JsonValueKind.Object || !e.TryGetProperty(name, out var v)) return "";
        return v.ValueKind switch
        {
            JsonValueKind.Number => v.GetRawText(),
            JsonValueKind.String => v.GetString() ?? "",
            _ => "",
        };
    }

    static bool Bool(JsonElement e, string name) =>
        e.ValueKind == JsonValueKind.Object && e.TryGetProperty(name, out var v) &&
        (v.ValueKind == JsonValueKind.True || (v.ValueKind == JsonValueKind.String && bool.TryParse(v.GetString(), out var b) && b));

    static int IntProp(JsonElement e, string name)
    {
        if (e.ValueKind != JsonValueKind.Object || !e.TryGetProperty(name, out var v)) return 0;
        return v.ValueKind == JsonValueKind.Number && v.TryGetDouble(out var d) ? (int)Math.Round(d) : 0;
    }

    // The issue's sprint name: the active/assigned sprint if any, else the most
    // recent closed sprint (so completed-sprint issues still group), else "". Reads
    // the agile convenience `sprint`/`closedSprints` fields (board issue endpoint)
    // AND the configurable Sprint custom field (default customfield_10020) that a
    // JQL/board-less search returns — object arrays (Cloud) or legacy toString
    // strings (older instances).
    static string SprintNameOf(JsonElement fields, string sprintField)
    {
        if (Prop(fields, "sprint") is { } s)
        {
            if (s.ValueKind == JsonValueKind.Object && Str(s, "name") is { Length: > 0 } n0) return n0;
            if (s.ValueKind == JsonValueKind.Array && s.GetArrayLength() > 0 && Str(s[s.GetArrayLength() - 1], "name") is { Length: > 0 } nA) return nA;
        }
        if (Prop(fields, sprintField) is { ValueKind: JsonValueKind.Array } cf && cf.GetArrayLength() > 0)
        {
            var last = cf[cf.GetArrayLength() - 1];
            if (last.ValueKind == JsonValueKind.Object && Str(last, "name") is { Length: > 0 } nc) return nc;
            if (last.ValueKind == JsonValueKind.String) { var nm = LegacySprintName(last.GetString() ?? ""); if (nm.Length > 0) return nm; }
        }
        if (Prop(fields, "closedSprints") is { ValueKind: JsonValueKind.Array } cs && cs.GetArrayLength() > 0)
            return Str(cs[cs.GetArrayLength() - 1], "name");
        return "";
    }

    // Parse a name out of Jira's legacy sprint toString, e.g.
    // "…Sprint@1a[id=5,rapidViewId=3,state=ACTIVE,name=Sprint 3,startDate=…]".
    static string LegacySprintName(string s)
    {
        var m = System.Text.RegularExpressions.Regex.Match(s, @"name=([^,\]]+)");
        return m.Success ? m.Groups[1].Value.Trim() : "";
    }

    // Every sprint OBJECT an issue references — the agile `sprint`/`closedSprints`
    // fields plus the configurable Sprint custom field — used to derive a project's
    // Sprint rows from its issues (so sprints exist without a readable board). Only
    // objects (with id/name/dates) become rows; legacy string sprints still supply
    // the task's sprint name via SprintNameOf.
    public static IEnumerable<JsonElement> SprintsFromIssue(JsonElement fields, string sprintField)
    {
        static IEnumerable<JsonElement> FromField(JsonElement? p)
        {
            if (p is not { } v) yield break;
            if (v.ValueKind == JsonValueKind.Object) yield return v;
            else if (v.ValueKind == JsonValueKind.Array)
                foreach (var x in v.EnumerateArray()) if (x.ValueKind == JsonValueKind.Object) yield return x;
        }
        foreach (var x in FromField(Prop(fields, "sprint"))) yield return x;
        foreach (var x in FromField(Prop(fields, sprintField))) yield return x;
        foreach (var x in FromField(Prop(fields, "closedSprints"))) yield return x;
    }

    // The issue's epic name: the agile `epic` object (company-managed), else an
    // Epic-typed parent's summary (team-managed), else "".
    static string EpicNameOf(JsonElement fields)
    {
        if (Prop(fields, "epic") is { ValueKind: JsonValueKind.Object } ep)
        {
            var n = Str(ep, "name");
            if (n.Length > 0) return n;
        }
        if (Prop(fields, "parent") is { ValueKind: JsonValueKind.Object } par &&
            Prop(par, "fields") is { } pf && StrPath(pf, "issuetype", "name").Equals("Epic", StringComparison.OrdinalIgnoreCase))
            return Str(pf, "summary");
        return "";
    }

    // Flatten Jira's Atlassian Document Format (ADF) rich text into plain text:
    // collect text/mention nodes, break blocks with newlines. Tolerates a plain
    // string (older/plain descriptions) and a missing field.
    public static string AdfToText(JsonElement? node)
    {
        if (node is not { } n) return "";
        var sb = new StringBuilder();
        WalkAdf(n, sb);
        return sb.ToString().Replace("\r\n", "\n").Trim();
    }

    static void WalkAdf(JsonElement n, StringBuilder sb)
    {
        if (n.ValueKind == JsonValueKind.String) { sb.Append(n.GetString()); return; }
        if (n.ValueKind == JsonValueKind.Array) { foreach (var child in n.EnumerateArray()) WalkAdf(child, sb); return; }
        if (n.ValueKind != JsonValueKind.Object) return;
        var type = Str(n, "type");
        if (type == "text") sb.Append(Str(n, "text"));
        else if (type == "mention" && Prop(n, "attrs") is { } at) sb.Append(Str(at, "text"));
        else if (type == "hardBreak") sb.Append('\n');
        if (Prop(n, "content") is { ValueKind: JsonValueKind.Array } content)
            foreach (var child in content.EnumerateArray()) WalkAdf(child, sb);
        if (type is "paragraph" or "heading" or "blockquote" or "codeBlock" or "listItem" or "rule") sb.Append('\n');
    }

    // A string[] field (e.g. labels).
    static List<string> StrArray(JsonElement e, string name)
    {
        var list = new List<string>();
        if (e.ValueKind == JsonValueKind.Object && e.TryGetProperty(name, out var arr) && arr.ValueKind == JsonValueKind.Array)
            foreach (var it in arr.EnumerateArray())
                if (it.ValueKind == JsonValueKind.String && it.GetString() is { Length: > 0 } s) list.Add(s);
        return list;
    }

    // An array-of-objects field projected to each object's "name" (components, fixVersions).
    static List<string> ObjNameArray(JsonElement e, string name)
    {
        var list = new List<string>();
        if (e.ValueKind == JsonValueKind.Object && e.TryGetProperty(name, out var arr) && arr.ValueKind == JsonValueKind.Array)
            foreach (var it in arr.EnumerateArray())
                if (Str(it, "name") is { Length: > 0 } s) list.Add(s);
        return list;
    }

    // The stable epic key: agile `epic.key`, else an Epic-typed parent's key.
    static string EpicKeyOf(JsonElement fields)
    {
        if (Prop(fields, "epic") is { ValueKind: JsonValueKind.Object } ep && Str(ep, "key") is { Length: > 0 } k) return k;
        if (Prop(fields, "parent") is { ValueKind: JsonValueKind.Object } par &&
            Prop(par, "fields") is { } pf && StrPath(pf, "issuetype", "name").Equals("Epic", StringComparison.OrdinalIgnoreCase))
            return Str(par, "key");
        return "";
    }

    // Jira tracks time in seconds; Atlas stores whole hours.
    public static int SecondsToHours(long seconds) => seconds <= 0 ? 0 : (int)Math.Round(seconds / 3600.0);

    static long LongProp(JsonElement e, string name) =>
        e.ValueKind == JsonValueKind.Object && e.TryGetProperty(name, out var v) &&
        v.ValueKind == JsonValueKind.Number && v.TryGetInt64(out var l) ? l : 0;

    static string Initials(string name)
    {
        var parts = (name ?? "").Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length == 0) return "?";
        return parts.Length == 1
            ? parts[0][..Math.Min(2, parts[0].Length)].ToUpperInvariant()
            : (parts[0][0].ToString() + parts[^1][0]).ToUpperInvariant();
    }

    static DateTime ParseAt(string iso) =>
        DateTime.TryParse(iso, System.Globalization.CultureInfo.InvariantCulture,
            System.Globalization.DateTimeStyles.AdjustToUniversal | System.Globalization.DateTimeStyles.AssumeUniversal, out var dt)
            ? dt : DateTime.UtcNow;

    // Page a values[]/isLast agile endpoint, cloning each element so it outlives
    // the JsonDocument. Flags `onTruncate` if the page cap is hit.
    static async Task<List<JsonElement>> FetchPagedAsync(HttpClient c, string path, string arrayProp, Action onTruncate)
    {
        var all = new List<JsonElement>();
        int startAt = 0, page = 0;
        while (page++ < MaxPages)
        {
            var sep = path.Contains('?') ? "&" : "?";
            var res = await c.GetAsync($"{path}{sep}startAt={startAt}&maxResults={PageSize}");
            if (!res.IsSuccessStatusCode)
                throw new InvalidOperationException($"Jira returned {(int)res.StatusCode} {res.ReasonPhrase} for {path}. Check the board id and the service account's Browse Projects permission.");
            using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
            var root = doc.RootElement;
            if (!root.TryGetProperty(arrayProp, out var arr) || arr.ValueKind != JsonValueKind.Array) break;
            var n = arr.GetArrayLength();
            foreach (var item in arr.EnumerateArray()) all.Add(item.Clone());
            var isLast = root.TryGetProperty("isLast", out var il) && il.ValueKind == JsonValueKind.True;
            if (isLast || n < PageSize) return all;
            startAt += n;
        }
        onTruncate();
        return all;
    }

    // Page an issues[] endpoint (uses total/startAt/maxResults for termination).
    // `expand` (e.g. "changelog") is passed through so callers can pull the issue
    // history alongside the fields in a single request.
    static async Task<List<JsonElement>> FetchIssuesAsync(HttpClient c, string path, string fields, Action onTruncate, string expand = "")
    {
        var all = new List<JsonElement>();
        int startAt = 0, page = 0;
        var fieldQuery = Uri.EscapeDataString(fields);
        var expandQuery = expand.Length > 0 ? $"&expand={Uri.EscapeDataString(expand)}" : "";
        while (page++ < MaxPages)
        {
            var res = await c.GetAsync($"{path}?startAt={startAt}&maxResults={PageSize}&fields={fieldQuery}{expandQuery}");
            if (!res.IsSuccessStatusCode)
                throw new InvalidOperationException($"Jira returned {(int)res.StatusCode} {res.ReasonPhrase} for {path}. Check the board id and the service account's Browse Projects permission.");
            using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
            var root = doc.RootElement;
            if (!root.TryGetProperty("issues", out var arr) || arr.ValueKind != JsonValueKind.Array) break;
            var n = arr.GetArrayLength();
            foreach (var item in arr.EnumerateArray()) all.Add(item.Clone());
            var total = root.TryGetProperty("total", out var tt) && tt.ValueKind == JsonValueKind.Number ? tt.GetInt32() : startAt + n;
            startAt += n;
            if (n == 0 || startAt >= total) return all;
        }
        onTruncate();
        return all;
    }

    // Page an enhanced JQL search (rest/api/3/search/jql) — used when a project
    // has no board, so it can be synced by project key alone. Pages via the
    // opaque nextPageToken the endpoint returns until it's absent.
    static async Task<List<JsonElement>> FetchJqlAsync(HttpClient c, string jql, string fields, Action onTruncate, string expand = "")
    {
        var all = new List<JsonElement>();
        var fq = Uri.EscapeDataString(fields);
        var jq = Uri.EscapeDataString(jql);
        var expandQuery = expand.Length > 0 ? $"&expand={Uri.EscapeDataString(expand)}" : "";
        string? token = null;
        int page = 0;
        while (page++ < MaxPages)
        {
            var url = $"rest/api/3/search/jql?jql={jq}&maxResults={PageSize}&fields={fq}{expandQuery}"
                + (token is not null ? $"&nextPageToken={Uri.EscapeDataString(token)}" : "");
            var res = await c.GetAsync(url);
            if (!res.IsSuccessStatusCode)
                throw new InvalidOperationException($"Jira returned {(int)res.StatusCode} {res.ReasonPhrase} searching the project. Check the project key and the service account's Browse Projects permission.");
            using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
            var root = doc.RootElement;
            if (root.TryGetProperty("issues", out var arr) && arr.ValueKind == JsonValueKind.Array)
                foreach (var item in arr.EnumerateArray()) all.Add(item.Clone());
            token = root.TryGetProperty("nextPageToken", out var nt) && nt.ValueKind == JsonValueKind.String ? nt.GetString() : null;
            if (token is null) return all;
        }
        onTruncate();
        return all;
    }
}
