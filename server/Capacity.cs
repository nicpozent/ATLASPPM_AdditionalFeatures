using Microsoft.EntityFrameworkCore;

namespace Atlas.Api;

// ============================================================================
//  Team capacity — cross-checks the people ASSIGNED to a project (People &
//  roles) against their allocation on the Resources sheet. Utilisation is the
//  sum of operational, project and product load; anyone over 100% is over-
//  allocated, and heavy operational load (BAU) is called out because it's the
//  most common reason project delivery slips. Over-allocation among a project's
//  assigned team is surfaced as a deterministic resource risk.
// ============================================================================
public static class Capacity
{
    const int HighOpsPct = 50; // operational load at/above this competes with delivery

    // Distinct, real people assigned to a project via People & roles.
    static async Task<List<string>> AssignedPeopleAsync(AtlasDbContext db, string projectId) =>
        await db.RoleAssignments
            .Where(a => a.ProjectId == projectId && a.Person != "" && a.Person != "N/A")
            .Select(a => a.Person).Distinct().ToListAsync();

    static int Util(Resource r) => r.OpsPct + r.ProjectPct + r.ProductPct;

    // Assigned team members who are over-allocated (>100%). Reused by the risk engine.
    public static async Task<List<string>> OverAllocatedAsync(AtlasDbContext db, string projectId)
    {
        var names = await AssignedPeopleAsync(db, projectId);
        if (names.Count == 0) return new();
        return await db.Resources.Where(r => names.Contains(r.Name) && r.OpsPct + r.ProjectPct + r.ProductPct > 100)
            .Select(r => r.Name).ToListAsync();
    }

    public static void MapCapacityEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/projects/{id}/capacity", async (string id, AtlasDbContext db) =>
        {
            if (!await db.Projects.AnyAsync(p => p.Id == id)) return Results.NotFound();
            var names = await AssignedPeopleAsync(db, id);
            var people = await db.Resources.Where(r => names.Contains(r.Name)).OrderBy(r => r.Name).ToListAsync();
            var rows = people.Select(r => new CapacityRowDto(
                r.Name, r.Role, r.Initials, r.Color, r.OpsPct, r.ProjectPct, r.ProductPct,
                Util(r), Util(r) > 100, r.OpsPct >= HighOpsPct)).ToList();
            // Names assigned but not found on the Resources sheet (e.g. external) —
            // shown as unknown-capacity so the assignment isn't silently dropped.
            var unknown = names.Except(people.Select(p => p.Name)).ToList();
            return Results.Ok(new CapacityDto(
                names.Count, rows.Count(r => r.Over), rows.Count(r => r.HighOps), rows, unknown));
        });
    }
}
