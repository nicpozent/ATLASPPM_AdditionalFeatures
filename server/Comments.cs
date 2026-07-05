using Microsoft.EntityFrameworkCore;

namespace Atlas.Api;

public record CreateCommentReq(string Body);
public record CommentDto(int Id, string Author, string Initials, string Body, string At);

// ============================================================================
//  Project comments — the collaboration thread on a project. Reading is open to
//  anyone who can see the project; posting requires Edit on "Comments &
//  artifacts" (cap-artifacts). Author/initials are captured from the caller.
// ============================================================================
public static class Comments
{
    public static void MapCommentEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/projects/{id}/comments", async (string id, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (!await db.Projects.AnyAsync(p => p.Id == id)) return Results.NotFound();
            var items = await db.ProjectComments.Where(c => c.ProjectId == id).OrderBy(c => c.Id)
                .Select(c => new CommentDto(c.Id, c.Author, c.Initials, c.Body, c.At.ToString("o"))).ToListAsync();
            var canPost = await Permissions.Allows(http, db, cfg, "cap-artifacts", "E");
            return Results.Ok(new { canPost, comments = items });
        });

        api.MapPost("/projects/{id}/comments", async (string id, CreateCommentReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-artifacts", "E") is { } denied) return denied;
            if (!await db.Projects.AnyAsync(p => p.Id == id)) return Results.NotFound();
            if (string.IsNullOrWhiteSpace(req.Body)) return Results.BadRequest(new { error = "Comment can't be empty." });
            var author = Permissions.ActorName(http, cfg);
            var c = new ProjectComment
            {
                ProjectId = id, Author = author, Initials = Initials(author),
                Body = req.Body.Trim(), At = DateTime.UtcNow,
            };
            db.ProjectComments.Add(c);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Projects", "Posted comment", id));
            await db.SaveChangesAsync();
            return Results.Created($"/api/v1/projects/{id}/comments/{c.Id}",
                new CommentDto(c.Id, c.Author, c.Initials, c.Body, c.At.ToString("o")));
        });
    }

    static string Initials(string name)
    {
        var parts = name.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length == 0) return "?";
        return parts.Length == 1
            ? parts[0][..Math.Min(2, parts[0].Length)].ToUpperInvariant()
            : (parts[0][0].ToString() + parts[^1][0]).ToUpperInvariant();
    }
}
