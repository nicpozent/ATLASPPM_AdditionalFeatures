using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;

namespace Atlas.Api.People;

public record CreateAbsenceReq(string Person, string From, string To, string? Type);

// ============================================================================
//  Team absences — the project vacation calendar. Adding/removing an absence
//  requires Edit on "Projects & tasks" (cap-projects).
// ============================================================================
public static class Vacations
{
    static readonly string[] Types = { "vacation", "sick", "training" };
    static bool IsoDate(string s) => Regex.IsMatch(s ?? "", @"^\d{4}-\d{2}-\d{2}$");

    public static void MapVacationEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/projects/{id}/vacations", async (string id, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (!await db.Projects.AnyAsync(p => p.Id == id)) return Results.NotFound();
            var items = await db.Absences.Where(a => a.ProjectId == id).OrderBy(a => a.Person).ThenBy(a => a.From).ToListAsync();
            var canEdit = await Permissions.Allows(http, db, cfg, "cap-projects", "E");
            return Results.Ok(new VacationsDto(canEdit, items.Select(a => new AbsenceDto(a.Id, a.Person, a.From, a.To, a.Type)).ToList()));
        });

        api.MapPost("/projects/{id}/vacations", async (string id, CreateAbsenceReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            if (!await db.Projects.AnyAsync(p => p.Id == id)) return Results.NotFound();
            if (string.IsNullOrWhiteSpace(req.Person)) return Results.BadRequest(new { error = "Person is required." });
            if (!IsoDate(req.From) || !IsoDate(req.To)) return Results.BadRequest(new { error = "Valid from/to dates are required." });
            if (string.CompareOrdinal(req.To, req.From) < 0) return Results.BadRequest(new { error = "End date must be on or after the start date." });
            var ord = (await db.Absences.Where(a => a.ProjectId == id).Select(a => (int?)a.Ord).MaxAsync() ?? 0) + 1;
            var abs = new Absence
            {
                ProjectId = id, Ord = ord, Person = req.Person.Trim(), From = req.From, To = req.To,
                Type = Types.Contains(req.Type) ? req.Type! : "vacation",
            };
            db.Absences.Add(abs);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Vacations", $"Logged {abs.Type}", $"{id} · {abs.Person} ({abs.From}→{abs.To})"));
            await db.SaveChangesAsync();
            return Results.Created($"/api/v1/projects/{id}/vacations/{abs.Id}", new AbsenceDto(abs.Id, abs.Person, abs.From, abs.To, abs.Type));
        });

        api.MapDelete("/vacations/{absId:int}", async (int absId, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            var abs = await db.Absences.FindAsync(absId);
            if (abs is null) return Results.NotFound();
            db.Absences.Remove(abs);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Vacations", "Removed absence", $"{abs.ProjectId} · {abs.Person}"));
            await db.SaveChangesAsync();
            return Results.NoContent();
        });
    }
}
