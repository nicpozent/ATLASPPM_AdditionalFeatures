using Microsoft.EntityFrameworkCore;

namespace Atlas.Api;

// ============================================================================
//  Allocation engine — the single source of a person's PROJECT load, combining
//  two signals per (person, project):
//    • planned  — explicit team-assignment % (time-phased, incl. extension)
//    • task     — bottom-up load derived from their open tasks' estimate hours,
//                 smoothed over each task's active window
//  and taking the HIGHER of the two per project (ADR-0020): the planned figure
//  is a floor, and heavy task load can raise it, but the two never double-count.
//  A person's project total is the sum of that per-project max across projects.
//  Ops and product load stay additive (separate work types). Reused by both the
//  Resources roster and a project's capacity panel so they never drift.
// ============================================================================
public static class AllocationEngine
{
    // Whole calendar weeks between two dates (min 1) — succeeds only when both
    // parse and end >= start, so an unparseable/absent bound falls back to the
    // default horizon rather than collapsing to 1 week (which would over-count).
    static bool TryWeeks(string? start, string? end, out int weeks)
    {
        weeks = 0;
        if (DateOnly.TryParse(start, out var s) && DateOnly.TryParse(end, out var e) && e >= s)
        {
            weeks = Math.Max(1, (int)Math.Round((e.DayNumber - s.DayNumber) / 7.0));
            return true;
        }
        return false;
    }
    const int DefaultTaskWeeks = 4;  // undated task with no clean project window → rolling ~4-week horizon

    // Planned project allocation per person per project, time-phased as-of `on`
    // (base segment + extension), summed within a project.
    public static async Task<Dictionary<string, Dictionary<string, int>>> ProjectPlannedAsync(AtlasDbContext db, DateOnly on)
    {
        var map = new Dictionary<string, Dictionary<string, int>>(StringComparer.OrdinalIgnoreCase);
        var assigns = await db.TeamAssignments.Include(a => a.Members)
            .Where(a => a.EntityType == "project").ToListAsync();
        foreach (var a in assigns)
            foreach (var m in a.Members)
            {
                var live = (AllocMath.ActiveOn(m.StartDate, m.EndDate, on) ? m.Alloc : 0)
                         + (m.ExtAlloc > 0 && AllocMath.ActiveOn(m.ExtStartDate, m.ExtEndDate, on) ? m.ExtAlloc : 0);
                if (live <= 0) continue;
                Add(map, m.Name, a.EntityId, live);
            }
        return map;
    }

    // Task-estimate load per person per project, as-of `on`. Each open, assigned
    // task with estimate hours is smoothed over its active window (task dates,
    // else the project window, else a rolling default), converted to a weekly %,
    // and summed per project. Only tasks live on `on` count.
    public static async Task<Dictionary<string, Dictionary<string, int>>> TaskLoadAsync(AtlasDbContext db, DateOnly on)
    {
        var map = new Dictionary<string, Dictionary<string, int>>(StringComparer.OrdinalIgnoreCase);
        var projWindows = await db.Projects.Where(p => !p.Archived)
            .Select(p => new { p.Id, p.StartDate, p.Due }).ToListAsync();
        var pw = projWindows.ToDictionary(p => p.Id, p => (StartDate: p.StartDate, End: p.Due));

        var tasks = await db.ProjectTasks
            .Where(t => t.Status != "Done" && t.EstimateHours > 0
                     && t.Assignee != "" && t.Assignee != "Unassigned")
            .Select(t => new { t.Assignee, t.ProjectId, t.EstimateHours, t.StartDate, t.TargetDate })
            .ToListAsync();

        foreach (var t in tasks)
        {
            pw.TryGetValue(t.ProjectId, out var proj);
            var hasTaskDates = !string.IsNullOrEmpty(t.StartDate) || !string.IsNullOrEmpty(t.TargetDate);
            // Effective window for the "is it live now?" test (task dates first,
            // else the project window; unparseable/empty bounds are open).
            var winStart = hasTaskDates ? t.StartDate : proj.StartDate;
            var winEnd = hasTaskDates ? t.TargetDate : proj.End;
            if (!AllocMath.ActiveOn(winStart, winEnd, on)) continue;

            // Weeks to smooth the estimate over: the task's own window, else the
            // project window, else the rolling default horizon.
            int weeks = TryWeeks(t.StartDate, t.TargetDate, out var tw) ? tw
                      : TryWeeks(proj.StartDate, proj.End, out var pw2) ? pw2
                      : DefaultTaskWeeks;

            var pct = AllocMath.PctFromHours((int)Math.Round(t.EstimateHours / (double)weeks));
            if (pct <= 0) continue;
            Add(map, t.Assignee.Trim(), t.ProjectId, pct);
        }
        return map;
    }

    // Combined project load per person: Σ over projects of max(planned, task),
    // clamped per project to 100. This is the canonical PROJECT number shown on
    // Resources and used in a project's capacity panel.
    public static async Task<Dictionary<string, int>> ProjectLoadByPersonAsync(AtlasDbContext db, DateOnly on)
    {
        var planned = await ProjectPlannedAsync(db, on);
        var task = await TaskLoadAsync(db, on);
        var people = new HashSet<string>(planned.Keys, StringComparer.OrdinalIgnoreCase);
        people.UnionWith(task.Keys);

        var result = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        foreach (var person in people)
        {
            planned.TryGetValue(person, out var pl);
            task.TryGetValue(person, out var tk);
            var projectIds = new HashSet<string>(pl?.Keys ?? Enumerable.Empty<string>());
            if (tk != null) projectIds.UnionWith(tk.Keys);

            var total = 0;
            foreach (var pid in projectIds)
            {
                var a = pl != null && pl.TryGetValue(pid, out var pv) ? pv : 0;
                var b = tk != null && tk.TryGetValue(pid, out var tv) ? tv : 0;
                total += Math.Min(100, Math.Max(a, b));   // higher of the two per project (ADR-0020)
            }
            result[person] = total;
        }
        return result;
    }

    static void Add(Dictionary<string, Dictionary<string, int>> map, string person, string projectId, int pct)
    {
        if (string.IsNullOrWhiteSpace(person)) return;
        if (!map.TryGetValue(person, out var byProj)) map[person] = byProj = new(StringComparer.OrdinalIgnoreCase);
        byProj[projectId] = (byProj.TryGetValue(projectId, out var cur) ? cur : 0) + pct;
    }
}
