using Microsoft.EntityFrameworkCore;

namespace Atlas.Api;

// ---- Request bodies --------------------------------------------------------
public record CreateDemandReq(string Title, string? Dept, string? Priority, int? Value, int? Effort);
public record UpdateDemandStageReq(string Stage);
public record CreateBlockerReq(string Title, string ProjectId, string? Owner, string? Status);
public record UpdateBlockerStatusReq(string Status);
public record CreateProjectReq(string Name, string? Dept, string? Owner, string? Methodology);
public record CreateProgramReq(string Name, string? Owner, string? Goal, string? Status, List<string>? Projects);
public record CreateObjectiveReq(string Title, string? Owner, string? Horizon);

public static class WriteEndpoints
{
    static readonly string[] Stages = { "draft", "backlog", "approved", "progress", "hold" };
    static readonly string[] BlockerStatuses = { "Active", "In progress", "Resolved" };

    public static void MapAtlasWriteEndpoints(this RouteGroupBuilder api)
    {
        // ---- Demands -------------------------------------------------------
        api.MapPost("/demands", async (CreateDemandReq req, AtlasDbContext db) =>
        {
            if (string.IsNullOrWhiteSpace(req.Title)) return Results.BadRequest(new { error = "Title is required." });
            var d = new Demand
            {
                Id = await NextId(db.Demands.Select(x => x.Id), "DM-", db),
                Title = req.Title.Trim(),
                Dept = string.IsNullOrWhiteSpace(req.Dept) ? "Unassigned" : req.Dept!.Trim(),
                Priority = Clamp(req.Priority, new[] { "High", "Medium", "Critical", "Low" }, "Medium"),
                Value = Math.Clamp(req.Value ?? 3, 1, 5),
                Effort = Math.Clamp(req.Effort ?? 3, 1, 5),
                Stage = "draft",
                Requester = "You",
                Mine = true,
                Date = DateTime.UtcNow.ToString("MMM dd"),
            };
            db.Demands.Add(d);
            await db.SaveChangesAsync();
            return Results.Created($"/api/v1/demands/{d.Id}",
                new DemandDto(d.Id, d.Title, d.Stage, d.Priority, d.Value, d.Effort, d.Requester, d.Dept, d.Date));
        });

        api.MapPatch("/demands/{id}", async (string id, UpdateDemandStageReq req, AtlasDbContext db) =>
        {
            if (!Stages.Contains(req.Stage)) return Results.BadRequest(new { error = "Unknown stage." });
            var d = await db.Demands.FindAsync(id);
            if (d is null) return Results.NotFound();
            d.Stage = req.Stage;
            await db.SaveChangesAsync();
            return Results.Ok(new DemandDto(d.Id, d.Title, d.Stage, d.Priority, d.Value, d.Effort, d.Requester, d.Dept, d.Date));
        });

        api.MapDelete("/demands/{id}", async (string id, AtlasDbContext db) =>
        {
            var d = await db.Demands.FindAsync(id);
            if (d is null) return Results.NotFound();
            db.Demands.Remove(d);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        // ---- Blockers ------------------------------------------------------
        api.MapPost("/blockers", async (CreateBlockerReq req, AtlasDbContext db) =>
        {
            if (string.IsNullOrWhiteSpace(req.Title)) return Results.BadRequest(new { error = "Title is required." });
            var project = await db.Projects.FindAsync(req.ProjectId);
            if (project is null) return Results.BadRequest(new { error = "Unknown projectId." });
            var b = new Blocker
            {
                Id = await NextId(db.Blockers.Select(x => x.Id), "BLK-", db),
                Title = req.Title.Trim(),
                ProjectId = req.ProjectId,
                Owner = string.IsNullOrWhiteSpace(req.Owner) ? project.Owner : req.Owner!.Trim(),
                Status = Clamp(req.Status, BlockerStatuses, "Active"),
            };
            db.Blockers.Add(b);
            await db.SaveChangesAsync();
            return Results.Created($"/api/v1/blockers/{b.Id}",
                new BlockerDto(b.Id, b.Title, b.ProjectId, project.Name, b.Owner, b.Status));
        });

        api.MapPatch("/blockers/{id}", async (string id, UpdateBlockerStatusReq req, AtlasDbContext db) =>
        {
            if (!BlockerStatuses.Contains(req.Status)) return Results.BadRequest(new { error = "Unknown status." });
            var b = await db.Blockers.Include(x => x.Project).FirstOrDefaultAsync(x => x.Id == id);
            if (b is null) return Results.NotFound();
            b.Status = req.Status;
            await db.SaveChangesAsync();
            return Results.Ok(new BlockerDto(b.Id, b.Title, b.ProjectId, b.Project!.Name, b.Owner, b.Status));
        });

        // ---- Projects ------------------------------------------------------
        api.MapPost("/projects", async (CreateProjectReq req, AtlasDbContext db) =>
        {
            if (string.IsNullOrWhiteSpace(req.Name)) return Results.BadRequest(new { error = "Name is required." });
            var p = new Project
            {
                Id = await NextId(db.Projects.Select(x => x.Id), "PRJ-", db),
                Name = req.Name.Trim(),
                Dept = string.IsNullOrWhiteSpace(req.Dept) ? "Unassigned" : req.Dept!.Trim(),
                Owner = string.IsNullOrWhiteSpace(req.Owner) ? "Unassigned" : req.Owner!.Trim(),
                Methodology = string.IsNullOrWhiteSpace(req.Methodology) ? "Scrum" : req.Methodology!.Trim(),
                Status = "green", Health = "On track", Progress = 0,
                Target = "TBD", Phase = "Planning", Due = "TBD",
            };
            db.Projects.Add(p);
            await db.SaveChangesAsync();
            return Results.Created($"/api/v1/projects/{p.Id}", new ProjectDto(
                p.Id, p.Name, p.Dept, p.Owner, p.Methodology, p.Status, p.Health, p.Progress, p.Budget, p.Spent, p.Target, 0));
        });

        // ---- Programs ------------------------------------------------------
        api.MapPost("/programs", async (CreateProgramReq req, AtlasDbContext db) =>
        {
            if (string.IsNullOrWhiteSpace(req.Name)) return Results.BadRequest(new { error = "Name is required." });
            var pg = new Program
            {
                Id = await NextId(db.Programs.Select(x => x.Id), "PGM-", db),
                Name = req.Name.Trim(),
                Owner = string.IsNullOrWhiteSpace(req.Owner) ? "Unassigned" : req.Owner!.Trim(),
                Goal = req.Goal?.Trim() ?? "",
                Status = string.IsNullOrWhiteSpace(req.Status) ? "On track" : req.Status!.Trim(),
                Projects = req.Projects ?? new(),
                Health = "green",
            };
            db.Programs.Add(pg);
            await db.SaveChangesAsync();
            return Results.Created($"/api/v1/programs/{pg.Id}", new ProgramDto(
                pg.Id, pg.Name, pg.Owner, pg.Goal, pg.Status, pg.Projects, pg.Budget, pg.Spent, pg.Progress, pg.Health));
        });

        // ---- OKRs ----------------------------------------------------------
        api.MapPost("/okrs", async (CreateObjectiveReq req, AtlasDbContext db) =>
        {
            if (string.IsNullOrWhiteSpace(req.Title)) return Results.BadRequest(new { error = "Title is required." });
            var o = new Objective
            {
                Id = await NextId(db.Objectives.Select(x => x.Id), "OKR-", db),
                Title = req.Title.Trim(),
                Owner = string.IsNullOrWhiteSpace(req.Owner) ? "Unassigned" : req.Owner!.Trim(),
                Horizon = string.IsNullOrWhiteSpace(req.Horizon) ? "FY26" : req.Horizon!.Trim(),
            };
            db.Objectives.Add(o);
            await db.SaveChangesAsync();
            return Results.Created($"/api/v1/okrs/{o.Id}",
                new ObjectiveDto(o.Id, o.Title, o.Owner, o.Horizon, new List<KrDto>()));
        });
    }

    // Next sequential id for a prefix (e.g. "DM-" -> "DM-331"), based on the
    // max numeric suffix currently stored. Small tables, so a materialize is fine.
    static async Task<string> NextId(IQueryable<string> ids, string prefix, AtlasDbContext _)
    {
        var existing = await ids.ToListAsync();
        var max = existing
            .Select(x => int.TryParse(x.Split('-').Last(), out var n) ? n : 0)
            .DefaultIfEmpty(0).Max();
        return $"{prefix}{max + 1}";
    }

    static string Clamp(string? value, string[] allowed, string fallback)
        => value is not null && allowed.Contains(value) ? value : fallback;
}
