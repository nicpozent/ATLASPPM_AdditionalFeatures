using System.Security.Claims;
using Microsoft.EntityFrameworkCore;

namespace Atlas.Api;

// ============================================================================
//  Permission enforcement — turns the DB-backed matrix (see Rbac.cs) into real
//  authorization on write endpoints.
//
//  The caller's effective role is resolved from:
//    • the Entra `roles` claim when auth is ON  (authoritative, tamper-proof)
//    • the `X-Atlas-Role` header when auth is OFF (the demo's role switcher, so
//      the mockup can actually SHOW enforcement — the header is ignored the
//      moment real auth is on, so it is never a security hole)
//  When auth is off and no header is sent (curl, other tools), access is full —
//  the single-user dev default is unchanged.
// ============================================================================
public static class Permissions
{
    // Level ranking: None < View < Edit < Full.
    static int Rank(string level) => level switch { "F" => 3, "E" => 2, "V" => 1, _ => 0 };

    // Both the 9 cosmetic UI identities and the 6 canonical Entra roles collapse
    // onto the six RoleDef ids that head the matrix.
    static readonly Dictionary<string, string> RoleMap = new(StringComparer.OrdinalIgnoreCase)
    {
        // UI switcher identities (nav.ts ROLES)
        ["admin"] = "admin", ["pmo"] = "pmo", ["pm"] = "pm",
        ["teammgr"] = "team", ["svcmgr"] = "team", ["devmgr"] = "team", ["inframgr"] = "team",
        ["architect"] = "pmo", ["stakeholder"] = "stkhldr",
        // Canonical Entra app roles
        ["PlatformAdmin"] = "admin", ["PMO"] = "pmo", ["ProjectManager"] = "pm",
        ["TeamMember"] = "team", ["Executive"] = "exec", ["Stakeholder"] = "stkhldr",
    };
    // Tie-break when a user carries several roles: keep the most privileged.
    static readonly string[] Privilege = { "admin", "pmo", "pm", "exec", "team", "stkhldr" };

    // Returns the effective RoleDef id, or null for "full access" (dev, no header).
    public static string? ResolveRoleId(ClaimsPrincipal user, HttpRequest req, bool authEnabled)
    {
        if (authEnabled)
        {
            var ids = user.FindAll("roles").Concat(user.FindAll(ClaimTypes.Role))
                .Select(c => RoleMap.GetValueOrDefault(c.Value))
                .Where(x => x is not null).Select(x => x!).ToHashSet();
            return Privilege.FirstOrDefault(ids.Contains) ?? "stkhldr"; // unknown → least privilege
        }
        var header = req.Headers["X-Atlas-Role"].ToString();
        return string.IsNullOrWhiteSpace(header) ? null : RoleMap.GetValueOrDefault(header);
    }

    static async Task<string> LevelAsync(string roleId, AtlasDbContext db, string cap) =>
        (await db.RolePermissions.FirstOrDefaultAsync(p => p.RoleId == roleId && p.CapabilityKey == cap))?.Level ?? "N";

    // True when the caller's effective role has at least `min` on `cap`.
    public static async Task<bool> Allows(HttpContext http, AtlasDbContext db, IConfiguration cfg, string cap, string min)
    {
        var roleId = ResolveRoleId(http.User, http.Request, cfg.GetValue("Auth:Enabled", false));
        if (roleId is null) return true;                       // dev, no impersonation → allow
        return Rank(await LevelAsync(roleId, db, cap)) >= Rank(min);
    }

    // Returns a 403 result when the caller's role lacks `min` access to `cap`,
    // or null when the action is allowed (call at the top of a write handler).
    public static async Task<IResult?> Deny(HttpContext http, AtlasDbContext db, IConfiguration cfg, string cap, string min)
    {
        if (await Allows(http, db, cfg, cap, min)) return null;
        var label = (await db.Capabilities.FindAsync(cap))?.Label ?? cap;
        return Results.Json(
            new { error = $"Your role doesn’t have the access needed to “{label}”." },
            statusCode: StatusCodes.Status403Forbidden);
    }

    // Display name for the current caller (real name/UPN under auth, else role).
    public static string ActorName(HttpContext http, IConfiguration cfg)
    {
        var authEnabled = cfg.GetValue("Auth:Enabled", false);
        var role = ResolveRoleId(http.User, http.Request, authEnabled) ?? "dev";
        return authEnabled
            ? (http.User.FindFirst("name")?.Value ?? http.User.FindFirst("preferred_username")?.Value ?? role)
            : role;
    }

    // Builds an audit entry for the current caller. Add it to the DbContext just
    // before SaveChangesAsync so it commits in the same transaction as the change.
    public static AuditEvent Audit(HttpContext http, IConfiguration cfg, string category, string action, string target)
    {
        var authEnabled = cfg.GetValue("Auth:Enabled", false);
        var role = ResolveRoleId(http.User, http.Request, authEnabled) ?? "dev";
        return new AuditEvent
        {
            At = DateTime.UtcNow, Actor = ActorName(http, cfg), Role = role,
            Category = category, Action = action, Target = target,
        };
    }
}
