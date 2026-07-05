using Microsoft.EntityFrameworkCore;

namespace Atlas.Api;

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
    }
}
