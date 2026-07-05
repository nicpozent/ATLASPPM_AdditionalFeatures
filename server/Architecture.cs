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

    // The Architecture Review Board roster — each an independent sign-off. These
    // are the architecture roles that own architectural correctness (per the
    // prototype: assigned in People & roles; ARB, not the PMO, owns this).
    static readonly string[] ArbRoster =
    {
        "Chief Architect", "Business Architect", "Solution Architect",
        "Infrastructure Architect", "Security Architect",
    };
    static readonly string[] Decisions = { "pending", "approved", "conditions", "rejected" };

    // Roll-up of the independent sign-offs into an overall board verdict.
    internal static string ArbStatus(IReadOnlyCollection<ArchApproval> a)
    {
        if (a.Count == 0) return "Not started";
        if (a.Any(x => x.Decision == "rejected")) return "Rejected";
        if (a.All(x => x.Decision is "approved" or "conditions"))
            return a.Any(x => x.Decision == "conditions") ? "Approved with conditions" : "Approved";
        if (a.Any(x => x.Decision is "approved" or "conditions")) return "In review";
        return "Pending";
    }

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
        if (!await db.ArchApprovals.AnyAsync(a => a.ProjectId == projectId))
            for (var i = 0; i < ArbRoster.Length; i++)
                db.ArchApprovals.Add(new ArchApproval { ProjectId = projectId, Role = ArbRoster[i], Ord = i });
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
            var approvals = await db.ArchApprovals.Where(a => a.ProjectId == id).OrderBy(a => a.Ord).ToListAsync();
            var canEdit = await Permissions.Allows(http, db, cfg, "cap-approve", "E");
            return Results.Ok(new ArchitectureDto(canEdit, profile!.ChangeType,
                phases.Select(p => new AdmPhaseDto(p.Id, p.Code, p.Phase, p.Focus, p.Owner, p.Artefact, p.Status)).ToList(),
                approvals.Select(a => new ArchApprovalDto(a.Id, a.Role, a.Decision, a.DecidedBy, a.DecidedAt, a.Note)).ToList(),
                ArbStatus(approvals)));
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

        // Record one ARB member's sign-off. Each role's decision is independent;
        // the overall board verdict is their roll-up. Gated on the same governance
        // capability as gates/architecture — the architecture roles own it.
        api.MapPatch("/arch-approvals/{approvalId:int}", async (int approvalId, SetArbDecisionReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-approve", "E") is { } denied) return denied;
            if (!Decisions.Contains(req.Decision)) return Results.BadRequest(new { error = "Unknown decision." });
            var a = await db.ArchApprovals.FindAsync(approvalId);
            if (a is null) return Results.NotFound();

            // Overall status before, so we can notify only on a real board transition.
            var siblings = await db.ArchApprovals.Where(x => x.ProjectId == a.ProjectId).ToListAsync();
            var before = ArbStatus(siblings);

            a.Decision = req.Decision;
            if (req.Decision == "pending") { a.DecidedBy = ""; a.DecidedAt = ""; a.Note = ""; }
            else
            {
                a.DecidedBy = Permissions.ActorName(http, cfg);
                a.DecidedAt = DateTime.UtcNow.ToString("dd MMM yyyy");
                a.Note = req.Note?.Trim() ?? "";
            }
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Architecture", $"ARB {a.Role}: {req.Decision}", $"{a.ProjectId} · {a.Role}"));
            await db.SaveChangesAsync();

            // If the board's overall verdict changed to a terminal one, tell subscribers.
            var after = ArbStatus(siblings);
            if (after != before && after is "Approved" or "Approved with conditions" or "Rejected")
            {
                var project = await db.Projects.FindAsync(a.ProjectId);
                var name = project?.Name ?? a.ProjectId;
                await Notifications.EmitToEntityAsync(db, cfg, Notifications.Approval, "project", a.ProjectId,
                    $"ARB {after.ToLowerInvariant()}: {name}", $"{a.ProjectId} · Architecture Review Board verdict is now “{after}”.",
                    Permissions.CallerKey(http, cfg));
            }
            return Results.Ok(new ArchApprovalDto(a.Id, a.Role, a.Decision, a.DecidedBy, a.DecidedAt, a.Note));
        });
    }
}
