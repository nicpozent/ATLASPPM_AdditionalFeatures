using Microsoft.EntityFrameworkCore;

namespace Atlas.Api;

public record CreateRequirementReq(string Title, string? Type, string? Priority, string? Status,
    string? Epic, string? Story, string? Test, string? TestStatus, string? Release);
public record SetTestStatusReq(string TestStatus);
public record CreateChangeReq(string Title, string? ReqCode, string? Impact, string? Sdp);

// ============================================================================
//  Requirements & traceability — requirement → epic/story → test → release,
//  plus scope change requests. Requirements/CRs are project delivery work:
//  editing requires Edit on "Projects & tasks" (cap-projects).
// ============================================================================
public static class Requirements
{
    static readonly string[] Types = { "Functional", "Non-functional", "Compliance" };
    static readonly string[] Priorities = { "Critical", "High", "Medium", "Low" };
    static readonly string[] Statuses = { "Draft", "In review", "Approved" };
    static readonly string[] TestStatuses = { "Not run", "In test", "Passed", "Failed" };
    static readonly string[] Impacts = { "Low", "Medium", "High" };

    public static void MapRequirementEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/projects/{id}/requirements", async (string id, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (!await db.Projects.AnyAsync(p => p.Id == id)) return Results.NotFound();
            var reqs = await db.Requirements.Where(r => r.ProjectId == id).OrderBy(r => r.Ord).ToListAsync();
            var crs = await db.ChangeRequests.Where(c => c.ProjectId == id).OrderByDescending(c => c.Ord).ToListAsync();
            var canEdit = await Permissions.Allows(http, db, cfg, "cap-projects", "E");
            var total = reqs.Count;
            var stats = new ReqStatsDto(total, reqs.Count(r => r.Status == "Approved"),
                total == 0 ? 0 : (int)Math.Round(100.0 * reqs.Count(r => !string.IsNullOrEmpty(r.Test) && r.Test != "—") / total),
                reqs.Count(r => r.Verified));
            return Results.Ok(new RequirementsDto(canEdit, stats,
                reqs.Select(ToReqDto).ToList(), crs.Select(ToCrDto).ToList()));
        });

        api.MapPost("/projects/{id}/requirements", async (string id, CreateRequirementReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            if (!await db.Projects.AnyAsync(p => p.Id == id)) return Results.NotFound();
            if (string.IsNullOrWhiteSpace(req.Title)) return Results.BadRequest(new { error = "Title is required." });
            var ord = (await db.Requirements.Where(r => r.ProjectId == id).Select(r => (int?)r.Ord).MaxAsync() ?? 0) + 1;
            var r = new Requirement
            {
                ProjectId = id, Ord = ord, Code = $"REQ-{ord:00}", Title = req.Title.Trim(),
                Type = Types.Contains(req.Type) ? req.Type! : "Functional",
                Priority = Priorities.Contains(req.Priority) ? req.Priority! : "Medium",
                Status = Statuses.Contains(req.Status) ? req.Status! : "Draft",
                Epic = req.Epic?.Trim() ?? "", Story = req.Story?.Trim() ?? "",
                Test = string.IsNullOrWhiteSpace(req.Test) ? "—" : req.Test!.Trim(),
                TestStatus = TestStatuses.Contains(req.TestStatus) ? req.TestStatus! : "Not run",
                Release = string.IsNullOrWhiteSpace(req.Release) ? "Backlog" : req.Release!.Trim(),
            };
            db.Requirements.Add(r);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Requirements", "Created requirement", $"{id} · {r.Code} {r.Title}"));
            await db.SaveChangesAsync();
            return Results.Created($"/api/v1/projects/{id}/requirements/{r.Id}", ToReqDto(r));
        });

        api.MapPatch("/requirements/{reqId:int}", async (int reqId, SetTestStatusReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            if (!TestStatuses.Contains(req.TestStatus)) return Results.BadRequest(new { error = "Unknown test status." });
            var r = await db.Requirements.FindAsync(reqId);
            if (r is null) return Results.NotFound();
            r.TestStatus = req.TestStatus;
            r.Verified = req.TestStatus == "Passed";
            await db.SaveChangesAsync();
            return Results.Ok(ToReqDto(r));
        });

        api.MapPost("/projects/{id}/change-requests", async (string id, CreateChangeReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            if (!await db.Projects.AnyAsync(p => p.Id == id)) return Results.NotFound();
            if (string.IsNullOrWhiteSpace(req.Title)) return Results.BadRequest(new { error = "Title is required." });
            var ord = (await db.ChangeRequests.Where(c => c.ProjectId == id).Select(c => (int?)c.Ord).MaxAsync() ?? 0) + 1;
            var cr = new ChangeRequest
            {
                ProjectId = id, Ord = ord, Code = $"CR-{ord:00}", Title = req.Title.Trim(),
                ReqCode = req.ReqCode?.Trim() ?? "", Impact = Impacts.Contains(req.Impact) ? req.Impact! : "Medium",
                Sdp = req.Sdp?.Trim() ?? "", Status = "Pending",
                RaisedBy = Permissions.ActorName(http, cfg), Date = DateTime.UtcNow.ToString("dd MMM yyyy"),
            };
            db.ChangeRequests.Add(cr);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Requirements", "Raised change request", $"{id} · {cr.Code} {cr.Title}"));
            await db.SaveChangesAsync();
            return Results.Created($"/api/v1/projects/{id}/change-requests/{cr.Id}", ToCrDto(cr));
        });
    }

    static RequirementDto ToReqDto(Requirement r) =>
        new(r.Id, r.Code, r.Title, r.Type, r.Priority, r.Status, r.Epic, r.Story, r.Test, r.TestStatus, r.Release, r.Verified);
    static ChangeRequestDto ToCrDto(ChangeRequest c) =>
        new(c.Id, c.Code, c.Title, c.ReqCode, c.Impact, c.Sdp, c.Status, c.RaisedBy, c.Date);
}
