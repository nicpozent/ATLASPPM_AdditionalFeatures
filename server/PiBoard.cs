using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace Atlas.Api;

public record SetPlacementReq(int ObjectiveId, int? IterationId);

// ============================================================================
//  PI Program Board placement (ADR-0061). The board lays PI objectives out on a
//  swimlane grid: rows are the linked deliverables (project/program/product/
//  release) already on each objective, columns are the increment's iterations.
//  The row is derived from existing data; only the *column* (which iteration a
//  card sits in) is board-specific placement state.
//
//  Placement is a first-class column, PiObjective.IterationId (null ⇒
//  Unscheduled). This makes each move an independent single-row write — so two
//  planners dragging different cards at once can't clobber each other (the
//  earlier Setting-blob read-modify-write map could lose updates). Reads are open
//  to any authenticated caller (parity with the other /increments reads); writing
//  a placement needs Edit on "Project schedule" (cap-schedule), exactly like the
//  objective/dependency writes it sits beside. (History: this used to live as a
//  migration-free JSON blob in Setting "pi.board.{id}"; promoted to a typed
//  column — see docs/pi-board-followups.md §1. The old rows are backfilled and
//  removed by the PiObjectiveIterationId migration.)
// ============================================================================
public static class PiBoard
{
    public static void MapPiBoardEndpoints(this RouteGroupBuilder api)
    {
        // Current placement map for a board: objectiveId → iterationId, for every
        // objective in the increment that sits in a still-existing iteration.
        api.MapGet("/increments/{id:int}/board", async (int id, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (!await db.ProgramIncrements.AnyAsync(i => i.Id == id)) return Results.NotFound();
            var canEdit = await Permissions.Allows(http, db, cfg, "cap-schedule", "E");

            var iterIds = (await db.PiIterations.Where(t => t.IncrementId == id).Select(t => t.Id).ToListAsync()).ToHashSet();
            var placements = (await db.PiObjectives
                    .Where(o => o.IncrementId == id && o.IterationId != null)
                    .Select(o => new { o.Id, o.IterationId })
                    .ToListAsync())
                .Where(o => iterIds.Contains(o.IterationId!.Value))
                .ToDictionary(o => o.Id.ToString(), o => o.IterationId!.Value);

            return Results.Ok(new { canEdit, placements });
        });

        // Place an objective in an iteration column (or clear it → null moves the
        // card back to the "Unscheduled" column). Validates that both the
        // objective and the iteration belong to this increment, then writes just
        // that objective's row (concurrent-safe).
        api.MapPut("/increments/{id:int}/board/placement", async (int id, SetPlacementReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http, IHubContext<BoardHub> hub) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-schedule", "E") is { } denied) return denied;
            if (!await db.ProgramIncrements.AnyAsync(i => i.Id == id)) return Results.NotFound();

            var obj = await db.PiObjectives.FirstOrDefaultAsync(o => o.Id == req.ObjectiveId && o.IncrementId == id);
            if (obj is null) return Results.BadRequest(new { error = "That objective isn't in this increment." });
            if (req.IterationId is { } it && !await db.PiIterations.AnyAsync(t => t.Id == it && t.IncrementId == id))
                return Results.BadRequest(new { error = "That iteration isn't in this increment." });

            obj.IterationId = req.IterationId;                 // per-row ⇒ concurrent-safe
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "PI Planning", "Moved board card",
                $"objective {req.ObjectiveId} → {(req.IterationId?.ToString() ?? "unscheduled")}"));
            await db.SaveChangesAsync();
            await BoardHub.NotifyGroupAsync(hub, id);
            return Results.NoContent();
        });
    }
}
