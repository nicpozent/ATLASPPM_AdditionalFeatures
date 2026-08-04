using Microsoft.EntityFrameworkCore;

namespace Atlas.Api.People;

// ============================================================================
//  Capacity intelligence — portfolio-level reads over the shared capacity roster
//  (ResourcesData.RosterAsync): who's over-allocated, where the headroom is,
//  demand-vs-capacity by department, and skills-based staffing suggestions
//  (people who have a skill AND have free capacity). Read-only; all derived from
//  the same time-phased allocation the Resources roster uses.
// ============================================================================
public static class CapacityIntel
{
    public static void MapCapacityIntelEndpoints(this RouteGroupBuilder api)
    {
        // Portfolio capacity vs demand + over-/under-allocation lists.
        api.MapGet("/capacity/insight", async (AtlasDbContext db, IConfiguration cfg, HttpContext http, string? asOf) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-dashboards", "V") is { } deny) return deny;
            var on = !string.IsNullOrWhiteSpace(asOf) && DateOnly.TryParse(asOf, out var d)
                ? d : DateOnly.FromDateTime(DateTime.UtcNow);
            var roster = await ResourcesData.RosterAsync(db, on);

            CapPersonDto ToPerson(RosterRow p) => new(p.Name, p.Title, p.Dept,
                ResourcesData.Initials(p.Name), ResourcesData.ColorFor(p.Name),
                p.Ops, p.Project, p.Product, p.Total, Math.Max(0, 100 - p.Total));

            var headcount = roster.Count;
            var totalCapacity = headcount * 100;
            var totalAllocated = roster.Sum(p => p.Total);
            var over = roster.Where(p => p.Total > 100).OrderByDescending(p => p.Total).Select(ToPerson).ToList();
            var under = roster.Where(p => p.Total > 0 && p.Total < 50).OrderBy(p => p.Total).Select(ToPerson).ToList();
            var unallocated = roster.Count(p => p.Total == 0);

            var byDept = roster.GroupBy(p => p.Dept).Select(g =>
            {
                var cap = g.Count() * 100;
                var alloc = g.Sum(p => p.Total);
                return new CapDeptDto(g.Key, g.Count(), cap, alloc,
                    cap > 0 ? (int)Math.Round(alloc * 100.0 / cap) : 0, g.Count(p => p.Total > 100));
            }).OrderByDescending(x => x.LoadedPct).ToList();

            return Results.Ok(new CapacityInsightDto(
                headcount, totalCapacity, totalAllocated,
                totalCapacity > 0 ? (int)Math.Round(totalAllocated * 100.0 / totalCapacity) : 0,
                over.Count, roster.Count(p => 100 - p.Total >= 50), unallocated,
                over, under, byDept));
        });

        // Skills-based staffing: people who have the requested skill (rated ≥ the
        // given minimum level) AND have spare capacity, ranked by free % then skill.
        api.MapGet("/capacity/staffing", async (AtlasDbContext db, IConfiguration cfg, HttpContext http, string? skill, int? minLevel, int? minFree, string? asOf) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-dashboards", "V") is { } deny) return deny;
            var on = !string.IsNullOrWhiteSpace(asOf) && DateOnly.TryParse(asOf, out var d)
                ? d : DateOnly.FromDateTime(DateTime.UtcNow);
            var skillName = (skill ?? "").Trim();
            if (skillName.Length == 0) return Results.Ok(new StaffingDto("", new()));
            var sk = await db.Skills.FirstOrDefaultAsync(s => s.Name.ToLower() == skillName.ToLower());
            if (sk is null) return Results.Ok(new StaffingDto(skillName, new()));

            var lvl = Math.Clamp(minLevel ?? 2, 0, 4);
            var free = Math.Clamp(minFree ?? 0, 0, 100);
            var ratings = await db.SkillRatings.Where(r => r.SkillId == sk.Id && r.Level >= lvl).ToListAsync();
            var roster = (await ResourcesData.RosterAsync(db, on)).ToDictionary(p => p.Name, p => p, StringComparer.OrdinalIgnoreCase);

            var candidates = ratings.Select(r =>
            {
                roster.TryGetValue(r.Person, out var row);
                var total = row?.Total ?? 0;
                var freePct = Math.Max(0, 100 - total);
                return new StaffCandidateDto(r.Person, row?.Title ?? "Team member", row?.Dept ?? "",
                    ResourcesData.Initials(r.Person), ResourcesData.ColorFor(r.Person), r.Level, total, freePct);
            })
            .Where(c => c.Free >= free)
            .OrderByDescending(c => c.Free).ThenByDescending(c => c.Level).ThenBy(c => c.Name)
            .ToList();
            return Results.Ok(new StaffingDto(skillName, candidates));
        });
    }
}
