using Microsoft.EntityFrameworkCore;

namespace Atlas.Api;

public record CreatePhaseReq(string? Name, int? StartMonth, int? EndMonth, int? Progress);
public record UpdatePhaseReq(string? Name, int? StartMonth, int? EndMonth, int? Progress);
public record CreateMilestoneReq(string? Label, int? Month);

// ============================================================================
//  Timeline / Gantt. A project has scheduled phases (bars) and milestones
//  (diamonds) across a 12-month grid; a program aggregates its projects' phases
//  into one view. Phases are seeded from the methodology scaffold on project
//  creation (see Templates) and are then editable. Writes require Edit on
//  "Projects & tasks"; reads are open.
// ============================================================================
public static class GanttEndpoints
{
    static readonly string[] Months = { "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec" };
    static int Clamp(int? v, int lo, int hi, int fallback) => v is int n ? Math.Clamp(n, lo, hi) : fallback;
    static string MonthLabel(int m) => Months[Math.Clamp(m, 0, 11)];

    // Map a display date ("1 Aug 2026") to a 0-11 month index on the year grid.
    static int? MonthOf(string? display)
    {
        if (string.IsNullOrWhiteSpace(display)) return null;
        return DateTime.TryParse(display, out var d) ? d.Month - 1 : (int?)null;
    }

    // Map a sprint to a bar on the year grid. Jira often omits dates on
    // future/closed sprints — flag those `undated` and fall back to the project
    // window (else the current month) so past & current sprints still show.
    static GanttSprintDto SprintBar(Sprint s, int? winStart, int? winEnd)
    {
        var a = MonthOf(s.StartDate);
        var b = MonthOf(s.EndDate);
        var undated = a is null && b is null;
        if (undated) { a = winStart ?? DateTime.UtcNow.Month - 1; b = winEnd ?? a; }
        var start = Math.Min(a ?? b!.Value, b ?? a!.Value);
        var end = Math.Max(a ?? b!.Value, b ?? a!.Value);
        // Carry the real ISO dates through so the client places the bar in its true
        // calendar year; month-of-year above stays as the undated/anchored fallback.
        return new GanttSprintDto(s.Id, s.Name, s.Status, start, end, undated, s.StartDate, s.EndDate);
    }

    static PhaseDto ToDto(Phase p) => new(p.Id, p.Name, p.StartMonth, p.EndMonth, p.Progress);
    static MilestoneDto ToDto(Milestone m) => new(m.Id, m.Label, m.Month, m.Date);

    public static void MapGanttEndpoints(this RouteGroupBuilder api)
    {
        // ---- Project timeline ---------------------------------------------
        api.MapGet("/projects/{id}/gantt", async (string id, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            var proj = await db.Projects.FindAsync(id);
            if (proj is null) return Results.NotFound();
            var canEdit = await Permissions.Allows(http, db, cfg, "cap-schedule", "E");
            var phases = await db.Phases.Where(p => p.ProjectId == id).OrderBy(p => p.Ord).ThenBy(p => p.Id)
                .Select(p => ToDto(p)).ToListAsync();
            var milestones = await db.Milestones.Where(m => m.ProjectId == id).OrderBy(m => m.Month).ThenBy(m => m.Id)
                .Select(m => ToDto(m)).ToListAsync();
            var end = string.IsNullOrWhiteSpace(proj.Target) || proj.Target == "TBD" ? proj.Due : proj.Target;
            var winStart = MonthOf(proj.StartDate);
            var winEnd = MonthOf(end);
            // Sprints synced from Jira (or created locally) render as bars in the
            // Schedule view below the phases — past & current included (ADR-0029).
            var sprints = (await db.Sprints.Where(s => s.ProjectId == id)
                    .OrderBy(s => s.Ord).ThenBy(s => s.Id).ToListAsync())
                .Select(s => SprintBar(s, winStart, winEnd)).ToList();
            return Results.Ok(new GanttDto(canEdit, phases, milestones,
                winStart, winEnd, proj.StartDate, end, sprints));
        });

        api.MapPost("/projects/{id}/phases", async (string id, CreatePhaseReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-schedule", "E") is { } denied) return denied;
            if (await db.Projects.FindAsync(id) is null) return Results.NotFound();
            var start = Clamp(req.StartMonth, 0, 11, 0);
            var end = Math.Max(start, Clamp(req.EndMonth, 0, 11, start));
            var p = new Phase
            {
                ProjectId = id,
                Name = string.IsNullOrWhiteSpace(req.Name) ? "New phase" : req.Name!.Trim(),
                StartMonth = start, EndMonth = end, Progress = Clamp(req.Progress, 0, 100, 0),
                Ord = (await db.Phases.Where(x => x.ProjectId == id).Select(x => (int?)x.Ord).MaxAsync() ?? -1) + 1,
            };
            db.Phases.Add(p);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Timeline", "Added phase", $"{id} · {p.Name}"));
            await db.SaveChangesAsync();
            return Results.Created($"/api/v1/phases/{p.Id}", ToDto(p));
        });

        api.MapPatch("/phases/{id:int}", async (int id, UpdatePhaseReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-schedule", "E") is { } denied) return denied;
            var p = await db.Phases.FindAsync(id);
            if (p is null) return Results.NotFound();
            if (req.Name is not null && req.Name.Trim().Length > 0) p.Name = req.Name.Trim();
            if (req.StartMonth is int s) p.StartMonth = Math.Clamp(s, 0, 11);
            if (req.EndMonth is int e) p.EndMonth = Math.Clamp(e, 0, 11);
            if (p.EndMonth < p.StartMonth) p.EndMonth = p.StartMonth;
            if (req.Progress is int pr) p.Progress = Math.Clamp(pr, 0, 100);
            await db.SaveChangesAsync();
            return Results.Ok(ToDto(p));
        });

        api.MapDelete("/phases/{id:int}", async (int id, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-schedule", "E") is { } denied) return denied;
            var p = await db.Phases.FindAsync(id);
            if (p is null) return Results.NotFound();
            db.Phases.Remove(p);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Timeline", "Removed phase", $"{p.ProjectId} · {p.Name}"));
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        // ---- Milestones ---------------------------------------------------
        api.MapPost("/projects/{id}/milestones", async (string id, CreateMilestoneReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-schedule", "E") is { } denied) return denied;
            if (await db.Projects.FindAsync(id) is null) return Results.NotFound();
            if (string.IsNullOrWhiteSpace(req.Label)) return Results.BadRequest(new { error = "Label is required." });
            var month = Clamp(req.Month, 0, 11, 0);
            var m = new Milestone { ProjectId = id, Label = req.Label!.Trim(), Month = month, Date = MonthLabel(month) };
            db.Milestones.Add(m);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Timeline", "Added milestone", $"{id} · {m.Label}"));
            await db.SaveChangesAsync();
            return Results.Created($"/api/v1/milestones/{m.Id}", ToDto(m));
        });

        api.MapDelete("/milestones/{id:int}", async (int id, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-schedule", "E") is { } denied) return denied;
            var m = await db.Milestones.FindAsync(id);
            if (m is null) return Results.NotFound();
            db.Milestones.Remove(m);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Timeline", "Removed milestone", $"{m.ProjectId} · {m.Label}"));
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        // ---- Program timeline (aggregate) ---------------------------------
        // Each project row carries not just its phases but its window (from the
        // project dates, else derived from its sprints/tasks) and its sprint bars,
        // so the program timeline shows a real schedule built from projects, tasks
        // and sprints rather than an empty "No phases" grid (ADR-0029).
        api.MapGet("/programs/{id}/gantt", async (string id, AtlasDbContext db) =>
        {
            var pg = await db.Programs.FindAsync(id);
            if (pg is null) return Results.NotFound();
            var projects = await db.Projects.Where(p => pg.Projects.Contains(p.Id) && !p.Archived)
                .OrderBy(p => p.Id).ToListAsync();
            var ids = projects.Select(p => p.Id).ToList();
            var phases = await db.Phases.Where(p => ids.Contains(p.ProjectId)).OrderBy(p => p.Ord).ThenBy(p => p.Id).ToListAsync();
            var milestones = await db.Milestones.Where(m => ids.Contains(m.ProjectId)).OrderBy(m => m.Month).ThenBy(m => m.Id).ToListAsync();
            var sprints = await db.Sprints.Where(s => ids.Contains(s.ProjectId)).OrderBy(s => s.Ord).ThenBy(s => s.Id).ToListAsync();
            var tasks = await db.ProjectTasks.Where(t => ids.Contains(t.ProjectId)).ToListAsync();

            var rows = projects.Select(p =>
            {
                var end = string.IsNullOrWhiteSpace(p.Target) || p.Target == "TBD" ? p.Due : p.Target;
                int? ws = MonthOf(p.StartDate);
                int? we = MonthOf(end);
                var mySprints = sprints.Where(s => s.ProjectId == p.Id).ToList();
                var myPhases = phases.Where(x => x.ProjectId == p.Id).ToList();

                // No explicit project dates → derive the window from the months its
                // phases, sprints and dated tasks actually span.
                if (ws is null && we is null)
                {
                    var months = new List<int>();
                    months.AddRange(myPhases.SelectMany(x => new[] { x.StartMonth, x.EndMonth }));
                    foreach (var s in mySprints) { if (MonthOf(s.StartDate) is int a) months.Add(a); if (MonthOf(s.EndDate) is int b) months.Add(b); }
                    foreach (var t in tasks.Where(t => t.ProjectId == p.Id)) { if (MonthOf(t.StartDate) is int a) months.Add(a); if (MonthOf(t.TargetDate) is int b) months.Add(b); }
                    if (months.Count > 0) { ws = months.Min(); we = months.Max(); }
                }

                var sprintBars = mySprints.Select(s => SprintBar(s, ws, we)).ToList();
                return new ProgramGanttRowDto(p.Id, p.Name, myPhases.Select(ToDto).ToList(),
                    ws, we, p.StartDate, end, sprintBars);
            }).ToList();
            return Results.Ok(new ProgramGanttDto(rows, milestones.Select(ToDto).ToList()));
        });

        // ---- Portfolio timeline (everything on one month grid) -------------
        // One bar per project/program/product/release with dates, so the
        // roadmap can be filtered by category. Undated items are omitted (they
        // can't be placed). Reads are open.
        api.MapGet("/portfolio/gantt", async (AtlasDbContext db) =>
        {
            var items = new List<PortfolioGanttItemDto>();

            void Add(string type, string id, string name, string status, int? progress, string startRaw, string endRaw, string dept = "")
            {
                var s = MonthOf(startRaw);
                var e = MonthOf(endRaw);
                if (s is null && e is null) return;                 // no dates → can't place
                var start = Math.Min(s ?? e!.Value, e ?? s!.Value);
                var end = Math.Max(s ?? e!.Value, e ?? s!.Value);
                items.Add(new PortfolioGanttItemDto(type, id, name, status, start, end, progress,
                    string.IsNullOrWhiteSpace(startRaw) ? endRaw : startRaw, string.IsNullOrWhiteSpace(endRaw) ? startRaw : endRaw, dept));
            }
            // Place an item by month indices directly, when its window was derived
            // (not from an explicit date) — labels show the month names.
            void AddMonths(string type, string id, string name, string status, int? progress, int startMonth, int endMonth, string dept = "")
            {
                var start = Math.Clamp(Math.Min(startMonth, endMonth), 0, 11);
                var end = Math.Clamp(Math.Max(startMonth, endMonth), 0, 11);
                items.Add(new PortfolioGanttItemDto(type, id, name, status, start, end, progress, MonthLabel(start), MonthLabel(end), dept));
            }

            // Preload month spans of phases/sprints/tasks so an undated project can
            // still be placed by what its schedule actually covers (matches the
            // program timeline's derivation).
            var allPhases = await db.Phases.ToListAsync();
            var allSprints = await db.Sprints.ToListAsync();
            var allTasks = await db.ProjectTasks.ToListAsync();
            List<int> DerivedMonths(string projectId)
            {
                var m = new List<int>();
                m.AddRange(allPhases.Where(x => x.ProjectId == projectId).SelectMany(x => new[] { x.StartMonth, x.EndMonth }));
                foreach (var s in allSprints.Where(x => x.ProjectId == projectId)) { if (MonthOf(s.StartDate) is int a) m.Add(a); if (MonthOf(s.EndDate) is int b) m.Add(b); }
                foreach (var t in allTasks.Where(x => x.ProjectId == projectId)) { if (MonthOf(t.StartDate) is int a) m.Add(a); if (MonthOf(t.TargetDate) is int b) m.Add(b); }
                return m;
            }

            foreach (var p in await db.Projects.Where(x => !x.Archived).OrderBy(x => x.Name).ToListAsync())
            {
                var pend = string.IsNullOrWhiteSpace(p.Target) || p.Target == "TBD" ? p.Due : p.Target;
                if (MonthOf(p.StartDate) is null && MonthOf(pend) is null)
                {
                    var m = DerivedMonths(p.Id);
                    if (m.Count > 0) AddMonths("project", p.Id, p.Name, p.Status, p.Progress, m.Min(), m.Max(), p.Dept);
                }
                else Add("project", p.Id, p.Name, p.Status, p.Progress, p.StartDate, pend, p.Dept);
            }
            foreach (var g in await db.Programs.Where(x => !x.Archived).OrderBy(x => x.Name).ToListAsync())
                Add("program", g.Id, g.Name, g.Status, g.Progress, g.StartDate, g.EndDate, g.Dept);
            foreach (var pr in await db.Products.OrderBy(x => x.Name).ToListAsync())
                Add("product", pr.Id, pr.Name, pr.Status, null, pr.StartDate, pr.EndDate, pr.Dept);
            foreach (var r in await db.Releases.Where(x => !x.Archived).OrderBy(x => x.Name).ToListAsync())
                Add("release", r.Id, r.Name, r.Status, r.Progress, r.Date, r.Date);

            return Results.Ok(new PortfolioGanttDto(items));
        });
    }
}
