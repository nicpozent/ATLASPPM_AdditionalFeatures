using Microsoft.EntityFrameworkCore;

namespace Atlas.Api;

public record StatusReq(string Status);

// ============================================================================
//  Lifecycle status transitions. Products, objectives and releases are never
//  deleted or archived — they move through terminal states and stay visible,
//  filed under their status: Products → Active / Retired / Replaced; Objectives
//  and Releases → (…) / Completed. Requires Edit on "Projects & tasks"; audited.
// ============================================================================
public static class Lifecycle
{
    static readonly string[] ProductStatuses = { "Active", "Retired", "Replaced" };
    static readonly string[] ObjectiveStatuses = { "Active", "Completed" };
    static readonly string[] ReleaseStatuses = { "Planned", "In progress", "Deployed", "Rolled back", "Completed", "Cancelled" };

    public static void MapLifecycleEndpoints(this RouteGroupBuilder api)
    {
        api.MapPatch("/products/{id}/status", async (string id, StatusReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-products", "E") is { } denied) return denied;
            if (!ProductStatuses.Contains(req.Status)) return Results.BadRequest(new { error = "Unknown status." });
            var p = await db.Products.FindAsync(id);
            if (p is null) return Results.NotFound();
            p.Status = req.Status;
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Products", $"Set status {req.Status}", $"{p.Id} · {p.Name}"));
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        api.MapPatch("/okrs/{id}/status", async (string id, StatusReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-okrs", "E") is { } denied) return denied;
            if (!ObjectiveStatuses.Contains(req.Status)) return Results.BadRequest(new { error = "Unknown status." });
            var o = await db.Objectives.FindAsync(id);
            if (o is null) return Results.NotFound();
            o.Status = req.Status;
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "OKRs", $"Set status {req.Status}", $"{o.Id} · {o.Title}"));
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        api.MapPatch("/releases/{id}/status", async (string id, StatusReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            if (!ReleaseStatuses.Contains(req.Status)) return Results.BadRequest(new { error = "Unknown status." });
            var r = await db.Releases.FindAsync(id);
            if (r is null) return Results.NotFound();
            r.Status = req.Status;
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Releases", $"Set status {req.Status}", $"{r.Id} · {r.Name}"));
            await db.SaveChangesAsync();
            return Results.NoContent();
        });
    }
}
