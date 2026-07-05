using Microsoft.EntityFrameworkCore;

namespace Atlas.Api;

public record CreateArtifactReq(string Name, string? Type, string? Owner, string? Status);
public record UpdateArtifactReq(string? Name, string? Type, string? Owner, string? Status);

// ============================================================================
//  Artifacts — a per-project document register where each artifact carries file
//  versions (stored as bytea, like demand attachments). Managing artifacts and
//  uploading versions requires Edit on "Comments & artifacts" (cap-artifacts).
// ============================================================================
public static class Artifacts
{
    static readonly string[] Types = { "Governance", "Waterfall", "Agile", "Design", "Test", "Other" };
    static readonly string[] Statuses = { "Draft", "In review", "Approved", "Living" };

    public static void MapArtifactEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/projects/{id}/artifacts", async (string id, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (!await db.Projects.AnyAsync(p => p.Id == id)) return Results.NotFound();
            var artifacts = await db.Artifacts.Where(a => a.ProjectId == id).Include(a => a.Versions).OrderBy(a => a.Ord).ToListAsync();
            var canEdit = await Permissions.Allows(http, db, cfg, "cap-artifacts", "E");
            return Results.Ok(new ArtifactsDto(canEdit, artifacts.Select(ToDto).ToList()));
        });

        api.MapPost("/projects/{id}/artifacts", async (string id, CreateArtifactReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-artifacts", "E") is { } denied) return denied;
            if (!await db.Projects.AnyAsync(p => p.Id == id)) return Results.NotFound();
            if (string.IsNullOrWhiteSpace(req.Name)) return Results.BadRequest(new { error = "Name is required." });
            var ord = (await db.Artifacts.Where(a => a.ProjectId == id).Select(a => (int?)a.Ord).MaxAsync() ?? 0) + 1;
            var art = new Artifact
            {
                ProjectId = id, Ord = ord, Name = req.Name.Trim(),
                Type = Types.Contains(req.Type) ? req.Type! : "Governance",
                Owner = string.IsNullOrWhiteSpace(req.Owner) ? "—" : req.Owner!.Trim(),
                Status = Statuses.Contains(req.Status) ? req.Status! : "Draft",
            };
            db.Artifacts.Add(art);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Artifacts", "Created artifact", $"{id} · {art.Name}"));
            await db.SaveChangesAsync();
            return Results.Created($"/api/v1/artifacts/{art.Id}", ToDto(art));
        });

        // Update an artifact's status (or name/type/owner) after creation — this
        // is what lets a document move Draft → In review → Approved → Living.
        api.MapPatch("/artifacts/{artId:int}", async (int artId, UpdateArtifactReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-artifacts", "E") is { } denied) return denied;
            var art = await db.Artifacts.Include(a => a.Versions).FirstOrDefaultAsync(a => a.Id == artId);
            if (art is null) return Results.NotFound();
            if (req.Status is not null)
            {
                if (!Statuses.Contains(req.Status)) return Results.BadRequest(new { error = $"Status must be one of: {string.Join(", ", Statuses)}." });
                art.Status = req.Status;
            }
            if (!string.IsNullOrWhiteSpace(req.Name)) art.Name = req.Name.Trim();
            if (req.Type is not null && Types.Contains(req.Type)) art.Type = req.Type;
            if (req.Owner is not null) art.Owner = string.IsNullOrWhiteSpace(req.Owner) ? "—" : req.Owner.Trim();
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Artifacts", "Updated artifact", $"{art.ProjectId} · {art.Name} → {art.Status}"));
            await db.SaveChangesAsync();
            return Results.Ok(ToDto(art));
        });

        // Upload a new file version (multipart). Version number = current count + 1.
        api.MapPost("/artifacts/{artId:int}/versions", async (int artId, HttpContext http, AtlasDbContext db, IConfiguration cfg) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-artifacts", "E") is { } denied) return denied;
            var art = await db.Artifacts.Include(a => a.Versions).FirstOrDefaultAsync(a => a.Id == artId);
            if (art is null) return Results.NotFound();
            if (!http.Request.HasFormContentType) return Results.BadRequest(new { error = "Expected multipart/form-data." });
            var form = await http.Request.ReadFormAsync();
            var file = form.Files.FirstOrDefault();
            if (Hardening.ValidateUpload(file?.FileName, file?.Length ?? 0) is { } reason) return Results.BadRequest(new { error = reason });
            using var ms = new MemoryStream();
            await file!.CopyToAsync(ms);
            var v = (art.Versions.Count == 0 ? 0 : art.Versions.Max(x => x.Version)) + 1;
            var ver = new ArtifactVersion
            {
                ArtifactId = artId, Version = v, FileName = Path.GetFileName(file.FileName),
                ContentType = string.IsNullOrWhiteSpace(file.ContentType) ? "application/octet-stream" : file.ContentType,
                Size = file.Length, UploadedAt = DateTime.UtcNow.ToString("dd MMM yyyy"), Bytes = ms.ToArray(),
            };
            db.ArtifactVersions.Add(ver);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Artifacts", $"Uploaded v{v}", $"{art.ProjectId} · {art.Name}"));
            await db.SaveChangesAsync();
            return Results.Ok(new ArtifactVersionDto(ver.Id, ver.Version, ver.FileName, ver.Size, ver.UploadedAt));
        });

        api.MapGet("/artifact-versions/{verId:int}", async (int verId, AtlasDbContext db) =>
        {
            var v = await db.ArtifactVersions.FindAsync(verId);
            return v is null ? Results.NotFound() : Results.File(v.Bytes, v.ContentType, v.FileName);
        });
    }

    static ArtifactDto ToDto(Artifact a) => new(
        a.Id, a.Name, a.Type, a.Owner, a.Status,
        a.Versions.OrderByDescending(v => v.Version)
            .Select(v => new ArtifactVersionDto(v.Id, v.Version, v.FileName, v.Size, v.UploadedAt)).ToList());
}
