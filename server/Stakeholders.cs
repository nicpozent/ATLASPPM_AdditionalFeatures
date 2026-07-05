using Microsoft.EntityFrameworkCore;

namespace Atlas.Api;

public record CreateStakeholderReq(string Name, string? Role, string? Power, string? Interest);
public record StakeholderDto(int Id, string Name, string Role, string Power, string Interest);

// ============================================================================
//  Stakeholder matrix — power/interest stakeholders attached to a project or a
//  program. Reading is open; adding/removing requires Edit on projects
//  (cap-projects). Persisted so the matrix survives navigation (it used to be
//  client-only on programs and a static stub on projects).
// ============================================================================
public static class Stakeholders
{
    static readonly string[] Scopes = { "project", "program" };
    static readonly string[] Levels = { "High", "Low" };
    static string Norm(string? v) => Levels.Contains(v) ? v! : "High";

    public static void MapStakeholderEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/stakeholder-matrix/{scopeType}/{scopeId}", async (string scopeType, string scopeId, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (!Scopes.Contains(scopeType)) return Results.BadRequest(new { error = "scopeType must be project or program." });
            var items = await db.StakeholderEntries.Where(s => s.ScopeType == scopeType && s.ScopeId == scopeId).OrderBy(s => s.Id)
                .Select(s => new StakeholderDto(s.Id, s.Name, s.Role, s.Power, s.Interest)).ToListAsync();
            var canEdit = await Permissions.Allows(http, db, cfg, "cap-projects", "E");
            return Results.Ok(new { canEdit, stakeholders = items });
        });

        api.MapPost("/stakeholder-matrix/{scopeType}/{scopeId}", async (string scopeType, string scopeId, CreateStakeholderReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            if (!Scopes.Contains(scopeType)) return Results.BadRequest(new { error = "scopeType must be project or program." });
            if (string.IsNullOrWhiteSpace(req.Name)) return Results.BadRequest(new { error = "Name is required." });
            var s = new StakeholderEntry
            {
                ScopeType = scopeType, ScopeId = scopeId, Name = req.Name.Trim(),
                Role = req.Role?.Trim() ?? "Stakeholder", Power = Norm(req.Power), Interest = Norm(req.Interest),
            };
            db.StakeholderEntries.Add(s);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Projects", "Added stakeholder", $"{scopeType} {scopeId} · {s.Name}"));
            await db.SaveChangesAsync();
            return Results.Created($"/api/v1/stakeholder-matrix/{s.Id}", new StakeholderDto(s.Id, s.Name, s.Role, s.Power, s.Interest));
        });

        api.MapDelete("/stakeholder-matrix/{id:int}", async (int id, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            var s = await db.StakeholderEntries.FindAsync(id);
            if (s is null) return Results.NotFound();
            db.StakeholderEntries.Remove(s);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Projects", "Removed stakeholder", $"{s.ScopeType} {s.ScopeId} · {s.Name}"));
            await db.SaveChangesAsync();
            return Results.NoContent();
        });
    }
}
