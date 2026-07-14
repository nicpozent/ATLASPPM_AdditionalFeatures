using Microsoft.EntityFrameworkCore;

namespace Atlas.Api;

public record CreateTestPlanReq(string Name, string? Stage, int? Cases, int? Passed, int? Failed, int? Blocked, int? JiraBoardId);
public record UpdateTestPlanReq(string? Name, string? Stage, int? Cases, int? Passed, int? Failed, int? Blocked, int? JiraBoardId);
public record CreateDefectReq(string Title, string? Severity, string? Owner, string? Status, string? Test);
public record UpdateDefectReq(string? Title, string? Severity, string? Owner, string? Status, string? Test);
public record CreatePlanTaskReq(string Title, string? Status, string? Assignee,
    string? Description, string? StartDate, string? DueDate, double? EstimateHours);
public record UpdatePlanTaskReq(string? Title, string? Status, string? Assignee,
    string? Description, string? StartDate, string? DueDate, double? EstimateHours);

// ============================================================================
//  Quality — test plans (execution breakdown) and defects for a project.
//  Editing requires Edit on "Quality, tests & defects" (cap-quality). Totals are
//  computed from the plans and defects.
// ============================================================================
public static class Quality
{
    static readonly string[] Severities = { "Critical", "High", "Medium", "Low" };
    static readonly string[] DefectStatuses = { "Open", "In progress", "Resolved", "Closed" };
    static readonly string[] Stages = { "Unit", "Integration", "System", "UAT", "Regression", "Performance", "Security" };
    static readonly string[] PlanTaskStatuses = { "Not run", "In test", "Passed", "Failed", "Blocked" };

    public static void MapQualityEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/projects/{id}/quality", async (string id, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (!await db.Projects.AnyAsync(p => p.Id == id)) return Results.NotFound();
            var plans = await db.TestPlans.Where(p => p.ProjectId == id).Include(p => p.Tasks).OrderBy(p => p.Ord).ToListAsync();
            var defects = await db.Defects.Where(d => d.ProjectId == id).OrderBy(d => d.Ord).ToListAsync();
            var canEdit = await Permissions.Allows(http, db, cfg, "cap-quality", "E");

            var cases = plans.Sum(p => p.Cases);
            var executed = plans.Sum(p => p.Passed + p.Failed + p.Blocked);
            var passed = plans.Sum(p => p.Passed);
            var failed = plans.Sum(p => p.Failed);
            var totals = new QualityTotalsDto(
                cases,
                cases == 0 ? 0 : (int)Math.Round(100.0 * executed / cases),
                executed == 0 ? 0 : (int)Math.Round(100.0 * passed / executed),
                failed,
                defects.Count(d => d.Status is "Open" or "In progress"));

            return Results.Ok(new QualityDto(canEdit, totals, plans.Select(ToPlanDto).ToList(),
                defects.Select(d => new DefectDto(d.Id, d.Code, d.Title, d.Severity, d.Owner, d.Status, d.Test)).ToList()));
        });

        api.MapPost("/projects/{id}/test-plans", async (string id, CreateTestPlanReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-quality", "E") is { } denied) return denied;
            if (!await db.Projects.AnyAsync(p => p.Id == id)) return Results.NotFound();
            if (string.IsNullOrWhiteSpace(req.Name)) return Results.BadRequest(new { error = "Name is required." });
            var cases = Math.Max(0, req.Cases ?? 0);
            var passed = Math.Max(0, req.Passed ?? 0);
            var failed = Math.Max(0, req.Failed ?? 0);
            var blocked = Math.Max(0, req.Blocked ?? 0);
            if (passed + failed + blocked > cases) return Results.BadRequest(new { error = "Passed + failed + blocked cannot exceed total cases." });
            var ord = (await db.TestPlans.Where(p => p.ProjectId == id).Select(p => (int?)p.Ord).MaxAsync() ?? 0) + 1;
            var plan = new TestPlan { ProjectId = id, Ord = ord, Name = req.Name.Trim(),
                Stage = Stages.Contains(req.Stage) ? req.Stage! : "System",
                Cases = cases, Passed = passed, Failed = failed, Blocked = blocked,
                JiraBoardId = Math.Max(0, req.JiraBoardId ?? 0) };
            db.TestPlans.Add(plan);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Quality", "Added test plan", $"{id} · {plan.Name}"));
            await db.SaveChangesAsync();
            return Results.Created($"/api/v1/projects/{id}/test-plans/{plan.Id}", ToPlanDto(plan));
        });

        api.MapPost("/projects/{id}/defects", async (string id, CreateDefectReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-quality", "E") is { } denied) return denied;
            if (!await db.Projects.AnyAsync(p => p.Id == id)) return Results.NotFound();
            if (string.IsNullOrWhiteSpace(req.Title)) return Results.BadRequest(new { error = "Title is required." });
            var ord = (await db.Defects.Where(d => d.ProjectId == id).Select(d => (int?)d.Ord).MaxAsync() ?? 0) + 1;
            var def = new Defect
            {
                ProjectId = id, Ord = ord, Code = $"DEF-{ord:00}", Title = req.Title.Trim(),
                Severity = Severities.Contains(req.Severity) ? req.Severity! : "Medium",
                Owner = string.IsNullOrWhiteSpace(req.Owner) ? "—" : req.Owner!.Trim(),
                Status = DefectStatuses.Contains(req.Status) ? req.Status! : "Open",
                Test = req.Test?.Trim() ?? "",
            };
            db.Defects.Add(def);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Quality", "Logged defect", $"{id} · {def.Code} {def.Title}"));
            await db.SaveChangesAsync();
            return Results.Created($"/api/v1/projects/{id}/defects/{def.Id}",
                new DefectDto(def.Id, def.Code, def.Title, def.Severity, def.Owner, def.Status, def.Test));
        });

        api.MapPatch("/test-plans/{planId:int}", async (int planId, UpdateTestPlanReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-quality", "E") is { } denied) return denied;
            var plan = await db.TestPlans.FindAsync(planId);
            if (plan is null) return Results.NotFound();
            if (req.Name is not null)
            {
                if (string.IsNullOrWhiteSpace(req.Name)) return Results.BadRequest(new { error = "Name is required." });
                plan.Name = req.Name.Trim();
            }
            if (req.Stage is not null)
            {
                if (!Stages.Contains(req.Stage)) return Results.BadRequest(new { error = "Unknown stage." });
                plan.Stage = req.Stage;
            }
            if (req.Cases is not null) plan.Cases = Math.Max(0, req.Cases.Value);
            if (req.Passed is not null) plan.Passed = Math.Max(0, req.Passed.Value);
            if (req.Failed is not null) plan.Failed = Math.Max(0, req.Failed.Value);
            if (req.Blocked is not null) plan.Blocked = Math.Max(0, req.Blocked.Value);
            if (req.JiraBoardId is not null) plan.JiraBoardId = Math.Max(0, req.JiraBoardId.Value);
            if (plan.Passed + plan.Failed + plan.Blocked > plan.Cases)
                return Results.BadRequest(new { error = "Passed + failed + blocked cannot exceed total cases." });
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Quality", "Updated test plan", $"{plan.ProjectId} · {plan.Name}"));
            await db.SaveChangesAsync();
            return Results.Ok(ToPlanDto(plan));
        });

        api.MapDelete("/test-plans/{planId:int}", async (int planId, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-quality", "E") is { } denied) return denied;
            var plan = await db.TestPlans.FindAsync(planId);
            if (plan is null) return Results.NotFound();
            db.TestPlans.Remove(plan);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Quality", "Removed test plan", $"{plan.ProjectId} · {plan.Name}"));
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        api.MapPatch("/defects/{defectId:int}", async (int defectId, UpdateDefectReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-quality", "E") is { } denied) return denied;
            var def = await db.Defects.FindAsync(defectId);
            if (def is null) return Results.NotFound();
            if (req.Title is not null)
            {
                if (string.IsNullOrWhiteSpace(req.Title)) return Results.BadRequest(new { error = "Title is required." });
                def.Title = req.Title.Trim();
            }
            if (req.Severity is not null)
            {
                if (!Severities.Contains(req.Severity)) return Results.BadRequest(new { error = "Unknown severity." });
                def.Severity = req.Severity;
            }
            if (req.Status is not null)
            {
                if (!DefectStatuses.Contains(req.Status)) return Results.BadRequest(new { error = "Unknown status." });
                def.Status = req.Status;
            }
            if (req.Owner is not null) def.Owner = string.IsNullOrWhiteSpace(req.Owner) ? "—" : req.Owner.Trim();
            if (req.Test is not null) def.Test = req.Test.Trim();
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Quality", "Updated defect", $"{def.ProjectId} · {def.Code} → {def.Status}"));
            await db.SaveChangesAsync();
            return Results.Ok(new DefectDto(def.Id, def.Code, def.Title, def.Severity, def.Owner, def.Status, def.Test));
        });

        api.MapDelete("/defects/{defectId:int}", async (int defectId, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-quality", "E") is { } denied) return denied;
            var def = await db.Defects.FindAsync(defectId);
            if (def is null) return Results.NotFound();
            db.Defects.Remove(def);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Quality", "Removed defect", $"{def.ProjectId} · {def.Code}"));
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        // ---- Test-plan tasks (test cases tracked under a plan) ------------
        api.MapPost("/test-plans/{planId:int}/tasks", async (int planId, CreatePlanTaskReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-quality", "E") is { } denied) return denied;
            if (!await db.TestPlans.AnyAsync(p => p.Id == planId)) return Results.NotFound();
            if (string.IsNullOrWhiteSpace(req.Title)) return Results.BadRequest(new { error = "Title is required." });
            var ord = (await db.TestPlanTasks.Where(t => t.TestPlanId == planId).Select(t => (int?)t.Ord).MaxAsync() ?? 0) + 1;
            var t = new TestPlanTask
            {
                TestPlanId = planId, Ord = ord, Title = req.Title.Trim(),
                Status = PlanTaskStatuses.Contains(req.Status) ? req.Status! : "Not run",
                Assignee = req.Assignee?.Trim() ?? "",
                Description = req.Description?.Trim() ?? "",
                StartDate = req.StartDate?.Trim() ?? "",
                DueDate = req.DueDate?.Trim() ?? "",
                EstimateHours = Math.Max(0, req.EstimateHours ?? 0),
            };
            db.TestPlanTasks.Add(t);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Quality", "Added test-plan task", $"plan {planId} · {t.Title}"));
            await db.SaveChangesAsync();
            return Results.Ok(ToTaskDto(t));
        });

        api.MapPatch("/test-plan-tasks/{taskId:int}", async (int taskId, UpdatePlanTaskReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-quality", "E") is { } denied) return denied;
            var t = await db.TestPlanTasks.FindAsync(taskId);
            if (t is null) return Results.NotFound();
            if (req.Title is not null)
            {
                if (string.IsNullOrWhiteSpace(req.Title)) return Results.BadRequest(new { error = "Title is required." });
                t.Title = req.Title.Trim();
            }
            if (req.Status is not null)
            {
                if (!PlanTaskStatuses.Contains(req.Status)) return Results.BadRequest(new { error = "Unknown status." });
                t.Status = req.Status;
            }
            if (req.Assignee is not null) t.Assignee = req.Assignee.Trim();
            if (req.Description is not null) t.Description = req.Description.Trim();
            if (req.StartDate is not null) t.StartDate = req.StartDate.Trim();
            if (req.DueDate is not null) t.DueDate = req.DueDate.Trim();
            if (req.EstimateHours is not null) t.EstimateHours = Math.Max(0, req.EstimateHours.Value);
            await db.SaveChangesAsync();
            return Results.Ok(ToTaskDto(t));
        });

        api.MapDelete("/test-plan-tasks/{taskId:int}", async (int taskId, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-quality", "E") is { } denied) return denied;
            var t = await db.TestPlanTasks.FindAsync(taskId);
            if (t is null) return Results.NotFound();
            db.TestPlanTasks.Remove(t);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        // Pull the plan's linked Jira board into its tasks — reuses the project
        // Jira sync's client/paging/parsing (idempotent by issue key). Requires
        // Jira configured and a board linked on the plan.
        api.MapPost("/test-plans/{planId:int}/jira-ingest", async (int planId, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-quality", "E") is { } denied) return denied;
            var plan = await db.TestPlans.FindAsync(planId);
            if (plan is null) return Results.NotFound();
            if (!Jira.JiraConfigured(cfg)) return Results.BadRequest(new { error = "Jira isn't configured — set it up in Integrations first." });
            if (plan.JiraBoardId <= 0) return Results.BadRequest(new { error = "Link a Jira board to this plan first." });
            try
            {
                using var c = Jira.Client(cfg);
                var res = await Jira.IngestTestTasksAsync(db, cfg, c, plan);
                db.AuditEvents.Add(Permissions.Audit(http, cfg, "Quality", "Ingested Jira test tasks",
                    $"plan {planId} · board {plan.JiraBoardId} · +{res.Added}/~{res.Updated}/-{res.Removed}"));
                await db.SaveChangesAsync();
                return Results.Ok(new { res.Added, res.Updated, res.Removed, res.Truncated });
            }
            catch (Exception ex)
            {
                return Results.Json(new { error = $"Jira ingest failed: {ex.Message}" }, statusCode: StatusCodes.Status502BadGateway);
            }
        });
    }

    static TestPlanDto ToPlanDto(TestPlan p)
    {
        var notRun = Math.Max(0, p.Cases - p.Passed - p.Failed - p.Blocked);
        var execPct = p.Cases == 0 ? 0 : (int)Math.Round(100.0 * (p.Passed + p.Failed + p.Blocked) / p.Cases);
        return new TestPlanDto(p.Id, p.Name, p.Stage, p.Cases, p.Passed, p.Failed, p.Blocked, notRun, execPct,
            p.JiraBoardId, p.Tasks.OrderBy(t => t.Ord).Select(ToTaskDto).ToList());
    }

    static TestPlanTaskDto ToTaskDto(TestPlanTask t) =>
        new(t.Id, t.Title, t.Status, t.Assignee, t.Description, t.StartDate, t.DueDate, t.EstimateHours, t.JiraKey);
}
