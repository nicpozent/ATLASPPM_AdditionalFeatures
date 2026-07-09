using Microsoft.EntityFrameworkCore;

namespace Atlas.Api;

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

    // Empty role (dev, no header) = full access. Admin/PMO own the lead; the
    // architect owns architecture roles. Under auth, architect == pmo canonically.
    static bool CanAssignLead(string ui) => ui is "" or "admin" or "pmo";
    static bool CanAssignArch(string ui) => ui is "" or "admin" or "architect";

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
            if (!await db.Projects.AnyAsync(p => p.Id == id)) return Results.NotFound();
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
            return Results.Ok(new AssignmentsDto(
                CanAssignLead(ui), CanAssignArch(ui), LeadKey, LeadLabel, lead,
                leadOptions, arch, leadOptions, missing));
        });

        // Candidate people for an assignment pool, for dropdowns outside the
        // project role panel (e.g. Product Owner). Falls back to the resource
        // directory until Entra teams are mapped.
        api.MapGet("/assignable/{pool}", async (string pool, AtlasDbContext db) =>
        {
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
            if (!isLead && !ArchKeys.Contains(roleKey)) return Results.BadRequest(new { error = "Unknown role." });

            var ui = Permissions.EffectiveUiRole(http, cfg);
            var allowed = isLead ? CanAssignLead(ui) : CanAssignArch(ui);
            if (!allowed)
                return Results.Json(new { error = isLead
                        ? "Only the PMO can assign the project manager."
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

            var label = isLead ? LeadLabel : ArchRoles.First(r => r.Key == roleKey).Label;
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "People", "Assigned role",
                $"{id} · {label} → {(person == "" ? "Unassigned" : person)}"));
            await db.SaveChangesAsync();
            return Results.Ok(new RoleAssignmentDto(roleKey, label, person, new()));
        });
    }
}

public record AssignReq(string? Person);
