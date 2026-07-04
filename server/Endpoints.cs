using Microsoft.EntityFrameworkCore;

namespace Atlas.Api;

public static class Endpoints
{
    // Maps the /api/v1 surface the frontend calls. Grouped under the API base so
    // it sits behind nginx's same-origin /api proxy.
    public static void MapAtlasEndpoints(this WebApplication app)
    {
        var api = app.MapGroup("/api/v1");
        if (app.Configuration.GetValue("Auth:Enabled", false))
            api.RequireAuthorization();

        api.MapAtlasWriteEndpoints();
        api.MapRoleEndpoints();

        api.MapGet("/projects", async (AtlasDbContext db) =>
            await db.Projects.OrderBy(p => p.Id).Select(p => new ProjectDto(
                p.Id, p.Name, p.Dept, p.Owner, p.Methodology, p.Status, p.Health, p.Progress,
                p.Budget, p.Spent, p.Target, p.Blockers.Count)).ToListAsync());

        api.MapGet("/projects/my", async (AtlasDbContext db) =>
            await db.Projects.Where(p => p.StakeholderVisible).OrderBy(p => p.Id).Select(p =>
                new StakeholderProjectDto(p.Id, p.Name, p.Dept, p.Status, p.Health, p.Progress, p.Target, p.Phase))
                .ToListAsync());

        api.MapGet("/projects/{id}", async (string id, AtlasDbContext db) =>
        {
            var p = await db.Projects.FirstOrDefaultAsync(x => x.Id == id);
            return p is null
                ? Results.NotFound()
                : Results.Ok(new ProjectDetailDto(p.Id, p.Name, p.Dept, p.Owner, p.Methodology,
                    p.Status, p.Health, p.Progress, p.Phase, p.Budget, p.Spent, p.Due));
        });

        api.MapGet("/blockers", async (AtlasDbContext db) =>
            await db.Blockers.OrderBy(x => x.Id).Select(x => new BlockerDto(
                x.Id, x.Title, x.ProjectId, x.Project!.Name, x.Owner, x.Status)).ToListAsync());

        api.MapGet("/demands", async (AtlasDbContext db) =>
            await db.Demands.OrderBy(d => d.Id).Select(d => new DemandDto(
                d.Id, d.Title, d.Stage, d.Priority, d.Value, d.Effort, d.Requester, d.Dept, d.Date)).ToListAsync());

        api.MapGet("/demands/my", async (AtlasDbContext db) =>
            await db.Demands.Where(d => d.Mine).OrderByDescending(d => d.Id).Select(d =>
                new MyDemandDto(d.Id, d.Title, d.Dept, d.Priority, d.Date, d.Stage)).ToListAsync());

        api.MapGet("/programs", async (AtlasDbContext db) =>
            await db.Programs.OrderBy(x => x.Id).Select(x => new ProgramDto(
                x.Id, x.Name, x.Owner, x.Goal, x.Status, x.Projects, x.Budget, x.Spent, x.Progress, x.Health))
                .ToListAsync());

        api.MapGet("/products", async (AtlasDbContext db) =>
            await db.Products.OrderBy(x => x.Id)
                .Select(x => new ProductDto(x.Id, x.Name, x.Owner, x.Source, x.Projects,
                    x.Tasks.OrderBy(t => t.Id).Select(t => new TaskDto(t.TaskId, t.Title, t.Status, t.Points, t.DateIso, t.MappedRelease)).ToList(),
                    x.Members.OrderBy(m => m.Id).Select(m => new MemberDto(m.Name, m.Alloc)).ToList(),
                    x.Releases)).ToListAsync());

        api.MapGet("/okrs", async (AtlasDbContext db) =>
            await db.Objectives.OrderBy(o => o.Id)
                .Select(o => new ObjectiveDto(o.Id, o.Title, o.Owner, o.Horizon,
                    o.Krs.OrderBy(k => k.Id).Select(k => new KrDto(k.Id, k.Title, k.Link, k.Progress)).ToList()))
                .ToListAsync());

        api.MapGet("/resources", async (AtlasDbContext db) =>
            await db.Resources.OrderBy(r => r.Id).Select(r => new ResourceDto(
                r.Name, r.Role, r.Dept, r.Initials, r.Color, r.OpsPct, r.ProjectPct, r.ProductPct, r.Over))
                .ToListAsync());

        api.MapGet("/financials", async (AtlasDbContext db) =>
            await db.Projects.OrderBy(p => p.Id).Select(p => new FinRowDto(
                p.Id, p.Name, p.Budget, p.Spent, p.Capex, p.Forecast, p.Budget - p.Forecast, p.Roi,
                p.LaborDev, p.LaborArch, p.LaborInfra,
                p.Budget > 0 ? (int)Math.Round(p.Spent / p.Budget * 100) : 0,
                p.Budget - p.Forecast >= 0)).ToListAsync());

        api.MapGet("/releases", async (AtlasDbContext db) =>
            await db.Releases.OrderBy(r => r.Id).Select(r => new ReleaseDto(
                r.Id, r.Name, r.Reqs, r.Crs, r.Owner, r.Link, r.Scope, r.Date, r.Env, r.Progress, r.Risk, r.Status))
                .ToListAsync());

        api.MapGet("/delivery", async (AtlasDbContext db) =>
            await db.DeliveryReports.ToDictionaryAsync(r => r.Period, r => new DeliveryStatsDto(
                r.Completed, r.InProgress, r.Planned, r.Velocity, r.VelTrend, r.OnTime, r.BlockersCleared,
                r.BlockersOpen, r.Milestones, r.BudgetBurn, r.SpendPct, r.Satisfaction, r.CostPerDeliverable,
                r.ValuePerEuro)));

        api.MapGet("/dashboard", DashboardEndpoint.Build);
    }
}

public static class DashboardEndpoint
{
    static readonly Dictionary<string, string> HealthKey = new()
        { ["green"] = "ontrack", ["amber"] = "atrisk", ["red"] = "critical", ["hold"] = "onhold" };
    static readonly Dictionary<string, string> PipelineKey = new()
        { ["draft"] = "draft", ["backlog"] = "backlog", ["approved"] = "approved", ["progress"] = "inprogress", ["hold"] = "onhold" };

    public static async Task<DashboardDto> Build(AtlasDbContext db)
    {
        var projects = await db.Projects.OrderBy(p => p.Id).ToListAsync();
        var demands = await db.Demands.ToListAsync();

        var kpis = (await db.DashboardKpis.OrderBy(k => k.Ord).ToListAsync())
            .ToDictionary(k => k.Key, k => new KpiValueDto(k.Value, k.Delta, k.Good, k.Spark));

        // Health donut — counts by project status, mapped to the frontend's keys.
        var health = new[] { "ontrack", "atrisk", "critical", "onhold" }
            .ToDictionary(k => k, k => new HealthSegmentDto(
                projects.Count(p => HealthKey.GetValueOrDefault(p.Status) == k)));

        // Pipeline — counts by demand stage, mapped to the frontend's keys.
        var pipeline = new[] { "draft", "backlog", "approved", "inprogress", "onhold" }
            .ToDictionary(k => k, k => new PipelineStageDto(
                demands.Count(d => PipelineKey.GetValueOrDefault(d.Stage) == k)));

        var snap = await db.BudgetSnapshots.FirstOrDefaultAsync();
        var budget = snap is null ? null
            : new BudgetDto(snap.Allocated, snap.Spent, snap.SpentPct, snap.Months, snap.Planned, snap.Actual, snap.Max);

        var projectRows = projects.Select(p => new ProjectRowDto(
            p.Id, p.Name, p.Dept, p.Owner, p.Methodology, p.Status, p.Health, p.Progress, p.Budget, p.Spent)).ToList();

        var attention = projects.Where(p => p.AttentionReason != null)
            .Select(p => new AttentionItemDto(p.Id, p.Name, p.AttentionReason!, p.AttentionSeverity ?? "amber")).ToList();

        var activity = (await db.ActivityEvents.OrderBy(a => a.Ord).ToListAsync())
            .Select(a => new ActivityEventDto(a.Who, a.Action, a.Time, a.Initials, a.Color)).ToList();

        var tasks = (await db.MyTasks.OrderBy(t => t.Ord).ToListAsync())
            .Select(t => new TaskRowDto(t.Name, t.Sprint, t.Status)).ToList();

        var approvals = demands.Where(d => d.PendingApproval)
            .Select(d => new ApprovalRowDto(d.Id, d.Title, d.Requester, d.Dept, d.Value)).ToList();

        return new DashboardDto(kpis, health, budget, pipeline, projectRows, attention, activity, tasks, approvals);
    }
}
