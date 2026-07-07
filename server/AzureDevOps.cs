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
    }

    static async Task<string> NextProjectIdAsync(AtlasDbContext db)
    {
        var ids = await db.Projects.Select(x => x.Id).ToListAsync();
        var max = ids.Select(x => int.TryParse(x.Split('-').Last(), out var n) ? n : 0).DefaultIfEmpty(0).Max();
        return $"PRJ-{max + 1}";
    }
}
