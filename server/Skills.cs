using ClosedXML.Excel;
using Microsoft.EntityFrameworkCore;

namespace Atlas.Api;

public record CreateSkillReq(string? Name);
public record RenameSkillReq(string? Name);
public record SetRatingReq(int SkillId, string? Person, int Level);

// ============================================================================
//  Skills matrix (My Team) — customizable competency columns × the manager's
//  team members × a 0–4 proficiency. The matrix is MANAGER-SCOPED: only a team's
//  manager (or Platform Admin) can see and maintain it, and a skill column
//  belongs to the manager slot that created it, so a manager sees only their own
//  team's skills (plus any legacy "shared" ones), never another team's. Editing
//  additionally needs Edit on "Projects & tasks" (cap-projects). Non-managers get
//  an empty matrix with canView=false — the client hides the panel for them.
// ============================================================================
public static class Skills
{
    public static void MapSkillEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/skills", async (AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            var scope = await Teams.ScopeAsync(db, cfg, http);
            var canView = scope.Count > 0;                    // only managers / Platform Admin see the matrix
            if (!canView)
                return Results.Ok(new SkillsMatrixDto(false, false, new(), new(), new()));
            var canEdit = await Permissions.Allows(http, db, cfg, "cap-projects", "E");
            var people = await RosterAsync(db, cfg, http);
            // Only the caller's own team(s) — plus legacy "shared" ("") columns.
            var skills = (await db.Skills.OrderBy(s => s.Ord).ThenBy(s => s.Id).ToListAsync())
                .Where(s => s.Team == "" || scope.Contains(s.Team))
                .Select(s => new SkillDto(s.Id, s.Name)).ToList();
            var visibleSkillIds = skills.Select(s => s.Id).ToHashSet();
            var known = people.ToHashSet(StringComparer.OrdinalIgnoreCase);
            var ratings = (await db.SkillRatings.ToListAsync())
                .Where(r => visibleSkillIds.Contains(r.SkillId) && known.Contains(r.Person))
                .Select(r => new SkillRatingDto(r.SkillId, r.Person, r.Level)).ToList();
            return Results.Ok(new SkillsMatrixDto(canEdit, canView, skills, people, ratings));
        });

        // Colour-graded Excel of the skills matrix (people × skills, cell = 0–4
        // proficiency shaded on a blue ramp). Same roster/scope as GET /skills.
        api.MapGet("/skills/export.xlsx", async (AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            var scope = await Teams.ScopeAsync(db, cfg, http);
            if (scope.Count == 0)                             // manager-scoped, same as GET /skills
                return Results.Json(new { error = "The skills matrix is available to team managers only." }, statusCode: StatusCodes.Status403Forbidden);
            var people = await RosterAsync(db, cfg, http);
            var skills = (await db.Skills.OrderBy(s => s.Ord).ThenBy(s => s.Id).ToListAsync())
                .Where(s => s.Team == "" || scope.Contains(s.Team)).ToList();
            var known = people.ToHashSet(StringComparer.OrdinalIgnoreCase);
            var ratings = (await db.SkillRatings.ToListAsync()).Where(r => known.Contains(r.Person))
                .ToDictionary(r => (r.SkillId, r.Person), r => r.Level);

            // Blue ramp by level (0 blank, 1→4 light→dark).
            string[] ramp = { "", "#EAF2FB", "#CFE0F4", "#93C0EA", "#4E97D9" };
            static string LevelLabel(int l) => l switch { 1 => "1 · Aware", 2 => "2 · Working", 3 => "3 · Strong", 4 => "4 · Expert", _ => "" };

            using var wb = new XLWorkbook();
            var ws = wb.Worksheets.Add("Skills matrix");
            ws.Cell(1, 1).Value = "Team skills matrix";
            ws.Cell(1, 1).Style.Font.Bold = true;
            ws.Cell(1, 1).Style.Font.FontSize = 13;
            if (skills.Count > 0) ws.Range(1, 1, 1, skills.Count + 1).Merge();

            var hdr = 2;
            ws.Cell(hdr, 1).Value = "Person";
            for (int i = 0; i < skills.Count; i++) ws.Cell(hdr, i + 2).Value = skills[i].Name;
            var hRange = ws.Range(hdr, 1, hdr, Math.Max(1, skills.Count + 1));
            hRange.Style.Font.Bold = true;
            hRange.Style.Fill.BackgroundColor = XLColor.FromHtml("#11163A");
            hRange.Style.Font.FontColor = XLColor.White;

            var r = hdr + 1;
            foreach (var person in people)
            {
                ws.Cell(r, 1).Value = person;
                for (int i = 0; i < skills.Count; i++)
                {
                    var lvl = ratings.TryGetValue((skills[i].Id, person), out var v) ? v : 0;
                    var cell = ws.Cell(r, i + 2);
                    cell.Value = lvl == 0 ? "" : lvl;
                    cell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
                    if (lvl > 0)
                    {
                        cell.Style.Fill.BackgroundColor = XLColor.FromHtml(ramp[lvl]);
                        if (lvl == 4) cell.Style.Font.FontColor = XLColor.White;
                        cell.GetComment().AddText(LevelLabel(lvl));
                    }
                }
                r++;
            }
            if (people.Count == 0) ws.Cell(hdr + 1, 1).Value = "No team members in scope.";

            ws.SheetView.FreezeRows(2);
            ws.SheetView.FreezeColumns(1);
            ws.Column(1).Width = 26;
            for (int i = 0; i < skills.Count; i++) ws.Column(i + 2).Width = 14;

            using var ms = new MemoryStream();
            wb.SaveAs(ms);
            return Results.File(ms.ToArray(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "atlas-skills-matrix.xlsx");
        });

        // Skills for the people ASSIGNED to one entity (project/program/product/
        // release) — the matrix filtered to that team, WITHOUT the My-Team roster
        // scope (so a viewer sees the assigned team's skills even if they don't
        // manage them). Read-only; shown on the entity's Overview.
        api.MapGet("/skills/entity/{type}/{id}", async (string type, string id, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            var types = new[] { "project", "program", "product", "release" };
            if (!types.Contains(type)) return Results.BadRequest(new { error = "Unknown entity type." });
            // People assigned here, however they were assigned: attached team /
            // sub-team / individual members, plus (for projects) People & roles
            // assignments and open, estimated task assignees. Name-keyed to match
            // the ratings maintained in My Team.
            var names = new List<string>();
            names.AddRange((await db.TeamAssignments.Include(a => a.Members)
                    .Where(a => a.EntityType == type && a.EntityId == id).ToListAsync())
                .SelectMany(a => a.Members).Select(m => m.Name));
            if (type == "project")
            {
                names.AddRange(await db.RoleAssignments.Where(a => a.ProjectId == id).Select(a => a.Person).ToListAsync());
                names.AddRange(await db.ProjectTasks
                    .Where(t => t.ProjectId == id && t.Status != "Done" && t.Assignee != "" && t.Assignee != "Unassigned")
                    .Select(t => t.Assignee).ToListAsync());
            }
            var members = names
                .Where(n => !string.IsNullOrWhiteSpace(n) && n != "N/A" && n != "Unassigned")
                .Select(n => n.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase).OrderBy(n => n).ToList();
            var skills = await db.Skills.OrderBy(s => s.Ord).ThenBy(s => s.Id)
                .Select(s => new SkillDto(s.Id, s.Name)).ToListAsync();
            var known = members.ToHashSet(StringComparer.OrdinalIgnoreCase);
            var ratings = (await db.SkillRatings.ToListAsync())
                .Where(r => known.Contains(r.Person))
                .Select(r => new SkillRatingDto(r.SkillId, r.Person, r.Level)).ToList();
            // canEdit is false here — editing stays in My Team. canView is true:
            // this is a read-only projection of the entity's own assigned team.
            return Results.Ok(new SkillsMatrixDto(false, true, skills, members, ratings));
        });

        api.MapPost("/skills", async (CreateSkillReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            var scope = await Teams.ScopeAsync(db, cfg, http);
            if (scope.Count == 0)                             // only a team's manager maintains its matrix
                return Results.Json(new { error = "The skills matrix is available to team managers only." }, statusCode: StatusCodes.Status403Forbidden);
            if (string.IsNullOrWhiteSpace(req.Name)) return Results.BadRequest(new { error = "A skill name is required." });
            var name = req.Name.Trim();
            // A skill belongs to the caller's own manager slot (Platform Admin, with
            // no single slot, creates a shared "" column visible to every manager).
            var team = Permissions.ManagerKey(http, cfg) ?? "";
            if (await db.Skills.AnyAsync(s => s.Name == name && s.Team == team)) return Results.Conflict(new { error = "That skill already exists." });
            var ord = (await db.Skills.Select(s => (int?)s.Ord).MaxAsync() ?? -1) + 1;
            var skill = new Skill { Name = name, Ord = ord, Team = team };
            db.Skills.Add(skill);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Skills", "Added skill", name));
            await db.SaveChangesAsync();
            return Results.Created($"/api/v1/skills/{skill.Id}", new SkillDto(skill.Id, skill.Name));
        });

        api.MapPatch("/skills/{id:int}", async (int id, RenameSkillReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            var scope = await Teams.ScopeAsync(db, cfg, http);
            var s = await db.Skills.FindAsync(id);
            if (s is null || !InScope(s, scope)) return Results.NotFound();
            if (string.IsNullOrWhiteSpace(req.Name)) return Results.BadRequest(new { error = "A skill name is required." });
            s.Name = req.Name.Trim();
            await db.SaveChangesAsync();
            return Results.Ok(new SkillDto(s.Id, s.Name));
        });

        api.MapDelete("/skills/{id:int}", async (int id, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            var scope = await Teams.ScopeAsync(db, cfg, http);
            var s = await db.Skills.FindAsync(id);
            if (s is null || !InScope(s, scope)) return Results.NotFound();
            db.SkillRatings.RemoveRange(db.SkillRatings.Where(r => r.SkillId == id));
            db.Skills.Remove(s);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Skills", "Removed skill", s.Name));
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        // Upsert one person's level for one skill (0–4). Level 0 clears the cell.
        api.MapPut("/skill-ratings", async (SetRatingReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            var scope = await Teams.ScopeAsync(db, cfg, http);
            if (string.IsNullOrWhiteSpace(req.Person)) return Results.BadRequest(new { error = "A person is required." });
            var skill = await db.Skills.FindAsync(req.SkillId);
            if (skill is null || !InScope(skill, scope)) return Results.NotFound();
            var person = req.Person.Trim();
            var level = Math.Clamp(req.Level, 0, 4);
            var rating = await db.SkillRatings.FirstOrDefaultAsync(r => r.SkillId == req.SkillId && r.Person == person);
            if (level == 0)
            {
                if (rating is not null) db.SkillRatings.Remove(rating);
            }
            else if (rating is null)
            {
                db.SkillRatings.Add(new SkillRating { SkillId = req.SkillId, Person = person, Level = level });
            }
            else rating.Level = level;
            await db.SaveChangesAsync();
            return Results.Ok(new SkillRatingDto(req.SkillId, person, level));
        });
    }

    // A skill column is maintainable by the caller when it is shared ("") or owned
    // by a manager slot in their scope. Non-managers have an empty scope, so they
    // can touch nothing.
    static bool InScope(Skill s, HashSet<string> scope) => s.Team == "" || scope.Contains(s.Team);

    // The people the caller manages (Entra members in scope). A non-manager has an
    // empty scope and therefore an empty roster — the matrix is manager-scoped.
    static async Task<List<string>> RosterAsync(AtlasDbContext db, IConfiguration cfg, HttpContext http)
    {
        var scope = await Teams.ScopeAsync(db, cfg, http);
        if (scope.Count == 0) return new();
        var groups = await db.EntraGroups.Include(g => g.Members)
            .Where(g => scope.Contains(g.ManagerKey)).ToListAsync();
        return groups.SelectMany(g => g.Members)
            .Select(m => m.DisplayName)
            .Where(n => !string.IsNullOrWhiteSpace(n))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(n => n)
            .ToList();
    }
}
