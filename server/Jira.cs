using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;

namespace Atlas.Api;

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

        // Sync one project from its mapped Jira board. Managing integrations
        // requires Edit on "Integrations & connectors".
        api.MapPost("/projects/{id}/jira/sync", async (string id, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-integrations", "E") is { } denied) return denied;
            if (!JiraConfigured(cfg))
                return Results.Ok(new { ok = false, error = "Jira isn't configured — set Jira:BaseUrl, Jira:Email and Jira:ApiToken (see docs/jira-setup.md)." });
            var p = await db.Projects.FirstOrDefaultAsync(x => x.Id == id);
            if (p is null) return Results.NotFound();
            if (string.IsNullOrWhiteSpace(p.JiraProjectKey) || p.JiraBoardId is null)
                return Results.Ok(new { ok = false, error = "This project isn't mapped to Jira — set its Jira project key and board id first." });
            try
            {
                using var c = Client(cfg);
                var r = await SyncProjectAsync(db, cfg, c, p);
                db.AuditEvents.Add(Permissions.Audit(http, cfg, "Integrations", "Synced project from Jira",
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
        api.MapPost("/integrations/jira/sync", async (AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-integrations", "E") is { } denied) return denied;
            if (!JiraConfigured(cfg))
                return Results.Ok(new { ok = false, error = "Jira isn't configured — set Jira:BaseUrl, Jira:Email and Jira:ApiToken (see docs/jira-setup.md)." });
            var mapped = await db.Projects
                .Where(p => !p.Archived && p.JiraProjectKey != "" && p.JiraBoardId != null)
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
                    var r = await SyncProjectAsync(db, cfg, c, p);
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
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "F") is { } denied) return denied;
            var key = (req.JiraProjectKey ?? "").Trim().ToUpperInvariant();
            if (key.Length == 0) return Results.BadRequest(new { error = "A Jira project key is required." });
            var board = req.BoardId is int b && b > 0 ? b : (int?)null;
            var target = (req.Target ?? "project").Trim().ToLowerInvariant();

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
    public static async Task<SyncResult> SyncProjectAsync(AtlasDbContext db, IConfiguration cfg, HttpClient c, Project p)
    {
        var board = p.JiraBoardId!.Value;
        var pointsField = string.IsNullOrWhiteSpace(cfg["Jira:StoryPointsField"]) ? "customfield_10016" : cfg["Jira:StoryPointsField"]!.Trim();
        var truncated = false;

        // --- Sprints: /board/{id}/sprint (values[] + isLast) -----------------
        var jiraSprints = await FetchPagedAsync(c, $"rest/agile/1.0/board/{board}/sprint", "values", () => truncated = true);
        var existingSprints = await db.Sprints.Where(s => s.ProjectId == p.Id).ToListAsync();
        var sprintOrd = existingSprints.Select(s => s.Ord).DefaultIfEmpty(0).Max();
        var seenSprints = new HashSet<string>();
        foreach (var js in jiraSprints)
        {
            var key = NumOrStr(js, "id");
            if (key.Length == 0) continue;
            seenSprints.Add(key);
            var s = existingSprints.FirstOrDefault(x => x.JiraKey == key);
            if (s is null) { s = new Sprint { ProjectId = p.Id, JiraKey = key, Ord = ++sprintOrd }; db.Sprints.Add(s); existingSprints.Add(s); }
            s.Name = Str(js, "name");
            s.Goal = Str(js, "goal");
            s.StartDate = DatePart(Str(js, "startDate"));
            s.EndDate = DatePart(Str(js, "endDate"));
            s.Status = MapSprintState(Str(js, "state"));
        }
        if (seenSprints.Count > 0)
            db.Sprints.RemoveRange(existingSprints.Where(s => s.JiraKey.Length > 0 && !seenSprints.Contains(s.JiraKey)));

        // --- Epics: /board/{id}/epic (values[] + isLast) ---------------------
        var jiraEpics = await FetchPagedAsync(c, $"rest/agile/1.0/board/{board}/epic", "values", () => truncated = true);
        var existingEpics = await db.Epics.Where(e => e.ProjectId == p.Id).ToListAsync();
        var epicOrd = existingEpics.Select(e => e.Ord).DefaultIfEmpty(0).Max();
        var seenEpics = new HashSet<string>();
        foreach (var je in jiraEpics)
        {
            var key = NumOrStr(je, "id");
            if (key.Length == 0) continue;
            seenEpics.Add(key);
            var e = existingEpics.FirstOrDefault(x => x.JiraKey == key);
            if (e is null) { e = new Epic { ProjectId = p.Id, JiraKey = key, Ord = ++epicOrd }; db.Epics.Add(e); existingEpics.Add(e); }
            var name = Str(je, "name");
            e.Name = name.Length > 0 ? name : Str(je, "summary");
            e.Status = Bool(je, "done") ? "Complete" : "In progress";
        }
        if (seenEpics.Count > 0)
            db.Epics.RemoveRange(existingEpics.Where(e => e.JiraKey.Length > 0 && !seenEpics.Contains(e.JiraKey)));

        // --- Issues: /board/{id}/issue (issues[] + total paging) -------------
        var fields = $"summary,status,issuetype,assignee,duedate,priority,sprint,closedSprints,epic,parent,{pointsField}";
        var jiraIssues = await FetchIssuesAsync(c, $"rest/agile/1.0/board/{board}/issue", fields, () => truncated = true);
        var existingTasks = await db.ProjectTasks.Where(t => t.ProjectId == p.Id).ToListAsync();
        var taskOrd = existingTasks.Select(t => t.Ord).DefaultIfEmpty(0).Max();
        var seenTasks = new HashSet<string>();
        int backlog = 0;
        foreach (var ji in jiraIssues)
        {
            var key = Str(ji, "key");
            if (key.Length == 0) continue;
            seenTasks.Add(key);
            var f = Prop(ji, "fields") ?? default;
            var t = existingTasks.FirstOrDefault(x => x.JiraKey == key);
            if (t is null) { t = new ProjectTask { ProjectId = p.Id, JiraKey = key, Code = key, Ord = ++taskOrd }; db.ProjectTasks.Add(t); existingTasks.Add(t); }
            t.Code = key;
            t.Name = Str(f, "summary");
            t.Assignee = StrPath(f, "assignee", "displayName") is { Length: > 0 } a ? a : "Unassigned";
            t.Status = MapIssueStatus(StrPath(f, "status", "statusCategory", "key"));
            t.Priority = MapPriority(StrPath(f, "priority", "name"));
            t.TargetDate = DatePart(Str(f, "duedate"));
            t.Points = Math.Max(0, IntProp(f, pointsField));
            var sprintName = SprintNameOf(f);
            t.Sprint = sprintName;
            if (sprintName.Length == 0) backlog++;
            t.Epic = EpicNameOf(f);
        }
        if (seenTasks.Count > 0)
            db.ProjectTasks.RemoveRange(existingTasks.Where(t => t.JiraKey.Length > 0 && !seenTasks.Contains(t.JiraKey)));

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

        return new SyncResult(seenSprints.Count, seenEpics.Count, seenTasks.Count, backlog, truncated);
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
    // recent closed sprint (so completed-sprint issues still group), else "".
    static string SprintNameOf(JsonElement fields)
    {
        if (Prop(fields, "sprint") is { } s)
        {
            if (s.ValueKind == JsonValueKind.Object) return Str(s, "name");
            if (s.ValueKind == JsonValueKind.Array && s.GetArrayLength() > 0) return Str(s[s.GetArrayLength() - 1], "name");
        }
        if (Prop(fields, "closedSprints") is { ValueKind: JsonValueKind.Array } cs && cs.GetArrayLength() > 0)
            return Str(cs[cs.GetArrayLength() - 1], "name");
        return "";
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
    static async Task<List<JsonElement>> FetchIssuesAsync(HttpClient c, string path, string fields, Action onTruncate)
    {
        var all = new List<JsonElement>();
        int startAt = 0, page = 0;
        var fieldQuery = Uri.EscapeDataString(fields);
        while (page++ < MaxPages)
        {
            var res = await c.GetAsync($"{path}?startAt={startAt}&maxResults={PageSize}&fields={fieldQuery}");
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
}
