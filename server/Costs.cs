using Microsoft.EntityFrameworkCore;

namespace Atlas.Api;

public record UpdateCostReq(decimal Amount);
public record CreateCostReq(string Label, string? Note, List<string>? OwnerRoles, decimal? Amount);

// ============================================================================
//  Financial cost lines — each project has a standard, role-owned cost taxonomy
//  (internal labour Dev/Arch/Infra, License, PaaS/IaaS/SaaS, Vendor, Savings).
//  A line's amount is editable only by the roles that own it, plus PMO/Admin.
//  Adding/removing custom lines is PMO/Admin only. Amounts in whole euros.
// ============================================================================
public static class Costs
{
    // key, label, owner display, owning UI roles. Savings has no owner → PMO/Admin only.
    static readonly (string Key, string Label, string Note, string[] Roles)[] Template =
    {
        ("laborDev",   "Internal labor · Dev",          "Eng. Manager / Developers Manager", new[] { "teammgr", "devmgr" }),
        ("laborArch",  "Internal labor · Architecture", "Chief Architect",                   new[] { "architect" }),
        ("laborInfra", "Internal labor · Infra",        "Global Service Mgr / Infra Manager",new[] { "svcmgr", "inframgr" }),
        ("licDev",     "License · Dev",                 "Eng. Manager / Developers Manager", new[] { "teammgr", "devmgr" }),
        ("licInfra",   "License · Infra",               "Infra Manager / Global Service Mgr",new[] { "inframgr", "svcmgr" }),
        ("paasDev",    "PaaS · Dev",                    "Eng. Manager / Developers Manager", new[] { "teammgr", "devmgr" }),
        ("paasInfra",  "PaaS · Infra",                  "Infra Manager / Global Service Mgr",new[] { "inframgr", "svcmgr" }),
        ("iaasInfra",  "IaaS · Infra",                  "Infra Manager / Global Service Mgr",new[] { "inframgr", "svcmgr" }),
        ("saasDev",    "SaaS · Dev",                    "Eng. Manager / Developers Manager", new[] { "teammgr", "devmgr" }),
        ("saasInfra",  "SaaS · Infra",                  "Infra Manager / Global Service Mgr",new[] { "inframgr", "svcmgr" }),
        ("vendor",     "Vendor / other",                "PMO",                               new[] { "pmo" }),
        ("savings",    "Savings / benefit",             "PMO / Admin",                       System.Array.Empty<string>()),
    };

    // A line is editable by PMO/Admin (all lines) or by a role that owns it.
    // Empty uiRole = dev with no impersonation → full access.
    static bool CanEditLine(string uiRole, List<string> ownerRoles) =>
        string.IsNullOrEmpty(uiRole) || uiRole == "admin" || uiRole == "pmo" || ownerRoles.Contains(uiRole);
    static bool CanManage(string uiRole) => string.IsNullOrEmpty(uiRole) || uiRole == "admin" || uiRole == "pmo";

    static async Task EnsureAsync(AtlasDbContext db, string projectId)
    {
        if (await db.CostLines.AnyAsync(c => c.ProjectId == projectId)) return;
        for (var i = 0; i < Template.Length; i++)
        {
            var t = Template[i];
            db.CostLines.Add(new CostLine { ProjectId = projectId, Key = t.Key, Label = t.Label, Note = t.Note, OwnerRoles = t.Roles.ToList(), IsSystem = true, Amount = 0, Ord = i });
        }
        await db.SaveChangesAsync();
    }

    public static void MapCostEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/projects/{id}/costs", async (string id, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (!await db.Projects.AnyAsync(p => p.Id == id)) return Results.NotFound();
            await EnsureAsync(db, id);
            var lines = await db.CostLines.Where(c => c.ProjectId == id).OrderBy(c => c.Ord).ToListAsync();
            var uiRole = Permissions.EffectiveUiRole(http, cfg);
            var total = lines.Where(l => l.Key != "savings").Sum(l => l.Amount);
            var savings = lines.Where(l => l.Key == "savings").Sum(l => l.Amount);
            return Results.Ok(new CostsDto(CanManage(uiRole), total, savings,
                lines.Select(l => new CostLineDto(l.Id, l.Label, l.Note, l.OwnerRoles, l.Amount, CanEditLine(uiRole, l.OwnerRoles), l.IsSystem)).ToList()));
        });

        api.MapPatch("/costs/{lineId:int}", async (int lineId, UpdateCostReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            var line = await db.CostLines.FindAsync(lineId);
            if (line is null) return Results.NotFound();
            var uiRole = Permissions.EffectiveUiRole(http, cfg);
            if (!CanEditLine(uiRole, line.OwnerRoles))
                return Results.Json(new { error = "This cost line is owned by another role." }, statusCode: StatusCodes.Status403Forbidden);
            if (req.Amount < 0) return Results.BadRequest(new { error = "Amount cannot be negative." });
            line.Amount = req.Amount;
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Costs", $"Updated {line.Label}", $"{line.ProjectId} · €{req.Amount:N0}"));
            await db.SaveChangesAsync();
            return Results.Ok(new CostLineDto(line.Id, line.Label, line.Note, line.OwnerRoles, line.Amount, true, line.IsSystem));
        });

        api.MapPost("/projects/{id}/costs", async (string id, CreateCostReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            var uiRole = Permissions.EffectiveUiRole(http, cfg);
            if (!CanManage(uiRole)) return Results.Json(new { error = "Only PMO / Admin can add cost lines." }, statusCode: StatusCodes.Status403Forbidden);
            if (!await db.Projects.AnyAsync(p => p.Id == id)) return Results.NotFound();
            if (string.IsNullOrWhiteSpace(req.Label)) return Results.BadRequest(new { error = "Label is required." });
            var ord = (await db.CostLines.Where(c => c.ProjectId == id).Select(c => (int?)c.Ord).MaxAsync() ?? 0) + 1;
            var line = new CostLine
            {
                ProjectId = id, Ord = ord, Key = "", Label = req.Label.Trim(), Note = req.Note?.Trim() ?? "Custom",
                OwnerRoles = req.OwnerRoles ?? new(), IsSystem = false, Amount = Math.Max(0, req.Amount ?? 0),
            };
            db.CostLines.Add(line);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Costs", "Added cost line", $"{id} · {line.Label}"));
            await db.SaveChangesAsync();
            return Results.Created($"/api/v1/costs/{line.Id}",
                new CostLineDto(line.Id, line.Label, line.Note, line.OwnerRoles, line.Amount, true, false));
        });

        api.MapDelete("/costs/{lineId:int}", async (int lineId, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            var uiRole = Permissions.EffectiveUiRole(http, cfg);
            if (!CanManage(uiRole)) return Results.Json(new { error = "Only PMO / Admin can remove cost lines." }, statusCode: StatusCodes.Status403Forbidden);
            var line = await db.CostLines.FindAsync(lineId);
            if (line is null) return Results.NotFound();
            if (line.IsSystem) return Results.BadRequest(new { error = "Standard cost lines can't be removed." });
            db.CostLines.Remove(line);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Costs", "Removed cost line", $"{line.ProjectId} · {line.Label}"));
            await db.SaveChangesAsync();
            return Results.NoContent();
        });
    }
}
