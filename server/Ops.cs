using Microsoft.EntityFrameworkCore;

namespace Atlas.Api.Operations;

public record CreateOpsServiceReq(string Name, string? Category, string? Dept, string? Owner, string? Description);
public record UpdateOpsServiceReq(string? Name, string? Category, string? Dept, string? Owner, string? Status, string? Description);
public record CreateOpsItemReq(string Title, string? Description, string? Type, string? Priority, string? Status,
    string? Assignee, int? Alloc, string? ImpactProjectId, string? ImpactNote, string? StartDate, string? EndDate);
public record UpdateOpsItemReq(string? Title, string? Description, string? Type, string? Priority, string? Status,
    string? Assignee, int? Alloc, string? ImpactProjectId, string? ImpactNote, string? StartDate, string? EndDate);
public record LinkOpsTaskReq(int TaskId);
public record BulkDeleteOpsItemsReq(List<int>? Ids);

// ============================================================================
//  Ops module — run-the-business work, a distinct TYPE from project delivery.
//  Standing operational services (support, maintenance, monitoring,
//  infrastructure) hold work items; each item carries a per-assignee allocation
//  that rolls up into that person's Ops% on Resources, and may be tagged as
//  impacting a specific project's outcome (ops load pulling capacity off
//  delivery). Editing is gated on the dedicated "Operational work" capability
//  (cap-ops); reading is open and returns a CanEdit flag for affordances.
// ============================================================================
public static class Ops
{
    static readonly string[] Categories = { "Support", "Maintenance", "Monitoring", "Infrastructure", "Incident response", "Other" };
    static readonly string[] ServiceStatuses = { "Active", "Paused", "Retired" };
    static readonly string[] ItemTypes = { "Incident", "Request", "Maintenance", "Monitoring", "Change", "Epic", "Other" };
    static readonly string[] Priorities = { "Critical", "High", "Medium", "Low" };
    static readonly string[] ItemStatuses = { "Open", "In progress", "Blocked", "Done" };

    // A work item still consuming capacity (anything not finished).
    public static bool IsActive(OpsItem i) => i.Status != "Done";

    // Ops allocation per person from active ops items — the source for Resources'
    // Ops%. Time-phased: an item only counts if its date window is live on `asOf`
    // (default today); items with no dates are always live. Keyed case-insensitively.
    public static async Task<Dictionary<string, int>> AllocByPersonAsync(AtlasDbContext db, DateOnly? asOf = null)
    {
        var on = asOf ?? DateOnly.FromDateTime(DateTime.UtcNow);
        var items = await db.OpsItems.Where(i => i.Status != "Done" && i.Assignee != "" && i.Alloc > 0).ToListAsync();
        var map = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        foreach (var i in items)
        {
            if (!AllocMath.ActiveOn(i.StartDate, i.EndDate, on)) continue;
            var name = i.Assignee.Trim();
            if (name.Length == 0 || name.Equals("Unassigned", StringComparison.OrdinalIgnoreCase)) continue;
            map[name] = (map.TryGetValue(name, out var v) ? v : 0) + i.Alloc;
        }
        return map;
    }

    public static void MapOpsEndpoints(this RouteGroupBuilder api)
    {
        // The Ops board: every service with its work items, plus a portfolio summary.
        api.MapGet("/ops", async (AtlasDbContext db, IConfiguration cfg, HttpContext http, bool? includeArchived) =>
        {
            var canEdit = await Permissions.Allows(http, db, cfg, "cap-ops", "E");
            var services = await db.OpsServices
                .Where(s => includeArchived == true || !s.Archived)
                .OrderBy(s => s.Ord).ThenBy(s => s.Id).ToListAsync();
            var items = await db.OpsItems.OrderBy(i => i.Ord).ThenBy(i => i.Id).ToListAsync();
            var projNames = await db.Projects.ToDictionaryAsync(p => p.Id, p => p.Name);
            // Comment / attachment counts (badges on each row; full thread fetched
            // lazily via the detail endpoint when an item is opened).
            var itemIds = items.Select(i => i.Id).ToList();
            var comCounts = (await db.OpsItemComments.Where(c => itemIds.Contains(c.OpsItemId))
                    .GroupBy(c => c.OpsItemId).Select(g => new { g.Key, N = g.Count() }).ToListAsync())
                .ToDictionary(x => x.Key, x => x.N);
            var attCounts = (await db.OpsItemAttachments.Where(a => itemIds.Contains(a.OpsItemId))
                    .GroupBy(a => a.OpsItemId).Select(g => new { g.Key, N = g.Count() }).ToListAsync())
                .ToDictionary(x => x.Key, x => x.N);

            // Linked project tasks per service (traceability rows alongside items).
            var links = await db.OpsTaskLinks.ToListAsync();
            var linkedTaskIds = links.Select(l => l.TaskId).Distinct().ToList();
            var tasks = linkedTaskIds.Count == 0 ? new List<ProjectTask>()
                : await db.ProjectTasks.Where(t => linkedTaskIds.Contains(t.Id)).ToListAsync();
            var taskById = tasks.ToDictionary(t => t.Id);
            var linksByService = links.GroupBy(l => l.ServiceId).ToDictionary(g => g.Key, g => g.ToList());

            var byService = items.GroupBy(i => i.ServiceId).ToDictionary(g => g.Key, g => g.ToList());
            var svcDtos = services.Select(s =>
            {
                var its = byService.TryGetValue(s.Id, out var l) ? l : new List<OpsItem>();
                var active = its.Where(IsActive).ToList();
                var linked = (linksByService.TryGetValue(s.Id, out var ls) ? ls : new List<OpsTaskLink>())
                    .Where(x => taskById.ContainsKey(x.TaskId))
                    .Select(x => { var t = taskById[x.TaskId]; return new OpsLinkedTaskDto(t.Id, t.Code, t.Name, t.Status, t.Assignee, t.ProjectId, projNames.GetValueOrDefault(t.ProjectId, t.ProjectId)); })
                    .ToList();
                return new OpsServiceDto(s.Id, s.Ref, s.Name, s.Category, s.Dept, s.Owner, s.Status, s.Description,
                    its.Select(i => ToItemDto(i, s.Name, projNames, comCounts.GetValueOrDefault(i.Id), attCounts.GetValueOrDefault(i.Id))).ToList(),
                    active.Count, active.Sum(i => i.Alloc), s.Archived, s.JiraProjectKey, linked);
            }).ToList();

            var allActive = items.Where(IsActive).ToList();
            var summary = new OpsSummaryDto(
                services.Count,
                allActive.Count(i => i.Status is "Open" or "In progress"),
                allActive.Count(i => i.Status == "Blocked"),
                allActive.Where(i => !string.IsNullOrEmpty(i.ImpactProjectId)).Select(i => i.ImpactProjectId).Distinct().Count(),
                allActive.Where(i => i.Assignee != "" && !i.Assignee.Equals("Unassigned", StringComparison.OrdinalIgnoreCase))
                    .Select(i => i.Assignee).Distinct(StringComparer.OrdinalIgnoreCase).Count());
            return Results.Ok(new OpsBoardDto(canEdit, svcDtos, summary));
        });

        // ---- Services -----------------------------------------------------
        api.MapPost("/ops/services", async (CreateOpsServiceReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-ops", "E") is { } denied) return denied;
            if (string.IsNullOrWhiteSpace(req.Name)) return Results.BadRequest(new { error = "A service name is required." });
            var maxNum = (await db.OpsServices.Select(s => s.Ref).ToListAsync())
                .Select(r => int.TryParse(r.Split('-').Last(), out var n) ? n : 0).DefaultIfEmpty(0).Max();
            var ord = (await db.OpsServices.Select(s => (int?)s.Ord).MaxAsync() ?? 0) + 1;
            var svc = new OpsService
            {
                Ref = $"OPS-{maxNum + 1}", Name = req.Name.Trim(), Ord = ord,
                Category = Categories.Contains(req.Category) ? req.Category! : "Support",
                Dept = string.IsNullOrWhiteSpace(req.Dept) ? "Unassigned" : req.Dept!.Trim(),
                Owner = string.IsNullOrWhiteSpace(req.Owner) ? "" : req.Owner!.Trim(),
                Description = req.Description?.Trim() ?? "", Status = "Active",
            };
            db.OpsServices.Add(svc);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Ops", "Created ops service", $"{svc.Ref} {svc.Name}"));
            await db.SaveChangesAsync();
            return Results.Created($"/api/v1/ops/services/{svc.Id}",
                new OpsServiceDto(svc.Id, svc.Ref, svc.Name, svc.Category, svc.Dept, svc.Owner, svc.Status, svc.Description, new(), 0, 0, svc.Archived, svc.JiraProjectKey));
        });

        api.MapPatch("/ops/services/{id:int}", async (int id, UpdateOpsServiceReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-ops", "E") is { } denied) return denied;
            var svc = await db.OpsServices.FindAsync(id);
            if (svc is null) return Results.NotFound();
            if (req.Name is not null)
            {
                if (string.IsNullOrWhiteSpace(req.Name)) return Results.BadRequest(new { error = "A service name is required." });
                svc.Name = req.Name.Trim();
            }
            if (req.Category is not null && Categories.Contains(req.Category)) svc.Category = req.Category;
            if (req.Dept is not null) svc.Dept = string.IsNullOrWhiteSpace(req.Dept) ? "Unassigned" : req.Dept.Trim();
            if (req.Owner is not null) svc.Owner = req.Owner.Trim();
            if (req.Status is not null)
            {
                if (!ServiceStatuses.Contains(req.Status)) return Results.BadRequest(new { error = "Unknown status." });
                svc.Status = req.Status;
            }
            if (req.Description is not null) svc.Description = req.Description.Trim();
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Ops", "Updated ops service", $"{svc.Ref} {svc.Name}"));
            await db.SaveChangesAsync();
            return Results.Ok(new { ok = true });
        });

        api.MapDelete("/ops/services/{id:int}", async (int id, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-ops", "E") is { } denied) return denied;
            var svc = await db.OpsServices.FindAsync(id);
            if (svc is null) return Results.NotFound();
            db.OpsItems.RemoveRange(db.OpsItems.Where(i => i.ServiceId == id));
            db.OpsServices.Remove(svc);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Ops", "Removed ops service", $"{svc.Ref} {svc.Name}"));
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        // Archive / unarchive a service — hides it from the board without deleting
        // its history (items are kept). Toggled by `on`.
        api.MapPost("/ops/services/{id:int}/archive", async (int id, bool? on, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-ops", "E") is { } denied) return denied;
            var svc = await db.OpsServices.FindAsync(id);
            if (svc is null) return Results.NotFound();
            svc.Archived = on ?? true;
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Ops", svc.Archived ? "Archived ops service" : "Unarchived ops service", $"{svc.Ref} {svc.Name}"));
            await db.SaveChangesAsync();
            return Results.Ok(new { ok = true, archived = svc.Archived });
        });

        // ---- Work items ---------------------------------------------------
        api.MapPost("/ops/services/{id:int}/items", async (int id, CreateOpsItemReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-ops", "E") is { } denied) return denied;
            var svc = await db.OpsServices.FindAsync(id);
            if (svc is null) return Results.NotFound();
            if (string.IsNullOrWhiteSpace(req.Title)) return Results.BadRequest(new { error = "A title is required." });
            var impact = await ResolveImpactAsync(db, req.ImpactProjectId);
            var ord = (await db.OpsItems.Where(i => i.ServiceId == id).Select(i => (int?)i.Ord).MaxAsync() ?? 0) + 1;
            var item = new OpsItem
            {
                ServiceId = id, Title = req.Title.Trim(), Description = req.Description?.Trim() ?? "", Ord = ord,
                Type = ItemTypes.Contains(req.Type) ? req.Type! : "Maintenance",
                Priority = Priorities.Contains(req.Priority) ? req.Priority! : "Medium",
                Status = ItemStatuses.Contains(req.Status) ? req.Status! : "Open",
                Assignee = string.IsNullOrWhiteSpace(req.Assignee) ? "" : req.Assignee!.Trim(),
                Alloc = Math.Clamp(req.Alloc ?? 0, 0, 100),
                ImpactProjectId = impact, ImpactNote = req.ImpactNote?.Trim() ?? "",
                StartDate = NormDate(req.StartDate), EndDate = NormDate(req.EndDate),
                CreatedAt = DateTime.UtcNow.ToString("dd MMM yyyy"),
            };
            db.OpsItems.Add(item);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Ops", "Created ops work item", $"{svc.Ref} · {item.Title}"));
            await db.SaveChangesAsync();
            var projNames = await db.Projects.ToDictionaryAsync(p => p.Id, p => p.Name);
            return Results.Created($"/api/v1/ops/items/{item.Id}", ToItemDto(item, svc.Name, projNames));
        });

        api.MapPatch("/ops/items/{id:int}", async (int id, UpdateOpsItemReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-ops", "E") is { } denied) return denied;
            var item = await db.OpsItems.FindAsync(id);
            if (item is null) return Results.NotFound();
            if (req.Title is not null)
            {
                if (string.IsNullOrWhiteSpace(req.Title)) return Results.BadRequest(new { error = "A title is required." });
                item.Title = req.Title.Trim();
            }
            if (req.Description is not null) item.Description = req.Description.Trim();
            if (req.Type is not null && ItemTypes.Contains(req.Type)) item.Type = req.Type;
            if (req.Priority is not null && Priorities.Contains(req.Priority)) item.Priority = req.Priority;
            if (req.Status is not null)
            {
                if (!ItemStatuses.Contains(req.Status)) return Results.BadRequest(new { error = "Unknown status." });
                item.Status = req.Status;
            }
            if (req.Assignee is not null) item.Assignee = req.Assignee.Trim();
            if (req.Alloc is not null) item.Alloc = Math.Clamp(req.Alloc.Value, 0, 100);
            if (req.ImpactProjectId is not null) item.ImpactProjectId = await ResolveImpactAsync(db, req.ImpactProjectId);
            if (req.ImpactNote is not null) item.ImpactNote = req.ImpactNote.Trim();
            if (req.StartDate is not null) item.StartDate = NormDate(req.StartDate);
            if (req.EndDate is not null) item.EndDate = NormDate(req.EndDate);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Ops", "Updated ops work item", $"{item.Title} · {item.Status}"));
            await db.SaveChangesAsync();
            var svc = await db.OpsServices.FindAsync(item.ServiceId);
            var projNames = await db.Projects.ToDictionaryAsync(p => p.Id, p => p.Name);
            return Results.Ok(ToItemDto(item, svc?.Name ?? "", projNames));
        });

        api.MapDelete("/ops/items/{id:int}", async (int id, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-ops", "E") is { } denied) return denied;
            var item = await db.OpsItems.FindAsync(id);
            if (item is null) return Results.NotFound();
            db.OpsItems.Remove(item);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Ops", "Removed ops work item", item.Title));
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        // Bulk-delete work items in one call (multi-select on the board). Skips
        // ids that don't exist; reports how many were removed.
        api.MapPost("/ops/items/bulk-delete", async (BulkDeleteOpsItemsReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-ops", "E") is { } denied) return denied;
            var ids = (req.Ids ?? new()).Distinct().ToList();
            if (ids.Count == 0) return Results.Ok(new { deleted = 0 });
            var items = await db.OpsItems.Where(i => ids.Contains(i.Id)).ToListAsync();
            if (items.Count > 0)
            {
                db.OpsItems.RemoveRange(items);
                db.AuditEvents.Add(Permissions.Audit(http, cfg, "Ops", "Bulk-removed ops work items", $"{items.Count} item{(items.Count == 1 ? "" : "s")}"));
                await db.SaveChangesAsync();
            }
            return Results.Ok(new { deleted = items.Count });
        });

        // Full work-item detail incl. Jira comment thread + attachment metadata.
        api.MapGet("/ops/items/{id:int}", async (int id, AtlasDbContext db) =>
        {
            var item = await db.OpsItems.FindAsync(id);
            if (item is null) return Results.NotFound();
            var svc = await db.OpsServices.FindAsync(item.ServiceId);
            var projNames = await db.Projects.ToDictionaryAsync(p => p.Id, p => p.Name);
            var comments = await db.OpsItemComments.Where(c => c.OpsItemId == id).OrderBy(c => c.At).ThenBy(c => c.Id)
                .Select(c => new TaskCommentDto(c.Id, c.Author, c.Initials, c.Body, c.At.ToString("o"), c.JiraId != "")).ToListAsync();
            var attachments = await db.OpsItemAttachments.Where(a => a.OpsItemId == id).OrderBy(a => a.Id)
                .Select(a => new TaskAttachmentDto(a.Id, a.FileName, a.ContentType, a.Size, a.Author, a.CreatedAt)).ToListAsync();
            var dto = ToItemDto(item, svc?.Name ?? "", projNames, comments.Count, attachments.Count);
            return Results.Ok(new OpsItemDetailDto(dto, comments, attachments));
        });

        // Download an Ops work-item attachment (bytes stored in the DB).
        // Internal roles only (cap-dashboards) — guards the sequential id.
        api.MapGet("/ops/item-attachments/{attId:int}", async (int attId, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-dashboards", "V") is { } deny) return deny;
            var a = await db.OpsItemAttachments.FindAsync(attId);
            return a is null ? Results.NotFound() : Results.File(a.Bytes, a.ContentType, a.FileName);
        });

        // ---- Linked project tasks (traceability) --------------------------
        // Link an existing project task to a service so its delivery tasks show
        // alongside manual items. The task's allocation stays with its project.
        api.MapPost("/ops/services/{id:int}/tasks", async (int id, LinkOpsTaskReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-ops", "E") is { } denied) return denied;
            var svc = await db.OpsServices.FindAsync(id);
            if (svc is null) return Results.NotFound();
            var task = await db.ProjectTasks.FindAsync(req.TaskId);
            if (task is null) return Results.BadRequest(new { error = "No such task." });
            if (!await db.OpsTaskLinks.AnyAsync(l => l.ServiceId == id && l.TaskId == req.TaskId))
            {
                db.OpsTaskLinks.Add(new OpsTaskLink { ServiceId = id, TaskId = req.TaskId });
                db.AuditEvents.Add(Permissions.Audit(http, cfg, "Ops", "Linked task to service", $"{svc.Ref} · {task.Code} {task.Name}"));
                await db.SaveChangesAsync();
            }
            return Results.NoContent();
        });

        api.MapDelete("/ops/services/{id:int}/tasks/{taskId:int}", async (int id, int taskId, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-ops", "E") is { } denied) return denied;
            var links = await db.OpsTaskLinks.Where(l => l.ServiceId == id && l.TaskId == taskId).ToListAsync();
            if (links.Count > 0) { db.OpsTaskLinks.RemoveRange(links); await db.SaveChangesAsync(); }
            return Results.NoContent();
        });

        // Ops load impacting one project — shown on Project Detail. Active items
        // tagged to this project, with the total capacity they pull off delivery.
        api.MapGet("/projects/{id}/ops-impact", async (string id, AtlasDbContext db) =>
        {
            if (!await db.Projects.AnyAsync(p => p.Id == id)) return Results.NotFound();
            var items = await db.OpsItems.Where(i => i.ImpactProjectId == id && i.Status != "Done")
                .OrderByDescending(i => i.Alloc).ThenBy(i => i.Id).ToListAsync();
            var svcNames = await db.OpsServices.ToDictionaryAsync(s => s.Id, s => s.Name);
            var rows = items.Select(i => new OpsImpactRowDto(i.Id, i.Title,
                svcNames.TryGetValue(i.ServiceId, out var n) ? n : "", i.Type, i.Priority, i.Status,
                string.IsNullOrEmpty(i.Assignee) ? "Unassigned" : i.Assignee, i.Alloc, i.ImpactNote)).ToList();
            return Results.Ok(new OpsImpactDto(items.Sum(i => i.Alloc), rows));
        });
    }

    // A supplied impact project id is kept only if it names a real project.
    static async Task<string?> ResolveImpactAsync(AtlasDbContext db, string? projectId)
    {
        var id = (projectId ?? "").Trim();
        if (id.Length == 0) return null;
        return await db.Projects.AnyAsync(p => p.Id == id) ? id : null;
    }

    static OpsItemDto ToItemDto(OpsItem i, string serviceName, IReadOnlyDictionary<string, string> projNames,
        int commentCount = 0, int attachmentCount = 0) =>
        new(i.Id, i.ServiceId, serviceName, i.Title, i.Description, i.Type, i.Priority, i.Status,
            string.IsNullOrEmpty(i.Assignee) ? "Unassigned" : i.Assignee, i.Alloc,
            i.ImpactProjectId, i.ImpactProjectId is not null && projNames.TryGetValue(i.ImpactProjectId, out var pn) ? pn : null,
            i.ImpactNote, i.CreatedAt, i.StartDate, i.EndDate,
            i.JiraKey, i.JiraUrl, i.IssueType, i.Reporter, i.StatusName, i.Resolution,
            i.ParentKey, i.EpicKey, i.EpicName, i.Points, i.EstimateHours, i.TimeSpentHours,
            i.TargetDate, i.JiraCreated, i.JiraUpdated,
            i.Labels, i.Components, i.FixVersions, commentCount, attachmentCount);

    // Blank for empty/unparseable; else ISO yyyy-MM-dd.
    static string NormDate(string? s)
    {
        var v = (s ?? "").Trim();
        if (v.Length == 0) return "";
        return DateOnly.TryParse(v, out var d) ? d.ToString("yyyy-MM-dd") : v;
    }
}
