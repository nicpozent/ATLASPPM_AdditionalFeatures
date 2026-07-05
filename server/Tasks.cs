using Microsoft.EntityFrameworkCore;

namespace Atlas.Api;

public record CreateTaskReq(string Name, string? Epic, string? Assignee, string? Status, string? Sprint, string? Baseline, string? Priority,
    string? StartDate, string? TargetDate, int? Points, string? Size, int? EstimateHours);
public record UpdateTaskReq(string? Name, string? Epic, string? Assignee, string? Status, string? Sprint, string? Baseline, string? Priority,
    string? StartDate, string? TargetDate, int? Points, string? Size, int? EstimateHours);
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
    static readonly string[] Sizes = { "XS", "S", "M", "L", "XL", "XXL" };
    static readonly string[] EpicStatuses = { "Complete", "In progress", "Upcoming", "At risk" };

    public static void MapTaskEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/projects/{id}/tasks", async (string id, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (!await db.Projects.AnyAsync(p => p.Id == id)) return Results.NotFound();
            var tasks = await db.ProjectTasks.Where(t => t.ProjectId == id).OrderBy(t => t.Ord).ToListAsync();
            var absences = await db.Absences.Where(a => a.ProjectId == id).ToListAsync();
            var canEdit = await Permissions.Allows(http, db, cfg, "cap-projects", "E");
            var canCreate = await Permissions.Allows(http, db, cfg, "cap-schedule", "E");
            return Results.Ok(new ProjectTasksDto(canEdit, tasks.Select(t => ToDto(t, absences)).ToList(), canCreate));
        });

        api.MapPost("/projects/{id}/tasks", async (string id, CreateTaskReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-schedule", "E") is { } denied) return denied;
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
                StartDate = req.StartDate?.Trim() ?? "", TargetDate = req.TargetDate?.Trim() ?? "",
                Points = Math.Max(0, req.Points ?? 0), Size = Sizes.Contains(req.Size) ? req.Size! : "",
                EstimateHours = Math.Max(0, req.EstimateHours ?? 0),
            };
            db.ProjectTasks.Add(task);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Tasks", "Created task", $"{id} · {task.Code} {task.Name}"));
            await db.SaveChangesAsync();
            return Results.Created($"/api/v1/projects/{id}/tasks/{task.Id}", ToDto(task, null));
        });

        api.MapPatch("/tasks/{taskId:int}", async (int taskId, UpdateTaskReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            var task = await db.ProjectTasks.FindAsync(taskId);
            if (task is null) return Results.NotFound();
            if (req.Name is not null)
            {
                if (string.IsNullOrWhiteSpace(req.Name)) return Results.BadRequest(new { error = "Name is required." });
                task.Name = req.Name.Trim();
            }
            if (req.Epic is not null) task.Epic = req.Epic.Trim();
            if (req.Assignee is not null) task.Assignee = string.IsNullOrWhiteSpace(req.Assignee) ? "Unassigned" : req.Assignee.Trim();
            if (req.Status is not null)
            {
                if (!Statuses.Contains(req.Status)) return Results.BadRequest(new { error = "Unknown status." });
                task.Status = req.Status;
            }
            if (req.Priority is not null)
            {
                if (!Priorities.Contains(req.Priority)) return Results.BadRequest(new { error = "Unknown priority." });
                task.Priority = req.Priority;
            }
            if (req.Baseline is not null) task.Baseline = req.Baseline.Trim();
            if (req.StartDate is not null) task.StartDate = req.StartDate.Trim();
            if (req.TargetDate is not null) task.TargetDate = req.TargetDate.Trim();
            if (req.Points is not null) task.Points = Math.Max(0, req.Points.Value);
            if (req.Size is not null) task.Size = Sizes.Contains(req.Size) ? req.Size : "";
            if (req.EstimateHours is not null) task.EstimateHours = Math.Max(0, req.EstimateHours.Value);
            // Re-planning the sprint keeps the baseline fixed, so moving a task off
            // its baselined sprint is exactly what marks it as spilled over.
            if (req.Sprint is not null)
            {
                task.Sprint = req.Sprint.Trim();
                db.AuditEvents.Add(Permissions.Audit(http, cfg, "Tasks", "Re-planned sprint", $"{task.Code} → {task.Sprint} (baseline {task.Baseline})"));
            }
            await db.SaveChangesAsync();
            // Spillover may have changed → keep the auto RAID risk in sync.
            if (req.Sprint is not null)
                await Spillover.ReconcileRaidAsync(db, task.ProjectId, http, cfg);
            var absences = await db.Absences.Where(a => a.ProjectId == task.ProjectId).ToListAsync();
            return Results.Ok(ToDto(task, absences));
        });

        api.MapDelete("/tasks/{taskId:int}", async (int taskId, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            var task = await db.ProjectTasks.FindAsync(taskId);
            if (task is null) return Results.NotFound();
            var comments = await db.TaskComments.Where(c => c.TaskId == taskId).ToListAsync();
            db.TaskComments.RemoveRange(comments);
            db.ProjectTasks.Remove(task);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Tasks", "Deleted task", $"{task.ProjectId} · {task.Code} {task.Name}"));
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        // ---- Task comments ------------------------------------------------
        api.MapGet("/tasks/{taskId:int}/comments", async (int taskId, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (!await db.ProjectTasks.AnyAsync(t => t.Id == taskId)) return Results.NotFound();
            var items = await db.TaskComments.Where(c => c.TaskId == taskId).OrderBy(c => c.Id)
                .Select(c => new TaskCommentDto(c.Id, c.Author, c.Initials, c.Body, c.At.ToString("o"))).ToListAsync();
            var canPost = await Permissions.Allows(http, db, cfg, "cap-projects", "E");
            return Results.Ok(new { canPost, comments = items });
        });

        api.MapPost("/tasks/{taskId:int}/comments", async (int taskId, CreateCommentReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            if (!await db.ProjectTasks.AnyAsync(t => t.Id == taskId)) return Results.NotFound();
            if (string.IsNullOrWhiteSpace(req.Body)) return Results.BadRequest(new { error = "Comment can't be empty." });
            var author = Permissions.ActorName(http, cfg);
            var c = new TaskComment
            {
                TaskId = taskId, Author = author, Initials = TaskInitials(author),
                Body = req.Body.Trim(), At = DateTime.UtcNow,
            };
            db.TaskComments.Add(c);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Tasks", "Posted task comment", $"task {taskId}"));
            await db.SaveChangesAsync();
            return Results.Created($"/api/v1/tasks/{taskId}/comments/{c.Id}",
                new TaskCommentDto(c.Id, c.Author, c.Initials, c.Body, c.At.ToString("o")));
        });

        // ---- Epics --------------------------------------------------------
        api.MapGet("/projects/{id}/epics", async (string id, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (!await db.Projects.AnyAsync(p => p.Id == id)) return Results.NotFound();
            var epics = await db.Epics.Where(e => e.ProjectId == id).OrderBy(e => e.Ord).ToListAsync();
            var canEdit = await Permissions.Allows(http, db, cfg, "cap-projects", "E");
            var canCreate = await Permissions.Allows(http, db, cfg, "cap-schedule", "E");
            return Results.Ok(new EpicsDto(canEdit, epics.Select(ToEpicDto).ToList(), canCreate));
        });

        api.MapPost("/projects/{id}/epics", async (string id, CreateEpicReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-schedule", "E") is { } denied) return denied;
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

    static ProjectTaskDto ToDto(ProjectTask t, List<Absence>? absences)
    {
        var onLeave = absences is not null && OnLeave(t, absences);
        return new(t.Id, t.Code, t.Name, t.Epic, t.Assignee, t.Status, t.Sprint, t.Baseline, t.Priority,
            t.StartDate, t.TargetDate, t.Points, t.Size, t.EstimateHours, onLeave);
    }

    // The assignee is "on leave" if any of their absences overlaps the task's
    // scheduled window [StartDate, TargetDate]. ISO dates compare correctly as
    // strings. Needs both a named assignee and at least one bounded date.
    static bool OnLeave(ProjectTask t, List<Absence> absences)
    {
        if (string.IsNullOrWhiteSpace(t.Assignee) || t.Assignee == "Unassigned") return false;
        var start = t.StartDate;
        var end = string.IsNullOrWhiteSpace(t.TargetDate) ? t.StartDate : t.TargetDate;
        if (string.IsNullOrWhiteSpace(start) && string.IsNullOrWhiteSpace(end)) return false;
        if (string.IsNullOrWhiteSpace(start)) start = end;
        if (string.IsNullOrWhiteSpace(end)) end = start;
        foreach (var a in absences)
        {
            if (!string.Equals(a.Person, t.Assignee, StringComparison.OrdinalIgnoreCase)) continue;
            // overlap: a.From <= end && a.To >= start
            if (string.CompareOrdinal(a.From, end) <= 0 && string.CompareOrdinal(a.To, start) >= 0) return true;
        }
        return false;
    }

    static string TaskInitials(string name)
    {
        var parts = name.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length == 0) return "?";
        return parts.Length == 1
            ? parts[0][..Math.Min(2, parts[0].Length)].ToUpperInvariant()
            : (parts[0][0].ToString() + parts[^1][0]).ToUpperInvariant();
    }
}
