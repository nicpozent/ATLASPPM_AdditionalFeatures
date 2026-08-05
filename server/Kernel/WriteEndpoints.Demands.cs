using System.Security.Claims;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace Atlas.Api;

// Demands write endpoints — split out of the former single MapAtlasWriteEndpoints god-method (R18 / #104).
// Part of the partial WriteEndpoints class; shared helpers (NextId, Clamp, HealthFor, …) stay in WriteEndpoints.cs.
public static partial class WriteEndpoints
{
    static void MapDemandWrites(RouteGroupBuilder api)
    {
        // ---- Demands -------------------------------------------------------
        api.MapPost("/demands", async (CreateDemandReq req, AtlasDbContext db, ClaimsPrincipal user, IConfiguration cfg, HttpContext http, IHubContext<BoardHub> hub) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-submit-demand", "E") is { } denied) return denied;
            if (string.IsNullOrWhiteSpace(req.Title)) return Results.BadRequest(new { error = "Title is required." });
            var authEnabled = Permissions.AuthEnabled(cfg);
            var criticality = req.Criticality is >= 1 and <= 5 ? req.Criticality.Value : 0;
            // Priority follows criticality when the intake form supplied it, else the explicit priority.
            var priority = criticality > 0
                ? new[] { "Low", "Low", "Medium", "High", "Critical" }[criticality - 1]
                : Clamp(req.Priority, new[] { "High", "Medium", "Critical", "Low" }, "Medium");
            var benefit = req.BenefitValue is >= 1 and <= 5 ? req.BenefitValue.Value : (req.Value ?? 3);
            var d = new Demand
            {
                Id = await NextId(db.Demands.Select(x => x.Id), "DM-", db),
                Title = req.Title.Trim(),
                Dept = string.IsNullOrWhiteSpace(req.Dept) ? "Unassigned" : req.Dept!.Trim(),
                Priority = priority,
                Value = Math.Clamp(benefit, 1, 5),                    // funnel "value" = benefit rank
                Effort = Math.Clamp(req.Effort ?? 3, 1, 5),
                Stage = "draft",
                Requester = "You",
                Mine = true,
                Date = DateTime.UtcNow.ToString("MMM dd"),
                Description = req.Description?.Trim() ?? "",
                Source = req.Source ?? "",
                GeoImpact = req.GeoImpact ?? new(),
                HasDeadline = req.HasDeadline ?? false,
                Deadline = req.Deadline,
                BusinessProblem = req.BusinessProblem?.Trim() ?? "",
                ImprovementExisting = req.ImprovementExisting ?? false,
                Criticality = criticality,
                Risk = req.Risk is >= 1 and <= 5 ? req.Risk.Value : 0,
                ExpectedBenefits = req.ExpectedBenefits?.Trim() ?? "",
                BenefitValue = req.BenefitValue is >= 1 and <= 5 ? req.BenefitValue.Value : 0,
                Stakeholders = req.Stakeholders ?? new(),
                AllStakeholders = req.AllStakeholders ?? false,
                CreatedBy = authEnabled ? Rbac.CallerId(user) : "",
            };
            db.Demands.Add(d);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Demands", "Created demand", d.Id));
            await db.SaveChangesAsync();
            await Notifications.EmitPortfolioAsync(db, cfg, Notifications.Created, $"New demand: {d.Title}", $"{d.Id} · {d.Title} ({d.Dept}) was submitted.", "demand", d.Id, Permissions.CallerKey(http, cfg));
            // Always alert portfolio leadership (PMO, Chief Architect, CTO, CIO, PM Lead).
            await Notifications.EmitToRolesAsync(db, cfg, Notifications.Created, DemandWatchRoles,
                $"New demand: {d.Title}", $"{d.Id} · {d.Title} ({d.Dept}) was submitted.", "demand", d.Id,
                Permissions.CallerRoleKeys(http, cfg));
            await BoardHub.NotifyRoomAsync(hub, DemandRoom);
            return Results.Created($"/api/v1/demands/{d.Id}",
                new DemandDto(d.Id, d.Title, d.Stage, d.Priority, d.Value, d.Effort, d.Requester, d.Dept, d.Date));
        });

        // Full demand incl. intake fields + attachment metadata.
        api.MapGet("/demands/{id}", async (string id, AtlasDbContext db, ClaimsPrincipal user, IConfiguration cfg, HttpContext http) =>
        {
            // Internal roles, or a Stakeholder for a demand they raised (Mine).
            if (await Permissions.DenyRead(http, db, cfg,
                () => db.Demands.AnyAsync(x => x.Id == id && x.Mine)) is { } deny) return deny;
            var d = await db.Demands.Include(x => x.Attachments).FirstOrDefaultAsync(x => x.Id == id);
            if (d is null) return Results.NotFound();
            var authEnabled = Permissions.AuthEnabled(cfg);
            return Results.Ok(new DemandDetailDto(
                d.Id, d.Title, d.Stage, d.Priority, d.Value, d.Effort, d.Requester, d.Dept, d.Date,
                d.Description, d.Source, d.GeoImpact, d.HasDeadline, d.Deadline, d.BusinessProblem,
                d.ImprovementExisting, d.Criticality, d.Risk, d.ExpectedBenefits, d.BenefitValue,
                d.Stakeholders, d.AllStakeholders,
                d.Attachments.Select(a => new AttachmentDto(a.Id, a.FileName, a.ContentType, a.Size)).ToList(),
                CanDelete(d, user, authEnabled)));
        });

        // Upload one or more attachments (multipart) to a demand.
        api.MapPost("/demands/{id}/attachments", async (string id, HttpContext http, AtlasDbContext db, IConfiguration cfg) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-submit-demand", "E") is { } denied) return denied;
            if (!http.Request.HasFormContentType) return Results.BadRequest(new { error = "Expected multipart/form-data." });
            var d = await db.Demands.FindAsync(id);
            if (d is null) return Results.NotFound();
            var form = await http.Request.ReadFormAsync();
            var saved = new List<AttachmentDto>();
            foreach (var file in form.Files)
            {
                if (file.Length <= 0) continue;
                if (Hardening.ValidateUpload(file.FileName, file.Length) is { } reason) return Results.BadRequest(new { error = reason });
                using var ms = new MemoryStream();
                await file.CopyToAsync(ms);
                var att = new DemandAttachment
                {
                    DemandId = id,
                    FileName = Path.GetFileName(file.FileName),
                    ContentType = string.IsNullOrWhiteSpace(file.ContentType) ? "application/octet-stream" : file.ContentType,
                    Size = file.Length,
                    Bytes = ms.ToArray(),
                };
                db.DemandAttachments.Add(att);
                saved.Add(new AttachmentDto(0, att.FileName, att.ContentType, att.Size));
            }
            await db.SaveChangesAsync();
            return Results.Ok(saved);
        });

        // Download an attachment's bytes. Internal roles only (cap-dashboards) —
        // guards the sequential attachment id against enumeration by outsiders.
        api.MapGet("/attachments/{attId:int}", async (int attId, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-dashboards", "V") is { } deny) return deny;
            var a = await db.DemandAttachments.FindAsync(attId);
            return a is null ? Results.NotFound() : Results.File(a.Bytes, a.ContentType, a.FileName);
        });

        api.MapPatch("/demands/{id}", async (string id, UpdateDemandStageReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http, IHubContext<BoardHub> hub) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-demand-scoring", "E") is { } denied) return denied;
            if (!Stages.Contains(req.Stage)) return Results.BadRequest(new { error = "Unknown stage." });
            // Approval is reserved for Platform Admin & PMO (cap-approve). Other
            // stage moves only need demand-scoring edit.
            if (req.Stage == "approved" && await Permissions.Deny(http, db, cfg, "cap-approve", "E") is { } noApprove) return noApprove;
            var d = await db.Demands.FindAsync(id);
            if (d is null) return Results.NotFound();
            var oldStage = d.Stage;
            d.Stage = req.Stage;
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Demands", $"Advanced demand to {req.Stage}", d.Id));
            await db.SaveChangesAsync();
            if (req.Stage != oldStage)
            {
                var ev = req.Stage == "approved" ? Notifications.Approval : Notifications.Status;
                var msg = req.Stage == "approved" ? "was approved" : $"moved to “{req.Stage}”";
                await Notifications.EmitToEntityAsync(db, cfg, ev, "demand", d.Id, $"Demand {d.Title} {msg}", $"{d.Id} · {d.Title} {msg}.", Permissions.CallerKey(http, cfg));
                // Also alert portfolio leadership regardless of per-demand subscription.
                await Notifications.EmitToRolesAsync(db, cfg, ev, DemandWatchRoles,
                    $"Demand {d.Title} {msg}", $"{d.Id} · {d.Title} {msg}.", "demand", d.Id,
                    Permissions.CallerRoleKeys(http, cfg));
            }
            await BoardHub.NotifyRoomAsync(hub, DemandRoom);
            return Results.Ok(new DemandDto(d.Id, d.Title, d.Stage, d.Priority, d.Value, d.Effort, d.Requester, d.Dept, d.Date));
        });

        api.MapDelete("/demands/{id}", async (string id, AtlasDbContext db, ClaimsPrincipal user, IConfiguration cfg, HttpContext http, IHubContext<BoardHub> hub) =>
        {
            var d = await db.Demands.FindAsync(id);
            if (d is null) return Results.NotFound();
            // You can delete your own initiatives; Platform Admins can delete any.
            if (!CanDelete(d, user, Permissions.AuthEnabled(cfg))) return Results.Forbid();
            db.Demands.Remove(d);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Demands", "Deleted demand", id));
            await db.SaveChangesAsync();
            await BoardHub.NotifyRoomAsync(hub, DemandRoom);
            return Results.NoContent();
        });

        // ---- Demand comments (Platform Admin, PMO & Chief Architect) --------
        // Reading is open to anyone who can see the demand; posting/removing needs
        // Edit on "Comment on demands" (cap-comment-demand).
        api.MapGet("/demands/{id}/comments", async (string id, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (!await db.Demands.AnyAsync(x => x.Id == id)) return Results.NotFound();
            var canComment = await Permissions.Allows(http, db, cfg, "cap-comment-demand", "E");
            var items = await db.DemandComments.Where(c => c.DemandId == id).OrderBy(c => c.Id)
                .Select(c => new DemandCommentDto(c.Id, c.Author, c.Body, c.CreatedAt)).ToListAsync();
            return Results.Ok(new DemandCommentsDto(canComment, items));
        });

        api.MapPost("/demands/{id}/comments", async (string id, DemandCommentReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-comment-demand", "E") is { } denied) return denied;
            if (!await db.Demands.AnyAsync(x => x.Id == id)) return Results.NotFound();
            if (string.IsNullOrWhiteSpace(req.Body)) return Results.BadRequest(new { error = "A comment can't be empty." });
            var c = new DemandComment
            {
                DemandId = id, Body = req.Body.Trim(),
                Author = Permissions.ActorName(http, cfg),
                CreatedAt = DateTime.UtcNow.ToString("o"),
            };
            db.DemandComments.Add(c);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Demands", "Commented on demand", id));
            await db.SaveChangesAsync();
            return Results.Created($"/api/v1/demands/{id}/comments/{c.Id}", new DemandCommentDto(c.Id, c.Author, c.Body, c.CreatedAt));
        });

        api.MapDelete("/demands/comments/{commentId:int}", async (int commentId, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-comment-demand", "E") is { } denied) return denied;
            var c = await db.DemandComments.FindAsync(commentId);
            if (c is null) return Results.NotFound();
            db.DemandComments.Remove(c);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Demands", "Deleted demand comment", c.DemandId));
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

    }
}
