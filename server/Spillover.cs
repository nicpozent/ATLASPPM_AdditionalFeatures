using Microsoft.EntityFrameworkCore;

namespace Atlas.Api;

// ============================================================================
//  Sprint spillover — a task whose current sprint no longer matches the sprint
//  it was baselined into has "spilled over". It's a deterministic schedule
//  signal (same rule the risk engine uses) surfaced in four places: the Tasks
//  board/list, the project Overview KPI, the Delivery Status report, and — once
//  it crosses a threshold — auto-raised as a RAID risk so it enters governance.
// ============================================================================
public static class Spillover
{
    // Auto-raise a RAID risk once this many tasks are past their baseline.
    const int RaidThreshold = 3;
    const string RaidPrefix = "Sprint spillover"; // identifies the auto-raised item

    // EF-translatable predicate: both sprint & baseline set and different.
    public static IQueryable<ProjectTask> Spilled(IQueryable<ProjectTask> q) =>
        q.Where(t => t.Sprint != "" && t.Baseline != "" && t.Sprint != t.Baseline);

    public static async Task<int> CountAsync(AtlasDbContext db, string projectId) =>
        await Spilled(db.ProjectTasks.Where(t => t.ProjectId == projectId)).CountAsync();

    // Ensure the auto RAID risk reflects current spillover: create/update it above
    // the threshold, remove it below. Idempotent; the caller need not SaveChanges.
    public static async Task ReconcileRaidAsync(AtlasDbContext db, string projectId, HttpContext http, IConfiguration cfg)
    {
        var count = await CountAsync(db, projectId);
        var existing = await db.RaidItems.FirstOrDefaultAsync(r => r.ProjectId == projectId && r.Auto && r.Title.StartsWith(RaidPrefix));

        if (count >= RaidThreshold)
        {
            var title = $"{RaidPrefix} — {count} task(s) past their baselined sprint";
            if (existing is null)
            {
                var next = (await db.RaidItems.Where(r => r.ProjectId == projectId).Select(r => (int?)r.Ord).MaxAsync() ?? 0) + 1;
                db.RaidItems.Add(new RaidItem
                {
                    ProjectId = projectId, Ord = next, Type = "Risk", Title = title,
                    Owner = "PMO", Status = "Open", Auto = true,
                });
                db.AuditEvents.Add(Permissions.Audit(http, cfg, "RAID", "Auto-raised spillover risk", $"{projectId} · {count} tasks"));
                await db.SaveChangesAsync();
            }
            else if (existing.Title != title || existing.Status != "Open")
            {
                existing.Title = title;
                existing.Status = "Open";
                await db.SaveChangesAsync();
            }
        }
        else if (existing is not null)
        {
            db.RaidItems.Remove(existing);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "RAID", "Cleared spillover risk", $"{projectId} · below threshold"));
            await db.SaveChangesAsync();
        }
    }

    public static void MapSpilloverEndpoints(this RouteGroupBuilder api)
    {
        // Per-project spilled tasks — backs the Overview KPI.
        api.MapGet("/projects/{id}/spillover", async (string id, AtlasDbContext db) =>
        {
            if (!await db.Projects.AnyAsync(p => p.Id == id)) return Results.NotFound();
            var tasks = await Spilled(db.ProjectTasks.Where(t => t.ProjectId == id))
                .OrderBy(t => t.Ord)
                .Select(t => new SpilledTaskDto(t.Code, t.Name, t.Baseline, t.Sprint, t.Assignee))
                .ToListAsync();
            return Results.Ok(tasks);
        });

        // Portfolio-wide spillover — backs the Delivery Status metric. Excludes
        // archived projects, consistent with the other portfolio rollups.
        api.MapGet("/spillover", async (AtlasDbContext db) =>
        {
            var rows = await Spilled(db.ProjectTasks)
                .GroupBy(t => t.ProjectId)
                .Select(g => new { g.Key, Count = g.Count() })
                .ToListAsync();
            var active = await db.Projects.Where(p => !p.Archived).ToDictionaryAsync(p => p.Id, p => p.Name);
            var byProject = rows.Where(r => active.ContainsKey(r.Key))
                .Select(r => new ProjectSpilloverDto(r.Key, active[r.Key], r.Count))
                .OrderByDescending(r => r.Count).ToList();
            return Results.Ok(new SpilloverSummaryDto(byProject.Sum(r => r.Count), byProject.Count, byProject));
        });
    }
}
