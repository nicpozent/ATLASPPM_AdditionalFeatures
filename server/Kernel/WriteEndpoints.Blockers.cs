using System.Security.Claims;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace Atlas.Api;

// Blockers write endpoints — split out of the former single MapAtlasWriteEndpoints god-method (R18 / #104).
// Part of the partial WriteEndpoints class; shared helpers (NextId, Clamp, HealthFor, …) stay in WriteEndpoints.cs.
public static partial class WriteEndpoints
{
    static void MapBlockerWrites(RouteGroupBuilder api)
    {
        // ---- Blockers ------------------------------------------------------
        api.MapPost("/blockers", async (CreateBlockerReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            if (string.IsNullOrWhiteSpace(req.Title)) return Results.BadRequest(new { error = "Title is required." });
            var project = await db.Projects.FindAsync(req.ProjectId);
            if (project is null) return Results.BadRequest(new { error = "Unknown projectId." });
            var b = new Blocker
            {
                Id = await NextId(db.Blockers.Select(x => x.Id), "BLK-", db),
                Title = req.Title.Trim(),
                Description = req.Description?.Trim() ?? "",
                ProjectId = req.ProjectId,
                Owner = string.IsNullOrWhiteSpace(req.Owner) ? project.Owner : req.Owner!.Trim(),
                Status = Clamp(req.Status, BlockerStatuses, "Active"),
            };
            db.Blockers.Add(b);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Blockers", "Raised blocker", $"{b.Id} ({project.Name})"));
            await db.SaveChangesAsync();
            return Results.Created($"/api/v1/blockers/{b.Id}",
                new BlockerDto(b.Id, b.Title, b.ProjectId, project.Name, b.Owner, b.Status, b.Description));
        });

        api.MapPatch("/blockers/{id}", async (string id, UpdateBlockerReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            var b = await db.Blockers.Include(x => x.Project).FirstOrDefaultAsync(x => x.Id == id);
            if (b is null) return Results.NotFound();
            if (req.Title is not null)
            {
                if (string.IsNullOrWhiteSpace(req.Title)) return Results.BadRequest(new { error = "Title is required." });
                b.Title = req.Title.Trim();
            }
            if (req.Description is not null) b.Description = req.Description.Trim();
            if (req.Owner is not null) b.Owner = string.IsNullOrWhiteSpace(req.Owner) ? (b.Project?.Owner ?? "") : req.Owner.Trim();
            if (req.Status is not null)
            {
                if (!BlockerStatuses.Contains(req.Status)) return Results.BadRequest(new { error = "Unknown status." });
                b.Status = req.Status;
            }
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Blockers", "Updated blocker", $"{b.Id} → {b.Status}"));
            await db.SaveChangesAsync();
            return Results.Ok(new BlockerDto(b.Id, b.Title, b.ProjectId, b.Project!.Name, b.Owner, b.Status, b.Description));
        });

        api.MapDelete("/blockers/{id}", async (string id, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            var b = await db.Blockers.FindAsync(id);
            if (b is null) return Results.NotFound();
            db.Blockers.Remove(b);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Blockers", "Deleted blocker", b.Id));
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

    }
}
