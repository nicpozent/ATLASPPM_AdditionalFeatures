using Microsoft.EntityFrameworkCore;

namespace Atlas.Api;

public record ToggleCriterionReq(bool Met);

// ============================================================================
//  Stage gates (G0–G5). Every project carries the standard six-gate rail; the
//  gate names & criteria labels are the reference framework (seeded on first
//  read), while completion and approvals are real per-project governance data.
//  Approving/rejecting a gate and toggling criteria require Full on "Approve
//  demands & gates" (cap-approve) — the same capability that governs approvals.
// ============================================================================
public static class Gates
{
    // The standard rail: code, display name, default approver, criteria labels.
    static readonly (string Code, string Name, string Approver, string[] Criteria)[] Template =
    {
        ("G0", "G0 · Concept / Mandate",   "Sponsor",  new[] { "Business case drafted", "Sponsor identified", "Initial funding envelope" }),
        ("G1", "G1 · Initiation",          "PMO Lead", new[] { "Charter approved", "High-level scope agreed", "Delivery approach selected" }),
        ("G2", "G2 · Plan & Design",       "PMO Lead", new[] { "Detailed plan baselined", "Architecture review passed", "Security review passed", "Budget approved" }),
        ("G3", "G3 · Build ready",         "PMO Lead", new[] { "Requirements baselined", "Test strategy approved", "Resources committed", "Risk register reviewed" }),
        ("G4", "G4 · Release readiness",   "Sponsor",  new[] { "UAT signed off", "Ops handover ready", "Go-live plan approved" }),
        ("G5", "G5 · Close & benefits",    "PMO Lead", new[] { "Benefits realised", "Lessons captured", "Resources released" }),
    };

    // Create the standard rail for a project that doesn't have one yet.
    static async Task EnsureAsync(AtlasDbContext db, string projectId)
    {
        if (await db.Gates.AnyAsync(g => g.ProjectId == projectId)) return;
        for (var i = 0; i < Template.Length; i++)
        {
            var t = Template[i];
            var gate = new Gate { ProjectId = projectId, Code = t.Code, Name = t.Name, Approver = t.Approver, Ord = i };
            for (var c = 0; c < t.Criteria.Length; c++)
                gate.Criteria.Add(new GateCriterion { Label = t.Criteria[c], Met = false, Ord = c });
            db.Gates.Add(gate);
        }
        await db.SaveChangesAsync();
    }

    public static void MapGateEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/projects/{id}/gates", async (string id, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (!await db.Projects.AnyAsync(p => p.Id == id)) return Results.NotFound();
            await EnsureAsync(db, id);
            var gates = await db.Gates.Where(g => g.ProjectId == id).Include(g => g.Criteria)
                .OrderBy(g => g.Ord).ToListAsync();
            var canGovern = await Permissions.Allows(http, db, cfg, "cap-approve", "F");
            return Results.Ok(new GatesDto(canGovern, gates.Select(ToDto).ToList()));
        });

        api.MapPatch("/gates/criteria/{critId:int}", async (int critId, ToggleCriterionReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-approve", "F") is { } denied) return denied;
            var crit = await db.GateCriteria.FindAsync(critId);
            if (crit is null) return Results.NotFound();
            crit.Met = req.Met;
            await db.SaveChangesAsync();
            return Results.Ok(new { crit.Id, crit.Met });
        });

        api.MapPost("/gates/{gateId:int}/approve", (int gateId, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
            DecideAsync(gateId, "Approved", db, cfg, http));
        api.MapPost("/gates/{gateId:int}/reject", (int gateId, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
            DecideAsync(gateId, "Rejected", db, cfg, http));
    }

    static async Task<IResult> DecideAsync(int gateId, string status, AtlasDbContext db, IConfiguration cfg, HttpContext http)
    {
        if (await Permissions.Deny(http, db, cfg, "cap-approve", "F") is { } denied) return denied;
        var gate = await db.Gates.FindAsync(gateId);
        if (gate is null) return Results.NotFound();
        gate.Status = status;
        gate.Date = DateTime.UtcNow.ToString("dd MMM yyyy");
        db.AuditEvents.Add(Permissions.Audit(http, cfg, "Gates", $"{status} gate {gate.Code}", $"{gate.ProjectId} · {gate.Name}"));
        await db.SaveChangesAsync();
        return Results.Ok(ToDto(await db.Gates.Include(g => g.Criteria).FirstAsync(g => g.Id == gateId)));
    }

    static GateDto ToDto(Gate g)
    {
        var crit = g.Criteria.OrderBy(c => c.Ord).ToList();
        var met = crit.Count(c => c.Met);
        var total = crit.Count;
        var pct = total == 0 ? 0 : (int)Math.Round(100.0 * met / total);
        return new GateDto(g.Id, g.Code, g.Name, g.Approver, g.Status, g.Date, pct,
            $"{met} of {total} criteria met",
            crit.Select(c => new GateCriterionDto(c.Id, c.Label, c.Met)).ToList());
    }
}
