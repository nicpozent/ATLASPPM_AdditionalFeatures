using System.Text.Json;
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
//  That placement is stored as a small JSON map (objectiveId → iterationId) in
//  the existing Setting store under "pi.board.{incrementId}" — deliberately
//  migration-free (this environment can't generate an EF migration). It is
//  presentation state, not a domain fact, so a key/value home is appropriate;
//  promoting it to a first-class PiObjective.IterationId column is a clean
//  follow-up once a migration can be generated. Reads are open to any
//  authenticated caller (parity with the other /increments reads); writing a
//  placement needs Edit on "Project schedule" (cap-schedule), exactly like the
//  objective/dependency writes it sits beside.
// ============================================================================
public static class PiBoard
{
    static string Key(int incrementId) => $"pi.board.{incrementId}";

    static async Task<Dictionary<string, int>> LoadAsync(AtlasDbContext db, int incrementId)
    {
        var raw = (await db.Settings.FindAsync(Key(incrementId)))?.Value;
        if (string.IsNullOrWhiteSpace(raw)) return new();
        try { return JsonSerializer.Deserialize<Dictionary<string, int>>(raw) ?? new(); }
        catch { return new(); }   // tolerate a hand-edited/corrupt value — treat as empty
    }

    static async Task SaveAsync(AtlasDbContext db, int incrementId, Dictionary<string, int> map)
    {
        var key = Key(incrementId);
        var json = JsonSerializer.Serialize(map);
        var s = await db.Settings.FindAsync(key);
        if (s is null) db.Settings.Add(new Setting { Key = key, Value = json });
        else s.Value = json;
    }

    public static void MapPiBoardEndpoints(this RouteGroupBuilder api)
    {
        // Current placement map for a board. Prunes entries whose objective or
        // iteration no longer exists so callers never see dangling placements.
        api.MapGet("/increments/{id:int}/board", async (int id, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (!await db.ProgramIncrements.AnyAsync(i => i.Id == id)) return Results.NotFound();
            var canEdit = await Permissions.Allows(http, db, cfg, "cap-schedule", "E");

            var map = await LoadAsync(db, id);
            var objIds = await db.PiObjectives.Where(o => o.IncrementId == id).Select(o => o.Id).ToListAsync();
            var iterIds = await db.PiIterations.Where(t => t.IncrementId == id).Select(t => t.Id).ToHashSetAsync();
            var placements = map
                .Where(kv => int.TryParse(kv.Key, out var oid) && objIds.Contains(oid) && iterIds.Contains(kv.Value))
                .ToDictionary(kv => kv.Key, kv => kv.Value);

            return Results.Ok(new { canEdit, placements });
        });

        // Place an objective in an iteration column (or clear it → null moves the
        // card back to the "Unscheduled" column). Validates that both the
        // objective and the iteration belong to this increment before persisting.
        api.MapPut("/increments/{id:int}/board/placement", async (int id, SetPlacementReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http, IHubContext<BoardHub> hub) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-schedule", "E") is { } denied) return denied;
            if (!await db.ProgramIncrements.AnyAsync(i => i.Id == id)) return Results.NotFound();

            var obj = await db.PiObjectives.FirstOrDefaultAsync(o => o.Id == req.ObjectiveId && o.IncrementId == id);
            if (obj is null) return Results.BadRequest(new { error = "That objective isn't in this increment." });
            if (req.IterationId is { } it && !await db.PiIterations.AnyAsync(t => t.Id == it && t.IncrementId == id))
                return Results.BadRequest(new { error = "That iteration isn't in this increment." });

            var map = await LoadAsync(db, id);
            if (req.IterationId is { } iter) map[req.ObjectiveId.ToString()] = iter;
            else map.Remove(req.ObjectiveId.ToString());
            await SaveAsync(db, id, map);

            db.AuditEvents.Add(Permissions.Audit(http, cfg, "PI Planning", "Moved board card",
                $"objective {req.ObjectiveId} → {(req.IterationId?.ToString() ?? "unscheduled")}"));
            await db.SaveChangesAsync();
            await BoardHub.NotifyGroupAsync(hub, id);
            return Results.NoContent();
        });
    }
}
