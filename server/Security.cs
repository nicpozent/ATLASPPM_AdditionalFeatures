using Microsoft.EntityFrameworkCore;

namespace Atlas.Api;

// PATCH is partial — every field is optional.
public record UpdateSecurityProfileReq(
    string? Classification, string? Residency, string? Subjects, string? Retention,
    bool? PersonalData, bool? SpecialCategory, bool? AutomatedDecisions, bool? CardholderData,
    bool? Gdpr, bool? Pci, bool? Iso, bool? AiAct, bool? Soc2, bool? Nis2);
public record CreateSecControlReq(string Control, string? Framework, string? Evidence, string? Owner, string? Status, string? Description, string? Reason);
public record UpdateSecControlReq(string? Control, string? Framework, string? Evidence, string? Owner, string? Status, string? Description, string? Reason);

// ============================================================================
//  Security, privacy & compliance — per-project data classification/privacy
//  profile, applicable frameworks, and a control-evidence register. Editing is
//  a governance activity: it requires Edit on "Approve demands & gates"
//  (cap-approve) and is written to the audit log.
// ============================================================================
public static class Security
{
    static readonly string[] Classifications = { "Public", "Internal", "Confidential", "Restricted" };
    static readonly string[] Residencies = { "EU / EEA", "Global", "On-prem only" };
    static readonly string[] ControlStatuses = { "Planned", "Partial", "Implemented", "Archived" };

    static async Task<SecurityProfile> EnsureAsync(AtlasDbContext db, string projectId)
    {
        var prof = await db.SecurityProfiles.FindAsync(projectId);
        if (prof is null)
        {
            prof = new SecurityProfile { ProjectId = projectId };
            db.SecurityProfiles.Add(prof);
            await db.SaveChangesAsync();
        }
        return prof;
    }

    static SecurityProfileDto ToDto(SecurityProfile p) => new(
        p.Classification, p.Residency, p.Subjects, p.Retention,
        p.PersonalData, p.SpecialCategory, p.AutomatedDecisions, p.CardholderData,
        p.Gdpr, p.Pci, p.Iso, p.AiAct, p.Soc2, p.Nis2);

    public static void MapSecurityEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/projects/{id}/security", async (string id, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (!await db.Projects.AnyAsync(p => p.Id == id)) return Results.NotFound();
            var prof = await EnsureAsync(db, id);
            var controls = await db.SecurityControls.Where(c => c.ProjectId == id).OrderBy(c => c.Ord).ToListAsync();
            var canEdit = await Permissions.Allows(http, db, cfg, "cap-approve", "E");
            return Results.Ok(new SecurityDto(canEdit, ToDto(prof),
                controls.Select(ToControlDto).ToList()));
        });

        api.MapPatch("/projects/{id}/security", async (string id, UpdateSecurityProfileReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-approve", "E") is { } denied) return denied;
            if (!await db.Projects.AnyAsync(p => p.Id == id)) return Results.NotFound();
            var p = await EnsureAsync(db, id);
            if (req.Classification is not null && Classifications.Contains(req.Classification)) p.Classification = req.Classification;
            if (req.Residency is not null && Residencies.Contains(req.Residency)) p.Residency = req.Residency;
            if (req.Subjects is not null) p.Subjects = req.Subjects.Trim();
            if (req.Retention is not null) p.Retention = req.Retention.Trim();
            if (req.PersonalData is { } pd) p.PersonalData = pd;
            if (req.SpecialCategory is { } sc) p.SpecialCategory = sc;
            if (req.AutomatedDecisions is { } ad) p.AutomatedDecisions = ad;
            if (req.CardholderData is { } cd) p.CardholderData = cd;
            if (req.Gdpr is { } g) p.Gdpr = g;
            if (req.Pci is { } pci) p.Pci = pci;
            if (req.Iso is { } iso) p.Iso = iso;
            if (req.AiAct is { } ai) p.AiAct = ai;
            if (req.Soc2 is { } soc) p.Soc2 = soc;
            if (req.Nis2 is { } nis) p.Nis2 = nis;
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Security", "Updated security profile", id));
            await db.SaveChangesAsync();
            return Results.Ok(ToDto(p));
        });

        api.MapPost("/projects/{id}/security/controls", async (string id, CreateSecControlReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-approve", "E") is { } denied) return denied;
            if (!await db.Projects.AnyAsync(p => p.Id == id)) return Results.NotFound();
            if (string.IsNullOrWhiteSpace(req.Control)) return Results.BadRequest(new { error = "Control is required." });
            var next = (await db.SecurityControls.Where(c => c.ProjectId == id).Select(c => (int?)c.Ord).MaxAsync() ?? 0) + 1;
            var ctl = new SecurityControl
            {
                ProjectId = id, Ord = next, Code = $"CTL-{next:00}", Control = req.Control.Trim(),
                Framework = string.IsNullOrWhiteSpace(req.Framework) ? "ISO 27001" : req.Framework!.Trim(),
                Evidence = string.IsNullOrWhiteSpace(req.Evidence) ? "—" : req.Evidence!.Trim(),
                Owner = string.IsNullOrWhiteSpace(req.Owner) ? "—" : req.Owner!.Trim(),
                Status = ControlStatuses.Contains(req.Status) ? req.Status! : "Planned",
                Description = req.Description?.Trim() ?? "", Reason = req.Reason?.Trim() ?? "",
            };
            db.SecurityControls.Add(ctl);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Security", "Added control", $"{id} · {ctl.Code} {ctl.Control}"));
            await db.SaveChangesAsync();
            return Results.Created($"/api/v1/projects/{id}/security/controls/{ctl.Id}", ToControlDto(ctl));
        });

        // Modify a control — status (incl. Archived), or any of its fields, with
        // an optional reason capturing why it changed. Removable via DELETE.
        api.MapPatch("/security/controls/{ctlId:int}", async (int ctlId, UpdateSecControlReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-approve", "E") is { } denied) return denied;
            var ctl = await db.SecurityControls.FindAsync(ctlId);
            if (ctl is null) return Results.NotFound();
            if (req.Control is not null)
            {
                if (string.IsNullOrWhiteSpace(req.Control)) return Results.BadRequest(new { error = "Control is required." });
                ctl.Control = req.Control.Trim();
            }
            if (req.Framework is not null) ctl.Framework = string.IsNullOrWhiteSpace(req.Framework) ? "ISO 27001" : req.Framework.Trim();
            if (req.Evidence is not null) ctl.Evidence = string.IsNullOrWhiteSpace(req.Evidence) ? "—" : req.Evidence.Trim();
            if (req.Owner is not null) ctl.Owner = string.IsNullOrWhiteSpace(req.Owner) ? "—" : req.Owner.Trim();
            if (req.Status is not null)
            {
                if (!ControlStatuses.Contains(req.Status)) return Results.BadRequest(new { error = "Unknown status." });
                ctl.Status = req.Status;
            }
            if (req.Description is not null) ctl.Description = req.Description.Trim();
            if (req.Reason is not null) ctl.Reason = req.Reason.Trim();
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Security", "Updated control", $"{ctl.ProjectId} · {ctl.Code} → {ctl.Status}"));
            await db.SaveChangesAsync();
            return Results.Ok(ToControlDto(ctl));
        });

        api.MapDelete("/security/controls/{ctlId:int}", async (int ctlId, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-approve", "E") is { } denied) return denied;
            var ctl = await db.SecurityControls.FindAsync(ctlId);
            if (ctl is null) return Results.NotFound();
            db.SecurityControls.Remove(ctl);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Security", "Removed control", $"{ctl.ProjectId} · {ctl.Code} {ctl.Control}"));
            await db.SaveChangesAsync();
            return Results.NoContent();
        });
    }

    static SecurityControlDto ToControlDto(SecurityControl c) =>
        new(c.Id, c.Code, c.Control, c.Framework, c.Evidence, c.Owner, c.Status, c.Description, c.Reason);
}
