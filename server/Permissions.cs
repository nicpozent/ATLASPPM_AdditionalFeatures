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
    // The ONE place the Auth:Enabled default lives. Fail-open (false) is safe only
    // because Program.cs's production fuse refuses to boot with auth disabled in
    // the Production environment (see Program.cs "Production safety fuses"). Route
    // every reader through here so flipping the default is a one-line change.
    internal static bool AuthEnabled(IConfiguration cfg) => cfg.GetValue("Auth:Enabled", false);

    // Level ranking: None < View < Edit < Full.
    internal static int Rank(string level) => level switch { "F" => 3, "E" => 2, "V" => 1, _ => 0 };

    // Both the 9 cosmetic UI identities and the 6 canonical Entra roles collapse
    // onto the six RoleDef ids that head the matrix.
    static readonly Dictionary<string, string> RoleMap = new(StringComparer.OrdinalIgnoreCase)
    {
        // UI switcher identities (nav.ts ROLES)
        ["admin"] = "admin", ["pmo"] = "pmo", ["pm"] = "pm", ["pmlead"] = "pmlead",
        ["teammgr"] = "team", ["svcmgr"] = "team", ["devmgr"] = "team", ["inframgr"] = "team",
        // Regional manager identities clone their base manager's capabilities
        // (all "team"); they differ only in labour-rate visibility (ADR-0057).
        ["devapac"] = "team", ["blogit"] = "team", ["inframgr_apac"] = "team",
        ["architect"] = "pmo", ["stakeholder"] = "stkhldr",
        // CTO / CIO — leadership identities enforced at Executive level (their
        // distinct persona lives in the header switcher + ManagerKey).
        ["cto"] = "exec", ["cio"] = "exec",
        // Canonical Entra app roles
        ["PlatformAdmin"] = "admin", ["PMO"] = "pmo", ["ProjectManager"] = "pm", ["PMLead"] = "pmlead",
        ["TeamMember"] = "team", ["Executive"] = "exec", ["Stakeholder"] = "stkhldr",
        ["CTO"] = "exec", ["CIO"] = "exec",
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
        if (string.IsNullOrWhiteSpace(header)) return null;   // dev / no impersonation → full access
        // A known switcher identity maps to its canonical RoleDef; otherwise treat
        // the header as a RoleDef id directly, so a role CREATED in Admin → Roles &
        // Permissions is selectable in the switcher and enforced by its own matrix
        // row (an unknown id has no grants → least privilege, never full access).
        return RoleMap.TryGetValue(header, out var mapped) ? mapped : header;
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
        ["devapac"] = "devmgr", ["blogit"] = "devmgr",
        ["inframgr"] = "inframgr", ["InfrastructureManager"] = "inframgr",
        ["inframgr_apac"] = "inframgr",
        ["architect"] = "architect", ["ChiefArchitect"] = "architect",
        ["pmo"] = "pmo", ["PMO"] = "pmo",
        ["pmlead"] = "pmlead", ["PMLead"] = "pmlead",
        ["cto"] = "cto", ["CTO"] = "cto",
        ["cio"] = "cio", ["CIO"] = "cio",
    };

    // All role identity keys the caller holds — used to deliver role-addressed
    // notifications (UserKey "role:<key>"). Auth off: the switcher identity plus
    // its coarse/manager mappings; auth on: every role claim mapped through both
    // the manager and coarse maps. Case-insensitive.
    public static HashSet<string> CallerRoleKeys(HttpContext http, IConfiguration cfg)
    {
        var keys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        void add(string v)
        {
            if (string.IsNullOrWhiteSpace(v)) return;
            keys.Add(v);
            if (ManagerMap.TryGetValue(v, out var m)) keys.Add(m);
            if (RoleMap.TryGetValue(v, out var r)) keys.Add(r);
        }
        if (Permissions.AuthEnabled(cfg))
            foreach (var c in http.User.FindAll("roles").Concat(http.User.FindAll(ClaimTypes.Role))) add(c.Value);
        else
            add(http.Request.Headers["X-Atlas-Role"].ToString());
        return keys;
    }
    public static string? ManagerKey(HttpContext http, IConfiguration cfg)
    {
        if (Permissions.AuthEnabled(cfg))
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
        var roleId = ResolveRoleId(http.User, http.Request, Permissions.AuthEnabled(cfg));
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

    // Per-object read gate for entity-detail endpoints. Internal roles (and the
    // dev no-header identity) pass via cap-dashboards View; the external
    // Stakeholder passes only when `stakeholderOwns` confirms the specific entity
    // is in their own visible set (a StakeholderVisible project, a demand they
    // raised). So a stakeholder can open their own items — MyProjects drills into
    // the project screen — but can't read others' by guessing a sequential/known id.
    public static async Task<IResult?> DenyRead(HttpContext http, AtlasDbContext db, IConfiguration cfg, Func<Task<bool>> stakeholderOwns)
    {
        if (await Deny(http, db, cfg, "cap-dashboards", "V") is not { } forbidden) return null; // internal / dev
        return await stakeholderOwns() ? null : forbidden;                                       // own entity, else 403
    }

    // True when the caller is a Platform Administrator (or the dev no-header
    // default, which has full access). Gates the destructive, admin-only actions
    // such as hard-deleting a project — separate from the capability matrix so it
    // stays admin-only regardless of how the matrix is edited.
    public static bool IsPlatformAdmin(HttpContext http, IConfiguration cfg)
    {
        var roleId = ResolveRoleId(http.User, http.Request, Permissions.AuthEnabled(cfg));
        return roleId is null || roleId == "admin";
    }

    // The caller's fine-grained UI role for cosmetic, role-owned controls (e.g.
    // financial cost lines). With auth off this is the raw X-Atlas-Role header
    // (the 9 identities, so devmgr ≠ inframgr). With auth on only the six
    // canonical app roles exist in the token, so it's necessarily coarser.
    public static string EffectiveUiRole(HttpContext http, IConfiguration cfg)
    {
        var authEnabled = Permissions.AuthEnabled(cfg);
        return authEnabled
            ? (ResolveRoleId(http.User, http.Request, true) ?? "")
            : http.Request.Headers["X-Atlas-Role"].ToString();
    }

    // Stable per-user identity for personal data (subscriptions, notification
    // prefs). Under auth it's the Entra object id; with auth off it's the role
    // identity from the header (so each switcher identity is its own "user").
    public static string CallerKey(HttpContext http, IConfiguration cfg)
    {
        if (Permissions.AuthEnabled(cfg)) return Rbac.CallerId(http.User);
        var header = http.Request.Headers["X-Atlas-Role"].ToString();
        return string.IsNullOrWhiteSpace(header) ? "dev" : header;
    }

    // The caller's email for outbound notifications (empty when unknown, e.g.
    // auth off — email delivery is then skipped and only in-app is used).
    public static string CallerEmail(HttpContext http, IConfiguration cfg)
    {
        if (!Permissions.AuthEnabled(cfg)) return "";
        return http.User.FindFirst("preferred_username")?.Value
            ?? http.User.FindFirst(ClaimTypes.Email)?.Value
            ?? http.User.FindFirst("upn")?.Value ?? "";
    }

    // Display name for the current caller (real name/UPN under auth, else role).
    public static string ActorName(HttpContext http, IConfiguration cfg)
    {
        var authEnabled = Permissions.AuthEnabled(cfg);
        var role = ResolveRoleId(http.User, http.Request, authEnabled) ?? "dev";
        return authEnabled
            ? (http.User.FindFirst("name")?.Value ?? http.User.FindFirst("preferred_username")?.Value ?? role)
            : role;
    }

    // Builds an audit entry for the current caller. Add it to the DbContext just
    // before SaveChangesAsync so it commits in the same transaction as the change.
    public static AuditEvent Audit(HttpContext http, IConfiguration cfg, string category, string action, string target)
    {
        var authEnabled = Permissions.AuthEnabled(cfg);
        var role = ResolveRoleId(http.User, http.Request, authEnabled) ?? "dev";
        AtlasTelemetry.RecordAudit(category, action);   // domain-write metric (no-op unless OTel is on)
        return new AuditEvent
        {
            At = DateTime.UtcNow, Actor = ActorName(http, cfg), Role = role,
            Category = category, Action = action, Target = target,
        };
    }
}
