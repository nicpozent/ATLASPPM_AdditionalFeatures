using Microsoft.EntityFrameworkCore;

namespace Atlas.Api.Governance;

public record CreateRequirementReq(string Title, string? Type, string? Priority, string? Status,
    string? Epic, string? Story, string? Test, string? TestStatus, string? Release, string? Description);
public record UpdateRequirementReq(string? Title, string? Type, string? Priority, string? Status,
    string? Epic, string? Story, string? Test, string? TestStatus, string? Release, string? Description);
public record CreateChangeReq(string Title, string? ReqCode, string? Impact, string? Sdp);
public record UpdateChangeReq(string? Title, string? ReqCode, string? Impact, string? Sdp, string? Status);

// ============================================================================
//  Requirements & traceability — requirement → epic/story → test → release,
//  plus scope change requests. Requirements/CRs are project delivery work:
//  editing requires Edit on "Projects & tasks" (cap-projects).
// ============================================================================
public static class Requirements
{
    static readonly string[] Types = { "Functional", "Non-functional", "Compliance" };
    static readonly string[] Priorities = { "Critical", "High", "Medium", "Low" };
    static readonly string[] Statuses = { "Draft", "In review", "Approved",
        "Replaced", "Archived", "Retired (Requester)", "Retired (PM)", "Retired (Team)" };
    static readonly string[] TestStatuses = { "Not run", "In test", "Passed", "Failed" };
    static readonly string[] Impacts = { "Low", "Medium", "High" };
    static readonly string[] CrStatuses = { "Pending", "Approved", "Rejected" };

    public static void MapRequirementEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/projects/{id}/requirements", async (string id, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (!await db.Projects.AnyAsync(p => p.Id == id)) return Results.NotFound();
            var reqs = await db.Requirements.Where(r => r.ProjectId == id).Include(r => r.Attachments).OrderBy(r => r.Ord).ToListAsync();
            var crs = await db.ChangeRequests.Where(c => c.ProjectId == id).OrderByDescending(c => c.Ord).ToListAsync();
            var canEdit = await Permissions.Allows(http, db, cfg, "cap-projects", "E");
            var total = reqs.Count;
            var stats = new ReqStatsDto(total, reqs.Count(r => r.Status == "Approved"),
                total == 0 ? 0 : (int)Math.Round(100.0 * reqs.Count(r => !string.IsNullOrEmpty(r.Test) && r.Test != "—") / total),
                reqs.Count(r => r.Verified));
            return Results.Ok(new RequirementsDto(canEdit, stats,
                reqs.Select(ToReqDto).ToList(), crs.Select(ToCrDto).ToList()));
        });

        api.MapPost("/projects/{id}/requirements", async (string id, CreateRequirementReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            if (!await db.Projects.AnyAsync(p => p.Id == id)) return Results.NotFound();
            if (string.IsNullOrWhiteSpace(req.Title)) return Results.BadRequest(new { error = "Title is required." });
            var ord = (await db.Requirements.Where(r => r.ProjectId == id).Select(r => (int?)r.Ord).MaxAsync() ?? 0) + 1;
            var r = new Requirement
            {
                ProjectId = id, Ord = ord, Code = $"REQ-{ord:00}", Title = req.Title.Trim(),
                Type = Types.Contains(req.Type) ? req.Type! : "Functional",
                Priority = Priorities.Contains(req.Priority) ? req.Priority! : "Medium",
                Status = Statuses.Contains(req.Status) ? req.Status! : "Draft",
                Epic = req.Epic?.Trim() ?? "", Story = req.Story?.Trim() ?? "",
                Test = string.IsNullOrWhiteSpace(req.Test) ? "—" : req.Test!.Trim(),
                TestStatus = TestStatuses.Contains(req.TestStatus) ? req.TestStatus! : "Not run",
                Release = string.IsNullOrWhiteSpace(req.Release) ? "Backlog" : req.Release!.Trim(),
                Description = req.Description?.Trim() ?? "",
            };
            db.Requirements.Add(r);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Requirements", "Created requirement", $"{id} · {r.Code} {r.Title}"));
            await db.SaveChangesAsync();
            return Results.Created($"/api/v1/projects/{id}/requirements/{r.Id}", ToReqDto(r));
        });

        api.MapPatch("/requirements/{reqId:int}", async (int reqId, UpdateRequirementReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            var r = await db.Requirements.Include(x => x.Attachments).FirstOrDefaultAsync(x => x.Id == reqId);
            if (r is null) return Results.NotFound();
            if (req.Title is not null)
            {
                if (string.IsNullOrWhiteSpace(req.Title)) return Results.BadRequest(new { error = "Title is required." });
                r.Title = req.Title.Trim();
            }
            if (req.Type is not null)
            {
                if (!Types.Contains(req.Type)) return Results.BadRequest(new { error = "Unknown type." });
                r.Type = req.Type;
            }
            if (req.Priority is not null)
            {
                if (!Priorities.Contains(req.Priority)) return Results.BadRequest(new { error = "Unknown priority." });
                r.Priority = req.Priority;
            }
            if (req.Status is not null)
            {
                if (!Statuses.Contains(req.Status)) return Results.BadRequest(new { error = "Unknown status." });
                r.Status = req.Status;
            }
            if (req.Epic is not null) r.Epic = req.Epic.Trim();
            if (req.Story is not null) r.Story = req.Story.Trim();
            if (req.Test is not null) r.Test = string.IsNullOrWhiteSpace(req.Test) ? "—" : req.Test.Trim();
            if (req.Release is not null) r.Release = string.IsNullOrWhiteSpace(req.Release) ? "Backlog" : req.Release.Trim();
            if (req.Description is not null) r.Description = req.Description.Trim();
            if (req.TestStatus is not null)
            {
                if (!TestStatuses.Contains(req.TestStatus)) return Results.BadRequest(new { error = "Unknown test status." });
                r.TestStatus = req.TestStatus;
                r.Verified = req.TestStatus == "Passed";
            }
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Requirements", "Updated requirement", $"{r.ProjectId} · {r.Code}"));
            await db.SaveChangesAsync();
            return Results.Ok(ToReqDto(r));
        });

        api.MapDelete("/requirements/{reqId:int}", async (int reqId, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            var r = await db.Requirements.Include(x => x.Attachments).FirstOrDefaultAsync(x => x.Id == reqId);
            if (r is null) return Results.NotFound();
            db.RequirementAttachments.RemoveRange(r.Attachments);
            db.Requirements.Remove(r);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Requirements", "Deleted requirement", $"{r.ProjectId} · {r.Code} {r.Title}"));
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        // Attach a file to a requirement (multipart).
        api.MapPost("/requirements/{reqId:int}/attachments", async (int reqId, HttpContext http, AtlasDbContext db, IConfiguration cfg) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            var r = await db.Requirements.FindAsync(reqId);
            if (r is null) return Results.NotFound();
            if (!http.Request.HasFormContentType) return Results.BadRequest(new { error = "Expected multipart/form-data." });
            var form = await http.Request.ReadFormAsync();
            var file = form.Files.FirstOrDefault();
            if (Hardening.ValidateUpload(file?.FileName, file?.Length ?? 0) is { } reason) return Results.BadRequest(new { error = reason });
            using var ms = new MemoryStream();
            await file!.CopyToAsync(ms);
            var att = new RequirementAttachment
            {
                RequirementId = reqId, FileName = Path.GetFileName(file.FileName),
                ContentType = string.IsNullOrWhiteSpace(file.ContentType) ? "application/octet-stream" : file.ContentType,
                Size = file.Length, UploadedAt = DateTime.UtcNow.ToString("dd MMM yyyy"), Bytes = ms.ToArray(),
            };
            db.RequirementAttachments.Add(att);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Requirements", "Attached file", $"{r.ProjectId} · {r.Code} · {att.FileName}"));
            await db.SaveChangesAsync();
            return Results.Ok(new RequirementAttachmentDto(att.Id, att.FileName, att.Size, att.UploadedAt));
        });

        api.MapDelete("/requirement-attachments/{attId:int}", async (int attId, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            var att = await db.RequirementAttachments.FindAsync(attId);
            if (att is null) return Results.NotFound();
            db.RequirementAttachments.Remove(att);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        api.MapGet("/requirement-attachments/{attId:int}", async (int attId, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-dashboards", "V") is { } deny) return deny;
            var att = await db.RequirementAttachments.FindAsync(attId);
            return att is null ? Results.NotFound() : Results.File(att.Bytes, att.ContentType, att.FileName);
        });

        api.MapPost("/projects/{id}/change-requests", async (string id, CreateChangeReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            if (!await db.Projects.AnyAsync(p => p.Id == id)) return Results.NotFound();
            if (string.IsNullOrWhiteSpace(req.Title)) return Results.BadRequest(new { error = "Title is required." });
            var ord = (await db.ChangeRequests.Where(c => c.ProjectId == id).Select(c => (int?)c.Ord).MaxAsync() ?? 0) + 1;
            var cr = new ChangeRequest
            {
                ProjectId = id, Ord = ord, Code = $"CR-{ord:00}", Title = req.Title.Trim(),
                ReqCode = req.ReqCode?.Trim() ?? "", Impact = Impacts.Contains(req.Impact) ? req.Impact! : "Medium",
                Sdp = req.Sdp?.Trim() ?? "", Status = "Pending",
                RaisedBy = Permissions.ActorName(http, cfg), Date = DateTime.UtcNow.ToString("dd MMM yyyy"),
            };
            db.ChangeRequests.Add(cr);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Requirements", "Raised change request", $"{id} · {cr.Code} {cr.Title}"));
            await db.SaveChangesAsync();
            return Results.Created($"/api/v1/projects/{id}/change-requests/{cr.Id}", ToCrDto(cr));
        });

        api.MapPatch("/change-requests/{crId:int}", async (int crId, UpdateChangeReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            var cr = await db.ChangeRequests.FindAsync(crId);
            if (cr is null) return Results.NotFound();
            if (req.Title is not null)
            {
                if (string.IsNullOrWhiteSpace(req.Title)) return Results.BadRequest(new { error = "Title is required." });
                cr.Title = req.Title.Trim();
            }
            if (req.ReqCode is not null) cr.ReqCode = req.ReqCode.Trim();
            if (req.Impact is not null)
            {
                if (!Impacts.Contains(req.Impact)) return Results.BadRequest(new { error = "Unknown impact." });
                cr.Impact = req.Impact;
            }
            if (req.Sdp is not null) cr.Sdp = req.Sdp.Trim();
            if (req.Status is not null)
            {
                if (!CrStatuses.Contains(req.Status)) return Results.BadRequest(new { error = "Unknown status." });
                cr.Status = req.Status;
            }
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Requirements", "Updated change request", $"{cr.ProjectId} · {cr.Code} → {cr.Status}"));
            await db.SaveChangesAsync();
            return Results.Ok(ToCrDto(cr));
        });

        api.MapDelete("/change-requests/{crId:int}", async (int crId, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            var cr = await db.ChangeRequests.FindAsync(crId);
            if (cr is null) return Results.NotFound();
            db.ChangeRequests.Remove(cr);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Requirements", "Deleted change request", $"{cr.ProjectId} · {cr.Code}"));
            await db.SaveChangesAsync();
            return Results.NoContent();
        });
    }

    static RequirementDto ToReqDto(Requirement r) =>
        new(r.Id, r.Code, r.Title, r.Type, r.Priority, r.Status, r.Epic, r.Story, r.Test, r.TestStatus, r.Release, r.Verified,
            r.Description, r.Attachments.OrderBy(a => a.Id)
                .Select(a => new RequirementAttachmentDto(a.Id, a.FileName, a.Size, a.UploadedAt)).ToList());
    static ChangeRequestDto ToCrDto(ChangeRequest c) =>
        new(c.Id, c.Code, c.Title, c.ReqCode, c.Impact, c.Sdp, c.Status, c.RaisedBy, c.Date);
}
