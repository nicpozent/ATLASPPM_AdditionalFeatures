using System.Security.Claims;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace Atlas.Api;

// OKRs write endpoints — split out of the former single MapAtlasWriteEndpoints god-method (R18 / #104).
// Part of the partial WriteEndpoints class; shared helpers (NextId, Clamp, HealthFor, …) stay in WriteEndpoints.cs.
public static partial class WriteEndpoints
{
    static void MapOkrWrites(RouteGroupBuilder api)
    {
        // ---- OKRs ----------------------------------------------------------
        api.MapPost("/okrs", async (CreateObjectiveReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-okrs", "E") is { } denied) return denied;
            if (string.IsNullOrWhiteSpace(req.Title)) return Results.BadRequest(new { error = "Title is required." });
            var o = new Objective
            {
                Id = await NextId(db.Objectives.Select(x => x.Id), "OKR-", db),
                Title = req.Title.Trim(),
                Owner = string.IsNullOrWhiteSpace(req.Owner) ? "Unassigned" : req.Owner!.Trim(),
                Horizon = string.IsNullOrWhiteSpace(req.Horizon) ? "FY26" : req.Horizon!.Trim(),
                StartDate = req.StartDate?.Trim() ?? "",
                TargetDate = req.TargetDate?.Trim() ?? "",
            };
            db.Objectives.Add(o);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "OKRs", "Created objective", $"{o.Id} · {o.Title}"));
            await db.SaveChangesAsync();
            return Results.Created($"/api/v1/okrs/{o.Id}",
                new ObjectiveDto(o.Id, o.Title, o.Owner, o.Horizon, new List<KrDto>(), o.Status, o.Health, o.StartDate, o.TargetDate));
        });

        // Edit an objective's fields and manual RAG health. Gated on Edit for OKRs
        // — in the matrix that's exactly PMO + Platform Admin.
        api.MapPatch("/okrs/{id}", async (string id, UpdateObjectiveReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-okrs", "E") is { } denied) return denied;
            var o = await db.Objectives.FindAsync(id);
            if (o is null) return Results.NotFound();
            if (!string.IsNullOrWhiteSpace(req.Title)) o.Title = req.Title!.Trim();
            if (!string.IsNullOrWhiteSpace(req.Owner)) o.Owner = req.Owner!.Trim();
            if (!string.IsNullOrWhiteSpace(req.Horizon)) o.Horizon = req.Horizon!.Trim();
            if (req.StartDate is not null) o.StartDate = req.StartDate.Trim();
            if (req.TargetDate is not null) o.TargetDate = req.TargetDate.Trim();
            if (req.Health is not null)
            {
                if (req.Health is not ("green" or "amber" or "red")) return Results.BadRequest(new { error = "Health must be green, amber or red." });
                o.Health = req.Health;
            }
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "OKRs", "Updated objective", $"{o.Id} · {o.Title}"));
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        api.MapPost("/okrs/{id}/krs", async (string id, CreateKrReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-okrs", "E") is { } denied) return denied;
            if (string.IsNullOrWhiteSpace(req.Title)) return Results.BadRequest(new { error = "Title is required." });
            var obj = await db.Objectives.FindAsync(id);
            if (obj is null) return Results.NotFound();
            var (lType, lId, lName) = await ResolveKrLink(db, req.LinkType, req.LinkId);
            var kr = new KeyResult
            {
                Id = await NextId(db.KeyResults.Select(x => x.Id), "KR-", db),
                Title = req.Title.Trim(),
                // A typed link wins; otherwise keep any free-text label supplied.
                Link = lType.Length > 0 ? lName : (req.Link?.Trim() ?? ""),
                LinkType = lType, LinkId = lId,
                Progress = Math.Clamp(req.Progress ?? 0, 0, 100),
                ObjectiveId = id,
            };
            db.KeyResults.Add(kr);
            await db.SaveChangesAsync();
            return Results.Created($"/api/v1/okrs/{id}/krs/{kr.Id}",
                new KrDto(kr.Id, kr.Title, kr.Link, kr.Progress, kr.LinkType, kr.LinkId, kr.LinkType.Length > 0));
        });

        api.MapPatch("/krs/{id}", async (string id, UpdateKrReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-okrs", "E") is { } denied) return denied;
            var kr = await db.KeyResults.FindAsync(id);
            if (kr is null) return Results.NotFound();
            if (req.Progress is int p) kr.Progress = Math.Clamp(p, 0, 100);
            // Update or clear the typed link when either field is provided.
            if (req.LinkType is not null || req.LinkId is not null)
            {
                var (lType, lId, lName) = await ResolveKrLink(db, req.LinkType ?? kr.LinkType, req.LinkId ?? kr.LinkId);
                kr.LinkType = lType; kr.LinkId = lId;
                kr.Link = lType.Length > 0 ? lName : "";
            }
            await db.SaveChangesAsync();
            return Results.Ok(new KrDto(kr.Id, kr.Title, kr.Link, kr.Progress, kr.LinkType, kr.LinkId, kr.LinkType.Length > 0));
        });

        // Permanently delete an objective and its key results. Requires Full on
        // "Create / edit projects".
        api.MapDelete("/okrs/{id}", async (string id, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-okrs", "F") is { } denied) return denied;
            var o = await db.Objectives.FindAsync(id);
            if (o is null) return Results.NotFound();
            await db.KeyResults.Where(k => k.ObjectiveId == id).ExecuteDeleteAsync();
            db.Objectives.Remove(o);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "OKRs", "Deleted objective", $"{o.Id} · {o.Title}"));
            await db.SaveChangesAsync();
            return Results.NoContent();
        });
    }
}
