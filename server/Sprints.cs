using Microsoft.EntityFrameworkCore;

namespace Atlas.Api;

public record CreateSprintReq(string Name, string? Goal, string? StartDate, string? EndDate, string? Status, int? CommittedPoints);
public record UpdateSprintReq(string? Name, string? Goal, string? StartDate, string? EndDate, string? Status, int? CommittedPoints);

// ============================================================================
//  Sprints (iterations) — the Sprint tab on agile-with-sprints projects. Tasks
//  are matched to a sprint by name (ProjectTask.Sprint == Sprint.Name); the
//  per-sprint roll-up (task counts, points, spillover) is derived at read time.
//  Creating needs Edit on "Project schedule" (cap-schedule); editing/deleting
//  needs Edit on "Projects & tasks" (cap-projects).
// ============================================================================
public static class Sprints
{
    static readonly string[] Statuses = { "Planned", "Started", "Halted", "Completed", "Cancelled" };

    public static void MapSprintEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/projects/{id}/sprints", async (string id, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (!await db.Projects.AnyAsync(p => p.Id == id)) return Results.NotFound();
            var sprints = await db.Sprints.Where(s => s.ProjectId == id).OrderBy(s => s.Ord).ToListAsync();
            var tasks = await db.ProjectTasks.Where(t => t.ProjectId == id).ToListAsync();
            var canEdit = await Permissions.Allows(http, db, cfg, "cap-projects", "E");
            var canCreate = await Permissions.Allows(http, db, cfg, "cap-schedule", "E");
            return Results.Ok(new SprintsDto(canEdit, canCreate, sprints.Select(s => ToDto(s, tasks)).ToList()));
        });

        api.MapPost("/projects/{id}/sprints", async (string id, CreateSprintReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-schedule", "E") is { } denied) return denied;
            if (!await db.Projects.AnyAsync(p => p.Id == id)) return Results.NotFound();
            if (string.IsNullOrWhiteSpace(req.Name)) return Results.BadRequest(new { error = "Name is required." });
            var ord = (await db.Sprints.Where(s => s.ProjectId == id).Select(s => (int?)s.Ord).MaxAsync() ?? 0) + 1;
            var sprint = new Sprint
            {
                ProjectId = id, Ord = ord, Name = req.Name.Trim(), Goal = req.Goal?.Trim() ?? "",
                StartDate = req.StartDate?.Trim() ?? "", EndDate = req.EndDate?.Trim() ?? "",
                Status = Statuses.Contains(req.Status) ? req.Status! : "Planned",
                CommittedPoints = Math.Max(0, req.CommittedPoints ?? 0),
            };
            db.Sprints.Add(sprint);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Sprints", "Created sprint", $"{id} · {sprint.Name}"));
            await db.SaveChangesAsync();
            var tasks = await db.ProjectTasks.Where(t => t.ProjectId == id).ToListAsync();
            return Results.Created($"/api/v1/projects/{id}/sprints/{sprint.Id}", ToDto(sprint, tasks));
        });

        api.MapPatch("/sprints/{sprintId:int}", async (int sprintId, UpdateSprintReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            var sprint = await db.Sprints.FindAsync(sprintId);
            if (sprint is null) return Results.NotFound();
            if (req.Name is not null)
            {
                if (string.IsNullOrWhiteSpace(req.Name)) return Results.BadRequest(new { error = "Name is required." });
                sprint.Name = req.Name.Trim();
            }
            if (req.Goal is not null) sprint.Goal = req.Goal.Trim();
            if (req.StartDate is not null) sprint.StartDate = req.StartDate.Trim();
            if (req.EndDate is not null) sprint.EndDate = req.EndDate.Trim();
            if (req.Status is not null)
            {
                if (!Statuses.Contains(req.Status)) return Results.BadRequest(new { error = "Unknown status." });
                sprint.Status = req.Status;
            }
            if (req.CommittedPoints is not null) sprint.CommittedPoints = Math.Max(0, req.CommittedPoints.Value);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Sprints", "Updated sprint", $"{sprint.ProjectId} · {sprint.Name}"));
            await db.SaveChangesAsync();
            var tasks = await db.ProjectTasks.Where(t => t.ProjectId == sprint.ProjectId).ToListAsync();
            return Results.Ok(ToDto(sprint, tasks));
        });

        api.MapDelete("/sprints/{sprintId:int}", async (int sprintId, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            var sprint = await db.Sprints.FindAsync(sprintId);
            if (sprint is null) return Results.NotFound();
            db.Sprints.Remove(sprint);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Sprints", "Deleted sprint", $"{sprint.ProjectId} · {sprint.Name}"));
            await db.SaveChangesAsync();
            return Results.NoContent();
        });
    }

    static SprintDto ToDto(Sprint s, List<ProjectTask> tasks)
    {
        var inSprint = tasks.Where(t => string.Equals(t.Sprint, s.Name, StringComparison.OrdinalIgnoreCase)).ToList();
        var done = inSprint.Where(t => t.Status == "Done").ToList();
        var points = inSprint.Sum(t => t.Points);
        var donePoints = done.Sum(t => t.Points);
        // Spilled in = a task now in this sprint whose baseline was a different sprint.
        var spilled = inSprint.Count(t => !string.IsNullOrWhiteSpace(t.Baseline) && !string.Equals(t.Baseline, s.Name, StringComparison.OrdinalIgnoreCase));
        return new SprintDto(s.Id, s.Name, s.Goal, s.StartDate, s.EndDate, s.Status,
            s.CommittedPoints > 0 ? s.CommittedPoints : points, inSprint.Count, done.Count, points, donePoints, spilled);
    }
}
