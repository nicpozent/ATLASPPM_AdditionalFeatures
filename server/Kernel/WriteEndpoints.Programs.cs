using System.Security.Claims;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace Atlas.Api;

// Programs write endpoints — split out of the former single MapAtlasWriteEndpoints god-method (R18 / #104).
// Part of the partial WriteEndpoints class; shared helpers (NextId, Clamp, HealthFor, …) stay in WriteEndpoints.cs.
public static partial class WriteEndpoints
{
    static void MapProgramWrites(RouteGroupBuilder api)
    {
        // ---- Programs ------------------------------------------------------
        api.MapPost("/programs", async (CreateProgramReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "F") is { } denied) return denied;
            if (string.IsNullOrWhiteSpace(req.Name)) return Results.BadRequest(new { error = "Name is required." });
            var pg = new Program
            {
                Id = await NextId(db.Programs.Select(x => x.Id), "PGM-", db),
                Name = req.Name.Trim(),
                Owner = string.IsNullOrWhiteSpace(req.Owner) ? "Unassigned" : req.Owner!.Trim(),
                Goal = req.Goal?.Trim() ?? "",
                Status = string.IsNullOrWhiteSpace(req.Status) ? "On track" : req.Status!.Trim(),
                Projects = req.Projects ?? new(),
                Health = "green",
                StartDate = req.StartDate?.Trim() ?? "",
                EndDate = req.EndDate?.Trim() ?? "",
                Dept = Departments.Normalize(req.Dept),
            };
            db.Programs.Add(pg);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Programs", "Created program", $"{pg.Id} · {pg.Name}"));
            await db.SaveChangesAsync();
            await Notifications.EmitPortfolioAsync(db, cfg, Notifications.Created, $"New program: {pg.Name}", $"{pg.Id} · {pg.Name} was created.", "program", pg.Id, Permissions.CallerKey(http, cfg));
            return Results.Created($"/api/v1/programs/{pg.Id}", new ProgramDto(
                pg.Id, pg.Name, pg.Owner, pg.Goal, pg.Status, pg.Projects, pg.Budget, pg.Spent, pg.Progress, pg.Health, pg.StartDate, pg.Archived, pg.EndDate, pg.Dept));
        });

        // Edit a program's owner, department, goal and dates. Requires Edit on projects.
        api.MapPatch("/programs/{id}", async (string id, UpdateProgramReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            var pg = await db.Programs.FindAsync(id);
            if (pg is null) return Results.NotFound();
            if (!string.IsNullOrWhiteSpace(req.Owner)) pg.Owner = req.Owner!.Trim();
            if (req.Dept is not null) pg.Dept = Departments.Normalize(req.Dept);
            if (req.Goal is not null) pg.Goal = req.Goal.Trim();
            if (req.StartDate is not null) pg.StartDate = req.StartDate.Trim();
            if (req.EndDate is not null) pg.EndDate = req.EndDate.Trim();
            // Link/unlink projects after creation: only keep ids that exist.
            if (req.Projects is not null)
            {
                var valid = await db.Projects.Where(p => req.Projects.Contains(p.Id)).Select(p => p.Id).ToListAsync();
                pg.Projects = req.Projects.Where(valid.Contains).Distinct().ToList();
            }
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Programs", "Updated program", $"{pg.Id} · {pg.Name}"));
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        // Archive / restore a program (soft delete — kept, just hidden from the
        // active list). Requires Edit on "Create / edit projects".
        api.MapPost("/programs/{id}/archive", async (string id, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            var pg = await db.Programs.FindAsync(id);
            if (pg is null) return Results.NotFound();
            pg.Archived = true;
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Programs", "Archived program", $"{pg.Id} · {pg.Name}"));
            await db.SaveChangesAsync();
            return Results.NoContent();
        });
        api.MapPost("/programs/{id}/unarchive", async (string id, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            var pg = await db.Programs.FindAsync(id);
            if (pg is null) return Results.NotFound();
            pg.Archived = false;
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Programs", "Restored program", $"{pg.Id} · {pg.Name}"));
            await db.SaveChangesAsync();
            return Results.NoContent();
        });
        // Permanently delete a program. Requires Full on "Create / edit projects".
        api.MapDelete("/programs/{id}", async (string id, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "F") is { } denied) return denied;
            var pg = await db.Programs.FindAsync(id);
            if (pg is null) return Results.NotFound();
            db.Programs.Remove(pg);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Programs", "Deleted program", $"{pg.Id} · {pg.Name}"));
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

    }
}
