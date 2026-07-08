using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;

namespace Atlas.Api;

// ============================================================================
//  Azure DevOps integration — connector scaffold (ADR-0035).
//
//  Mirrors the Jira connector's shape: configuration → authenticated client →
//  connection test → project discovery → import/map to an Atlas project. What
//  is deliberately deferred (a follow-up, once the connector is in real use) is
//  the work-item → tasks/sprints SYNC: this scaffold connects, tests, lists the
//  organisation's projects and stores the mapping (Project.AdoProject) so a
//  later sync can pull boards. Everything stays dormant until a PAT is set.
//
//  Configuration (env / Docker secret), all empty ⇒ integration stays dormant:
//    • AzureDevOps:Organization  the org name ("contoso") or full URL
//                                (https://dev.azure.com/contoso)
//    • AzureDevOps:Pat           a Personal Access Token with Project & Team
//                                (Read) — and Work Items (Read) for the later
//                                board sync. Scoped to the org.
//
//  Auth is HTTP Basic with an EMPTY username and the PAT as the password
//  (":{PAT}" base64-encoded) — Azure DevOps's standard PAT scheme, analogous to
//  Jira Cloud's "email:api-token".
// ============================================================================
public record AdoImportReq(string? AdoProject, string? Target, string? AtlasId, string? Name);

public static class AzureDevOps
{
    const string ApiVersion = "7.0";

    public static bool AdoConfigured(IConfiguration cfg) =>
        !string.IsNullOrWhiteSpace(cfg["AzureDevOps:Organization"]) &&
        !string.IsNullOrWhiteSpace(cfg["AzureDevOps:Pat"]);

    // Normalise a configured organisation to a clean https base URL. Accepts a
    // bare org name ("contoso"), a dev.azure.com URL, or a legacy
    // "contoso.visualstudio.com" URL. Returns null when it can't form one.
    public static string? NormalizeOrgUrl(string? raw)
    {
        var s = (raw ?? "").Trim().TrimEnd('/');
        if (s.Length == 0) return null;
        // A bare org name (no dot, no scheme) → dev.azure.com/{org}.
        if (!s.Contains('.') && !s.Contains('/') &&
            !s.StartsWith("http", StringComparison.OrdinalIgnoreCase))
            return $"https://dev.azure.com/{Uri.EscapeDataString(s)}";
        if (!s.StartsWith("http://", StringComparison.OrdinalIgnoreCase) &&
            !s.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            s = "https://" + s;
        return Uri.TryCreate(s, UriKind.Absolute, out var u) && (u.Scheme == "http" || u.Scheme == "https")
            ? u.GetLeftPart(UriPartial.Path).TrimEnd('/')
            : null;
    }

    // An HttpClient pinned to the org with Basic auth (":PAT"). Callers dispose it.
    public static HttpClient Client(IConfiguration cfg)
    {
        var baseUrl = NormalizeOrgUrl(cfg["AzureDevOps:Organization"])
            ?? throw new InvalidOperationException("AzureDevOps:Organization isn't valid (expected an org name or https://dev.azure.com/<org>).");
        var http = new HttpClient { BaseAddress = new Uri(baseUrl + "/"), Timeout = TimeSpan.FromSeconds(20) };
        var basic = Convert.ToBase64String(Encoding.UTF8.GetBytes($":{cfg["AzureDevOps:Pat"]}"));
        http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", basic);
        http.DefaultRequestHeaders.Accept.Add(new("application/json"));
        return http;
    }

    public static void MapAzureDevOpsEndpoints(this RouteGroupBuilder api)
    {
        // Config status for the Integrations card — never calls Azure DevOps.
        api.MapGet("/integrations/ado/status", async (AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-integrations", "V") is { } denied) return denied;
            var canManage = await Permissions.Allows(http, db, cfg, "cap-integrations", "E");
            return Results.Ok(new { configured = AdoConfigured(cfg), orgUrl = NormalizeOrgUrl(cfg["AzureDevOps:Organization"]) ?? "", canManage });
        });

        // Live connection test — lists the org's projects and reports back.
        api.MapPost("/integrations/ado/test", async (AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-integrations", "E") is { } denied) return denied;
            if (!AdoConfigured(cfg))
                return Results.Ok(new { ok = false, error = "Azure DevOps isn't configured — set AzureDevOps:Organization and AzureDevOps:Pat (see docs/azure-devops-setup.md)." });
            try
            {
                using var c = Client(cfg);
                var res = await c.GetAsync($"_apis/projects?$top=1&api-version={ApiVersion}");
                if (!res.IsSuccessStatusCode)
                    return Results.Ok(new { ok = false, error = $"Azure DevOps returned {(int)res.StatusCode} {res.ReasonPhrase}. Check the organisation and PAT (needs Project & Team: Read)." });
                var orgUrl = NormalizeOrgUrl(cfg["AzureDevOps:Organization"]) ?? "";
                db.AuditEvents.Add(Permissions.Audit(http, cfg, "Integrations", "Tested Azure DevOps connection", orgUrl));
                await db.SaveChangesAsync();
                return Results.Ok(new { ok = true, orgUrl });
            }
            catch (Exception ex)
            {
                return Results.Ok(new { ok = false, error = $"Couldn't reach Azure DevOps: {ex.Message}" });
            }
        });

        // ---- Discovery & import --------------------------------------------
        // List the org's projects, flagging which are already mapped in Atlas so
        // an admin/PM/PMO can approve & import the rest. Read needs project Edit.
        api.MapGet("/integrations/ado/projects", async (AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            var canManage = await Permissions.Allows(http, db, cfg, "cap-projects", "F");
            if (!AdoConfigured(cfg))
                return Results.Ok(new { configured = false, canManage, projects = Array.Empty<object>() });
            try
            {
                using var c = Client(cfg);
                var res = await c.GetAsync($"_apis/projects?$top=500&api-version={ApiVersion}");
                if (!res.IsSuccessStatusCode)
                    return Results.Json(new { configured = true, canManage, error = $"Azure DevOps returned {(int)res.StatusCode} {res.ReasonPhrase}.", projects = Array.Empty<object>() }, statusCode: StatusCodes.Status502BadGateway);
                using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
                var mapped = await db.Projects.Where(p => p.AdoProject != "").ToListAsync();
                var byName = new Dictionary<string, Project>(StringComparer.OrdinalIgnoreCase);
                foreach (var p in mapped) byName[p.AdoProject] = p;
                var items = new List<object>();
                if (doc.RootElement.TryGetProperty("value", out var arr) && arr.ValueKind == JsonValueKind.Array)
                {
                    foreach (var j in arr.EnumerateArray())
                    {
                        var name = j.TryGetProperty("name", out var n) ? n.GetString() ?? "" : "";
                        var id = j.TryGetProperty("id", out var i) ? i.GetString() ?? "" : "";
                        var has = byName.TryGetValue(name, out var ap);
                        items.Add(new
                        {
                            id, name,
                            state = j.TryGetProperty("state", out var s) ? s.GetString() ?? "" : "",
                            mappedProjectId = has ? ap!.Id : null,
                            mappedProjectName = has ? ap!.Name : null,
                        });
                    }
                }
                return Results.Ok(new { configured = true, canManage, projects = items });
            }
            catch (Exception ex)
            {
                return Results.Json(new { configured = true, canManage, error = $"Couldn't list Azure DevOps projects: {ex.Message}", projects = Array.Empty<object>() }, statusCode: StatusCodes.Status502BadGateway);
            }
        });

        // Approve & map an Azure DevOps project to a new/existing Atlas project,
        // or to a new project placed under a program. Reserved for Platform Admin
        // / PMO / PM (Full on Projects & tasks). The mapping is stored on the
        // project (Project.AdoProject); board sync is a follow-up (ADR-0035).
        api.MapPost("/integrations/ado/import", async (AdoImportReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "F") is { } denied) return denied;
            var adoProject = (req.AdoProject ?? "").Trim();
            var target = (req.Target ?? "project").Trim().ToLowerInvariant();
            if (adoProject.Length == 0) return Results.BadRequest(new { error = "An Azure DevOps project is required." });

            // Link an existing project.
            if (target == "project" && !string.IsNullOrWhiteSpace(req.AtlasId))
            {
                var p = await db.Projects.FindAsync(req.AtlasId);
                if (p is null) return Results.NotFound();
                p.AdoProject = adoProject;
                db.AuditEvents.Add(Permissions.Audit(http, cfg, "Integrations", "Mapped Azure DevOps project to existing project", $"{adoProject} → {p.Id}"));
                await db.SaveChangesAsync();
                return Results.Ok(new { ok = true, projectId = p.Id, created = false });
            }

            // Otherwise create a new project (optionally under a program).
            var name = string.IsNullOrWhiteSpace(req.Name) ? adoProject : req.Name!.Trim();
            var proj = new Project
            {
                Id = await NextProjectIdAsync(db), Name = name, Dept = "Unassigned", Owner = "Unassigned",
                Methodology = "Scrum", Status = "green", Health = "On track", Target = "TBD", Due = "TBD",
                Phase = "Planning", AdoProject = adoProject,
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
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Integrations", "Imported Azure DevOps project", $"{adoProject} → {proj.Id}{(programId != null ? $" (program {programId})" : "")}"));
            await db.SaveChangesAsync();
            return Results.Created($"/api/v1/projects/{proj.Id}", new { ok = true, projectId = proj.Id, programId, created = true });
        });

        // ---- Work-item sync -------------------------------------------------
        // Sync one mapped project: pull its Azure DevOps iterations → sprints and
        // work items → epics / tasks / backlog. Idempotent by ADO id; full pull
        // (prunes rows that vanished from ADO). Gated on Integrations (Edit).
        // With ?background=true the pull runs off the request path (202 + jobId)
        // so a large project can't 504 — mirrors Jira (ADR-0030/0039).
        api.MapPost("/projects/{id}/ado/sync", async (string id, bool? background, bool? delta, AtlasDbContext db, IConfiguration cfg, HttpContext http, AdoSyncQueue queue) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-integrations", "E") is { } denied) return denied;
            if (!AdoConfigured(cfg))
                return Results.Ok(new { ok = false, error = "Azure DevOps isn't configured — set AzureDevOps:Organization and AzureDevOps:Pat (see docs/azure-devops-setup.md)." });
            var p = await db.Projects.FindAsync(id);
            if (p is null) return Results.NotFound();
            if (string.IsNullOrWhiteSpace(p.AdoProject))
                return Results.Ok(new { ok = false, error = "This project isn't mapped to an Azure DevOps project. Import/map it first." });
            if (background == true) return QueueSync(queue, http, cfg, id, delta == true);
            try
            {
                using var c = Client(cfg);
                var r = await SyncProjectAsync(db, cfg, c, p, delta == true);
                db.AuditEvents.Add(Permissions.Audit(http, cfg, "Integrations", "Synced Azure DevOps project", $"{p.AdoProject} → {p.Id}: {r.Sprints} sprints, {r.Epics} epics, {r.Tasks} tasks"));
                await db.SaveChangesAsync();
                return Results.Ok(new { ok = true, r.Sprints, r.Epics, r.Tasks, r.Backlog, r.Truncated });
            }
            catch (Exception ex)
            {
                return Results.Json(new { ok = false, error = $"Azure DevOps sync failed: {ex.Message}" }, statusCode: StatusCodes.Status502BadGateway);
            }
        });

        // Sync every ADO-mapped, non-archived project in one pass (best-effort:
        // one project's failure doesn't stop the rest). Gated on Integrations.
        // ?background=true queues the pass and returns 202 + jobId to poll.
        api.MapPost("/integrations/ado/sync", async (bool? background, bool? delta, AtlasDbContext db, IConfiguration cfg, HttpContext http, AdoSyncQueue queue) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-integrations", "E") is { } denied) return denied;
            if (!AdoConfigured(cfg))
                return Results.Ok(new { ok = false, error = "Azure DevOps isn't configured — set AzureDevOps:Organization and AzureDevOps:Pat (see docs/azure-devops-setup.md)." });
            if (background == true) return QueueSync(queue, http, cfg, "all", delta == true);
            var mapped = await db.Projects.Where(p => p.AdoProject != "" && !p.Archived).ToListAsync();
            try
            {
                var r = await SyncProjectsCoreAsync(db, cfg, mapped, delta == true);
                db.AuditEvents.Add(Permissions.Audit(http, cfg, "Integrations", "Synced Azure DevOps (all mapped)", $"{r.Projects} projects, {r.Sprints} sprints, {r.Epics} epics, {r.Tasks} tasks"));
                await db.SaveChangesAsync();
                return Results.Ok(new { ok = true, projects = r.Projects, sprints = r.Sprints, epics = r.Epics, tasks = r.Tasks, errors = r.Errors });
            }
            catch (Exception ex)
            {
                return Results.Json(new { ok = false, error = $"Azure DevOps sync failed: {ex.Message}" }, statusCode: StatusCodes.Status502BadGateway);
            }
        });

        // Poll a background ADO sync job (the 202 responses above).
        api.MapGet("/integrations/ado/sync/status/{jobId}", (string jobId, AdoSyncQueue queue) =>
            queue.TryGet(jobId, out var s) && s is not null
                ? Results.Ok(new { s.Id, s.TargetId, s.State, s.Projects, s.Sprints, s.Epics, s.Tasks, s.Errors, s.Error })
                : Results.NotFound());
    }

    // Enqueue a background sync under the caller's identity; 202 + pollable id.
    static IResult QueueSync(AdoSyncQueue queue, HttpContext http, IConfiguration cfg, string targetId, bool delta = false)
    {
        var who = Permissions.Audit(http, cfg, "Integrations", "Queued Azure DevOps sync", delta ? "delta" : "full");
        var status = queue.Enqueue(targetId, who.Actor, who.Role, delta);
        return Results.Accepted($"/api/v1/integrations/ado/sync/status/{status.Id}",
            new { ok = true, queued = true, jobId = status.Id, state = status.State });
    }

    // Roll-up counts for a multi-project sync pass. Shared by the synchronous
    // sync-all endpoint and the background worker (best-effort per project).
    public record AdoBulkResult(int Projects, int Sprints, int Epics, int Tasks, List<string> Errors);

    public static async Task<AdoBulkResult> SyncProjectsCoreAsync(AtlasDbContext db, IConfiguration cfg, List<Project> projects, bool delta = false)
    {
        int sp = 0, ep = 0, tk = 0, ok = 0;
        var errors = new List<string>();
        using var c = Client(cfg);
        foreach (var p in projects)
        {
            var sw = System.Diagnostics.Stopwatch.StartNew();
            try { var r = await SyncProjectAsync(db, cfg, c, p, delta); sp += r.Sprints; ep += r.Epics; tk += r.Tasks; ok++; AtlasTelemetry.RecordSync("ado", sw.Elapsed.TotalSeconds, ok: true); }
            catch (Exception ex) { errors.Add($"{p.AdoProject}: {ex.Message}"); AtlasTelemetry.RecordSync("ado", sw.Elapsed.TotalSeconds, ok: false); }
        }
        return new AdoBulkResult(ok, sp, ep, tk, errors);
    }

    // The projects a background job targets: "all" mapped, or one project id.
    public static async Task<List<Project>> ResolveSyncTargetsAsync(AtlasDbContext db, string targetId)
    {
        if (string.Equals(targetId, "all", StringComparison.OrdinalIgnoreCase))
            return await db.Projects.Where(p => p.AdoProject != "" && !p.Archived).ToListAsync();
        var one = await db.Projects.FindAsync(targetId);
        return one is not null && !string.IsNullOrWhiteSpace(one.AdoProject) ? new List<Project> { one } : new List<Project>();
    }

    static async Task<string> NextProjectIdAsync(AtlasDbContext db)
    {
        var ids = await db.Projects.Select(x => x.Id).ToListAsync();
        var max = ids.Select(x => int.TryParse(x.Split('-').Last(), out var n) ? n : 0).DefaultIfEmpty(0).Max();
        return $"PRJ-{max + 1}";
    }

    // -----------------------------------------------------------------------
    //  Sync engine (Azure DevOps → Atlas)
    //
    //  One-way, idempotent by ADO id, mirroring the Jira engine's contract:
    //  iterations → sprints (by identifier), work items → epics (type "Epic")
    //  and tasks (all other types), issues with no iteration land in the
    //  backlog, and rows whose ADO id vanished are pruned (full pull). Locally-
    //  created rows (AdoId == "") are never touched. Bounded by MaxWorkItems.
    // -----------------------------------------------------------------------
    const int ApiPageBatch = 200;          // work-item detail batch size (ADO cap)
    const int DefaultMaxWorkItems = 20000; // WIQL's own reference ceiling; the pull runs
                                           // in the background (ADR-0039) so this is the
                                           // real bound, not a low anti-504 cap. Override
                                           // with AzureDevOps:MaxWorkItems.

    static int MaxWorkItems(IConfiguration cfg) =>
        int.TryParse(cfg["AzureDevOps:MaxWorkItems"], out var n) && n > 0 ? n : DefaultMaxWorkItems;

    public record AdoSyncResult(int Sprints, int Epics, int Tasks, int Backlog, bool Truncated);

    record AdoItem(string Id, string Type, string Title, string State, string Assignee,
        string IterationLeaf, string ParentId, int Points, int Priority, string Description,
        string Created, string Changed);

    public static async Task<AdoSyncResult> SyncProjectAsync(AtlasDbContext db, IConfiguration cfg, HttpClient c, Project p, bool delta = false)
    {
        var project = p.AdoProject.Trim();
        var enc = Uri.EscapeDataString(project);
        var truncated = false;
        // Delta ("changed-since") pull: only work items changed since the last
        // successful sync. Captured BEFORE the fetch so items that change during
        // the pull are caught next time. A delta must NOT prune (unchanged items
        // aren't returned); the first delta (no watermark) behaves as a full pull.
        var watermark = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ");
        var deltaActive = delta && !string.IsNullOrEmpty(p.LastAdoSync);
        var changedClause = ChangedSinceClause(delta, p.LastAdoSync);

        // --- Iterations → sprints (upsert by node identifier) ---------------
        var existingSprints = await db.Sprints.Where(s => s.ProjectId == p.Id).ToListAsync();
        var sprintOrd = existingSprints.Select(s => s.Ord).DefaultIfEmpty(0).Max();
        var seenSprints = new HashSet<string>();
        var iterRes = await c.GetAsync($"{enc}/_apis/wit/classificationnodes/iterations?$depth=5&api-version={ApiVersion}");
        if (iterRes.IsSuccessStatusCode)
        {
            using var iterDoc = JsonDocument.Parse(await iterRes.Content.ReadAsStringAsync());
            foreach (var node in FlattenIterations(iterDoc.RootElement))
            {
                var ident = node.TryGetProperty("identifier", out var idn) ? idn.GetString() ?? "" : "";
                var name = node.TryGetProperty("name", out var nn) ? nn.GetString() ?? "" : "";
                if (ident.Length == 0 || name.Length == 0) continue;
                seenSprints.Add(ident);
                var s = existingSprints.FirstOrDefault(x => x.AdoId == ident);
                if (s is null) { s = new Sprint { ProjectId = p.Id, AdoId = ident, Ord = ++sprintOrd }; db.Sprints.Add(s); existingSprints.Add(s); }
                s.Name = name;
                if (node.TryGetProperty("attributes", out var at) && at.ValueKind == JsonValueKind.Object)
                {
                    if (at.TryGetProperty("startDate", out var sd) && sd.ValueKind == JsonValueKind.String) s.StartDate = DatePart(sd.GetString());
                    if (at.TryGetProperty("finishDate", out var fd) && fd.ValueKind == JsonValueKind.String) s.EndDate = DatePart(fd.GetString());
                }
            }
        }

        // --- Work items: WIQL for ids, then batched detail fetch ------------
        var ids = new List<string>();
        var wiql = new StringContent(
            JsonSerializer.Serialize(new { query = $"SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '{project.Replace("'", "''")}'{changedClause} ORDER BY [System.ChangedDate] ASC" }),
            Encoding.UTF8, "application/json");
        var wiqlRes = await c.PostAsync($"{enc}/_apis/wit/wiql?api-version={ApiVersion}", wiql);
        if (wiqlRes.IsSuccessStatusCode)
        {
            using var wiqlDoc = JsonDocument.Parse(await wiqlRes.Content.ReadAsStringAsync());
            if (wiqlDoc.RootElement.TryGetProperty("workItems", out var wl) && wl.ValueKind == JsonValueKind.Array)
                foreach (var w in wl.EnumerateArray())
                    if (w.TryGetProperty("id", out var wid)) ids.Add(wid.GetRawText().Trim('"'));
        }
        var cap = MaxWorkItems(cfg);
        if (ids.Count > cap) { ids = ids.Take(cap).ToList(); truncated = true; }

        var items = new List<AdoItem>();
        var fields = "System.Id,System.WorkItemType,System.Title,System.State,System.AssignedTo," +
                     "System.IterationPath,System.Parent,System.Description,System.CreatedDate,System.ChangedDate," +
                     "Microsoft.VSTS.Scheduling.StoryPoints,Microsoft.VSTS.Scheduling.Effort,Microsoft.VSTS.Common.Priority";
        for (var i = 0; i < ids.Count; i += ApiPageBatch)
        {
            var batch = ids.Skip(i).Take(ApiPageBatch);
            var res = await c.GetAsync($"_apis/wit/workitems?ids={string.Join(',', batch)}&fields={Uri.EscapeDataString(fields)}&api-version={ApiVersion}");
            if (!res.IsSuccessStatusCode) { truncated = true; continue; }
            using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
            if (!doc.RootElement.TryGetProperty("value", out var arr) || arr.ValueKind != JsonValueKind.Array) continue;
            foreach (var wi in arr.EnumerateArray())
            {
                var id = wi.TryGetProperty("id", out var idp) ? idp.GetRawText().Trim('"') : "";
                if (id.Length == 0 || !wi.TryGetProperty("fields", out var f)) continue;
                items.Add(new AdoItem(
                    Id: id,
                    Type: FStr(f, "System.WorkItemType"),
                    Title: FStr(f, "System.Title"),
                    State: FStr(f, "System.State"),
                    Assignee: FStrPath(f, "System.AssignedTo", "displayName"),
                    IterationLeaf: LastSegment(FStr(f, "System.IterationPath")),
                    ParentId: FRaw(f, "System.Parent"),
                    Points: (int)Math.Round(FNum(f, "Microsoft.VSTS.Scheduling.StoryPoints") is var sp2 && sp2 > 0 ? sp2 : FNum(f, "Microsoft.VSTS.Scheduling.Effort")),
                    Priority: (int)FNum(f, "Microsoft.VSTS.Common.Priority"),
                    Description: FStr(f, "System.Description"),
                    Created: FStr(f, "System.CreatedDate"),
                    Changed: FStr(f, "System.ChangedDate")));
            }
        }

        // --- Epics (type "Epic") — first pass so tasks can link by parent ---
        var existingEpics = await db.Epics.Where(e => e.ProjectId == p.Id).ToListAsync();
        var epicOrd = existingEpics.Select(e => e.Ord).DefaultIfEmpty(0).Max();
        var seenEpics = new HashSet<string>();
        var epicNameById = new Dictionary<string, string>();
        foreach (var wi in items.Where(x => x.Type.Equals("Epic", StringComparison.OrdinalIgnoreCase)))
        {
            seenEpics.Add(wi.Id);
            epicNameById[wi.Id] = wi.Title;
            var e = existingEpics.FirstOrDefault(x => x.AdoId == wi.Id);
            if (e is null) { e = new Epic { ProjectId = p.Id, AdoId = wi.Id, Ord = ++epicOrd }; db.Epics.Add(e); existingEpics.Add(e); }
            e.Name = wi.Title;
            e.Status = IsDoneState(wi.State) ? "Complete" : "In progress";
            if (wi.Description.Length > 0) e.Description = StripHtml(wi.Description);
        }

        // --- Tasks (all other types) — upsert by ADO id ---------------------
        var existingTasks = await db.ProjectTasks.Where(t => t.ProjectId == p.Id).ToListAsync();
        var taskOrd = existingTasks.Select(t => t.Ord).DefaultIfEmpty(0).Max();
        var seenTasks = new HashSet<string>();
        int backlog = 0;
        foreach (var wi in items.Where(x => !x.Type.Equals("Epic", StringComparison.OrdinalIgnoreCase)))
        {
            seenTasks.Add(wi.Id);
            var code = $"ADO-{wi.Id}";
            var t = existingTasks.FirstOrDefault(x => x.AdoId == wi.Id);
            if (t is null) { t = new ProjectTask { ProjectId = p.Id, AdoId = wi.Id, Code = code, Ord = ++taskOrd }; db.ProjectTasks.Add(t); existingTasks.Add(t); }
            t.Code = code;
            t.Name = wi.Title;
            t.Assignee = wi.Assignee.Length > 0 ? wi.Assignee : "Unassigned";
            t.Status = MapAdoState(wi.State);
            t.StatusName = wi.State;
            t.Priority = MapAdoPriority(wi.Priority);
            t.Points = Math.Max(0, wi.Points);
            t.IssueType = wi.Type;
            t.Description = StripHtml(wi.Description);
            t.Sprint = wi.IterationLeaf.Equals(p.AdoProject, StringComparison.OrdinalIgnoreCase) ? "" : wi.IterationLeaf;
            if (t.Sprint.Length == 0) backlog++;
            t.ParentKey = wi.ParentId;
            t.Epic = wi.ParentId.Length > 0 && epicNameById.TryGetValue(wi.ParentId, out var en) ? en : "";
            t.JiraCreated = wi.Created;
            t.JiraUpdated = wi.Changed;
        }

        // --- Prune + full epic roll-up only on a full pull ------------------
        // A delta doesn't list every item, so removing "unseen" rows or recomputing
        // roll-ups from a partial set would wrongly delete/miscount unchanged rows.
        if (!deltaActive)
        {
            if (seenTasks.Count > 0)
                db.ProjectTasks.RemoveRange(existingTasks.Where(t => t.AdoId.Length > 0 && !seenTasks.Contains(t.AdoId)));
            if (seenEpics.Count > 0)
                db.Epics.RemoveRange(existingEpics.Where(e => e.AdoId.Length > 0 && !seenEpics.Contains(e.AdoId)));
            if (seenSprints.Count > 0)
                db.Sprints.RemoveRange(existingSprints.Where(s => s.AdoId.Length > 0 && !seenSprints.Contains(s.AdoId)));

            // Recompute synced epics' story rollup from surviving tasks (by name).
            var liveTasks = existingTasks.Where(t => t.AdoId.Length == 0 || seenTasks.Contains(t.AdoId)).ToList();
            foreach (var e in existingEpics.Where(e => e.AdoId.Length > 0 && seenEpics.Contains(e.AdoId)))
            {
                var its = liveTasks.Where(t => t.Epic == e.Name).ToList();
                e.Stories = its.Count;
                e.Done = its.Count(t => t.Status == "Done");
            }
        }

        p.LastAdoSync = watermark;    // stamp after a successful pull (caller owns SaveChanges)
        return new AdoSyncResult(seenSprints.Count, seenEpics.Count, seenTasks.Count, backlog, truncated);
    }

    // The WIQL fragment appended for a delta pull — only when delta is requested
    // AND there's a watermark to filter from (the first delta, no watermark,
    // behaves as a full pull). Pure; unit-tested. Mirrors Jira.DeltaClause.
    public static string ChangedSinceClause(bool delta, string? lastSync) =>
        delta && !string.IsNullOrEmpty(lastSync) ? $" AND [System.ChangedDate] >= '{lastSync}'" : "";

    // Flatten the iteration classification-node tree to its leaf iterations
    // (nodes that carry a start date, i.e. real iterations not grouping folders).
    static IEnumerable<JsonElement> FlattenIterations(JsonElement node)
    {
        var hasChildren = node.TryGetProperty("children", out var ch) && ch.ValueKind == JsonValueKind.Array && ch.GetArrayLength() > 0;
        var hasStart = node.TryGetProperty("attributes", out var at) && at.ValueKind == JsonValueKind.Object &&
                       at.TryGetProperty("startDate", out var sd) && sd.ValueKind == JsonValueKind.String;
        if (hasStart && node.TryGetProperty("identifier", out _)) yield return node;
        if (hasChildren)
            foreach (var kid in ch.EnumerateArray())
                foreach (var leaf in FlattenIterations(kid))
                    yield return leaf;
    }

    // ADO work-item State → Atlas task status (To Do | In Progress | In Review |
    // Done | Blocked). Covers Agile / Scrum / Basic process states.
    public static string MapAdoState(string state) => (state ?? "").Trim().ToLowerInvariant() switch
    {
        "done" or "closed" or "completed" or "resolved" => "Done",
        "active" or "committed" or "doing" or "in progress" or "inprogress" => "In Progress",
        "removed" => "Blocked",
        _ => "To Do",
    };

    static bool IsDoneState(string state) => MapAdoState(state) == "Done";

    // ADO priority (1 highest … 4 lowest) → Atlas Critical|High|Medium|Low.
    public static string MapAdoPriority(int p) => p switch { 1 => "Critical", 2 => "High", 3 => "Medium", 4 => "Low", _ => "Medium" };

    // Last "\"-separated segment of an IterationPath, e.g. "Proj\\Rel 1\\Sprint 3" → "Sprint 3".
    public static string LastSegment(string path) =>
        string.IsNullOrEmpty(path) ? "" : path.Split('\\').Last().Trim();

    // ISO date part (yyyy-MM-dd) of an ADO timestamp; "" when empty/unparseable.
    static string DatePart(string? iso) =>
        string.IsNullOrEmpty(iso) ? "" : (iso.Length >= 10 ? iso[..10] : iso);

    // Rough HTML→text for System.Description (ADO stores rich text as HTML).
    public static string StripHtml(string html)
    {
        if (string.IsNullOrEmpty(html)) return "";
        var sb = new StringBuilder(html.Length);
        var inTag = false;
        foreach (var chr in html)
        {
            if (chr == '<') inTag = true;
            else if (chr == '>') inTag = false;
            else if (!inTag) sb.Append(chr);
        }
        return System.Net.WebUtility.HtmlDecode(sb.ToString()).Trim();
    }

    // ---- Work-item field readers (fields is the "fields" object) ----------
    static string FStr(JsonElement fields, string name) =>
        fields.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() ?? "" : "";
    static string FRaw(JsonElement fields, string name) =>
        fields.TryGetProperty(name, out var v) && v.ValueKind != JsonValueKind.Null ? v.GetRawText().Trim('"') : "";
    static double FNum(JsonElement fields, string name) =>
        fields.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.Number ? v.GetDouble() : 0;
    static string FStrPath(JsonElement fields, string name, string prop) =>
        fields.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.Object && v.TryGetProperty(prop, out var pv) && pv.ValueKind == JsonValueKind.String
            ? pv.GetString() ?? "" : "";
}
