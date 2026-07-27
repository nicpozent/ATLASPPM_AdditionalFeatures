using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace Atlas.Api.Delivery;

public record CreateTaskReq(string Name, string? Epic, string? Assignee, string? Status, string? Sprint, string? Baseline, string? Priority,
    string? StartDate, string? TargetDate, int? Points, string? Size, int? EstimateHours);
public record UpdateTaskReq(string? Name, string? Epic, string? Assignee, string? Status, string? Sprint, string? Baseline, string? Priority,
    string? StartDate, string? TargetDate, int? Points, string? Size, int? EstimateHours);
public record CreateEpicReq(string Name, int? Stories, int? Done, string? Status, string? DependsOn, List<int>? DependsOnIds);
public record UpdateEpicReq(string? Name, int? Stories, int? Done, string? Status, string? DependsOn, List<int>? DependsOnIds);

// ============================================================================
//  Project tasks — the board (Kanban) & table on Project → Tasks. Creating and
//  moving tasks requires Edit on "Projects & tasks" (cap-projects); status
//  changes come from drag-and-drop on the board.
// ============================================================================
public static class Tasks
{
    // A project's task board is one real-time room; mutations ping it so open
    // boards refetch and stay in sync (presence/cursors come from the hub).
    static string Room(string projectId) => $"tasks:{projectId}";

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
            // Creating and moving cards are both scheduling actions — gated by Edit
            // on "Project schedule" (cap-schedule), held only by Platform Admin, PMO,
            // Project Manager and PM Lead (ADR-0065). Collaboration (presence/cursors/
            // live refresh) stays open to every role; only the writes are scoped.
            var canCreate = await Permissions.Allows(http, db, cfg, "cap-schedule", "E");
            var canMove = canCreate;
            var taskIds = tasks.Select(t => t.Id).ToList();
            var attCounts = (await db.TaskAttachments.Where(a => taskIds.Contains(a.TaskId))
                .GroupBy(a => a.TaskId).Select(g => new { g.Key, N = g.Count() }).ToListAsync())
                .ToDictionary(x => x.Key, x => x.N);
            var comCounts = (await db.TaskComments.Where(c => taskIds.Contains(c.TaskId))
                .GroupBy(c => c.TaskId).Select(g => new { g.Key, N = g.Count() }).ToListAsync())
                .ToDictionary(x => x.Key, x => x.N);
            // Onboarded people: resource pool + Entra-synced directory members.
            // A task assignee not in this set (e.g. pulled from Jira but never
            // onboarded) is flagged so the UI can warn.
            var known = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var r in await db.Resources.Select(x => x.Name).ToListAsync()) if (!string.IsNullOrWhiteSpace(r)) known.Add(r.Trim());
            foreach (var m in await db.TeamMembers.Select(x => new { x.DisplayName, x.Email }).ToListAsync())
            { if (!string.IsNullOrWhiteSpace(m.DisplayName)) known.Add(m.DisplayName.Trim()); if (!string.IsNullOrWhiteSpace(m.Email)) known.Add(m.Email.Trim()); }
            return Results.Ok(new ProjectTasksDto(canEdit, tasks.Select(t => ToDto(t, absences, known, attCounts, comCounts)).ToList(), canCreate, canMove));
        });

        api.MapPost("/projects/{id}/tasks", async (string id, CreateTaskReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http, IHubContext<BoardHub> hub) =>
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
            await BoardHub.NotifyRoomAsync(hub, Room(id));
            return Results.Created($"/api/v1/projects/{id}/tasks/{task.Id}", ToDto(task, null));
        });

        api.MapPatch("/tasks/{taskId:int}", async (int taskId, UpdateTaskReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http, IHubContext<BoardHub> hub) =>
        {
            // Moving a card between board columns (a status-only change) is a
            // scheduling action — Edit on "Project schedule" (cap-schedule), i.e.
            // Platform Admin, PMO, Project Manager and PM Lead only (ADR-0065).
            // Every OTHER field change (rename, assignee, estimate…) requires Edit
            // on cap-projects. Live collaboration (presence/cursors/refresh) is open
            // to all roles via the hub; only the write itself is scoped.
            var statusOnly = req.Status is not null && req.Name is null && req.Epic is null && req.Assignee is null
                && req.Sprint is null && req.Baseline is null && req.Priority is null && req.StartDate is null
                && req.TargetDate is null && req.Points is null && req.Size is null && req.EstimateHours is null;
            var moveCap = statusOnly ? "cap-schedule" : "cap-projects";
            if (await Permissions.Deny(http, db, cfg, moveCap, "E") is { } denied) return denied;
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
                if (task.Status != req.Status)
                    db.AuditEvents.Add(Permissions.Audit(http, cfg, "Tasks", "Moved task", $"{task.ProjectId} · {task.Code} {task.Status} → {req.Status}"));
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
            await BoardHub.NotifyRoomAsync(hub, Room(task.ProjectId));
            var absences = await db.Absences.Where(a => a.ProjectId == task.ProjectId).ToListAsync();
            return Results.Ok(ToDto(task, absences));
        });

        api.MapDelete("/tasks/{taskId:int}", async (int taskId, AtlasDbContext db, IConfiguration cfg, HttpContext http, IHubContext<BoardHub> hub) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            var task = await db.ProjectTasks.FindAsync(taskId);
            if (task is null) return Results.NotFound();
            var comments = await db.TaskComments.Where(c => c.TaskId == taskId).ToListAsync();
            db.TaskComments.RemoveRange(comments);
            db.ProjectTasks.Remove(task);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Tasks", "Deleted task", $"{task.ProjectId} · {task.Code} {task.Name}"));
            await db.SaveChangesAsync();
            await BoardHub.NotifyRoomAsync(hub, Room(task.ProjectId));
            return Results.NoContent();
        });

        // ---- Task comments ------------------------------------------------
        api.MapGet("/tasks/{taskId:int}/comments", async (int taskId, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (!await db.ProjectTasks.AnyAsync(t => t.Id == taskId)) return Results.NotFound();
            var items = await db.TaskComments.Where(c => c.TaskId == taskId).OrderBy(c => c.At).ThenBy(c => c.Id)
                .Select(c => new TaskCommentDto(c.Id, c.Author, c.Initials, c.Body, c.At.ToString("o"), c.JiraId != "")).ToListAsync();
            var canPost = await Permissions.Allows(http, db, cfg, "cap-projects", "E");
            return Results.Ok(new { canPost, comments = items });
        });

        // ---- Task attachments (files mirrored from Jira) ------------------
        api.MapGet("/tasks/{taskId:int}/attachments", async (int taskId, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            // Task detail is internal-only (stakeholders have no task board).
            if (await Permissions.Deny(http, db, cfg, "cap-dashboards", "V") is { } deny) return deny;
            if (!await db.ProjectTasks.AnyAsync(t => t.Id == taskId)) return Results.NotFound();
            var items = await db.TaskAttachments.Where(a => a.TaskId == taskId).OrderBy(a => a.Id)
                .Select(a => new TaskAttachmentDto(a.Id, a.FileName, a.ContentType, a.Size, a.Author, a.CreatedAt)).ToListAsync();
            return Results.Ok(items);
        });

        api.MapGet("/task-attachments/{attId:int}", async (int attId, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-dashboards", "V") is { } deny) return deny;
            var a = await db.TaskAttachments.FindAsync(attId);
            return a is null ? Results.NotFound() : Results.File(a.Bytes, a.ContentType, a.FileName);
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
            var tasks = await db.ProjectTasks.Where(t => t.ProjectId == id && t.Epic != "").ToListAsync();
            var canEdit = await Permissions.Allows(http, db, cfg, "cap-projects", "E");
            var canCreate = await Permissions.Allows(http, db, cfg, "cap-schedule", "E");
            return Results.Ok(new EpicsDto(canEdit, epics.Select(e => ToEpicDto(e, epics, tasks)).ToList(), canCreate));
        });

        api.MapPost("/projects/{id}/epics", async (string id, CreateEpicReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-schedule", "E") is { } denied) return denied;
            if (!await db.Projects.AnyAsync(p => p.Id == id)) return Results.NotFound();
            if (string.IsNullOrWhiteSpace(req.Name)) return Results.BadRequest(new { error = "Name is required." });
            var stories = Math.Max(0, req.Stories ?? 0);
            var done = Math.Clamp(req.Done ?? 0, 0, stories);
            var ord = (await db.Epics.Where(e => e.ProjectId == id).Select(e => (int?)e.Ord).MaxAsync() ?? 0) + 1;
            var validIds = await db.Epics.Where(x => x.ProjectId == id).Select(x => x.Id).ToListAsync();
            var epic = new Epic
            {
                ProjectId = id, Ord = ord, Name = req.Name.Trim(), Stories = stories, Done = done,
                Status = EpicStatuses.Contains(req.Status) ? req.Status! : "Upcoming",
                DependsOn = req.DependsOn?.Trim() ?? "",
                DependsOnIds = (req.DependsOnIds ?? new()).Where(validIds.Contains).Distinct().ToList(),
            };
            db.Epics.Add(epic);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Epics", "Created epic", $"{id} · {epic.Name}"));
            await db.SaveChangesAsync();
            var all = await db.Epics.Where(x => x.ProjectId == id).ToListAsync();
            return Results.Created($"/api/v1/projects/{id}/epics/{epic.Id}", ToEpicDto(epic, all));
        });

        api.MapPatch("/epics/{epicId:int}", async (int epicId, UpdateEpicReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            var epic = await db.Epics.FindAsync(epicId);
            if (epic is null) return Results.NotFound();
            if (req.Name is not null)
            {
                if (string.IsNullOrWhiteSpace(req.Name)) return Results.BadRequest(new { error = "Name is required." });
                epic.Name = req.Name.Trim();
            }
            if (req.Stories is not null) epic.Stories = Math.Max(0, req.Stories.Value);
            if (req.Done is not null) epic.Done = Math.Max(0, req.Done.Value);
            epic.Done = Math.Clamp(epic.Done, 0, epic.Stories);
            if (req.Status is not null)
            {
                if (!EpicStatuses.Contains(req.Status)) return Results.BadRequest(new { error = "Unknown status." });
                epic.Status = req.Status;
            }
            if (req.DependsOn is not null) epic.DependsOn = req.DependsOn.Trim();
            if (req.DependsOnIds is not null)
            {
                var validIds = await db.Epics.Where(x => x.ProjectId == epic.ProjectId && x.Id != epic.Id).Select(x => x.Id).ToListAsync();
                epic.DependsOnIds = req.DependsOnIds.Where(validIds.Contains).Distinct().ToList();
            }
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Epics", "Updated epic", $"{epic.ProjectId} · {epic.Name}"));
            await db.SaveChangesAsync();
            var all = await db.Epics.Where(x => x.ProjectId == epic.ProjectId).ToListAsync();
            return Results.Ok(ToEpicDto(epic, all));
        });

        api.MapDelete("/epics/{epicId:int}", async (int epicId, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            var epic = await db.Epics.FindAsync(epicId);
            if (epic is null) return Results.NotFound();
            // Clear this epic from any other epic's dependency list.
            var dependents = await db.Epics.Where(x => x.ProjectId == epic.ProjectId).ToListAsync();
            foreach (var d in dependents.Where(d => d.DependsOnIds.Contains(epicId)))
                d.DependsOnIds = d.DependsOnIds.Where(x => x != epicId).ToList();
            db.Epics.Remove(epic);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Epics", "Deleted epic", $"{epic.ProjectId} · {epic.Name}"));
            await db.SaveChangesAsync();
            return Results.NoContent();
        });
    }

    static EpicDto ToEpicDto(Epic e, List<Epic> all, List<ProjectTask>? tasks = null)
    {
        // Prefer aggregating from tasks linked to this epic (by name); fall back
        // to the epic's manual Stories/Done when no tasks reference it.
        var linked = tasks?.Where(t => t.Epic == e.Name).ToList();
        var stories = linked is { Count: > 0 } ? linked.Count : e.Stories;
        var done = linked is { Count: > 0 } ? linked.Count(t => t.Status == "Done") : e.Done;
        var pct = stories == 0 ? 0 : (int)Math.Round(100.0 * done / stories);
        var deps = e.DependsOnIds
            .Select(depId => all.FirstOrDefault(x => x.Id == depId))
            .Where(x => x is not null)
            .Select(x => new EpicRefDto(x!.Id, x.Name))
            .ToList();
        return new EpicDto(e.Id, e.Name, stories, done, pct, e.Status, e.DependsOn, deps,
            e.Description, e.EpicKey, e.JiraUrl, e.JiraKey);
    }

    static ProjectTaskDto ToDto(ProjectTask t, List<Absence>? absences, HashSet<string>? known = null,
        IReadOnlyDictionary<int, int>? attachmentCounts = null, IReadOnlyDictionary<int, int>? commentCounts = null)
    {
        var onLeave = absences is not null && OnLeave(t, absences);
        // Unknown only when we were given the onboarded set and the assignee
        // (a real person) isn't in it — otherwise assume known.
        var unassigned = string.IsNullOrWhiteSpace(t.Assignee) || t.Assignee == "Unassigned";
        var assigneeKnown = known is null || unassigned || known.Contains(t.Assignee.Trim());
        var atts = attachmentCounts is not null && attachmentCounts.TryGetValue(t.Id, out var ac) ? ac : 0;
        var coms = commentCounts is not null && commentCounts.TryGetValue(t.Id, out var cc) ? cc : 0;
        return new(t.Id, t.Code, t.Name, t.Epic, t.Assignee, t.Status, t.Sprint, t.Baseline, t.Priority,
            t.StartDate, t.TargetDate, t.Points, t.Size, t.EstimateHours, onLeave, assigneeKnown,
            t.Description, t.IssueType, t.Reporter, t.StatusName, t.Resolution,
            t.Labels, t.Components, t.FixVersions, t.ParentKey, t.EpicKey,
            t.TimeSpentHours, t.JiraKey, t.JiraUrl, t.JiraCreated, t.JiraUpdated, atts, coms,
            t.StartedAt, t.ResolvedAt);
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
