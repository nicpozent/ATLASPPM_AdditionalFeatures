using Microsoft.EntityFrameworkCore;

namespace Atlas.Api;

public record RoadmapMilestoneReq(string Title, string? Date, bool? Done);
public record RoadmapLinkReq(string EntityType, string EntityId);
public record CreateRoadmapItemReq(string Title, string? Description, string? Lane, string? Status,
    string? Theme, string? Owner, string? StartDate, string? EndDate, int? Confidence, int? Effort, int? Value,
    List<RoadmapMilestoneReq>? Milestones, List<RoadmapLinkReq>? Links, List<int>? DependsOn);
public record UpdateRoadmapItemReq(string? Title, string? Description, string? Lane, string? Status,
    string? Theme, string? Owner, string? StartDate, string? EndDate, int? Confidence, int? Effort, int? Value,
    List<RoadmapMilestoneReq>? Milestones, List<RoadmapLinkReq>? Links, List<int>? DependsOn);

// ============================================================================
//  Roadmap — strategic initiatives across the Now / Next / Later horizons that
//  also carry dates so the same items render on a time-based timeline. Each
//  initiative holds milestones, dependencies on other initiatives, and links to
//  portfolio entities (OKRs, projects, programs, products, releases). Editing is
//  gated on the dedicated "Roadmap" capability (cap-roadmap); reading is open
//  and returns a CanEdit flag for affordances. Data-driven — empty by default.
// ============================================================================
public static class Roadmap
{
    static readonly string[] Lanes = { "Now", "Next", "Later" };
    static readonly string[] Statuses = { "Proposed", "Committed", "In progress", "Done", "Cancelled" };
    static readonly string[] LinkTypes = { "okr", "project", "program", "product", "release" };

    public static void MapRoadmapEndpoints(this RouteGroupBuilder api)
    {
        // The whole roadmap: every initiative with its milestones/links/deps,
        // the set of themes in use, and the linkable portfolio entities.
        api.MapGet("/roadmap", async (AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            var canEdit = await Permissions.Allows(http, db, cfg, "cap-roadmap", "E");
            var items = await db.RoadmapItems
                .Include(i => i.Milestones)
                .Include(i => i.Links)
                .OrderBy(i => i.Ord).ThenBy(i => i.Id)
                .ToListAsync();
            var deps = await db.RoadmapDependencies.ToListAsync();

            var dtos = items.Select(i => ToDto(i, deps)).ToList();
            var themes = items.Where(i => !string.IsNullOrWhiteSpace(i.Theme))
                .Select(i => i.Theme).Distinct().OrderBy(t => t).ToList();
            var options = await LinkOptionsAsync(db);
            return Results.Ok(new RoadmapBoardDto(canEdit, dtos, themes, options));
        });

        api.MapPost("/roadmap", async (CreateRoadmapItemReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-roadmap", "E") is { } denied) return denied;
            if (string.IsNullOrWhiteSpace(req.Title)) return Results.BadRequest(new { error = "A title is required." });
            var maxNum = (await db.RoadmapItems.Select(i => i.Ref).ToListAsync())
                .Select(r => int.TryParse(r.Split('-').Last(), out var n) ? n : 0).DefaultIfEmpty(0).Max();
            var ord = (await db.RoadmapItems.Select(i => (int?)i.Ord).MaxAsync() ?? 0) + 1;
            var item = new RoadmapItem
            {
                Ref = $"RM-{maxNum + 1}", Title = req.Title.Trim(), Ord = ord,
                Description = req.Description?.Trim() ?? "",
                Lane = Lanes.Contains(req.Lane) ? req.Lane! : "Now",
                Status = Statuses.Contains(req.Status) ? req.Status! : "Proposed",
                Theme = req.Theme?.Trim() ?? "",
                Owner = req.Owner?.Trim() ?? "",
                StartDate = NormDate(req.StartDate), EndDate = NormDate(req.EndDate),
                Confidence = Math.Clamp(req.Confidence ?? 60, 0, 100),
                Effort = Math.Clamp(req.Effort ?? 3, 1, 5),
                Value = Math.Clamp(req.Value ?? 3, 1, 5),
                CreatedAt = DateTime.UtcNow.ToString("dd MMM yyyy"),
            };
            db.RoadmapItems.Add(item);
            await db.SaveChangesAsync();                      // assigns item.Id
            await ReplaceMilestonesAsync(db, item.Id, req.Milestones);
            await ReplaceLinksAsync(db, item.Id, req.Links);
            await ReplaceDepsAsync(db, item.Id, req.DependsOn);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Roadmap", "Created roadmap item", $"{item.Ref} {item.Title}"));
            await db.SaveChangesAsync();
            return Results.Created($"/api/v1/roadmap/{item.Id}", await ReadDtoAsync(db, item.Id));
        });

        api.MapPatch("/roadmap/{id:int}", async (int id, UpdateRoadmapItemReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-roadmap", "E") is { } denied) return denied;
            var item = await db.RoadmapItems.FindAsync(id);
            if (item is null) return Results.NotFound();
            if (req.Title is not null)
            {
                if (string.IsNullOrWhiteSpace(req.Title)) return Results.BadRequest(new { error = "A title is required." });
                item.Title = req.Title.Trim();
            }
            if (req.Description is not null) item.Description = req.Description.Trim();
            if (req.Lane is not null && Lanes.Contains(req.Lane)) item.Lane = req.Lane;
            if (req.Status is not null)
            {
                if (!Statuses.Contains(req.Status)) return Results.BadRequest(new { error = "Unknown status." });
                item.Status = req.Status;
            }
            if (req.Theme is not null) item.Theme = req.Theme.Trim();
            if (req.Owner is not null) item.Owner = req.Owner.Trim();
            if (req.StartDate is not null) item.StartDate = NormDate(req.StartDate);
            if (req.EndDate is not null) item.EndDate = NormDate(req.EndDate);
            if (req.Confidence is not null) item.Confidence = Math.Clamp(req.Confidence.Value, 0, 100);
            if (req.Effort is not null) item.Effort = Math.Clamp(req.Effort.Value, 1, 5);
            if (req.Value is not null) item.Value = Math.Clamp(req.Value.Value, 1, 5);
            if (req.Milestones is not null) await ReplaceMilestonesAsync(db, id, req.Milestones);
            if (req.Links is not null) await ReplaceLinksAsync(db, id, req.Links);
            if (req.DependsOn is not null) await ReplaceDepsAsync(db, id, req.DependsOn);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Roadmap", "Updated roadmap item", $"{item.Ref} {item.Title}"));
            await db.SaveChangesAsync();
            return Results.Ok(await ReadDtoAsync(db, id));
        });

        api.MapDelete("/roadmap/{id:int}", async (int id, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-roadmap", "E") is { } denied) return denied;
            var item = await db.RoadmapItems.FindAsync(id);
            if (item is null) return Results.NotFound();
            // Milestones & links cascade; drop dependency rows on either side by hand.
            db.RoadmapDependencies.RemoveRange(db.RoadmapDependencies.Where(d => d.ItemId == id || d.DependsOnItemId == id));
            db.RoadmapItems.Remove(item);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Roadmap", "Removed roadmap item", $"{item.Ref} {item.Title}"));
            await db.SaveChangesAsync();
            return Results.NoContent();
        });
    }

    // ---- helpers -----------------------------------------------------------

    // Blank string for an unparseable date; otherwise the ISO yyyy-MM-dd form.
    static string NormDate(string? s)
    {
        var v = (s ?? "").Trim();
        if (v.Length == 0) return "";
        return DateOnly.TryParse(v, out var d) ? d.ToString("yyyy-MM-dd") : v;
    }

    static async Task ReplaceMilestonesAsync(AtlasDbContext db, int itemId, List<RoadmapMilestoneReq>? ms)
    {
        db.RoadmapMilestones.RemoveRange(await db.RoadmapMilestones.Where(m => m.ItemId == itemId).ToListAsync());
        if (ms is null) return;
        var ord = 0;
        foreach (var m in ms)
        {
            if (string.IsNullOrWhiteSpace(m.Title)) continue;
            db.RoadmapMilestones.Add(new RoadmapMilestone
            {
                ItemId = itemId, Title = m.Title.Trim(), Date = NormDate(m.Date), Done = m.Done ?? false, Ord = ord++,
            });
        }
    }

    static async Task ReplaceLinksAsync(AtlasDbContext db, int itemId, List<RoadmapLinkReq>? links)
    {
        db.RoadmapLinks.RemoveRange(await db.RoadmapLinks.Where(l => l.ItemId == itemId).ToListAsync());
        if (links is null) return;
        var opts = await LinkOptionsAsync(db);
        var seen = new HashSet<string>();
        foreach (var l in links)
        {
            var type = (l.EntityType ?? "").Trim().ToLowerInvariant();
            var eid = (l.EntityId ?? "").Trim();
            if (!LinkTypes.Contains(type) || eid.Length == 0) continue;
            var key = $"{type}:{eid}";
            if (!seen.Add(key)) continue;
            var match = opts.FirstOrDefault(o => o.EntityType == type && o.EntityId == eid);
            if (match is null) continue;                      // only link to entities that exist
            db.RoadmapLinks.Add(new RoadmapLink { ItemId = itemId, EntityType = type, EntityId = eid, Label = match.Label });
        }
    }

    static async Task ReplaceDepsAsync(AtlasDbContext db, int itemId, List<int>? dependsOn)
    {
        db.RoadmapDependencies.RemoveRange(await db.RoadmapDependencies.Where(d => d.ItemId == itemId).ToListAsync());
        if (dependsOn is null) return;
        var valid = (await db.RoadmapItems.Select(i => i.Id).ToListAsync()).ToHashSet();
        foreach (var dep in dependsOn.Distinct())
        {
            if (dep == itemId || !valid.Contains(dep)) continue; // no self-deps, no phantoms
            db.RoadmapDependencies.Add(new RoadmapDependency { ItemId = itemId, DependsOnItemId = dep });
        }
    }

    // Every portfolio entity a roadmap item can point at, flattened for a picker.
    static async Task<List<RoadmapLinkOptionDto>> LinkOptionsAsync(AtlasDbContext db)
    {
        var opts = new List<RoadmapLinkOptionDto>();
        opts.AddRange(await db.Objectives.OrderBy(o => o.Title)
            .Select(o => new RoadmapLinkOptionDto("okr", o.Id, o.Title)).ToListAsync());
        opts.AddRange(await db.Projects.OrderBy(p => p.Name)
            .Select(p => new RoadmapLinkOptionDto("project", p.Id, p.Name)).ToListAsync());
        opts.AddRange(await db.Programs.OrderBy(p => p.Name)
            .Select(p => new RoadmapLinkOptionDto("program", p.Id, p.Name)).ToListAsync());
        opts.AddRange(await db.Products.OrderBy(p => p.Name)
            .Select(p => new RoadmapLinkOptionDto("product", p.Id, p.Name)).ToListAsync());
        opts.AddRange(await db.Releases.Where(r => !r.Archived).OrderBy(r => r.Name)
            .Select(r => new RoadmapLinkOptionDto("release", r.Id, r.Name)).ToListAsync());
        return opts;
    }

    static async Task<RoadmapItemDto?> ReadDtoAsync(AtlasDbContext db, int id)
    {
        var item = await db.RoadmapItems.Include(i => i.Milestones).Include(i => i.Links)
            .FirstOrDefaultAsync(i => i.Id == id);
        if (item is null) return null;
        var deps = await db.RoadmapDependencies.Where(d => d.ItemId == id || d.DependsOnItemId == id).ToListAsync();
        return ToDto(item, deps);
    }

    static RoadmapItemDto ToDto(RoadmapItem i, List<RoadmapDependency> allDeps) =>
        new(i.Id, i.Ref, i.Title, i.Description, i.Lane, i.Status, i.Theme, i.Owner,
            i.StartDate, i.EndDate, i.Confidence, i.Effort, i.Value,
            i.Milestones.OrderBy(m => m.Ord).ThenBy(m => m.Id)
                .Select(m => new RoadmapMilestoneDto(m.Id, m.Title, m.Date, m.Done)).ToList(),
            i.Links.OrderBy(l => l.EntityType).ThenBy(l => l.Label)
                .Select(l => new RoadmapLinkDto(l.EntityType, l.EntityId, l.Label)).ToList(),
            allDeps.Where(d => d.ItemId == i.Id).Select(d => d.DependsOnItemId).Distinct().ToList(),
            allDeps.Where(d => d.DependsOnItemId == i.Id).Select(d => d.ItemId).Distinct().ToList());
}
