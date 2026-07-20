using Microsoft.EntityFrameworkCore;

namespace Atlas.Api.Operations;

public record CreateOperationalReq(string Title, string? Type, string? Severity, string? Owner, string? Source);
public record UpdateOperationalReq(string? Status, string? Severity);

// ============================================================================
//  Operational items — incidents, maintenance, service requests, on-call and
//  changes that can affect a project's delivery. Logged against the project they
//  impact; active high-severity items are picked up by the risk engine as a
//  deterministic "Operational impact" finding. Source is connector-ready so the
//  same records can later be ingested from ServiceNow / SDP / Jira / ADO.
// ============================================================================
public static class Operational
{
    static readonly string[] Types = { "Incident", "Maintenance", "Service request", "On-call", "Change" };
    static readonly string[] Severities = { "Critical", "High", "Medium", "Low" };
    static readonly string[] Statuses = { "Open", "In progress", "Resolved", "Closed" };
    static readonly string[] Sources = { "Manual", "ServiceNow", "ManageEngine SDP", "Jira", "Azure DevOps" };

    public static bool IsActive(OperationalItem o) => o.Status is "Open" or "In progress";

    static OperationalItemDto ToDto(OperationalItem o, string? projectName) =>
        new(o.Id, o.Ref, o.Title, o.Type, o.Severity, o.Status, o.Source, o.ProjectId, projectName, o.Owner, o.Date);

    public static void MapOperationalEndpoints(this RouteGroupBuilder api)
    {
        // Items affecting a given project.
        api.MapGet("/projects/{id}/operational", async (string id, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (!await db.Projects.AnyAsync(p => p.Id == id)) return Results.NotFound();
            var name = await db.Projects.Where(p => p.Id == id).Select(p => p.Name).FirstAsync();
            var items = await db.OperationalItems.Where(o => o.ProjectId == id)
                .OrderByDescending(o => o.Id).ToListAsync();
            var canEdit = await Permissions.Allows(http, db, cfg, "cap-projects", "E");
            return Results.Ok(new OperationalDto(canEdit, items.Select(o => ToDto(o, name)).ToList()));
        });

        // Portfolio-wide list — backs the operational deviations report.
        api.MapGet("/operational", async (AtlasDbContext db) =>
        {
            var names = await db.Projects.ToDictionaryAsync(p => p.Id, p => p.Name);
            var items = await db.OperationalItems.OrderByDescending(o => o.Id).ToListAsync();
            return Results.Ok(items.Select(o => ToDto(o, o.ProjectId is not null && names.TryGetValue(o.ProjectId, out var n) ? n : null)).ToList());
        });

        api.MapPost("/projects/{id}/operational", async (string id, CreateOperationalReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            if (!await db.Projects.AnyAsync(p => p.Id == id)) return Results.NotFound();
            if (string.IsNullOrWhiteSpace(req.Title)) return Results.BadRequest(new { error = "Title is required." });

            var maxNum = (await db.OperationalItems.Select(o => o.Ref).ToListAsync())
                .Select(r => int.TryParse(r.Split('-').Last(), out var n) ? n : 0).DefaultIfEmpty(0).Max();
            var item = new OperationalItem
            {
                Ref = $"OPS-{maxNum + 1:000}", Title = req.Title.Trim(), ProjectId = id,
                Type = Types.Contains(req.Type) ? req.Type! : "Incident",
                Severity = Severities.Contains(req.Severity) ? req.Severity! : "Medium",
                Source = Sources.Contains(req.Source) ? req.Source! : "Manual",
                Owner = string.IsNullOrWhiteSpace(req.Owner) ? "—" : req.Owner!.Trim(),
                Status = "Open", Date = DateTime.UtcNow.ToString("dd MMM yyyy"),
            };
            db.OperationalItems.Add(item);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Operational", $"Logged {item.Type.ToLower()}", $"{id} · {item.Ref} {item.Title}"));
            await db.SaveChangesAsync();
            var name = await db.Projects.Where(p => p.Id == id).Select(p => p.Name).FirstAsync();
            return Results.Created($"/api/v1/operational/{item.Id}", ToDto(item, name));
        });

        api.MapPatch("/operational/{itemId:int}", async (int itemId, UpdateOperationalReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            var item = await db.OperationalItems.FindAsync(itemId);
            if (item is null) return Results.NotFound();
            if (!string.IsNullOrWhiteSpace(req.Status) && Statuses.Contains(req.Status)) item.Status = req.Status!;
            if (!string.IsNullOrWhiteSpace(req.Severity) && Severities.Contains(req.Severity)) item.Severity = req.Severity!;
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Operational", "Updated operational item", $"{item.Ref} · {item.Status}/{item.Severity}"));
            await db.SaveChangesAsync();
            var name = item.ProjectId is null ? null : await db.Projects.Where(p => p.Id == item.ProjectId).Select(p => p.Name).FirstOrDefaultAsync();
            return Results.Ok(ToDto(item, name));
        });

        api.MapDelete("/operational/{itemId:int}", async (int itemId, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            var item = await db.OperationalItems.FindAsync(itemId);
            if (item is null) return Results.NotFound();
            db.OperationalItems.Remove(item);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Operational", "Removed operational item", $"{item.Ref} · {item.Title}"));
            await db.SaveChangesAsync();
            return Results.NoContent();
        });
    }
}
