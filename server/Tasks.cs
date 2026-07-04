using Microsoft.EntityFrameworkCore;

namespace Atlas.Api;

public record CreateTaskReq(string Name, string? Epic, string? Assignee, string? Status, string? Sprint, string? Baseline, string? Priority);
public record UpdateTaskStatusReq(string Status);
public record CreateEpicReq(string Name, int? Stories, int? Done, string? Status, string? DependsOn);

// ============================================================================
//  Project tasks — the board (Kanban) & table on Project → Tasks. Creating and
//  moving tasks requires Edit on "Projects & tasks" (cap-projects); status
//  changes come from drag-and-drop on the board.
// ============================================================================
public static class Tasks
{
    static readonly string[] Statuses = { "To Do", "In Progress", "In Review", "Done", "Blocked" };
    static readonly string[] Priorities = { "Critical", "High", "Medium", "Low" };
    static readonly string[] EpicStatuses = { "Complete", "In progress", "Upcoming", "At risk" };

    public static void MapTaskEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/projects/{id}/tasks", async (string id, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (!await db.Projects.AnyAsync(p => p.Id == id)) return Results.NotFound();
            var tasks = await db.ProjectTasks.Where(t => t.ProjectId == id).OrderBy(t => t.Ord).ToListAsync();
            var canEdit = await Permissions.Allows(http, db, cfg, "cap-projects", "E");
            return Results.Ok(new ProjectTasksDto(canEdit, tasks.Select(ToDto).ToList()));
        });

        api.MapPost("/projects/{id}/tasks", async (string id, CreateTaskReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            if (!await db.Projects.AnyAsync(p => p.Id == id)) return Results.NotFound();
            if (string.IsNullOrWhiteSpace(req.Name)) return Results.BadRequest(new { error = "Name is required." });
            // Task codes are global (T-1042 style) — number from the max across projects.
            var existing = await db.ProjectTasks.Select(t => t.Code).ToListAsync();
            var maxNum = existing.Select(c => int.TryParse(c.Split('-').Last(), out var n) ? n : 0).DefaultIfEmpty(1041).Max();
            var ord = (await db.ProjectTasks.Where(t => t.ProjectId == id).Select(t => (int?)t.Ord).MaxAsync() ?? 0) + 1;
            var task = new ProjectTask
            {
                ProjectId = id, Ord = ord, Code = $"T-{maxNum + 1}", Name = req.Name.Trim(),
                Epic = req.Epic?.Trim() ?? "", Assignee = string.IsNullOrWhiteSpace(req.Assignee) ? "Unassigned" : req.Assignee!.Trim(),
                Status = Statuses.Contains(req.Status) ? req.Status! : "To Do",
                Sprint = req.Sprint?.Trim() ?? "", Baseline = req.Baseline?.Trim() ?? req.Sprint?.Trim() ?? "",
                Priority = Priorities.Contains(req.Priority) ? req.Priority! : "Medium",
            };
            db.ProjectTasks.Add(task);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Tasks", "Created task", $"{id} · {task.Code} {task.Name}"));
            await db.SaveChangesAsync();
            return Results.Created($"/api/v1/projects/{id}/tasks/{task.Id}", ToDto(task));
        });

        api.MapPatch("/tasks/{taskId:int}", async (int taskId, UpdateTaskStatusReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            if (!Statuses.Contains(req.Status)) return Results.BadRequest(new { error = "Unknown status." });
            var task = await db.ProjectTasks.FindAsync(taskId);
            if (task is null) return Results.NotFound();
            task.Status = req.Status;
            await db.SaveChangesAsync();
            return Results.Ok(ToDto(task));
        });

        // ---- Epics --------------------------------------------------------
        api.MapGet("/projects/{id}/epics", async (string id, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (!await db.Projects.AnyAsync(p => p.Id == id)) return Results.NotFound();
            var epics = await db.Epics.Where(e => e.ProjectId == id).OrderBy(e => e.Ord).ToListAsync();
            var canEdit = await Permissions.Allows(http, db, cfg, "cap-projects", "E");
            return Results.Ok(new EpicsDto(canEdit, epics.Select(ToEpicDto).ToList()));
        });

        api.MapPost("/projects/{id}/epics", async (string id, CreateEpicReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            if (!await db.Projects.AnyAsync(p => p.Id == id)) return Results.NotFound();
            if (string.IsNullOrWhiteSpace(req.Name)) return Results.BadRequest(new { error = "Name is required." });
            var stories = Math.Max(0, req.Stories ?? 0);
            var done = Math.Clamp(req.Done ?? 0, 0, stories);
            var ord = (await db.Epics.Where(e => e.ProjectId == id).Select(e => (int?)e.Ord).MaxAsync() ?? 0) + 1;
            var epic = new Epic
            {
                ProjectId = id, Ord = ord, Name = req.Name.Trim(), Stories = stories, Done = done,
                Status = EpicStatuses.Contains(req.Status) ? req.Status! : "Upcoming",
                DependsOn = req.DependsOn?.Trim() ?? "",
            };
            db.Epics.Add(epic);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Epics", "Created epic", $"{id} · {epic.Name}"));
            await db.SaveChangesAsync();
            return Results.Created($"/api/v1/projects/{id}/epics/{epic.Id}", ToEpicDto(epic));
        });
    }

    static EpicDto ToEpicDto(Epic e)
    {
        var pct = e.Stories == 0 ? 0 : (int)Math.Round(100.0 * e.Done / e.Stories);
        return new EpicDto(e.Id, e.Name, e.Stories, e.Done, pct, e.Status, e.DependsOn);
    }

    static ProjectTaskDto ToDto(ProjectTask t) =>
        new(t.Id, t.Code, t.Name, t.Epic, t.Assignee, t.Status, t.Sprint, t.Baseline, t.Priority);
}
