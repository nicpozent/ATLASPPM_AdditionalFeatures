using Microsoft.EntityFrameworkCore;

namespace Atlas.Api.Governance;

// ============================================================================
//  Deletion requests & archive administration (Admin → Archive & Deletions).
//  Roles that can't archive a project directly can REQUEST its deletion; PMO /
//  Admin approve (which archives it, a soft delete) or reject. The archive
//  itself is recoverable — PMO/Admin restore, and Platform Admin can purge a
//  manually-created project permanently (reusing the project delete rules).
// ============================================================================
public static class Deletions
{
    public static void MapDeletionEndpoints(this RouteGroupBuilder api)
    {
        // Filing a request is harmless — PMO approval (below) is the gated control —
        // so any caller may raise one. Roles that can archive directly won't use it.
        api.MapPost("/projects/{id}/deletion-request", async (string id, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            var p = await db.Projects.FirstOrDefaultAsync(x => x.Id == id);
            if (p is null) return Results.NotFound();
            if (p.Archived) return Results.BadRequest(new { error = "Project is already archived." });
            if (await db.DeletionRequests.AnyAsync(r => r.ProjectId == id && r.Status == "Pending"))
                return Results.BadRequest(new { error = "A deletion request is already pending for this project." });

            var role = Permissions.ResolveRoleId(http.User, http.Request, cfg.GetValue("Auth:Enabled", false)) ?? "dev";
            var req = new DeletionRequest
            {
                ProjectId = id, ProjectName = p.Name, RequestedBy = Permissions.ActorName(http, cfg),
                RequestedRole = role, Date = DateTime.UtcNow.ToString("dd MMM yyyy"), Status = "Pending",
            };
            db.DeletionRequests.Add(req);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Projects", "Requested project deletion", $"{id} · {p.Name}"));
            await db.SaveChangesAsync();
            return Results.Created($"/api/v1/deletion-requests/{req.Id}",
                new DeletionRequestDto(req.Id, req.ProjectId, req.ProjectName, req.RequestedBy, req.RequestedRole, req.Date));
        });

        // The Archive & Deletions admin view: pending requests + archived projects.
        api.MapGet("/deletion-requests", async (AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "V") is { } denied) return denied;
            var requests = await db.DeletionRequests.Where(r => r.Status == "Pending").OrderBy(r => r.Id)
                .Select(r => new DeletionRequestDto(r.Id, r.ProjectId, r.ProjectName, r.RequestedBy, r.RequestedRole, r.Date))
                .ToListAsync();
            var archived = await db.Projects.Where(p => p.Archived).OrderBy(p => p.Id)
                .Select(p => new ArchivedProjectDto(p.Id, p.Name, p.Dept, p.Owner, p.IsSystem)).ToListAsync();
            var canGovern = await Permissions.Allows(http, db, cfg, "cap-projects", "F");
            return Results.Ok(new ArchiveAdminDto(canGovern, Permissions.IsPlatformAdmin(http, cfg), requests, archived));
        });

        // Approve → archive the project (soft delete). PMO / Admin.
        api.MapPost("/deletion-requests/{reqId:int}/approve", async (int reqId, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "F") is { } denied) return denied;
            var req = await db.DeletionRequests.FindAsync(reqId);
            if (req is null) return Results.NotFound();
            var p = await db.Projects.FirstOrDefaultAsync(x => x.Id == req.ProjectId);
            if (p is not null) p.Archived = true;
            db.DeletionRequests.Remove(req);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Projects", "Approved deletion → archived", $"{req.ProjectId} · {req.ProjectName}"));
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        // Reject a request. PMO / Admin.
        api.MapDelete("/deletion-requests/{reqId:int}", async (int reqId, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "F") is { } denied) return denied;
            var req = await db.DeletionRequests.FindAsync(reqId);
            if (req is null) return Results.NotFound();
            db.DeletionRequests.Remove(req);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Projects", "Rejected deletion request", $"{req.ProjectId} · {req.ProjectName}"));
            await db.SaveChangesAsync();
            return Results.NoContent();
        });
    }
}
