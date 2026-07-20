using Microsoft.EntityFrameworkCore;

namespace Atlas.Api.Portfolio;

public record CreateNewsBlockReq(string Kind);
public record UpdateNewsBlockReq(string? Title, string? Body, string? Metric, string? Label,
    string? Tone, string? Who, string? Caption, string? Date, string? Meta);
public record NewsConfigReq(string? Theme, string? Layout);

// ============================================================================
//  Weekly Updates — the PMO-curated news wall. Blocks (announcements, highlight
//  metrics, shout-outs, images, milestones, docs) are persisted; the wall's
//  theme & layout live in the Settings store. Editing requires Edit on
//  "Projects & tasks" (cosmetically the "PMO editor"); reading is open.
// ============================================================================
public static class News
{
    static readonly string[] Kinds = { "headline", "highlight", "shoutout", "image", "milestone", "doc" };

    // Default content per kind, mirroring the prototype's makeBlock().
    static NewsBlock Defaults(string kind) => kind switch
    {
        "headline" => new() { Kind = kind, Title = "New announcement", Body = "Write your update here…" },
        "highlight" => new() { Kind = kind, Metric = "00", Label = "Metric label", Tone = "good" },
        "shoutout" => new() { Kind = kind, Who = "Team", Body = "Shout-out message…" },
        "image" => new() { Kind = kind, Caption = "Image caption" },
        "milestone" => new() { Kind = kind, Title = "Milestone", Date = "TBD", Body = "Details…" },
        _ => new() { Kind = "doc", Title = "Document.pdf", Meta = "Uploaded file" },
    };

    static NewsBlockDto ToDto(NewsBlock b) =>
        new(b.Id, b.Kind, b.Title, b.Body, b.Metric, b.Label, b.Tone, b.Who, b.Caption, b.Date, b.Meta);

    public static void MapNewsEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/news", async (AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            var theme = (await db.Settings.FindAsync("news.theme"))?.Value ?? "aurora";
            var layout = (await db.Settings.FindAsync("news.layout"))?.Value ?? "masonry";
            var blocks = await db.NewsBlocks.OrderBy(b => b.Ord).ThenBy(b => b.Id).ToListAsync();
            var canEdit = await Permissions.Allows(http, db, cfg, "cap-projects", "E");
            return Results.Ok(new NewsWallDto(canEdit, theme, layout, blocks.Select(ToDto).ToList()));
        });

        api.MapPost("/news/blocks", async (CreateNewsBlockReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            if (!Kinds.Contains(req.Kind)) return Results.BadRequest(new { error = "Unknown block kind." });
            var block = Defaults(req.Kind);
            block.Ord = (await db.NewsBlocks.Select(b => (int?)b.Ord).MaxAsync() ?? 0) + 1;
            db.NewsBlocks.Add(block);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "News", "Added block", req.Kind));
            await db.SaveChangesAsync();
            return Results.Created($"/api/v1/news/blocks/{block.Id}", ToDto(block));
        });

        api.MapPatch("/news/blocks/{id:int}", async (int id, UpdateNewsBlockReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            var b = await db.NewsBlocks.FindAsync(id);
            if (b is null) return Results.NotFound();
            if (req.Title is not null) b.Title = req.Title;
            if (req.Body is not null) b.Body = req.Body;
            if (req.Metric is not null) b.Metric = req.Metric;
            if (req.Label is not null) b.Label = req.Label;
            if (req.Tone is not null) b.Tone = req.Tone;
            if (req.Who is not null) b.Who = req.Who;
            if (req.Caption is not null) b.Caption = req.Caption;
            if (req.Date is not null) b.Date = req.Date;
            if (req.Meta is not null) b.Meta = req.Meta;
            await db.SaveChangesAsync();
            return Results.Ok(ToDto(b));
        });

        api.MapDelete("/news/blocks/{id:int}", async (int id, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            var b = await db.NewsBlocks.FindAsync(id);
            if (b is null) return Results.NotFound();
            db.NewsBlocks.Remove(b);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "News", "Removed block", b.Kind));
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        // Theme / layout — stored in the settings store.
        api.MapPatch("/news/config", async (NewsConfigReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            async Task Set(string key, string? val)
            {
                if (val is null) return;
                var s = await db.Settings.FindAsync(key);
                if (s is null) db.Settings.Add(new Setting { Key = key, Value = val });
                else s.Value = val;
            }
            await Set("news.theme", req.Theme);
            await Set("news.layout", req.Layout);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });
    }
}
