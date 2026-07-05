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
    internal static int Rank(string level) => level switch { "F" => 3, "E" => 2, "V" => 1, _ => 0 };

    // Both the 9 cosmetic UI identities and the 6 canonical Entra roles collapse
    // onto the six RoleDef ids that head the matrix.
    static readonly Dictionary<string, string> RoleMap = new(StringComparer.OrdinalIgnoreCase)
    {
        // UI switcher identities (nav.ts ROLES)
        ["admin"] = "admin", ["pmo"] = "pmo", ["pm"] = "pm", ["pmlead"] = "pmlead",
        ["teammgr"] = "team", ["svcmgr"] = "team", ["devmgr"] = "team", ["inframgr"] = "team",
        ["architect"] = "pmo", ["stakeholder"] = "stkhldr",
        // Canonical Entra app roles
        ["PlatformAdmin"] = "admin", ["PMO"] = "pmo", ["ProjectManager"] = "pm", ["PMLead"] = "pmlead",
        ["TeamMember"] = "team", ["Executive"] = "exec", ["Stakeholder"] = "stkhldr",
        // Manager Entra app roles — these also carry a permission level (team, or
        // pmo for the architect) so a manager assigned only their manager role
        // gets the right access, not least-privilege. Their fine-grained manager
        // identity (for team roll-up) is resolved separately by ManagerKey.
        ["GlobalEngineeringManager"] = "team", ["GlobalServiceManager"] = "team",
        ["DevelopersManager"] = "team", ["InfrastructureManager"] = "team",
        ["ChiefArchitect"] = "pmo",
    };
    // Tie-break when a user carries several roles: keep the most privileged.
    static readonly string[] Privilege = { "admin", "pmo", "pm", "pmlead", "exec", "team", "stkhldr" };

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

    // Fine-grained manager identity — distinct per manager (Global Engineering ≠
    // Developers), unlike the coarse permission role which collapses them to
    // "team". Resolved from the Entra app role when auth is on (the org assigns a
    // distinct app role per manager), else the X-Atlas-Role header. Returns the
    // manager slot key (teammgr/svcmgr/devmgr/inframgr/architect/pmo/pmlead) or null.
    static readonly Dictionary<string, string> ManagerMap = new(StringComparer.OrdinalIgnoreCase)
    {
        ["teammgr"] = "teammgr", ["GlobalEngineeringManager"] = "teammgr",
        ["svcmgr"] = "svcmgr", ["GlobalServiceManager"] = "svcmgr",
        ["devmgr"] = "devmgr", ["DevelopersManager"] = "devmgr",
        ["inframgr"] = "inframgr", ["InfrastructureManager"] = "inframgr",
        ["architect"] = "architect", ["ChiefArchitect"] = "architect",
        ["pmo"] = "pmo", ["PMO"] = "pmo",
        ["pmlead"] = "pmlead", ["PMLead"] = "pmlead",
    };
    public static string? ManagerKey(HttpContext http, IConfiguration cfg)
    {
        if (cfg.GetValue("Auth:Enabled", false))
        {
            foreach (var c in http.User.FindAll("roles").Concat(http.User.FindAll(ClaimTypes.Role)))
                if (ManagerMap.TryGetValue(c.Value, out var k)) return k;
            return null;
        }
        var header = http.Request.Headers["X-Atlas-Role"].ToString();
        return ManagerMap.TryGetValue(header, out var hk) ? hk : null;
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

    // True when the caller is a Platform Administrator (or the dev no-header
    // default, which has full access). Gates the destructive, admin-only actions
    // such as hard-deleting a project — separate from the capability matrix so it
    // stays admin-only regardless of how the matrix is edited.
    public static bool IsPlatformAdmin(HttpContext http, IConfiguration cfg)
    {
        var roleId = ResolveRoleId(http.User, http.Request, cfg.GetValue("Auth:Enabled", false));
        return roleId is null || roleId == "admin";
    }

    // The caller's fine-grained UI role for cosmetic, role-owned controls (e.g.
    // financial cost lines). With auth off this is the raw X-Atlas-Role header
    // (the 9 identities, so devmgr ≠ inframgr). With auth on only the six
    // canonical app roles exist in the token, so it's necessarily coarser.
    public static string EffectiveUiRole(HttpContext http, IConfiguration cfg)
    {
        var authEnabled = cfg.GetValue("Auth:Enabled", false);
        return authEnabled
            ? (ResolveRoleId(http.User, http.Request, true) ?? "")
            : http.Request.Headers["X-Atlas-Role"].ToString();
    }

    // Stable per-user identity for personal data (subscriptions, notification
    // prefs). Under auth it's the Entra object id; with auth off it's the role
    // identity from the header (so each switcher identity is its own "user").
    public static string CallerKey(HttpContext http, IConfiguration cfg)
    {
        if (cfg.GetValue("Auth:Enabled", false)) return Rbac.CallerId(http.User);
        var header = http.Request.Headers["X-Atlas-Role"].ToString();
        return string.IsNullOrWhiteSpace(header) ? "dev" : header;
    }

    // The caller's email for outbound notifications (empty when unknown, e.g.
    // auth off — email delivery is then skipped and only in-app is used).
    public static string CallerEmail(HttpContext http, IConfiguration cfg)
    {
        if (!cfg.GetValue("Auth:Enabled", false)) return "";
        return http.User.FindFirst("preferred_username")?.Value
            ?? http.User.FindFirst(ClaimTypes.Email)?.Value
            ?? http.User.FindFirst("upn")?.Value ?? "";
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
