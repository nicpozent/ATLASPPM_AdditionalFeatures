using Microsoft.EntityFrameworkCore;

namespace Atlas.Api;

public record ToggleCriterionReq(bool? Met, string? Label);
public record AddCriterionReq(string Label);
public record CreateDecisionReq(string Title, string? Context, string? Decision, string? Owner, string? Status);
public record CreateRaidReq(string Type, string Title, string? Owner, string? Status);
public record UpdateRaidReq(string? Type, string? Title, string? Owner, string? Status);

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
            if (req.Met is { } m) crit.Met = m;
            if (req.Label is not null)
            {
                if (string.IsNullOrWhiteSpace(req.Label)) return Results.BadRequest(new { error = "Label is required." });
                crit.Label = req.Label.Trim();
            }
            await db.SaveChangesAsync();
            return Results.Ok(new { crit.Id, crit.Label, crit.Met });
        });

        // Add a criterion to a gate — makes the security/architecture review
        // gates configurable rather than a fixed checklist.
        api.MapPost("/gates/{gateId:int}/criteria", async (int gateId, AddCriterionReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-approve", "F") is { } denied) return denied;
            var gate = await db.Gates.Include(g => g.Criteria).FirstOrDefaultAsync(g => g.Id == gateId);
            if (gate is null) return Results.NotFound();
            if (string.IsNullOrWhiteSpace(req.Label)) return Results.BadRequest(new { error = "Label is required." });
            var ord = (gate.Criteria.Count == 0 ? -1 : gate.Criteria.Max(c => c.Ord)) + 1;
            var crit = new GateCriterion { GateId = gateId, Label = req.Label.Trim(), Met = false, Ord = ord };
            db.GateCriteria.Add(crit);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Gates", "Added gate criterion", $"{gate.ProjectId} · {gate.Code} · {crit.Label}"));
            await db.SaveChangesAsync();
            return Results.Ok(new { crit.Id, crit.Label, crit.Met });
        });

        api.MapDelete("/gates/criteria/{critId:int}", async (int critId, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-approve", "F") is { } denied) return denied;
            var crit = await db.GateCriteria.FindAsync(critId);
            if (crit is null) return Results.NotFound();
            db.GateCriteria.Remove(crit);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Gates", "Removed gate criterion", crit.Label));
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        api.MapPost("/gates/{gateId:int}/approve", (int gateId, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
            DecideAsync(gateId, "Approved", db, cfg, http));
        api.MapPost("/gates/{gateId:int}/reject", (int gateId, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
            DecideAsync(gateId, "Rejected", db, cfg, http));

        // ---- Decision log (ADR) -------------------------------------------
        api.MapGet("/projects/{id}/decisions", async (string id, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (!await db.Projects.AnyAsync(p => p.Id == id)) return Results.NotFound();
            var decisions = await db.Decisions.Where(d => d.ProjectId == id).OrderBy(d => d.Ord).ToListAsync();
            var canGovern = await Permissions.Allows(http, db, cfg, "cap-approve", "F");
            return Results.Ok(new DecisionsDto(canGovern,
                decisions.Select(d => new DecisionDto(d.Code, d.Title, d.Context, d.DecisionText, d.Owner, d.Date, d.Status)).ToList()));
        });

        api.MapPost("/projects/{id}/decisions", async (string id, CreateDecisionReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-approve", "F") is { } denied) return denied;
            if (!await db.Projects.AnyAsync(p => p.Id == id)) return Results.NotFound();
            if (string.IsNullOrWhiteSpace(req.Title)) return Results.BadRequest(new { error = "Title is required." });
            var existing = await db.Decisions.Where(d => d.ProjectId == id).Select(d => d.Ord).ToListAsync();
            var next = (existing.DefaultIfEmpty(0).Max()) + 1;
            var status = new[] { "Proposed", "Approved", "Rejected" }.Contains(req.Status) ? req.Status! : "Proposed";
            var dec = new Decision
            {
                ProjectId = id, Ord = next, Code = $"DEC-{next:00}",
                Title = req.Title.Trim(), Context = req.Context?.Trim() ?? "", DecisionText = req.Decision?.Trim() ?? "",
                Owner = string.IsNullOrWhiteSpace(req.Owner) ? "—" : req.Owner!.Trim(),
                Date = DateTime.UtcNow.ToString("dd MMM yyyy"), Status = status,
            };
            db.Decisions.Add(dec);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Decisions", "Logged decision", $"{id} · {dec.Code} {dec.Title}"));
            await db.SaveChangesAsync();
            return Results.Created($"/api/v1/projects/{id}/decisions/{dec.Code}",
                new DecisionDto(dec.Code, dec.Title, dec.Context, dec.DecisionText, dec.Owner, dec.Date, dec.Status));
        });

        // ---- RAID register ------------------------------------------------
        api.MapGet("/projects/{id}/raid", async (string id, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (!await db.Projects.AnyAsync(p => p.Id == id)) return Results.NotFound();
            // Keep the auto-raised spillover risk in sync before reading the log.
            await Spillover.ReconcileRaidAsync(db, id, http, cfg);
            var items = await db.RaidItems.Where(r => r.ProjectId == id).OrderBy(r => r.Ord).ToListAsync();
            var canEdit = await Permissions.Allows(http, db, cfg, "cap-projects", "E");
            return Results.Ok(new RaidDto(canEdit,
                items.Select(r => new RaidItemDto(r.Id, r.Type, r.Title, r.Owner, r.Status, r.Auto)).ToList()));
        });

        api.MapPost("/projects/{id}/raid", async (string id, CreateRaidReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            if (!await db.Projects.AnyAsync(p => p.Id == id)) return Results.NotFound();
            if (string.IsNullOrWhiteSpace(req.Title)) return Results.BadRequest(new { error = "Title is required." });
            var type = new[] { "Risk", "Issue", "Assumption", "Dependency" }.Contains(req.Type) ? req.Type : "Risk";
            var next = (await db.RaidItems.Where(r => r.ProjectId == id).Select(r => (int?)r.Ord).MaxAsync() ?? 0) + 1;
            var item = new RaidItem
            {
                ProjectId = id, Ord = next, Type = type, Title = req.Title.Trim(),
                Owner = string.IsNullOrWhiteSpace(req.Owner) ? "—" : req.Owner!.Trim(),
                Status = string.IsNullOrWhiteSpace(req.Status) ? "Open" : req.Status!.Trim(),
            };
            db.RaidItems.Add(item);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "RAID", $"Logged {type.ToLower()}", $"{id} · {item.Title}"));
            await db.SaveChangesAsync();
            return Results.Created($"/api/v1/projects/{id}/raid/{item.Id}",
                new RaidItemDto(item.Id, item.Type, item.Title, item.Owner, item.Status));
        });

        // Move a RAID item along its lifecycle, or edit its type/title/owner.
        // Auto-raised items are system-managed, so they can't be hand-edited.
        api.MapPatch("/raid/{raidId:int}", async (int raidId, UpdateRaidReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            var item = await db.RaidItems.FindAsync(raidId);
            if (item is null) return Results.NotFound();
            if (item.Auto) return Results.BadRequest(new { error = "Auto-raised items are managed by Atlas and can't be edited." });
            if (req.Type is not null)
            {
                if (!RaidTypes.Contains(req.Type)) return Results.BadRequest(new { error = "Unknown type." });
                item.Type = req.Type;
            }
            if (req.Title is not null)
            {
                if (string.IsNullOrWhiteSpace(req.Title)) return Results.BadRequest(new { error = "Title is required." });
                item.Title = req.Title.Trim();
            }
            if (req.Owner is not null) item.Owner = string.IsNullOrWhiteSpace(req.Owner) ? "—" : req.Owner.Trim();
            if (req.Status is not null)
            {
                if (!RaidStatuses.Contains(req.Status)) return Results.BadRequest(new { error = "Unknown status." });
                item.Status = req.Status;
            }
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "RAID", "Updated item", $"{item.ProjectId} · {item.Title} → {item.Status}"));
            await db.SaveChangesAsync();
            return Results.Ok(new RaidItemDto(item.Id, item.Type, item.Title, item.Owner, item.Status, item.Auto));
        });

        api.MapDelete("/raid/{raidId:int}", async (int raidId, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            var item = await db.RaidItems.FindAsync(raidId);
            if (item is null) return Results.NotFound();
            if (item.Auto) return Results.BadRequest(new { error = "Auto-raised items clear themselves when the underlying condition resolves." });
            db.RaidItems.Remove(item);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "RAID", "Removed item", $"{item.ProjectId} · {item.Title}"));
            await db.SaveChangesAsync();
            return Results.NoContent();
        });
    }

    static readonly string[] RaidTypes = { "Risk", "Issue", "Assumption", "Dependency" };
    static readonly string[] RaidStatuses = { "Open", "Mitigating", "Validating", "On track", "Resolved", "Closed" };

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
