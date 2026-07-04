using Microsoft.EntityFrameworkCore;

namespace Atlas.Api;

public record CreateTestPlanReq(string Name, int? Cases, int? Passed, int? Failed, int? Blocked);
public record CreateDefectReq(string Title, string? Severity, string? Owner, string? Status, string? Test);

// ============================================================================
//  Quality — test plans (execution breakdown) and defects for a project.
//  Editing requires Edit on "Projects & tasks" (cap-projects). Totals are
//  computed from the plans and defects.
// ============================================================================
public static class Quality
{
    static readonly string[] Severities = { "Critical", "High", "Medium", "Low" };
    static readonly string[] DefectStatuses = { "Open", "In progress", "Resolved", "Closed" };

    public static void MapQualityEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/projects/{id}/quality", async (string id, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (!await db.Projects.AnyAsync(p => p.Id == id)) return Results.NotFound();
            var plans = await db.TestPlans.Where(p => p.ProjectId == id).OrderBy(p => p.Ord).ToListAsync();
            var defects = await db.Defects.Where(d => d.ProjectId == id).OrderBy(d => d.Ord).ToListAsync();
            var canEdit = await Permissions.Allows(http, db, cfg, "cap-projects", "E");

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
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            if (!await db.Projects.AnyAsync(p => p.Id == id)) return Results.NotFound();
            if (string.IsNullOrWhiteSpace(req.Name)) return Results.BadRequest(new { error = "Name is required." });
            var cases = Math.Max(0, req.Cases ?? 0);
            var passed = Math.Max(0, req.Passed ?? 0);
            var failed = Math.Max(0, req.Failed ?? 0);
            var blocked = Math.Max(0, req.Blocked ?? 0);
            if (passed + failed + blocked > cases) return Results.BadRequest(new { error = "Passed + failed + blocked cannot exceed total cases." });
            var ord = (await db.TestPlans.Where(p => p.ProjectId == id).Select(p => (int?)p.Ord).MaxAsync() ?? 0) + 1;
            var plan = new TestPlan { ProjectId = id, Ord = ord, Name = req.Name.Trim(), Cases = cases, Passed = passed, Failed = failed, Blocked = blocked };
            db.TestPlans.Add(plan);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Quality", "Added test plan", $"{id} · {plan.Name}"));
            await db.SaveChangesAsync();
            return Results.Created($"/api/v1/projects/{id}/test-plans/{plan.Id}", ToPlanDto(plan));
        });

        api.MapPost("/projects/{id}/defects", async (string id, CreateDefectReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
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
    }

    static TestPlanDto ToPlanDto(TestPlan p)
    {
        var notRun = Math.Max(0, p.Cases - p.Passed - p.Failed - p.Blocked);
        var execPct = p.Cases == 0 ? 0 : (int)Math.Round(100.0 * (p.Passed + p.Failed + p.Blocked) / p.Cases);
        return new TestPlanDto(p.Id, p.Name, p.Cases, p.Passed, p.Failed, p.Blocked, notRun, execPct);
    }
}
