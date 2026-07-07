using Microsoft.EntityFrameworkCore;

namespace Atlas.Api;

// ============================================================================
//  Team capacity — cross-checks the people ASSIGNED to a project (People &
//  roles AND attached teams — sub-teams or individuals) against their live
//  utilisation. Utilisation is the sum of operational, project and product
//  load computed from real, time-phased allocations (as of today); anyone over
//  100% is over-allocated, and heavy operational load (BAU) is called out.
//  Over-allocation among a project's assigned team is a deterministic risk.
// ============================================================================
public static class Capacity
{
    const int HighOpsPct = 50; // operational load at/above this competes with delivery

    // Distinct, real people assigned to a project — People & roles plus the
    // members of any team (sub-team or individual) attached to it.
    static async Task<List<string>> AssignedPeopleAsync(AtlasDbContext db, string projectId)
    {
        var roles = await db.RoleAssignments
            .Where(a => a.ProjectId == projectId && a.Person != "" && a.Person != "N/A")
            .Select(a => a.Person).ToListAsync();
        var team = (await db.TeamAssignments.Include(a => a.Members)
                .Where(a => a.EntityType == "project" && a.EntityId == projectId).ToListAsync())
            .SelectMany(a => a.Members).Select(m => m.Name);
        // People carrying open, estimated tasks on this project are working on it
        // even without a formal role/team assignment — count them too.
        var taskAssignees = await db.ProjectTasks
            .Where(t => t.ProjectId == projectId && t.Status != "Done" && t.EstimateHours > 0
                     && t.Assignee != "" && t.Assignee != "Unassigned")
            .Select(t => t.Assignee).ToListAsync();
        return roles.Concat(team).Concat(taskAssignees)
            .Where(n => !string.IsNullOrWhiteSpace(n) && n != "N/A")
            .Distinct(StringComparer.OrdinalIgnoreCase).ToList();
    }

    // Per-person utilisation today (ops + project + product) from live allocations
    // — the same sources and time-phasing the Resources roster uses.
    static async Task<Dictionary<string, (int Ops, int Project, int Product)>> UtilByPersonAsync(AtlasDbContext db)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var map = new Dictionary<string, (int Ops, int Project, int Product)>(StringComparer.OrdinalIgnoreCase);
        (int Ops, int Project, int Product) G(string n) => map.TryGetValue(n, out var v) ? v : (0, 0, 0);

        foreach (var (name, ops) in await Ops.AllocByPersonAsync(db)) { var v = G(name); map[name] = (v.Ops + ops, v.Project, v.Product); }
        // Project load = max(planned team %, task-estimate %) per project, summed
        // (ADR-0020) — the same engine the Resources roster uses.
        foreach (var (name, proj) in await AllocationEngine.ProjectLoadByPersonAsync(db, today)) { var v = G(name); map[name] = (v.Ops, v.Project + proj, v.Product); }
        foreach (var pa in await db.ProductAllocations.ToListAsync()) { var v = G(pa.MemberName); map[pa.MemberName] = (v.Ops, v.Project, v.Product + pa.Alloc); }
        return map;
    }

    // Titles for the project's people (from attached team members / role assignments).
    static async Task<Dictionary<string, string>> TitlesAsync(AtlasDbContext db, string projectId)
    {
        var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var team = await db.TeamAssignments.Include(a => a.Members)
            .Where(a => a.EntityType == "project" && a.EntityId == projectId).ToListAsync();
        foreach (var m in team.SelectMany(a => a.Members))
            if (!string.IsNullOrWhiteSpace(m.Title) && !map.ContainsKey(m.Name)) map[m.Name] = m.Title;
        return map;
    }

    // Assigned team members who are over-allocated (>100%). Reused by the risk engine.
    public static async Task<List<string>> OverAllocatedAsync(AtlasDbContext db, string projectId)
    {
        var names = await AssignedPeopleAsync(db, projectId);
        if (names.Count == 0) return new();
        var util = await UtilByPersonAsync(db);
        var set = names.ToHashSet(StringComparer.OrdinalIgnoreCase);
        return util.Where(kv => set.Contains(kv.Key) && kv.Value.Ops + kv.Value.Project + kv.Value.Product > 100)
            .Select(kv => kv.Key).ToList();
    }

    public static void MapCapacityEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/projects/{id}/capacity", async (string id, AtlasDbContext db) =>
        {
            if (!await db.Projects.AnyAsync(p => p.Id == id)) return Results.NotFound();
            var names = await AssignedPeopleAsync(db, id);
            var util = await UtilByPersonAsync(db);
            var titles = await TitlesAsync(db, id);
            var rows = names.OrderBy(n => n).Select(n =>
            {
                var u = util.TryGetValue(n, out var v) ? v : (Ops: 0, Project: 0, Product: 0);
                var total = u.Ops + u.Project + u.Product;
                var role = titles.TryGetValue(n, out var tt) && tt.Length > 0 ? tt : "Team member";
                return new CapacityRowDto(n, role, ResourcesData.Initials(n), ResourcesData.ColorFor(n),
                    u.Ops, u.Project, u.Product, total, total > 100, u.Ops >= HighOpsPct);
            }).ToList();
            return Results.Ok(new CapacityDto(
                names.Count, rows.Count(r => r.Over), rows.Count(r => r.HighOps), rows, new List<string>()));
        });
    }
}
