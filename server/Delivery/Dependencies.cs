using Microsoft.EntityFrameworkCore;

namespace Atlas.Api.Delivery;

public record LinkDependencyReq(string DependsOnId);

// ============================================================================
//  Project dependencies — cross-project links, with an inherited-risk rollup:
//  a project's *effective* health is the worst of its own status and the status
//  of everything it depends on. Linking requires Edit on "Projects & tasks".
// ============================================================================
public static class Dependencies
{
    // Severity of a traffic-light status (higher = worse).
    static int Rank(string status) => status switch { "red" => 3, "amber" => 2, "hold" => 1, _ => 0 };

    public static void MapDependencyEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/projects/{id}/dependencies", async (string id, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            var self = await db.Projects.FirstOrDefaultAsync(p => p.Id == id);
            if (self is null) return Results.NotFound();

            var dependsOnIds = await db.ProjectDependencies.Where(d => d.ProjectId == id).OrderBy(d => d.Ord).Select(d => d.DependsOnId).ToListAsync();
            var blockIds = await db.ProjectDependencies.Where(d => d.DependsOnId == id).OrderBy(d => d.Ord).Select(d => d.ProjectId).ToListAsync();
            var wanted = dependsOnIds.Concat(blockIds).Distinct().ToList();
            var projects = await db.Projects.Where(p => wanted.Contains(p.Id))
                .ToDictionaryAsync(p => p.Id, p => new DepLinkDto(p.Id, p.Name, p.Dept, p.Status, p.Health));

            var dependsOn = dependsOnIds.Where(projects.ContainsKey).Select(x => projects[x]).ToList();
            var blocks = blockIds.Where(projects.ContainsKey).Select(x => projects[x]).ToList();

            // Effective health = worst of own status and any upstream dependency.
            var worst = dependsOn.OrderByDescending(d => Rank(d.Status)).FirstOrDefault();
            var inherited = worst is not null && Rank(worst.Status) > Rank(self.Status);
            var canEdit = await Permissions.Allows(http, db, cfg, "cap-projects", "E");
            return Results.Ok(new DependenciesDto(canEdit, dependsOn, blocks,
                inherited, self.Health, inherited ? worst!.Health : self.Health, inherited ? worst!.Name : ""));
        });

        api.MapPost("/projects/{id}/dependencies", async (string id, LinkDependencyReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            if (!await db.Projects.AnyAsync(p => p.Id == id)) return Results.NotFound();
            if (string.IsNullOrWhiteSpace(req.DependsOnId) || req.DependsOnId == id)
                return Results.BadRequest(new { error = "Pick a different project to depend on." });
            var target = await db.Projects.FindAsync(req.DependsOnId);
            if (target is null) return Results.BadRequest(new { error = "Unknown project." });
            if (await db.ProjectDependencies.AnyAsync(d => d.ProjectId == id && d.DependsOnId == req.DependsOnId))
                return Results.BadRequest(new { error = "Dependency already exists." });
            var ord = (await db.ProjectDependencies.Where(d => d.ProjectId == id).Select(d => (int?)d.Ord).MaxAsync() ?? 0) + 1;
            db.ProjectDependencies.Add(new ProjectDependency { ProjectId = id, DependsOnId = req.DependsOnId, Ord = ord });
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Dependencies", "Linked dependency", $"{id} → {target.Id} {target.Name}"));
            await db.SaveChangesAsync();
            return Results.Created($"/api/v1/projects/{id}/dependencies",
                new DepLinkDto(target.Id, target.Name, target.Dept, target.Status, target.Health));
        });

        api.MapDelete("/projects/{id}/dependencies/{dependsOnId}", async (string id, string dependsOnId, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            var link = await db.ProjectDependencies.FirstOrDefaultAsync(d => d.ProjectId == id && d.DependsOnId == dependsOnId);
            if (link is null) return Results.NotFound();
            db.ProjectDependencies.Remove(link);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Dependencies", "Unlinked dependency", $"{id} ✕ {dependsOnId}"));
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        // -------- Portfolio timeline dependency arrows -----------------------
        // Generic cross-entity links (project/program/product/release/sprint) drawn
        // as arrows on the Portfolio & Program timelines. Merges the hand-drawn /
        // Jira-ingested TimelineDependency rows with the existing project→project
        // links (surfaced as source "project") so every known dependency shows.
        api.MapGet("/portfolio/dependencies", async (AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            var canEdit = await Permissions.Allows(http, db, cfg, "cap-projects", "E");
            var edges = (await db.TimelineDependencies.OrderBy(d => d.Ord).ThenBy(d => d.Id).ToListAsync())
                .Select(d => new TimelineDepDto(d.Id, d.FromType, d.FromId, d.ToType, d.ToId, d.Source))
                .ToList();
            // Fold in the legacy project→project links (not stored as TimelineDependency).
            var known = edges.Where(e => e.FromType == "project" && e.ToType == "project")
                .Select(e => (e.FromId, e.ToId)).ToHashSet();
            foreach (var p in await db.ProjectDependencies.OrderBy(d => d.Ord).ToListAsync())
                if (known.Add((p.ProjectId, p.DependsOnId)))
                    edges.Add(new TimelineDepDto(0, "project", p.ProjectId, "project", p.DependsOnId, "project"));
            return Results.Ok(new TimelineDepsDto(canEdit, edges));
        });

        api.MapPost("/portfolio/dependencies", async (CreateTimelineDepReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            var ft = Norm(req.FromType); var tt = Norm(req.ToType);
            if (ft is null || tt is null) return Results.BadRequest(new { error = "Unknown entity type." });
            if (string.IsNullOrWhiteSpace(req.FromId) || string.IsNullOrWhiteSpace(req.ToId))
                return Results.BadRequest(new { error = "Both ends are required." });
            var fid = req.FromId!.Trim(); var tid = req.ToId!.Trim();
            if (ft == tt && fid == tid) return Results.BadRequest(new { error = "An item can't depend on itself." });
            if (!await ExistsAsync(db, ft, fid) || !await ExistsAsync(db, tt, tid))
                return Results.BadRequest(new { error = "One of the items no longer exists." });
            if (await db.TimelineDependencies.AnyAsync(d => d.FromType == ft && d.FromId == fid && d.ToType == tt && d.ToId == tid))
                return Results.Conflict(new { error = "That dependency already exists." });
            var ord = (await db.TimelineDependencies.Select(d => (int?)d.Ord).MaxAsync() ?? 0) + 1;
            var dep = new TimelineDependency { FromType = ft, FromId = fid, ToType = tt, ToId = tid, Source = "manual", Ord = ord };
            db.TimelineDependencies.Add(dep);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Dependencies", "Linked timeline dependency", $"{ft}:{fid} → {tt}:{tid}"));
            await db.SaveChangesAsync();
            return Results.Created($"/api/v1/portfolio/dependencies/{dep.Id}",
                new TimelineDepDto(dep.Id, dep.FromType, dep.FromId, dep.ToType, dep.ToId, dep.Source));
        });

        // Derive sprint→sprint dependencies from a project's cross-sprint Jira
        // issue links (reuses the project Jira sync client). Config- + key-guarded,
        // idempotent, audited; failures return a clean 502.
        api.MapPost("/projects/{id}/dependencies/jira-ingest", async (string id, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            var proj = await db.Projects.FindAsync(id);
            if (proj is null) return Results.NotFound();
            if (!Jira.JiraConfigured(cfg)) return Results.BadRequest(new { error = "Jira isn't configured — set it up in Integrations first." });
            if (string.IsNullOrWhiteSpace(proj.JiraProjectKey)) return Results.BadRequest(new { error = "This project isn't linked to a Jira project." });
            try
            {
                using var c = Jira.Client(cfg);
                var res = await Jira.IngestSprintDependenciesAsync(db, cfg, c, proj);
                db.AuditEvents.Add(Permissions.Audit(http, cfg, "Dependencies", "Ingested Jira sprint dependencies", $"{id} · +{res.Added}/-{res.Removed}"));
                await db.SaveChangesAsync();
                return Results.Ok(new { res.Added, res.Removed, res.Truncated });
            }
            catch (Exception ex)
            {
                return Results.Json(new { error = $"Jira dependency ingest failed: {ex.Message}" }, statusCode: StatusCodes.Status502BadGateway);
            }
        });

        api.MapDelete("/portfolio/dependencies/{id:int}", async (int id, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            var dep = await db.TimelineDependencies.FindAsync(id);
            if (dep is null) return Results.NotFound();
            db.TimelineDependencies.Remove(dep);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Dependencies", "Unlinked timeline dependency", $"{dep.FromType}:{dep.FromId} ✕ {dep.ToType}:{dep.ToId}"));
            await db.SaveChangesAsync();
            return Results.NoContent();
        });
    }

    static readonly string[] Types = { "project", "program", "product", "release", "sprint" };
    static string? Norm(string? t) { t = t?.Trim().ToLowerInvariant(); return t is not null && Types.Contains(t) ? t : null; }

    static async Task<bool> ExistsAsync(AtlasDbContext db, string type, string id) => type switch
    {
        "project" => await db.Projects.AnyAsync(p => p.Id == id),
        "program" => await db.Programs.AnyAsync(p => p.Id == id),
        "product" => await db.Products.AnyAsync(p => p.Id == id),
        "release" => await db.Releases.AnyAsync(r => r.Id == id),
        "sprint"  => int.TryParse(id, out var sid) && await db.Sprints.AnyAsync(s => s.Id == sid),
        _ => false,
    };
}
