using System.Security.Claims;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace Atlas.Api;

// Releases write endpoints — split out of the former single MapAtlasWriteEndpoints god-method (R18 / #104).
// Part of the partial WriteEndpoints class; shared helpers (NextId, Clamp, HealthFor, …) stay in WriteEndpoints.cs.
public static partial class WriteEndpoints
{
    static void MapReleaseWrites(RouteGroupBuilder api)
    {
        // ---- Releases ------------------------------------------------------
        api.MapPost("/releases", async (CreateReleaseReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            if (string.IsNullOrWhiteSpace(req.Name)) return Results.BadRequest(new { error = "Name is required." });
            var scope = new[] { "Product", "Project", "Program" }.Contains(req.Scope) ? req.Scope! : "Product";
            var r = new Release
            {
                Id = await NextId(db.Releases.Select(x => x.Id), "REL-", db),
                Name = req.Name.Trim(),
                Owner = string.IsNullOrWhiteSpace(req.Owner) ? "Unassigned" : req.Owner!.Trim(),
                Link = req.Link?.Trim() ?? "",
                Scope = scope,
                Date = req.Date?.Trim() ?? "",
                Env = string.IsNullOrWhiteSpace(req.Env) ? "Staging" : req.Env!.Trim(),
                Risk = string.IsNullOrWhiteSpace(req.Risk) ? "Low" : req.Risk!.Trim(),
                Status = "Planned",
            };
            db.Releases.Add(r);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Releases", "Created release", $"{r.Id} · {r.Name}"));
            await db.SaveChangesAsync();
            return Results.Created($"/api/v1/releases/{r.Id}", new ReleaseDto(
                r.Id, r.Name, r.Reqs, r.Crs, r.Owner, r.Link, r.Scope, r.Date, r.Env, r.Progress, r.Risk, r.Status, r.Archived));
        });

        // Edit a release's fields. Anyone with Edit on "Projects & tasks" (which
        // includes the service/engineering/dev/infra managers) can maintain a
        // release from the Releases section. Only the fields sent are changed.
        api.MapPatch("/releases/{id}", async (string id, UpdateReleaseReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            var r = await db.Releases.FindAsync(id);
            if (r is null) return Results.NotFound();
            if (req.Name is not null)
            {
                if (string.IsNullOrWhiteSpace(req.Name)) return Results.BadRequest(new { error = "Name is required." });
                r.Name = req.Name.Trim();
            }
            if (req.Owner is not null) r.Owner = string.IsNullOrWhiteSpace(req.Owner) ? "Unassigned" : req.Owner.Trim();
            if (req.Link is not null) r.Link = req.Link.Trim();
            if (req.Scope is not null)
            {
                if (!new[] { "Product", "Project", "Program" }.Contains(req.Scope)) return Results.BadRequest(new { error = "Unknown scope." });
                r.Scope = req.Scope;
            }
            if (req.Date is not null) r.Date = req.Date.Trim();
            if (req.Env is not null) r.Env = req.Env.Trim();
            if (req.Risk is not null) r.Risk = req.Risk.Trim();
            if (req.Reqs is int rq) r.Reqs = Math.Max(0, rq);
            if (req.Crs is int cr) r.Crs = Math.Max(0, cr);
            if (req.Progress is int pg) r.Progress = Math.Clamp(pg, 0, 100);
            if (req.Status is not null)
            {
                if (!new[] { "Planned", "In progress", "Deployed", "Rolled back", "Completed", "Cancelled" }.Contains(req.Status))
                    return Results.BadRequest(new { error = "Unknown status." });
                r.Status = req.Status;
            }
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Releases", "Edited release", $"{r.Id} · {r.Name}"));
            await db.SaveChangesAsync();
            return Results.Ok(new ReleaseDto(r.Id, r.Name, r.Reqs, r.Crs, r.Owner, r.Link, r.Scope, r.Date, r.Env, r.Progress, r.Risk, r.Status, r.Archived));
        });

        // Archive / restore a release. Requires Edit on "Create / edit projects".
        api.MapPost("/releases/{id}/archive", async (string id, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            var r = await db.Releases.FindAsync(id);
            if (r is null) return Results.NotFound();
            r.Archived = true;
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Releases", "Archived release", $"{r.Id} · {r.Name}"));
            await db.SaveChangesAsync();
            return Results.NoContent();
        });
        api.MapPost("/releases/{id}/unarchive", async (string id, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            var r = await db.Releases.FindAsync(id);
            if (r is null) return Results.NotFound();
            r.Archived = false;
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Releases", "Restored release", $"{r.Id} · {r.Name}"));
            await db.SaveChangesAsync();
            return Results.NoContent();
        });
        // Permanently delete a release. Requires Full on "Create / edit projects".
        api.MapDelete("/releases/{id}", async (string id, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "F") is { } denied) return denied;
            var r = await db.Releases.FindAsync(id);
            if (r is null) return Results.NotFound();
            db.Releases.Remove(r);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Releases", "Deleted release", $"{r.Id} · {r.Name}"));
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

    }
}
