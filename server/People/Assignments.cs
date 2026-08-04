using Microsoft.EntityFrameworkCore;

namespace Atlas.Api.People;

// ============================================================================
//  People & roles — assigning the project lead and the architecture roles.
//  Governance mirrors the prototype exactly:
//    • PMO (or Platform Admin) assigns the Project Manager.
//    • The Chief Architect (or Platform Admin) assigns the 8 architecture roles.
//    • Everyone else sees the panel read-only.
//  The fine-grained pmo-vs-architect distinction is exact in dev (X-Atlas-Role);
//  under real auth both collapse to the PMO canonical role, so the server still
//  enforces the coarse rule and the UI stays honest.
// ============================================================================
public static class Assignments
{
    const string LeadKey = "pm";
    const string LeadLabel = "Project Manager";

    // Architecture roles, in the prototype's order. Assigned by the Chief Architect.
    static readonly (string Key, string Label)[] ArchRoles =
    {
        ("leadArchitect", "Lead Architect (SPOC)"),
        ("securityArchitect", "Security Architect"),
        ("securityOfficer", "Security Officer"),
        ("solutionArchitect", "Solution Architect"),
        ("technologyArchitect", "Technology Architect"),
        ("cloudArchitect", "Cloud Architect"),
        ("dataArchitect", "Data Architect"),
        ("businessArchitect", "Business Architect"),
    };
    static readonly HashSet<string> ArchKeys = ArchRoles.Select(r => r.Key).ToHashSet();

    // Delivery roles — the delivery-leadership assignments (assigned by the PM/PMO,
    // not the architect). Technical Lead is always offered; Scrum Master only on an
    // agile methodology. Candidates are the onboarded application roster, not a
    // mapped architecture team.
    static readonly (string Key, string Label)[] DeliveryRoles =
    {
        ("techLead", "Technical Lead"),
        ("scrumMaster", "Scrum Master"),
    };
    static readonly HashSet<string> DeliveryKeys = DeliveryRoles.Select(r => r.Key).ToHashSet();
    const string ScrumMasterKey = "scrumMaster";
    const string TechLeadKey = "techLead";

    // Methodologies that make the Scrum Master role relevant (the agile family).
    static readonly HashSet<string> AgileMethods = new(StringComparer.OrdinalIgnoreCase)
        { "Scrum", "Kanban", "SAFe", "Scrumban", "Disciplined Agile", "Extreme Programming" };
    static bool IsAgile(string? methodology) => !string.IsNullOrWhiteSpace(methodology) && AgileMethods.Contains(methodology);

    // Empty role (dev, no header) = full access. Admin/PMO own the lead; the
    // architect owns architecture roles. Under auth, architect == pmo canonically.
    static bool CanAssignLead(string ui) => ui is "" or "admin" or "pmo";
    static bool CanAssignArch(string ui) => ui is "" or "admin" or "architect";
    // Delivery roles are a PM/PMO responsibility (delivery leadership).
    static bool CanAssignDelivery(string ui) => ui is "" or "admin" or "pmo" or "pm" or "pmlead";

    // The onboarded application roster: the resource directory plus Entra-synced
    // members (the same "known people" basis the Resources screen uses), sorted
    // and de-duplicated. This is the candidate pool for the delivery roles.
    static async Task<List<string>> OnboardedAsync(AtlasDbContext db)
    {
        var names = new SortedSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var n in await db.Resources.Select(r => r.Name).ToListAsync())
            if (!string.IsNullOrWhiteSpace(n)) names.Add(n.Trim());
        foreach (var m in await db.TeamMembers.Select(m => m.DisplayName).ToListAsync())
            if (!string.IsNullOrWhiteSpace(m)) names.Add(m.Trim());
        return names.ToList();
    }

    // Keep the currently-assigned person selectable even if they are no longer in
    // the mapped team (moved teams, left the group) — otherwise the dropdown would
    // silently drop the live value.
    static List<string> WithCurrent(List<string> pool, string current) =>
        string.IsNullOrEmpty(current) || current == "N/A" || pool.Contains(current)
            ? pool
            : pool.Concat(new[] { current }).OrderBy(n => n, StringComparer.OrdinalIgnoreCase).ToList();

    public static void MapAssignmentEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/projects/{id}/assignments", async (string id, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.DenyRead(http, db, cfg,
                () => db.Projects.AnyAsync(p => p.Id == id && p.StakeholderVisible && !p.Archived)) is { } deny) return deny;
            var project = await db.Projects.FirstOrDefaultAsync(p => p.Id == id);
            if (project is null) return Results.NotFound();
            var ui = Permissions.EffectiveUiRole(http, cfg);
            var rows = await db.RoleAssignments.Where(a => a.ProjectId == id).ToListAsync();
            string Person(string key) => rows.FirstOrDefault(r => r.RoleKey == key)?.Person ?? "";

            // Candidate people come from the mapped Entra teams (Admin → Teams):
            //  • the 7 architect roles ← the Chief Architect's architecture team,
            //  • the Security Officer  ← the Security Officer team,
            //  • the Project Manager   ← the combined PM Lead + PMO pool.
            // Until any team is mapped we fall back to the resource directory so
            // the app is usable out of the box.
            var mapped = await Teams.AnyTeamMappedAsync(db);
            var fallback = mapped ? new List<string>()
                : await db.Resources.OrderBy(r => r.Name).Select(r => r.Name).ToListAsync();
            var archPool = mapped ? await Teams.PoolAsync(db, "architect") : fallback;
            var secPool = mapped ? await Teams.PoolAsync(db, "secofficer") : fallback;
            var pmPool = mapped ? await Teams.PoolAsync(db, "pmlead", "pmo") : fallback;

            var arch = ArchRoles.Select(r =>
            {
                var person = Person(r.Key);
                var pool = r.Key == "securityOfficer" ? secPool : archPool;
                return new RoleAssignmentDto(r.Key, r.Label, person, WithCurrent(pool, person));
            }).ToList();
            var missing = arch.Where(r => string.IsNullOrEmpty(r.Person)).Select(r => r.Label).ToList();

            var lead = Person(LeadKey);
            var leadOptions = WithCurrent(pmPool, lead);

            // Delivery roles — Scrum Master is only offered on an agile methodology.
            //  • Technical Lead ← the engineering-team pool: the Infrastructure,
            //    Global Engineering, BLOG IT and Dev/Developer teams mapped to their
            //    managers (falls back to the onboarded roster until any team is
            //    mapped, so it's usable out of the box).
            //  • Scrum Master   ← the onboarded application roster.
            var onboarded = await OnboardedAsync(db);
            var techLeadPool = mapped
                ? await Teams.PoolAsync(db, "inframgr", "inframgr_apac", "teammgr", "blogit", "devmgr", "devapac")
                : onboarded;
            var agile = IsAgile(project.Methodology);
            var delivery = DeliveryRoles
                .Where(r => r.Key != ScrumMasterKey || agile)
                .Select(r =>
                {
                    var person = Person(r.Key);
                    var pool = r.Key == TechLeadKey ? techLeadPool : onboarded;
                    return new RoleAssignmentDto(r.Key, r.Label, person, WithCurrent(pool, person));
                }).ToList();

            return Results.Ok(new AssignmentsDto(
                CanAssignLead(ui), CanAssignArch(ui), LeadKey, LeadLabel, lead,
                leadOptions, arch, leadOptions, missing,
                CanAssignDelivery(ui), delivery));
        });

        // Candidate people for an assignment pool, for dropdowns outside the
        // project role panel (e.g. Product Owner). Falls back to the resource
        // directory until Entra teams are mapped.
        api.MapGet("/assignable/{pool}", async (string pool, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-dashboards", "V") is { } deny) return deny;
            if (!await Teams.AnyTeamMappedAsync(db))
                return Results.Ok(await db.Resources.OrderBy(r => r.Name).Select(r => r.Name).ToListAsync());
            var names = pool switch
            {
                "pmpo" => await Teams.PoolAsync(db, "pmlead", "pmo"),
                "architecture" => await Teams.PoolAsync(db, "architect"),
                "secofficer" => await Teams.PoolAsync(db, "secofficer"),
                _ => new List<string>(),
            };
            return Results.Ok(names);
        });

        // Assign (or clear) a single role. Body: { "person": "Name" | "" | "N/A" }.
        api.MapPut("/projects/{id}/assignments/{roleKey}", async (string id, string roleKey,
            AssignReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (!await db.Projects.AnyAsync(p => p.Id == id)) return Results.NotFound();
            var isLead = roleKey == LeadKey;
            var isDelivery = DeliveryKeys.Contains(roleKey);
            if (!isLead && !isDelivery && !ArchKeys.Contains(roleKey)) return Results.BadRequest(new { error = "Unknown role." });

            var ui = Permissions.EffectiveUiRole(http, cfg);
            var allowed = isLead ? CanAssignLead(ui) : isDelivery ? CanAssignDelivery(ui) : CanAssignArch(ui);
            if (!allowed)
                return Results.Json(new { error = isLead || isDelivery
                        ? "Only the PMO / project manager can assign this role."
                        : "Only the Chief Architect can assign architecture roles." },
                    statusCode: StatusCodes.Status403Forbidden);

            var person = (req.Person ?? "").Trim();
            var row = await db.RoleAssignments.FirstOrDefaultAsync(a => a.ProjectId == id && a.RoleKey == roleKey);
            if (row is null)
            {
                row = new RoleAssignment { ProjectId = id, RoleKey = roleKey, Person = person };
                db.RoleAssignments.Add(row);
            }
            else row.Person = person;

            var label = isLead ? LeadLabel
                : isDelivery ? DeliveryRoles.First(r => r.Key == roleKey).Label
                : ArchRoles.First(r => r.Key == roleKey).Label;
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "People", "Assigned role",
                $"{id} · {label} → {(person == "" ? "Unassigned" : person)}"));
            await db.SaveChangesAsync();
            return Results.Ok(new RoleAssignmentDto(roleKey, label, person, new()));
        });
    }
}

public record AssignReq(string? Person);
