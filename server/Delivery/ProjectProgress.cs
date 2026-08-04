using Microsoft.EntityFrameworkCore;

namespace Atlas.Api.Delivery;

// ============================================================================
//  Project completion % derived from task state.
//  A project that has tasks reports progress computed from their statuses (so
//  the number reflects real delivery, not a manual guess); a project with no
//  tasks keeps its manually-entered Progress (e.g. waterfall projects tracked
//  by phase). Weighted so in-flight work counts partially:
//    Done 100% · In Review 70% · In Progress 40% · To Do/Blocked 0%.
//  Blocked contributes 0 on purpose — blocked work isn't progressing.
// ============================================================================
public static class ProjectProgress
{
    public static double Weight(string status) => status switch
    {
        "Done" => 1.0,
        "In Review" => 0.7,
        "In Progress" => 0.4,
        _ => 0.0,                 // "To Do", "Blocked", anything else
    };

    // Weighted completion for one project's status→count map; null when there
    // are no tasks (caller falls back to the stored manual Progress).
    public static int? FromCounts(IReadOnlyDictionary<string, int> statusCounts)
    {
        var total = statusCounts.Values.Sum();
        if (total == 0) return null;
        var weighted = statusCounts.Sum(kv => Weight(kv.Key) * kv.Value);
        return (int)Math.Round(weighted / total * 100);
    }

    // projectId → derived % for every project (in the given set) that has tasks.
    public static async Task<Dictionary<string, int>> MapAsync(AtlasDbContext db, ICollection<string> projectIds)
    {
        if (projectIds.Count == 0) return new();
        var rows = await db.ProjectTasks
            .Where(t => projectIds.Contains(t.ProjectId))
            .Select(t => new { t.ProjectId, t.Status })
            .ToListAsync();
        return rows
            .GroupBy(r => r.ProjectId)
            .ToDictionary(
                g => g.Key,
                g => FromCounts(g.GroupBy(x => x.Status).ToDictionary(s => s.Key, s => s.Count()))!.Value);
    }
}
