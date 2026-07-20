using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace Atlas.Api.Delivery;

public record CreateIncrementReq(string? Key, string? Name, string? StartDate, string? EndDate, string? State);
public record UpdateIncrementReq(string? Key, string? Name, string? StartDate, string? EndDate, string? State);
public record CreateIterationReq(string? Name, string? StartDate, string? EndDate, int? Capacity, int? Load);
public record UpdateIterationReq(string? Name, string? StartDate, string? EndDate, int? Capacity, int? Load);
public record CreatePiObjectiveReq(string? Title, string? Description, string? EntityType, string? EntityId,
    int? BusinessValue, int? ActualValue, bool? Committed, int? Confidence, string? Status, string? ObjectiveLink);
public record UpdatePiObjectiveReq(string? Title, string? Description, string? EntityType, string? EntityId,
    int? BusinessValue, int? ActualValue, bool? Committed, int? Confidence, string? Status, string? ObjectiveLink);
public record CreateDependencyReq(string? Title, string? FromType, string? FromId, string? ToType, string? ToId,
    string? Owner, string? DueDate, string? Status);
public record UpdateDependencyReq(string? Title, string? FromType, string? FromId, string? ToType, string? ToId,
    string? Owner, string? DueDate, string? Status);

// ============================================================================
//  Program Increment Planning (PIP) — quarterly PI planning across the whole
//  portfolio. An increment holds iterations (with capacity vs load), PI
//  objectives (business value + team confidence vote), and cross-team
//  dependencies. Reads are open to any authenticated user; writes need Edit on
//  "Project schedule" (cap-schedule).
// ============================================================================
public static class Pip
{
    static readonly string[] IncrementStates = { "Planning", "Active", "Completed", "Cancelled" };
    static readonly string[] ObjectiveStatuses = { "Planned", "In Progress", "Done", "Missed" };
    static readonly string[] DependencyStatuses = { "Identified", "Committed", "Resolved", "Blocked" };
    static readonly string[] LinkTypes = { "", "project", "program", "product", "release" };

    public static void MapPipEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/increments", async (AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            var canEdit = await Permissions.Allows(http, db, cfg, "cap-schedule", "E");
            var items = await db.ProgramIncrements
                .OrderByDescending(i => i.Ord).ThenByDescending(i => i.Id)
                .Select(i => new IncrementSummaryDto(i.Id, i.Key, i.Name, i.StartDate, i.EndDate, i.State,
                    i.Objectives.Count, i.Iterations.Count, i.Dependencies.Count))
                .ToListAsync();
            return Results.Ok(new IncrementsDto(canEdit, items));
        });

        api.MapGet("/increments/{id:int}", async (int id, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            var inc = await db.ProgramIncrements
                .Include(i => i.Iterations)
                .Include(i => i.Objectives)
                .Include(i => i.Dependencies)
                .FirstOrDefaultAsync(i => i.Id == id);
            if (inc is null) return Results.NotFound();
            var canEdit = await Permissions.Allows(http, db, cfg, "cap-schedule", "E");
            var names = await LoadTargetsAsync(db);
            var okr = await LoadOkrTitlesAsync(db);
            string Name(string type, string eid) => names.TryGetValue((type, eid), out var n) ? n : eid;

            return Results.Ok(new IncrementDto(inc.Id, inc.Key, inc.Name, inc.StartDate, inc.EndDate, inc.State, canEdit,
                inc.Iterations.OrderBy(x => x.Ord).Select(x => new PiIterationDto(x.Id, x.Name, x.StartDate, x.EndDate, x.Capacity, x.Load)).ToList(),
                inc.Objectives.OrderBy(x => x.Ord).Select(x => ToObjectiveDto(x, names, okr)).ToList(),
                inc.Dependencies.OrderBy(x => x.Ord).Select(x => new PiDependencyDto(x.Id, x.Title, x.FromType, x.FromId, Name(x.FromType, x.FromId),
                    x.ToType, x.ToId, Name(x.ToType, x.ToId), x.Owner, x.DueDate, x.Status)).ToList(),
                names.Select(kv => new PiLinkTargetDto(kv.Key.Item1, kv.Key.Item2, kv.Value)).ToList()));
        });

        api.MapPost("/increments", async (CreateIncrementReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-schedule", "E") is { } denied) return denied;
            if (string.IsNullOrWhiteSpace(req.Name)) return Results.BadRequest(new { error = "Name is required." });
            var ord = (await db.ProgramIncrements.Select(i => (int?)i.Ord).MaxAsync() ?? 0) + 1;
            var inc = new ProgramIncrement
            {
                Key = req.Key?.Trim() ?? "", Name = req.Name.Trim(),
                StartDate = req.StartDate?.Trim() ?? "", EndDate = req.EndDate?.Trim() ?? "",
                State = IncrementStates.Contains(req.State) ? req.State! : "Planning", Ord = ord,
            };
            db.ProgramIncrements.Add(inc);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "PIP", "Created increment", inc.Name));
            await db.SaveChangesAsync();
            return Results.Created($"/api/v1/increments/{inc.Id}",
                new IncrementSummaryDto(inc.Id, inc.Key, inc.Name, inc.StartDate, inc.EndDate, inc.State, 0, 0, 0));
        });

        api.MapPatch("/increments/{id:int}", async (int id, UpdateIncrementReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-schedule", "E") is { } denied) return denied;
            var inc = await db.ProgramIncrements.FindAsync(id);
            if (inc is null) return Results.NotFound();
            if (req.Key is not null) inc.Key = req.Key.Trim();
            if (req.Name is not null)
            {
                if (string.IsNullOrWhiteSpace(req.Name)) return Results.BadRequest(new { error = "Name is required." });
                inc.Name = req.Name.Trim();
            }
            if (req.StartDate is not null) inc.StartDate = req.StartDate.Trim();
            if (req.EndDate is not null) inc.EndDate = req.EndDate.Trim();
            if (req.State is not null)
            {
                if (!IncrementStates.Contains(req.State)) return Results.BadRequest(new { error = "Unknown state." });
                inc.State = req.State;
            }
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "PIP", "Updated increment", inc.Name));
            await db.SaveChangesAsync();
            return Results.Ok(new IncrementSummaryDto(inc.Id, inc.Key, inc.Name, inc.StartDate, inc.EndDate, inc.State,
                await db.PiObjectives.CountAsync(o => o.IncrementId == id),
                await db.PiIterations.CountAsync(o => o.IncrementId == id),
                await db.PiDependencies.CountAsync(o => o.IncrementId == id)));
        });

        api.MapDelete("/increments/{id:int}", async (int id, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-schedule", "E") is { } denied) return denied;
            var inc = await db.ProgramIncrements.FindAsync(id);
            if (inc is null) return Results.NotFound();
            db.ProgramIncrements.Remove(inc);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "PIP", "Deleted increment", inc.Name));
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        // ---- Iterations -------------------------------------------------------
        api.MapPost("/increments/{id:int}/iterations", async (int id, CreateIterationReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http, IHubContext<BoardHub> hub) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-schedule", "E") is { } denied) return denied;
            if (!await db.ProgramIncrements.AnyAsync(i => i.Id == id)) return Results.NotFound();
            if (string.IsNullOrWhiteSpace(req.Name)) return Results.BadRequest(new { error = "Name is required." });
            var ord = (await db.PiIterations.Where(x => x.IncrementId == id).Select(x => (int?)x.Ord).MaxAsync() ?? 0) + 1;
            var it = new PiIteration
            {
                IncrementId = id, Name = req.Name.Trim(), StartDate = req.StartDate?.Trim() ?? "",
                EndDate = req.EndDate?.Trim() ?? "", Capacity = Math.Max(0, req.Capacity ?? 0),
                Load = Math.Max(0, req.Load ?? 0), Ord = ord,
            };
            db.PiIterations.Add(it);
            await db.SaveChangesAsync();
            await BoardHub.NotifyGroupAsync(hub, id);
            return Results.Created($"/api/v1/increments/{id}", new PiIterationDto(it.Id, it.Name, it.StartDate, it.EndDate, it.Capacity, it.Load));
        });

        api.MapPatch("/pi-iterations/{iterId:int}", async (int iterId, UpdateIterationReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http, IHubContext<BoardHub> hub) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-schedule", "E") is { } denied) return denied;
            var it = await db.PiIterations.FindAsync(iterId);
            if (it is null) return Results.NotFound();
            if (req.Name is not null)
            {
                if (string.IsNullOrWhiteSpace(req.Name)) return Results.BadRequest(new { error = "Name is required." });
                it.Name = req.Name.Trim();
            }
            if (req.StartDate is not null) it.StartDate = req.StartDate.Trim();
            if (req.EndDate is not null) it.EndDate = req.EndDate.Trim();
            if (req.Capacity is not null) it.Capacity = Math.Max(0, req.Capacity.Value);
            if (req.Load is not null) it.Load = Math.Max(0, req.Load.Value);
            await db.SaveChangesAsync();
            await BoardHub.NotifyGroupAsync(hub, it.IncrementId);
            return Results.Ok(new PiIterationDto(it.Id, it.Name, it.StartDate, it.EndDate, it.Capacity, it.Load));
        });

        api.MapDelete("/pi-iterations/{iterId:int}", async (int iterId, AtlasDbContext db, IConfiguration cfg, HttpContext http, IHubContext<BoardHub> hub) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-schedule", "E") is { } denied) return denied;
            var it = await db.PiIterations.FindAsync(iterId);
            if (it is null) return Results.NotFound();
            db.PiIterations.Remove(it);
            await db.SaveChangesAsync();
            await BoardHub.NotifyGroupAsync(hub, it.IncrementId);
            return Results.NoContent();
        });

        // ---- Objectives -------------------------------------------------------
        api.MapPost("/increments/{id:int}/objectives", async (int id, CreatePiObjectiveReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http, IHubContext<BoardHub> hub) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-schedule", "E") is { } denied) return denied;
            if (!await db.ProgramIncrements.AnyAsync(i => i.Id == id)) return Results.NotFound();
            if (string.IsNullOrWhiteSpace(req.Title)) return Results.BadRequest(new { error = "Title is required." });
            if (req.EntityType is { } et && !LinkTypes.Contains(et)) return Results.BadRequest(new { error = "Unknown link type." });
            if (req.Status is { } st && !ObjectiveStatuses.Contains(st)) return Results.BadRequest(new { error = "Unknown status." });
            var ord = (await db.PiObjectives.Where(x => x.IncrementId == id).Select(x => (int?)x.Ord).MaxAsync() ?? 0) + 1;
            var o = new PiObjective
            {
                IncrementId = id, Title = req.Title.Trim(), Description = req.Description?.Trim() ?? "",
                EntityType = req.EntityType?.Trim() ?? "", EntityId = req.EntityId?.Trim() ?? "",
                BusinessValue = Clamp(req.BusinessValue ?? 0, 0, 10), ActualValue = Clamp(req.ActualValue ?? 0, 0, 10),
                Committed = req.Committed ?? true, Confidence = Clamp(req.Confidence ?? 0, 0, 5),
                Status = ObjectiveStatuses.Contains(req.Status) ? req.Status! : "Planned",
                ObjectiveLink = req.ObjectiveLink?.Trim() ?? "", Ord = ord,
            };
            db.PiObjectives.Add(o);
            await db.SaveChangesAsync();
            await BoardHub.NotifyGroupAsync(hub, id);
            return Results.Created($"/api/v1/increments/{id}", ToObjectiveDto(o, await LoadTargetsAsync(db), await LoadOkrTitlesAsync(db)));
        });

        api.MapPatch("/pi-objectives/{objId:int}", async (int objId, UpdatePiObjectiveReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http, IHubContext<BoardHub> hub) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-schedule", "E") is { } denied) return denied;
            var o = await db.PiObjectives.FindAsync(objId);
            if (o is null) return Results.NotFound();
            if (req.Title is not null)
            {
                if (string.IsNullOrWhiteSpace(req.Title)) return Results.BadRequest(new { error = "Title is required." });
                o.Title = req.Title.Trim();
            }
            if (req.Description is not null) o.Description = req.Description.Trim();
            if (req.EntityType is not null)
            {
                if (!LinkTypes.Contains(req.EntityType)) return Results.BadRequest(new { error = "Unknown link type." });
                o.EntityType = req.EntityType.Trim();
            }
            if (req.EntityId is not null) o.EntityId = req.EntityId.Trim();
            if (req.BusinessValue is not null) o.BusinessValue = Clamp(req.BusinessValue.Value, 0, 10);
            if (req.ActualValue is not null) o.ActualValue = Clamp(req.ActualValue.Value, 0, 10);
            if (req.Committed is not null) o.Committed = req.Committed.Value;
            if (req.Confidence is not null) o.Confidence = Clamp(req.Confidence.Value, 0, 5);
            if (req.Status is not null)
            {
                if (!ObjectiveStatuses.Contains(req.Status)) return Results.BadRequest(new { error = "Unknown status." });
                o.Status = req.Status;
            }
            if (req.ObjectiveLink is not null) o.ObjectiveLink = req.ObjectiveLink.Trim();
            await db.SaveChangesAsync();
            await BoardHub.NotifyGroupAsync(hub, o.IncrementId);
            return Results.Ok(ToObjectiveDto(o, await LoadTargetsAsync(db), await LoadOkrTitlesAsync(db)));
        });

        api.MapDelete("/pi-objectives/{objId:int}", async (int objId, AtlasDbContext db, IConfiguration cfg, HttpContext http, IHubContext<BoardHub> hub) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-schedule", "E") is { } denied) return denied;
            var o = await db.PiObjectives.FindAsync(objId);
            if (o is null) return Results.NotFound();
            var incId = o.IncrementId;
            db.PiObjectives.Remove(o);
            await db.SaveChangesAsync();
            await BoardHub.NotifyGroupAsync(hub, incId);
            return Results.NoContent();
        });

        // ---- Dependencies -----------------------------------------------------
        api.MapPost("/increments/{id:int}/dependencies", async (int id, CreateDependencyReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http, IHubContext<BoardHub> hub) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-schedule", "E") is { } denied) return denied;
            if (!await db.ProgramIncrements.AnyAsync(i => i.Id == id)) return Results.NotFound();
            if (string.IsNullOrWhiteSpace(req.Title)) return Results.BadRequest(new { error = "Title is required." });
            if (req.FromType is { } ft && !LinkTypes.Contains(ft)) return Results.BadRequest(new { error = "Unknown link type." });
            if (req.ToType is { } tt && !LinkTypes.Contains(tt)) return Results.BadRequest(new { error = "Unknown link type." });
            if (req.Status is { } st && !DependencyStatuses.Contains(st)) return Results.BadRequest(new { error = "Unknown status." });
            var ord = (await db.PiDependencies.Where(x => x.IncrementId == id).Select(x => (int?)x.Ord).MaxAsync() ?? 0) + 1;
            var d = new PiDependency
            {
                IncrementId = id, Title = req.Title.Trim(),
                FromType = req.FromType?.Trim() ?? "", FromId = req.FromId?.Trim() ?? "",
                ToType = req.ToType?.Trim() ?? "", ToId = req.ToId?.Trim() ?? "",
                Owner = req.Owner?.Trim() ?? "", DueDate = req.DueDate?.Trim() ?? "",
                Status = DependencyStatuses.Contains(req.Status) ? req.Status! : "Identified", Ord = ord,
            };
            db.PiDependencies.Add(d);
            await db.SaveChangesAsync();
            await BoardHub.NotifyGroupAsync(hub, id);
            var names = await LoadTargetsAsync(db);
            return Results.Created($"/api/v1/increments/{id}", ToDependencyDto(d, names));
        });

        api.MapPatch("/pi-dependencies/{depId:int}", async (int depId, UpdateDependencyReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http, IHubContext<BoardHub> hub) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-schedule", "E") is { } denied) return denied;
            var d = await db.PiDependencies.FindAsync(depId);
            if (d is null) return Results.NotFound();
            if (req.Title is not null)
            {
                if (string.IsNullOrWhiteSpace(req.Title)) return Results.BadRequest(new { error = "Title is required." });
                d.Title = req.Title.Trim();
            }
            if (req.FromType is not null)
            {
                if (!LinkTypes.Contains(req.FromType)) return Results.BadRequest(new { error = "Unknown link type." });
                d.FromType = req.FromType.Trim();
            }
            if (req.FromId is not null) d.FromId = req.FromId.Trim();
            if (req.ToType is not null)
            {
                if (!LinkTypes.Contains(req.ToType)) return Results.BadRequest(new { error = "Unknown link type." });
                d.ToType = req.ToType.Trim();
            }
            if (req.ToId is not null) d.ToId = req.ToId.Trim();
            if (req.Owner is not null) d.Owner = req.Owner.Trim();
            if (req.DueDate is not null) d.DueDate = req.DueDate.Trim();
            if (req.Status is not null)
            {
                if (!DependencyStatuses.Contains(req.Status)) return Results.BadRequest(new { error = "Unknown status." });
                d.Status = req.Status;
            }
            await db.SaveChangesAsync();
            await BoardHub.NotifyGroupAsync(hub, d.IncrementId);
            var names = await LoadTargetsAsync(db);
            return Results.Ok(ToDependencyDto(d, names));
        });

        api.MapDelete("/pi-dependencies/{depId:int}", async (int depId, AtlasDbContext db, IConfiguration cfg, HttpContext http, IHubContext<BoardHub> hub) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-schedule", "E") is { } denied) return denied;
            var d = await db.PiDependencies.FindAsync(depId);
            if (d is null) return Results.NotFound();
            var incId = d.IncrementId;
            db.PiDependencies.Remove(d);
            await db.SaveChangesAsync();
            await BoardHub.NotifyGroupAsync(hub, incId);
            return Results.NoContent();
        });
    }

    static int Clamp(int v, int lo, int hi) => Math.Max(lo, Math.Min(hi, v));

    static PiObjectiveDto ToObjectiveDto(PiObjective o, Dictionary<(string, string), string> names, Dictionary<string, string> okr) =>
        new(o.Id, o.Title, o.Description, o.EntityType, o.EntityId,
            names.TryGetValue((o.EntityType, o.EntityId), out var n) ? n : o.EntityId,
            o.BusinessValue, o.ActualValue, o.Committed, o.Confidence, o.Status,
            o.ObjectiveLink, okr.TryGetValue(o.ObjectiveLink, out var ot) ? ot : "");

    static PiDependencyDto ToDependencyDto(PiDependency d, Dictionary<(string, string), string> names) =>
        new(d.Id, d.Title, d.FromType, d.FromId, names.TryGetValue((d.FromType, d.FromId), out var fn) ? fn : d.FromId,
            d.ToType, d.ToId, names.TryGetValue((d.ToType, d.ToId), out var tn) ? tn : d.ToId,
            d.Owner, d.DueDate, d.Status);

    // Pickable deliverables — every non-archived project/program/product/release,
    // keyed by (type, id) so objective and dependency links can resolve a name.
    static async Task<Dictionary<(string, string), string>> LoadTargetsAsync(AtlasDbContext db)
    {
        var map = new Dictionary<(string, string), string>();
        foreach (var p in await db.Projects.Where(x => !x.Archived).Select(x => new { x.Id, x.Name }).ToListAsync())
            map[("project", p.Id)] = p.Name;
        foreach (var p in await db.Programs.Where(x => !x.Archived).Select(x => new { x.Id, x.Name }).ToListAsync())
            map[("program", p.Id)] = p.Name;
        foreach (var p in await db.Products.Select(x => new { x.Id, x.Name }).ToListAsync())
            map[("product", p.Id)] = p.Name;
        foreach (var r in await db.Releases.Where(x => !x.Archived).Select(x => new { x.Id, x.Name }).ToListAsync())
            map[("release", r.Id)] = r.Name;
        return map;
    }

    // OKR objectives, keyed by id → title, so a PI objective can name the strategic
    // objective it advances.
    static async Task<Dictionary<string, string>> LoadOkrTitlesAsync(AtlasDbContext db) =>
        await db.Objectives.ToDictionaryAsync(o => o.Id, o => o.Title);
}
