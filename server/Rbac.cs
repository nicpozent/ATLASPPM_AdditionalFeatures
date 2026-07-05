using System.Security.Claims;
using Microsoft.EntityFrameworkCore;

namespace Atlas.Api;

// ============================================================================
//  In-app RBAC — the DB-backed Roles & Permissions matrix (Admin screen).
//  A Platform Administrator can add custom roles and edit any permission cell;
//  the six canonical roles + capability catalogue ship as reference data.
//
//  This is the application's OWN authorization layer. It intentionally does NOT
//  write Entra app roles — those stay a small, stable set managed in the app
//  registration (the UI shows the admin exactly what to add there). Client-side
//  role checks remain cosmetic; the API is authoritative.
// ============================================================================

public record CreateRoleReq(string Name, string? Short, string? Who, string? Description,
    string? Icon, string? Color, string? Tint);
public record UpdateRoleReq(string? Name, string? Short, string? Who, string? Description,
    string? Icon, string? Color, string? Tint);
public record SetPermissionReq(string CapabilityKey, string Level);

public static class Rbac
{
    static readonly string[] Levels = { "F", "E", "V", "N" };

    // ---- Shared identity/role helpers (also used by WriteEndpoints) --------
    public static string CallerId(ClaimsPrincipal u) =>
        u.FindFirst("oid")?.Value
        ?? u.FindFirst("http://schemas.microsoft.com/identity/claims/objectidentifier")?.Value
        ?? u.FindFirst("preferred_username")?.Value
        ?? u.Identity?.Name ?? "";

    public static bool IsPlatformAdmin(ClaimsPrincipal u) =>
        u.FindAll("roles").Any(c => c.Value == "PlatformAdmin") || u.IsInRole("PlatformAdmin");

    // Only a Platform Administrator manages roles (anyone in single-user dev).
    static bool CanManage(ClaimsPrincipal u, bool authEnabled) => !authEnabled || IsPlatformAdmin(u);

    public static void MapRoleEndpoints(this RouteGroupBuilder api)
    {
        // Full matrix: capability catalogue + every role's levels.
        api.MapGet("/roles", async (AtlasDbContext db, ClaimsPrincipal user, IConfiguration cfg) =>
        {
            var authEnabled = cfg.GetValue("Auth:Enabled", false);
            var caps = await db.Capabilities.OrderBy(c => c.Sort).ToListAsync();
            var roles = await db.RoleDefs.Include(r => r.Permissions).OrderBy(r => r.Sort).ToListAsync();
            return Results.Ok(new RolesMatrixDto(
                caps.Select(c => new CapabilityDto(c.Key, c.Label)).ToList(),
                roles.Select(ToDto).ToList(),
                CanManage(user, authEnabled)));
        });

        api.MapPost("/roles", async (CreateRoleReq req, AtlasDbContext db, ClaimsPrincipal user, IConfiguration cfg, HttpContext http) =>
        {
            if (!CanManage(user, cfg.GetValue("Auth:Enabled", false))) return Results.Forbid();
            if (string.IsNullOrWhiteSpace(req.Name)) return Results.BadRequest(new { error = "Name is required." });
            var maxSort = await db.RoleDefs.Select(r => (int?)r.Sort).MaxAsync() ?? 0;
            var existing = await db.RoleDefs.Select(r => r.Id).ToListAsync();
            var n = existing.Select(x => x.StartsWith("role-") && int.TryParse(x["role-".Length..], out var i) ? i : 0)
                .DefaultIfEmpty(0).Max() + 1;
            var role = new RoleDef
            {
                Id = $"role-{n}",
                Name = req.Name.Trim(),
                Short = string.IsNullOrWhiteSpace(req.Short) ? Shorten(req.Name) : req.Short!.Trim(),
                Who = req.Who?.Trim() ?? "",
                Description = req.Description?.Trim() ?? "",
                Icon = string.IsNullOrWhiteSpace(req.Icon) ? "shield" : req.Icon!.Trim(),
                Color = string.IsNullOrWhiteSpace(req.Color) ? "#0F6CBD" : req.Color!.Trim(),
                Tint = string.IsNullOrWhiteSpace(req.Tint) ? "#E6EFFB" : req.Tint!.Trim(),
                IsSystem = false,
                Sort = maxSort + 1,
            };
            // A new role starts with no access anywhere; the admin grants cells.
            var capKeys = await db.Capabilities.Select(c => c.Key).ToListAsync();
            role.Permissions = capKeys.Select(k => new RolePermission { RoleId = role.Id, CapabilityKey = k, Level = "N" }).ToList();
            db.RoleDefs.Add(role);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Roles", "Created role", $"{role.Name} ({role.Id})"));
            await db.SaveChangesAsync();
            return Results.Created($"/api/v1/roles/{role.Id}", ToDto(role));
        });

        api.MapPatch("/roles/{id}", async (string id, UpdateRoleReq req, AtlasDbContext db, ClaimsPrincipal user, IConfiguration cfg, HttpContext http) =>
        {
            if (!CanManage(user, cfg.GetValue("Auth:Enabled", false))) return Results.Forbid();
            var role = await db.RoleDefs.Include(r => r.Permissions).FirstOrDefaultAsync(r => r.Id == id);
            if (role is null) return Results.NotFound();
            if (!string.IsNullOrWhiteSpace(req.Name)) role.Name = req.Name!.Trim();
            if (req.Short is not null) role.Short = req.Short.Trim();
            if (req.Who is not null) role.Who = req.Who.Trim();
            if (req.Description is not null) role.Description = req.Description.Trim();
            if (!string.IsNullOrWhiteSpace(req.Icon)) role.Icon = req.Icon!.Trim();
            if (!string.IsNullOrWhiteSpace(req.Color)) role.Color = req.Color!.Trim();
            if (!string.IsNullOrWhiteSpace(req.Tint)) role.Tint = req.Tint!.Trim();
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Roles", "Updated role", $"{role.Name} ({role.Id})"));
            await db.SaveChangesAsync();
            return Results.Ok(ToDto(role));
        });

        api.MapDelete("/roles/{id}", async (string id, AtlasDbContext db, ClaimsPrincipal user, IConfiguration cfg, HttpContext http) =>
        {
            if (!CanManage(user, cfg.GetValue("Auth:Enabled", false))) return Results.Forbid();
            var role = await db.RoleDefs.FindAsync(id);
            if (role is null) return Results.NotFound();
            if (role.IsSystem) return Results.BadRequest(new { error = "Canonical roles cannot be deleted." });
            db.RoleDefs.Remove(role);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Roles", "Deleted role", $"{role.Name} ({role.Id})"));
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        // Set a single matrix cell (role × capability) to F/E/V/N.
        api.MapPut("/roles/{id}/permissions", async (string id, SetPermissionReq req, AtlasDbContext db, ClaimsPrincipal user, IConfiguration cfg, HttpContext http) =>
        {
            if (!CanManage(user, cfg.GetValue("Auth:Enabled", false))) return Results.Forbid();
            if (!Levels.Contains(req.Level)) return Results.BadRequest(new { error = "Level must be F, E, V or N." });
            var role = await db.RoleDefs.FindAsync(id);
            if (role is null) return Results.NotFound();
            var cap = await db.Capabilities.FindAsync(req.CapabilityKey);
            if (cap is null) return Results.BadRequest(new { error = "Unknown capability." });
            var perm = await db.RolePermissions.FirstOrDefaultAsync(p => p.RoleId == id && p.CapabilityKey == req.CapabilityKey);
            if (perm is null)
                db.RolePermissions.Add(new RolePermission { RoleId = id, CapabilityKey = req.CapabilityKey, Level = req.Level });
            else
                perm.Level = req.Level;
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Roles", $"Set “{cap.Label}” = {req.Level}", $"{role.Name} ({role.Id})"));
            await db.SaveChangesAsync();
            return Results.Ok(new { roleId = id, capabilityKey = req.CapabilityKey, level = req.Level });
        });
    }

    static RoleDto ToDto(RoleDef r) => new(
        r.Id, r.Name, r.Short, r.Who, r.Description, r.Icon, r.Color, r.Tint, r.IsSystem,
        r.Permissions.ToDictionary(p => p.CapabilityKey, p => p.Level));

    static string Shorten(string name)
    {
        var t = name.Trim();
        return t.Length <= 8 ? t : t[..8];
    }

    // ---- Reference-data seed (idempotent) ---------------------------------
    // The canonical roles + capability catalogue are structural chrome (the
    // prototype hard-codes this exact matrix). We seed it as reference data so
    // the screen renders faithfully by default, then let the admin edit it.
    // This is NOT demo portfolio data and is seeded regardless of Seed:Enabled.
    public static async Task SeedAsync(AtlasDbContext db)
    {
        if (await db.Capabilities.AnyAsync() || await db.RoleDefs.AnyAsync()) return;

        // Column order matches the level strings on each role below.
        var caps = new (string Key, string Label)[]
        {
            ("cap-dashboards",    "Dashboards & reports"),
            ("cap-export",        "Pull / export reports"),
            ("cap-stk-projects",  "Stakeholder projects"),
            ("cap-projects",      "Projects & tasks"),
            ("cap-submit-demand", "Submit a demand"),
            ("cap-track-demand",  "Track own demand status"),
            ("cap-edit-demand",   "Edit demand fields"),
            ("cap-demand-scoring","Demand scoring"),
            ("cap-approve",       "Approve demands & gates"),
            ("cap-methodology",   "Methodology templates"),
            ("cap-artifacts",     "Comments & artifacts"),
            ("cap-integrations",  "Integrations & connectors"),
            ("cap-users-roles",   "Users, groups & roles"),
            ("cap-backups",       "Backups & restore"),
            ("cap-platform",      "Platform & SSO settings"),
            ("cap-audit",         "Audit & activity log"),
        };
        for (var i = 0; i < caps.Length; i++)
            db.Capabilities.Add(new Capability { Key = caps[i].Key, Label = caps[i].Label, Sort = i });

        // Levels per role, in the same column order as `caps`.
        var roles = new (string Id, string Name, string Short, string Who, string Icon, string Color, string Tint, string Desc, string Levels)[]
        {
            ("admin",   "Platform Administrator", "Admin",   "IT / Platform team",     "shieldUser", "#11163A", "#E6EAF5", "Full control of the platform — configuration, integrations, users, roles, backups & restore.", "FFFFFFFFFFFFFFFF"),
            ("pmo",     "PMO Lead",               "PMO",     "Portfolio office",       "shield",     "#0F6CBD", "#E6EFFB", "Governs the portfolio: methodologies, demand approvals, cross-project reporting.",              "FFFFFFFFFFFNNNNV"),
            ("pm",      "Project Manager",        "PM",      "Delivery",               "folder",     "#7A3FB0", "#F0E8F7", "Plans and runs projects: schedule, tasks, artifacts, RAID, status reporting.",                 "FEFFEFEENNFNNNNN"),
            ("team",    "Team Member",            "Team",    "Squads & contributors",  "users",      "#15A34A", "#E7F4EC", "Works assigned tasks, updates progress, comments and raises blockers.",                        "VNFEEFNENNENNNNN"),
            ("exec",    "Executive / Sponsor",    "Exec",    "Leadership",             "trendUp",    "#C98A00", "#FBF2D7", "Read-only dashboards, approves gates and funding, exports board reports.",                      "VVVNNFNNFNVNNNNN"),
            ("stkhldr", "Stakeholder",            "Stkhldr", "Business / requesters",  "userCheck",  "#0E7C7B", "#DEF2F1", "Sees only projects where they are a stakeholder; can submit demands and track their status.",   "NNVNEVNNNNNNNNNN"),
        };
        for (var r = 0; r < roles.Length; r++)
        {
            var def = roles[r];
            var role = new RoleDef
            {
                Id = def.Id, Name = def.Name, Short = def.Short, Who = def.Who,
                Description = def.Desc, Icon = def.Icon, Color = def.Color, Tint = def.Tint,
                IsSystem = true, Sort = r,
            };
            for (var c = 0; c < caps.Length; c++)
                role.Permissions.Add(new RolePermission { RoleId = def.Id, CapabilityKey = caps[c].Key, Level = def.Levels[c].ToString() });
            db.RoleDefs.Add(role);
        }
        await db.SaveChangesAsync();
    }

    // ---- Capability reconcile (idempotent, runs every startup) -------------
    // Adds capabilities introduced after the initial seed to BOTH fresh and
    // already-seeded databases, plus a sensible default level per existing role.
    // Only inserts what's missing, so it's safe to run on every boot and never
    // overwrites an admin's edits.
    public static async Task ReconcileAsync(AtlasDbContext db)
    {
        // New assignable rights. Sort continues after the 16 seeded capabilities.
        var extra = new (string Key, string Label, int Sort)[]
        {
            ("cap-okrs",     "OKRs",             16),
            ("cap-products", "Products",         17),
            ("cap-ways",     "Ways of working",  18),
            ("cap-schedule", "Project schedule", 19),
        };
        // Default level per role id for each new capability (absent role → "N").
        var defaults = new Dictionary<string, Dictionary<string, string>>
        {
            ["cap-okrs"]     = new() { ["admin"] = "F", ["pmo"] = "F" },
            ["cap-products"] = new() { ["admin"] = "F", ["pmo"] = "F" },
            ["cap-ways"]     = new() { ["admin"] = "F", ["pmo"] = "F" },
            ["cap-schedule"] = new() { ["admin"] = "F", ["pmo"] = "F", ["pm"] = "F" },
        };

        var existingCaps = (await db.Capabilities.Select(c => c.Key).ToListAsync()).ToHashSet();
        var roleIds = await db.RoleDefs.Select(r => r.Id).ToListAsync();
        var perms = await db.RolePermissions.Select(p => new { p.RoleId, p.CapabilityKey }).ToListAsync();
        var have = perms.Select(p => (p.RoleId, p.CapabilityKey)).ToHashSet();
        var changed = false;

        foreach (var (key, label, sort) in extra)
        {
            if (!existingCaps.Contains(key)) { db.Capabilities.Add(new Capability { Key = key, Label = label, Sort = sort }); changed = true; }
            foreach (var rid in roleIds)
            {
                if (have.Contains((rid, key))) continue;
                var level = defaults.TryGetValue(key, out var m) && m.TryGetValue(rid, out var l) ? l : "N";
                db.RolePermissions.Add(new RolePermission { RoleId = rid, CapabilityKey = key, Level = level });
                changed = true;
            }
        }
        if (changed) { await db.SaveChangesAsync(); changed = false; }

        // PM Lead — a distinct role that mirrors Project Manager's permissions at
        // creation (leads a group of PMs). Added here so it lands on existing DBs
        // too; cloned from pm's current permission set so it inherits every cap.
        if (!await db.RoleDefs.AnyAsync(r => r.Id == "pmlead") && await db.RoleDefs.AnyAsync(r => r.Id == "pm"))
        {
            var maxSort = await db.RoleDefs.MaxAsync(r => (int?)r.Sort) ?? 0;
            db.RoleDefs.Add(new RoleDef
            {
                Id = "pmlead", Name = "PM Lead", Short = "PM Lead", Who = "Delivery",
                Description = "Leads a group of project managers — same delivery permissions as a Project Manager.",
                Icon = "folder", Color = "#7A3FB0", Tint = "#F0E8F7", IsSystem = true, Sort = maxSort + 1,
            });
            var pmPerms = await db.RolePermissions.Where(p => p.RoleId == "pm").ToListAsync();
            foreach (var p in pmPerms)
                db.RolePermissions.Add(new RolePermission { RoleId = "pmlead", CapabilityKey = p.CapabilityKey, Level = p.Level });
            changed = true;
        }
        if (changed) await db.SaveChangesAsync();
    }
}
