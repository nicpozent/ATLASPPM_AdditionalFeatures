using System.Security.Claims;
using Microsoft.EntityFrameworkCore;

namespace Atlas.Api;

public record LaborRatesReq(Dictionary<string, decimal>? Rates);

// ============================================================================
//  Internal-labour rate card. Average blended cost/hour by discipline
//  (Dev / Infra / Architect / PM / PO) and seniority (Junior → Expert), used by
//  the My Team cost calculator to turn effort (days/months/hours) into an
//  internal-labour cost. Rates live in the Settings store under
//  `rate.<discipline>.<level>`. See ADR-0031, ADR-0055.
//
//  Each discipline's rate is *need-to-know*: it is both visible AND editable
//  only by the UI identities that own that discipline (the same owner model as
//  the per-project cost lines in Costs.cs), plus CTO/CIO who see every rate.
//  These are the cosmetic header personas (CLAUDE.md §7); the API filters on the
//  effective UI role so the wire response never carries a rate the caller may
//  not see — the header switcher is not a security boundary, but the filtering
//  is authoritative for what leaves the server.
// ============================================================================
public static class LaborRates
{
    // Region-scoped rate lines (discipline × region). Keys stay dot-free so the
    // Settings key `rate.<discipline>.<level>` still splits cleanly. See ADR-0057.
    public static readonly string[] Disciplines =
    {
        "infraSweden", "infraApac", "infraCh",
        "devSweden", "devApac", "devBlog", "devCh",
        "architectSweden", "architectCh",
        "pmSweden", "pmCh",
        "poSweden", "poCh",
    };
    public static readonly string[] Levels = { "junior", "semiSenior", "senior", "specialist", "expert" };

    // region rate line → UI identities that may view *and* edit it. CTO/CIO see
    // every line; each regional manager sees only their own region's line.
    static readonly Dictionary<string, string[]> Access = new()
    {
        ["infraSweden"]     = new[] { "inframgr", "svcmgr", "cto", "cio" },
        ["infraApac"]       = new[] { "inframgr_apac", "svcmgr", "cto", "cio" },
        ["infraCh"]         = new[] { "svcmgr", "cto", "cio" },
        ["devSweden"]       = new[] { "teammgr", "devmgr", "cto", "cio" },
        ["devApac"]         = new[] { "teammgr", "devapac", "cto", "cio" },
        ["devBlog"]         = new[] { "teammgr", "blogit", "cto", "cio" },
        ["devCh"]           = new[] { "teammgr", "cto", "cio" },
        ["architectSweden"] = new[] { "architect", "cto", "cio" },
        ["architectCh"]     = new[] { "architect", "cto", "cio" },
        ["pmSweden"]        = new[] { "pmo", "pmlead", "cto", "cio" },
        ["pmCh"]            = new[] { "pmo", "cto", "cio" },
        ["poSweden"]        = new[] { "pmo", "pmlead", "cto", "cio" },
        ["poCh"]            = new[] { "pmo", "cto", "cio" },
    };

    static string Key(string disc, string level) => $"rate.{disc}.{level}";

    // Entra app-role name OR cosmetic switcher key → the fine rate-owning
    // identity. Regional managers keep their distinct identity here (they collapse
    // to a base manager only for coarse *permissions*, ADR-0057), so each sees
    // exactly their region. The rate card gates on the FINE identity — the coarse
    // permission role (EffectiveUiRole) can't tell inframgr from svcmgr, or CTO
    // from admin, and would leak/hide the wrong lines under real SSO.
    static readonly Dictionary<string, string> RateRole = new(StringComparer.OrdinalIgnoreCase)
    {
        ["admin"] = "admin", ["PlatformAdmin"] = "admin",
        ["svcmgr"] = "svcmgr", ["GlobalServiceManager"] = "svcmgr",
        ["teammgr"] = "teammgr", ["GlobalEngineeringManager"] = "teammgr",
        ["devmgr"] = "devmgr", ["DevelopersManager"] = "devmgr",
        ["devapac"] = "devapac", ["DevAPACManager"] = "devapac",
        ["blogit"] = "blogit", ["BLOGITManager"] = "blogit", ["BlogItManager"] = "blogit",
        ["inframgr"] = "inframgr", ["InfrastructureManager"] = "inframgr",
        ["inframgr_apac"] = "inframgr_apac", ["InfrastructureManagerAPAC"] = "inframgr_apac",
        ["architect"] = "architect", ["ChiefArchitect"] = "architect",
        ["pmo"] = "pmo", ["PMO"] = "pmo",
        ["pmlead"] = "pmlead", ["PMLead"] = "pmlead",
        ["cto"] = "cto", ["CTO"] = "cto",
        ["cio"] = "cio", ["CIO"] = "cio",
    };

    // The caller's fine rate-owning identities (a set — a user may hold several
    // Entra roles). Auth on: every role claim; auth off: the X-Atlas-Role header.
    static HashSet<string> RateIdentities(HttpContext http, IConfiguration cfg)
    {
        var ids = new HashSet<string>();
        void Add(string v) { if (!string.IsNullOrWhiteSpace(v) && RateRole.TryGetValue(v.Trim(), out var k)) ids.Add(k); }
        if (cfg.GetValue("Auth:Enabled", false))
            foreach (var c in http.User.FindAll("roles").Concat(http.User.FindAll(ClaimTypes.Role))) Add(c.Value);
        else
            Add(http.Request.Headers["X-Atlas-Role"].ToString());
        return ids;
    }

    // Disciplines the caller may see/edit. Platform Admin sees & edits every line
    // (the superuser who manages the card); CTO/CIO are in every line's owner
    // list; each manager sees only the lines their identity owns. Empty ⇒ none.
    static string[] VisibleDisciplines(HashSet<string> ids) =>
        ids.Contains("admin")
            ? Disciplines
            : Disciplines.Where(d => Access.TryGetValue(d, out var roles) && roles.Any(ids.Contains)).ToArray();

    public static void MapLaborRateEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/labor-rates", async (AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            var visible = VisibleDisciplines(RateIdentities(http, cfg));
            var stored = await db.Settings.Where(s => s.Key.StartsWith("rate.")).ToDictionaryAsync(s => s.Key, s => s.Value);
            var rates = new Dictionary<string, decimal>();
            foreach (var d in visible)
                foreach (var l in Levels)
                    rates[$"{d}.{l}"] = stored.TryGetValue(Key(d, l), out var v) && decimal.TryParse(v, out var n) ? n : 0m;
            return Results.Ok(new
            {
                // Seeing a discipline ⇒ owning (editing) it, so anyone with a
                // visible discipline can edit — scoped per-discipline on PUT.
                canEdit = visible.Length > 0,
                disciplines = visible,
                levels = Levels,
                rates,
            });
        });

        api.MapPut("/labor-rates", async (LaborRatesReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            var visible = VisibleDisciplines(RateIdentities(http, cfg)).ToHashSet();
            if (visible.Count == 0)
                return Results.Json(new { error = "You don't have access to internal-labour rates." }, statusCode: StatusCodes.Status403Forbidden);
            if (req.Rates is null) return Results.BadRequest(new { error = "No rates supplied." });

            var saved = 0;
            foreach (var (k, amount) in req.Rates)
            {
                // Only accept known discipline.level keys the caller may edit;
                // silently ignore anything else (unknown or not owned).
                var parts = k.Split('.');
                if (parts.Length != 2 || !Disciplines.Contains(parts[0]) || !Levels.Contains(parts[1])) continue;
                if (!visible.Contains(parts[0])) continue;
                var key = Key(parts[0], parts[1]);
                var val = Math.Max(0, amount).ToString(System.Globalization.CultureInfo.InvariantCulture);
                var existing = await db.Settings.FindAsync(key);
                if (existing is null) db.Settings.Add(new Setting { Key = key, Value = val });
                else existing.Value = val;
                saved++;
            }
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Financials", "Updated internal-labour rate card", $"{saved} rate(s)"));
            await db.SaveChangesAsync();
            return Results.NoContent();
        });
    }
}
