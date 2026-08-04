using Microsoft.EntityFrameworkCore;

namespace Atlas.Api.Finance;

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
        ("laborPM",    "Internal labor · PM",           "PMO / PM Lead",                     new[] { "pmlead" }),
        ("laborPO",    "Internal labor · PO",           "PMO / PM Lead",                     new[] { "pmlead" }),
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

    static readonly string[] Kinds = { "actual", "forecast" };
    static string NormKind(string? kind) => kind == "forecast" ? "forecast" : "actual";

    static async Task EnsureAsync(AtlasDbContext db, string scope, string ownerId, string kind)
    {
        // Seed any standard (system) template line this owner is missing. This is
        // idempotent and self-healing: owners created before a new template line
        // (e.g. Internal labor · PM/PO) was added gain it on their next read,
        // without disturbing existing amounts or custom lines.
        var have = (await db.CostLines
            .Where(c => c.Scope == scope && c.OwnerId == ownerId && c.Kind == kind && c.Key != "")
            .Select(c => c.Key).ToListAsync()).ToHashSet();
        var added = false;
        for (var i = 0; i < Template.Length; i++)
        {
            var t = Template[i];
            if (have.Contains(t.Key)) continue;
            db.CostLines.Add(new CostLine { Scope = scope, OwnerId = ownerId, Kind = kind, Key = t.Key, Label = t.Label, Note = t.Note, OwnerRoles = t.Roles.ToList(), IsSystem = true, Amount = 0, Ord = i });
            added = true;
        }
        if (added) await db.SaveChangesAsync();
    }

    // Does the scoped owner (project / program / product) exist?
    static async Task<bool> OwnerExistsAsync(AtlasDbContext db, string scope, string id) => scope switch
    {
        "program" => await db.Programs.AnyAsync(p => p.Id == id),
        "product" => await db.Products.AnyAsync(p => p.Id == id),
        _ => await db.Projects.AnyAsync(p => p.Id == id),
    };

    static async Task<IResult> GetCostsAsync(string scope, string id, string? kind, AtlasDbContext db, IConfiguration cfg, HttpContext http)
    {
        if (!await OwnerExistsAsync(db, scope, id)) return Results.NotFound();
        var k = NormKind(kind);
        await EnsureAsync(db, scope, id, k);
        var lines = await db.CostLines.Where(c => c.Scope == scope && c.OwnerId == id && c.Kind == k).OrderBy(c => c.Ord).ToListAsync();
        var uiRole = Permissions.EffectiveUiRole(http, cfg);
        var total = lines.Where(l => l.Key != "savings").Sum(l => l.Amount);
        var savings = lines.Where(l => l.Key == "savings").Sum(l => l.Amount);
        return Results.Ok(new CostsDto(CanManage(uiRole), total, savings,
            lines.Select(l => new CostLineDto(l.Id, l.Label, l.Note, l.OwnerRoles, l.Amount, CanEditLine(uiRole, l.OwnerRoles), l.IsSystem)).ToList()));
    }

    static async Task<IResult> AddCostAsync(string scope, string id, string? kind, CreateCostReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http)
    {
        var uiRole = Permissions.EffectiveUiRole(http, cfg);
        if (!CanManage(uiRole)) return Results.Json(new { error = "Only PMO / Admin can add cost lines." }, statusCode: StatusCodes.Status403Forbidden);
        if (!await OwnerExistsAsync(db, scope, id)) return Results.NotFound();
        if (string.IsNullOrWhiteSpace(req.Label)) return Results.BadRequest(new { error = "Label is required." });
        var k = NormKind(kind);
        var ord = (await db.CostLines.Where(c => c.Scope == scope && c.OwnerId == id && c.Kind == k).Select(c => (int?)c.Ord).MaxAsync() ?? 0) + 1;
        var line = new CostLine
        {
            Scope = scope, OwnerId = id, Kind = k, Ord = ord, Key = "", Label = req.Label.Trim(), Note = req.Note?.Trim() ?? "Custom",
            OwnerRoles = req.OwnerRoles ?? new(), IsSystem = false, Amount = Math.Max(0, req.Amount ?? 0),
        };
        db.CostLines.Add(line);
        db.AuditEvents.Add(Permissions.Audit(http, cfg, "Costs", "Added cost line", $"{scope} {id} · {line.Label}"));
        await db.SaveChangesAsync();
        return Results.Created($"/api/v1/costs/{line.Id}",
            new CostLineDto(line.Id, line.Label, line.Note, line.OwnerRoles, line.Amount, true, false));
    }

    public static void MapCostEndpoints(this RouteGroupBuilder api)
    {
        // Same role-owned cost taxonomy for projects, programs and products.
        foreach (var (route, scope) in new[] { ("projects", "project"), ("programs", "program"), ("products", "product") })
        {
            api.MapGet($"/{route}/{{id}}/costs", (string id, string? kind, AtlasDbContext db, IConfiguration cfg, HttpContext http) => GetCostsAsync(scope, id, kind, db, cfg, http));
            api.MapPost($"/{route}/{{id}}/costs", (string id, string? kind, CreateCostReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) => AddCostAsync(scope, id, kind, req, db, cfg, http));
        }

        api.MapPatch("/costs/{lineId:int}", async (int lineId, UpdateCostReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            var line = await db.CostLines.FindAsync(lineId);
            if (line is null) return Results.NotFound();
            var uiRole = Permissions.EffectiveUiRole(http, cfg);
            if (!CanEditLine(uiRole, line.OwnerRoles))
                return Results.Json(new { error = "This cost line is owned by another role." }, statusCode: StatusCodes.Status403Forbidden);
            if (req.Amount < 0) return Results.BadRequest(new { error = "Amount cannot be negative." });
            line.Amount = req.Amount;
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Costs", $"Updated {line.Label}", $"{line.Scope} {line.OwnerId} · €{req.Amount:N0}"));
            await db.SaveChangesAsync();
            return Results.Ok(new CostLineDto(line.Id, line.Label, line.Note, line.OwnerRoles, line.Amount, true, line.IsSystem));
        });

        api.MapDelete("/costs/{lineId:int}", async (int lineId, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            var uiRole = Permissions.EffectiveUiRole(http, cfg);
            if (!CanManage(uiRole)) return Results.Json(new { error = "Only PMO / Admin can remove cost lines." }, statusCode: StatusCodes.Status403Forbidden);
            var line = await db.CostLines.FindAsync(lineId);
            if (line is null) return Results.NotFound();
            if (line.IsSystem) return Results.BadRequest(new { error = "Standard cost lines can't be removed." });
            db.CostLines.Remove(line);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Costs", "Removed cost line", $"{line.Scope} {line.OwnerId} · {line.Label}"));
            await db.SaveChangesAsync();
            return Results.NoContent();
        });
    }
}
