using Microsoft.EntityFrameworkCore;

namespace Atlas.Api;

public record SetChangeTypeReq(string ChangeType);
public record SetAdmStatusReq(string Status);

// ============================================================================
//  Architecture governance (TOGAF ADM). Each project carries the standard nine
//  ADM phases (reference framework, seeded "Not started") and a change-type
//  triage that drives the required governance level (computed client-side).
//  Editing requires Edit on "Approve demands & gates" (cap-approve) — the same
//  governance capability behind gates/security.
// ============================================================================
public static class Architecture
{
    static readonly string[] Statuses = { "Not started", "Draft", "In progress", "In review", "Approved" };

    // The standard ADM phases: code, name, focus, owning architect role, key artefact.
    static readonly (string Code, string Phase, string Focus, string Owner, string Artefact)[] Template =
    {
        ("P", "Preliminary",                  "Framework & principles",        "Chief Architect",          "Architecture principles"),
        ("A", "A · Architecture Vision",      "Scope, stakeholders, vision",   "Chief Architect",          "Vision document"),
        ("B", "B · Business Architecture",    "Capabilities, processes",       "Business Architect",       "Business architecture"),
        ("C", "C · Information Systems",      "Application & data",            "Solution Architect",       "App & data architecture"),
        ("D", "D · Technology Architecture",  "Platform, infra, security",     "Infrastructure Architect", "Technology architecture"),
        ("E", "E · Opportunities & Solutions","Options, gap, roadmap",         "Solution Architect",       "Gap analysis & options"),
        ("F", "F · Migration Planning",       "Transition states, sequencing", "Solution Architect",       "Migration plan"),
        ("G", "G · Implementation Governance","Build conformance",             "Chief Architect",          "Compliance reviews"),
        ("H", "H · Change Management",        "Post-impl & repository",        "Chief Architect",          "Post-impl review"),
    };

    static async Task EnsureAsync(AtlasDbContext db, string projectId)
    {
        if (await db.ArchProfiles.FindAsync(projectId) is null)
            db.ArchProfiles.Add(new ArchProfile { ProjectId = projectId });
        if (!await db.AdmPhases.AnyAsync(p => p.ProjectId == projectId))
            for (var i = 0; i < Template.Length; i++)
            {
                var t = Template[i];
                db.AdmPhases.Add(new AdmPhase { ProjectId = projectId, Code = t.Code, Phase = t.Phase, Focus = t.Focus, Owner = t.Owner, Artefact = t.Artefact, Ord = i });
            }
        await db.SaveChangesAsync();
    }

    public static void MapArchitectureEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/projects/{id}/architecture", async (string id, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (!await db.Projects.AnyAsync(p => p.Id == id)) return Results.NotFound();
            await EnsureAsync(db, id);
            var profile = await db.ArchProfiles.FindAsync(id);
            var phases = await db.AdmPhases.Where(p => p.ProjectId == id).OrderBy(p => p.Ord).ToListAsync();
            var canEdit = await Permissions.Allows(http, db, cfg, "cap-approve", "E");
            return Results.Ok(new ArchitectureDto(canEdit, profile!.ChangeType,
                phases.Select(p => new AdmPhaseDto(p.Id, p.Code, p.Phase, p.Focus, p.Owner, p.Artefact, p.Status)).ToList()));
        });

        api.MapPatch("/projects/{id}/architecture", async (string id, SetChangeTypeReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-approve", "E") is { } denied) return denied;
            if (!await db.Projects.AnyAsync(p => p.Id == id)) return Results.NotFound();
            await EnsureAsync(db, id);
            var profile = await db.ArchProfiles.FindAsync(id);
            profile!.ChangeType = req.ChangeType?.Trim() ?? "";
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Architecture", "Set change type", $"{id} · {profile.ChangeType}"));
            await db.SaveChangesAsync();
            return Results.Ok(new { changeType = profile.ChangeType });
        });

        api.MapPatch("/adm-phases/{phaseId:int}", async (int phaseId, SetAdmStatusReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-approve", "E") is { } denied) return denied;
            if (!Statuses.Contains(req.Status)) return Results.BadRequest(new { error = "Unknown status." });
            var phase = await db.AdmPhases.FindAsync(phaseId);
            if (phase is null) return Results.NotFound();
            phase.Status = req.Status;
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Architecture", $"{phase.Code} → {req.Status}", $"{phase.ProjectId} · {phase.Phase}"));
            await db.SaveChangesAsync();
            return Results.Ok(new AdmPhaseDto(phase.Id, phase.Code, phase.Phase, phase.Focus, phase.Owner, phase.Artefact, phase.Status));
        });
    }
}
