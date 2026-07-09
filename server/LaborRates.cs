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
    public static readonly string[] Disciplines = { "dev", "infra", "architect", "pm", "po" };
    public static readonly string[] Levels = { "junior", "semiSenior", "senior", "specialist", "expert" };

    // discipline → UI identities that may view *and* edit that discipline's rate.
    static readonly Dictionary<string, string[]> Access = new()
    {
        ["dev"]       = new[] { "teammgr", "devmgr", "cto", "cio" },
        ["infra"]     = new[] { "inframgr", "svcmgr", "cto", "cio" },
        ["architect"] = new[] { "architect", "cto", "cio" },
        ["pm"]        = new[] { "pmo", "pmlead", "cto", "cio" },
        ["po"]        = new[] { "pmo", "pmlead", "cto", "cio" },
    };

    static string Key(string disc, string level) => $"rate.{disc}.{level}";

    // Disciplines the given UI identity may see/edit (empty ⇒ none, e.g. no
    // impersonation header or a role outside the owner lists).
    static string[] VisibleDisciplines(string uiRole) =>
        Disciplines.Where(d => Access.TryGetValue(d, out var roles) && roles.Contains(uiRole)).ToArray();

    public static void MapLaborRateEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/labor-rates", async (AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            var visible = VisibleDisciplines(Permissions.EffectiveUiRole(http, cfg));
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
            var visible = VisibleDisciplines(Permissions.EffectiveUiRole(http, cfg)).ToHashSet();
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
