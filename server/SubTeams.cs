using Microsoft.EntityFrameworkCore;

namespace Atlas.Api;

// ============================================================================
//  Sub-teams & team assignments.
//
//  Managers (Global Service / Engineering / Infrastructure / Developer managers,
//  plus PMO & PM Lead) create named SUB-TEAMS — a roster of people they own.
//  Project / Program / Product / Release managers then ATTACH one or more of
//  those sub-teams to their entity and pick which members are actually working
//  on it. Manager scope reuses Teams.ScopeAsync (a manager sees self + descendants).
//
//  Creating/editing a sub-team needs a manager identity (or Platform Admin);
//  attaching a sub-team to an entity needs Edit on "Projects & tasks".
// ============================================================================
public record SubTeamReq(string? Name, string? Description, string? ManagerKey);
public record SubTeamMemberReq(string Name, string? Email, string? Title, int? Alloc = null,
    int? AllocHours = null, string? StartDate = null, string? EndDate = null,
    int? ExtAlloc = null, int? ExtHours = null, string? ExtStartDate = null, string? ExtEndDate = null);
public record AttachTeamReq(int SubTeamId, List<SubTeamMemberReq>? Members);
public record SetAssignmentMembersReq(List<SubTeamMemberReq> Members);

public record SubTeamMemberDto(int Id, string Name, string Email, string Title);
// Assignment members carry the full allocation shape (percent/hours + dates + extension).
public record AssignMemberDto(int Id, string Name, string Email, string Title, int Alloc, int AllocHours,
    string StartDate, string EndDate, int ExtAlloc, int ExtHours, string ExtStartDate, string ExtEndDate);
public record SubTeamDto(int Id, string Name, string ManagerKey, string ManagerLabel, string Description, bool CanManage, List<SubTeamMemberDto> Members);
public record SubTeamsDto(bool CanManage, List<SubTeamDto> SubTeams);
public record TeamAssignmentDto(int Id, int SubTeamId, string SubTeamName, string ManagerLabel, List<AssignMemberDto> Members);
public record TeamAssignmentsDto(bool CanEdit, List<TeamAssignmentDto> Assignments);
public record DirectoryMemberDto(string Name, string Email, string Title);

public static class SubTeams
{
    static readonly string[] EntityTypes = { "project", "program", "product", "release" };

    static async Task<bool> EntityExists(AtlasDbContext db, string type, string id) => type switch
    {
        "project" => await db.Projects.AnyAsync(x => x.Id == id),
        "program" => await db.Programs.AnyAsync(x => x.Id == id),
        "product" => await db.Products.AnyAsync(x => x.Id == id),
        "release" => await db.Releases.AnyAsync(x => x.Id == id),
        _ => false,
    };

    static SubTeamMemberDto ToDto(SubTeamMember m) => new(m.Id, m.Name, m.Email, m.Title);
    static AssignMemberDto ToAssignDto(TeamAssignmentMember m) =>
        new(m.Id, m.Name, m.Email, m.Title, m.Alloc, m.AllocHours, m.StartDate, m.EndDate, m.ExtAlloc, m.ExtHours, m.ExtStartDate, m.ExtEndDate);

    // Build a tracked assignment member from a request, resolving hours→% for
    // both the base and (optional) extension segments.
    static TeamAssignmentMember MemberFrom(SubTeamMemberReq x, int assignmentId = 0) => new()
    {
        TeamAssignmentId = assignmentId,
        Name = x.Name.Trim(), Email = x.Email?.Trim() ?? "", Title = x.Title?.Trim() ?? "",
        Alloc = AllocMath.Percent(x.Alloc, x.AllocHours),
        AllocHours = Math.Max(0, x.AllocHours ?? 0),
        StartDate = x.StartDate?.Trim() ?? "", EndDate = x.EndDate?.Trim() ?? "",
        ExtAlloc = AllocMath.Percent(x.ExtAlloc, x.ExtHours),
        ExtHours = Math.Max(0, x.ExtHours ?? 0),
        ExtStartDate = x.ExtStartDate?.Trim() ?? "", ExtEndDate = x.ExtEndDate?.Trim() ?? "",
    };

    public static void MapSubTeamEndpoints(this RouteGroupBuilder api)
    {
        // Candidate members the caller can add to a sub-team: everyone in the
        // Entra groups mapped to a manager slot within the caller's scope.
        api.MapGet("/subteams/candidates", async (AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            var scope = await Teams.ScopeAsync(db, cfg, http);
            if (scope.Count == 0) return Results.Ok(new { members = Array.Empty<object>() });
            var groups = await db.EntraGroups.Include(g => g.Members).Where(g => scope.Contains(g.ManagerKey)).ToListAsync();
            var members = groups.SelectMany(g => g.Members)
                .Select(m => new { name = m.DisplayName, email = m.Email, title = m.JobTitle })
                .Where(m => !string.IsNullOrWhiteSpace(m.name))
                .GroupBy(m => m.name).Select(g => g.First())
                .OrderBy(m => m.name).ToList();
            return Results.Ok(new { members });
        });

        // ---- Sub-teams (manager-owned rosters) ------------------------------
        api.MapGet("/subteams", async (AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "V") is { } denied) return denied;
            var scope = await Teams.ScopeAsync(db, cfg, http);       // slots the caller manages
            var teams = await db.SubTeams.Include(t => t.Members).OrderBy(t => t.Name).ToListAsync();
            var dto = teams.Select(t => new SubTeamDto(t.Id, t.Name, t.ManagerKey, Teams.SlotLabel(t.ManagerKey),
                t.Description, scope.Contains(t.ManagerKey), t.Members.OrderBy(m => m.Name).Select(ToDto).ToList())).ToList();
            return Results.Ok(new SubTeamsDto(scope.Count > 0, dto));
        });

        api.MapPost("/subteams", async (SubTeamReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            var scope = await Teams.ScopeAsync(db, cfg, http);
            if (scope.Count == 0) return Results.Json(new { error = "Only a team manager or Platform Administrator can create sub-teams." }, statusCode: StatusCodes.Status403Forbidden);
            if (string.IsNullOrWhiteSpace(req.Name)) return Results.BadRequest(new { error = "A sub-team name is required." });
            // Own key by default; Platform Admin may create under any slot in scope.
            var owner = !string.IsNullOrWhiteSpace(req.ManagerKey) && scope.Contains(req.ManagerKey!)
                ? req.ManagerKey!
                : (Permissions.ManagerKey(http, cfg) ?? scope.First());
            var t = new SubTeam { Name = req.Name.Trim(), Description = req.Description?.Trim() ?? "", ManagerKey = owner };
            db.SubTeams.Add(t);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Teams", "Created sub-team", t.Name));
            await db.SaveChangesAsync();
            return Results.Created($"/api/v1/subteams/{t.Id}", new SubTeamDto(t.Id, t.Name, t.ManagerKey, Teams.SlotLabel(t.ManagerKey), t.Description, true, new()));
        });

        api.MapPatch("/subteams/{id:int}", async (int id, SubTeamReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            var t = await db.SubTeams.FindAsync(id);
            if (t is null) return Results.NotFound();
            var scope = await Teams.ScopeAsync(db, cfg, http);
            if (!scope.Contains(t.ManagerKey)) return Results.Forbid();
            if (!string.IsNullOrWhiteSpace(req.Name)) t.Name = req.Name!.Trim();
            if (req.Description is not null) t.Description = req.Description.Trim();
            if (!string.IsNullOrWhiteSpace(req.ManagerKey) && scope.Contains(req.ManagerKey!)) t.ManagerKey = req.ManagerKey!;
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Teams", "Updated sub-team", t.Name));
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        api.MapDelete("/subteams/{id:int}", async (int id, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            var t = await db.SubTeams.FindAsync(id);
            if (t is null) return Results.NotFound();
            var scope = await Teams.ScopeAsync(db, cfg, http);
            if (!scope.Contains(t.ManagerKey)) return Results.Forbid();
            // Detach from any entity it was assigned to, then remove.
            db.TeamAssignments.RemoveRange(db.TeamAssignments.Where(a => a.SubTeamId == id));
            db.SubTeams.Remove(t);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Teams", "Deleted sub-team", t.Name));
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        api.MapPost("/subteams/{id:int}/members", async (int id, SubTeamMemberReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            var t = await db.SubTeams.FindAsync(id);
            if (t is null) return Results.NotFound();
            var scope = await Teams.ScopeAsync(db, cfg, http);
            if (!scope.Contains(t.ManagerKey)) return Results.Forbid();
            if (string.IsNullOrWhiteSpace(req.Name)) return Results.BadRequest(new { error = "A member name is required." });
            var m = new SubTeamMember { SubTeamId = id, Name = req.Name.Trim(), Email = req.Email?.Trim() ?? "", Title = req.Title?.Trim() ?? "" };
            db.SubTeamMembers.Add(m);
            await db.SaveChangesAsync();
            return Results.Created($"/api/v1/subteams/{id}/members/{m.Id}", ToDto(m));
        });

        api.MapDelete("/subteams/members/{memberId:int}", async (int memberId, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            var m = await db.SubTeamMembers.FindAsync(memberId);
            if (m is null) return Results.NotFound();
            var t = await db.SubTeams.FindAsync(m.SubTeamId);
            var scope = await Teams.ScopeAsync(db, cfg, http);
            if (t is null || !scope.Contains(t.ManagerKey)) return Results.Forbid();
            db.SubTeamMembers.Remove(m);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        // ---- Team assignments (attach a sub-team to an entity) --------------
        api.MapGet("/teams/assignments/{type}/{entityId}", async (string type, string entityId, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (!EntityTypes.Contains(type)) return Results.BadRequest(new { error = "Unknown entity type." });
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "V") is { } denied) return denied;
            var canEdit = await Permissions.Allows(http, db, cfg, "cap-projects", "E");
            var rows = await db.TeamAssignments.Include(a => a.Members)
                .Where(a => a.EntityType == type && a.EntityId == entityId).ToListAsync();
            var subs = await db.SubTeams.ToDictionaryAsync(s => s.Id, s => s);
            var dto = rows.Select(a => new TeamAssignmentDto(a.Id, a.SubTeamId,
                a.SubTeamId == 0 ? "Individuals" : subs.TryGetValue(a.SubTeamId, out var s) ? s.Name : "(removed sub-team)",
                a.SubTeamId == 0 ? "" : subs.TryGetValue(a.SubTeamId, out var s2) ? Teams.SlotLabel(s2.ManagerKey) : "",
                a.Members.OrderBy(m => m.Name).Select(ToAssignDto).ToList())).ToList();
            return Results.Ok(new TeamAssignmentsDto(canEdit, dto));
        });

        api.MapPost("/teams/assignments/{type}/{entityId}", async (string type, string entityId, AttachTeamReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            if (!EntityTypes.Contains(type)) return Results.BadRequest(new { error = "Unknown entity type." });
            if (!await EntityExists(db, type, entityId)) return Results.NotFound();
            var sub = await db.SubTeams.Include(s => s.Members).FirstOrDefaultAsync(s => s.Id == req.SubTeamId);
            if (sub is null) return Results.BadRequest(new { error = "Unknown sub-team." });
            if (await db.TeamAssignments.AnyAsync(a => a.EntityType == type && a.EntityId == entityId && a.SubTeamId == req.SubTeamId))
                return Results.Conflict(new { error = "That sub-team is already attached." });
            var a = new TeamAssignment { EntityType = type, EntityId = entityId, SubTeamId = req.SubTeamId };
            // Default to every member of the sub-team when a selection isn't given.
            var chosen = req.Members is { Count: > 0 } m
                ? m.Where(x => !string.IsNullOrWhiteSpace(x.Name)).Select(x => MemberFrom(x))
                : sub.Members.Select(x => new TeamAssignmentMember { Name = x.Name, Email = x.Email, Title = x.Title });
            foreach (var tm in chosen) a.Members.Add(tm);
            db.TeamAssignments.Add(a);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Teams", $"Attached sub-team to {type}", $"{entityId} · {sub.Name}"));
            await db.SaveChangesAsync();
            return Results.Created($"/api/v1/teams/assignments/{type}/{entityId}", new { a.Id });
        });

        api.MapPatch("/teams/assignments/{id:int}", async (int id, SetAssignmentMembersReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            var a = await db.TeamAssignments.Include(x => x.Members).FirstOrDefaultAsync(x => x.Id == id);
            if (a is null) return Results.NotFound();
            db.TeamAssignmentMembers.RemoveRange(a.Members);
            foreach (var x in req.Members.Where(x => !string.IsNullOrWhiteSpace(x.Name)))
                a.Members.Add(MemberFrom(x, a.Id));
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        // Assign an individual person directly to an entity (not via a sub-team).
        // Lands in the entity's shared "Individuals" bucket (SubTeamId 0), created
        // on first use. Same allocation shape as sub-team members.
        api.MapPost("/teams/assignments/{type}/{entityId}/individual", async (string type, string entityId, SubTeamMemberReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            if (!EntityTypes.Contains(type)) return Results.BadRequest(new { error = "Unknown entity type." });
            if (!await EntityExists(db, type, entityId)) return Results.NotFound();
            if (string.IsNullOrWhiteSpace(req.Name)) return Results.BadRequest(new { error = "A person is required." });
            var a = await db.TeamAssignments.Include(x => x.Members)
                .FirstOrDefaultAsync(x => x.EntityType == type && x.EntityId == entityId && x.SubTeamId == 0);
            if (a is null) { a = new TeamAssignment { EntityType = type, EntityId = entityId, SubTeamId = 0 }; db.TeamAssignments.Add(a); }
            var name = req.Name.Trim();
            if (a.Members.Any(x => string.Equals(x.Name, name, StringComparison.OrdinalIgnoreCase)))
                return Results.Conflict(new { error = $"{name} is already assigned individually." });
            a.Members.Add(MemberFrom(req, a.Id));
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Teams", $"Assigned individual to {type}", $"{entityId} · {name}"));
            await db.SaveChangesAsync();
            return Results.Created($"/api/v1/teams/assignments/{type}/{entityId}", new { a.Id });
        });

        // The roster of people who can be assigned individually — everyone in the
        // synced Entra groups (name/email/title).
        api.MapGet("/teams/roster", async (AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "V") is { } denied) return denied;
            var groups = await db.EntraGroups.Include(g => g.Members).ToListAsync();
            var members = groups.SelectMany(g => g.Members)
                .Where(m => !string.IsNullOrWhiteSpace(m.DisplayName))
                .GroupBy(m => m.DisplayName, StringComparer.OrdinalIgnoreCase).Select(g => g.First())
                .OrderBy(m => m.DisplayName)
                .Select(m => new DirectoryMemberDto(m.DisplayName, m.Email, m.JobTitle)).ToList();
            return Results.Ok(members);
        });

        api.MapDelete("/teams/assignments/{id:int}", async (int id, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            var a = await db.TeamAssignments.FindAsync(id);
            if (a is null) return Results.NotFound();
            db.TeamAssignments.Remove(a);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });
    }
}
