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
            return Results.Ok(new GanttDto(canEdit, phases, milestones,
                MonthOf(proj.StartDate), MonthOf(end), proj.StartDate, end));
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
        api.MapGet("/programs/{id}/gantt", async (string id, AtlasDbContext db) =>
        {
            var pg = await db.Programs.FindAsync(id);
            if (pg is null) return Results.NotFound();
            var projects = await db.Projects.Where(p => pg.Projects.Contains(p.Id) && !p.Archived)
                .OrderBy(p => p.Id).ToListAsync();
            var ids = projects.Select(p => p.Id).ToList();
            var phases = await db.Phases.Where(p => ids.Contains(p.ProjectId)).OrderBy(p => p.Ord).ThenBy(p => p.Id).ToListAsync();
            var milestones = await db.Milestones.Where(m => ids.Contains(m.ProjectId)).OrderBy(m => m.Month).ThenBy(m => m.Id).ToListAsync();
            var rows = projects.Select(p => new ProgramGanttRowDto(
                p.Id, p.Name,
                phases.Where(x => x.ProjectId == p.Id).Select(ToDto).ToList())).ToList();
            return Results.Ok(new ProgramGanttDto(rows, milestones.Select(ToDto).ToList()));
        });
    }
}
