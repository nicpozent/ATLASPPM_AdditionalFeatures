using Microsoft.EntityFrameworkCore;

namespace Atlas.Api;

public record LaborRatesReq(Dictionary<string, decimal>? Rates);

// ============================================================================
//  Internal-labour rate card. Average blended cost/hour by discipline (Dev,
//  Infra) and seniority (Junior → Expert), used by the My Team cost calculator
//  to turn effort (days/months/hours) into an internal-labour cost. Rates live
//  in the Settings store under `rate.<discipline>.<level>` and are editable by
//  PMO / PM Lead / Admin. See ADR-0031.
// ============================================================================
public static class LaborRates
{
    public static readonly string[] Disciplines = { "dev", "infra" };
    public static readonly string[] Levels = { "junior", "semiSenior", "senior", "specialist", "expert" };

    static string Key(string disc, string level) => $"rate.{disc}.{level}";

    // PMO / PM Lead / Admin (empty ⇒ dev with no impersonation) may edit rates.
    static bool CanEdit(string uiRole) =>
        string.IsNullOrEmpty(uiRole) || uiRole is "admin" or "pmo" or "pmlead";

    public static void MapLaborRateEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/labor-rates", async (AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            var stored = await db.Settings.Where(s => s.Key.StartsWith("rate.")).ToDictionaryAsync(s => s.Key, s => s.Value);
            var rates = new Dictionary<string, decimal>();
            foreach (var d in Disciplines)
                foreach (var l in Levels)
                    rates[$"{d}.{l}"] = stored.TryGetValue(Key(d, l), out var v) && decimal.TryParse(v, out var n) ? n : 0m;
            return Results.Ok(new
            {
                canEdit = CanEdit(Permissions.EffectiveUiRole(http, cfg)),
                disciplines = Disciplines,
                levels = Levels,
                rates,
            });
        });

        api.MapPut("/labor-rates", async (LaborRatesReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (!CanEdit(Permissions.EffectiveUiRole(http, cfg)))
                return Results.Json(new { error = "Only PMO / PM Lead / Admin can edit labour rates." }, statusCode: StatusCodes.Status403Forbidden);
            if (req.Rates is null) return Results.BadRequest(new { error = "No rates supplied." });

            foreach (var (k, amount) in req.Rates)
            {
                // Only accept known discipline.level keys; ignore anything else.
                var parts = k.Split('.');
                if (parts.Length != 2 || !Disciplines.Contains(parts[0]) || !Levels.Contains(parts[1])) continue;
                var key = Key(parts[0], parts[1]);
                var val = Math.Max(0, amount).ToString(System.Globalization.CultureInfo.InvariantCulture);
                var existing = await db.Settings.FindAsync(key);
                if (existing is null) db.Settings.Add(new Setting { Key = key, Value = val });
                else existing.Value = val;
            }
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Financials", "Updated internal-labour rate card", $"{req.Rates.Count} rate(s)"));
            await db.SaveChangesAsync();
            return Results.NoContent();
        });
    }
}
