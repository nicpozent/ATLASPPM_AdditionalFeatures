using Microsoft.EntityFrameworkCore;

namespace Atlas.Api.Finance;

public record RoiOverrideReq(decimal? Value);   // null clears → automatic

// ============================================================================
//  Financials. Budgets & actuals for projects, programs and products, driven by
//  the editable role-owned cost lines: "actual" lines roll up into Spent to date,
//  "forecast" lines into Forecast at completion. ROI is computed automatically
//  ((benefit − investment) / investment) unless a PMO/Admin sets a manual value,
//  stored per entity in the Settings store (key roi:{scope}:{id}).
// ============================================================================
public static class Financials
{
    const string AutoNote = "Automatic ROI = (Benefit − Investment) / Investment × 100. " +
        "Investment is the Forecast at completion (total forecast cost lines, excl. savings), " +
        "falling back to Budget; Benefit is the Savings / benefit line. Edit the cost lines to move it.";
    const string ManualNote = "Manual ROI overrides the automatic figure with a value you enter — " +
        "use it when the business case ROI is agreed outside the cost model. Clear it to return to automatic.";

    static async Task<List<FinRowDto>> RowsAsync(AtlasDbContext db, string scope)
    {
        // Cost lines for the scope, split by kind.
        var lines = await db.CostLines.Where(c => c.Scope == scope).ToListAsync();
        var actual = lines.Where(c => c.Kind == "actual").GroupBy(c => c.OwnerId).ToDictionary(g => g.Key, g => g.ToList());
        var forecast = lines.Where(c => c.Kind == "forecast").GroupBy(c => c.OwnerId).ToDictionary(g => g.Key, g => g.ToList());
        var overrides = await db.Settings.Where(s => s.Key.StartsWith($"roi:{scope}:")).ToDictionaryAsync(s => s.Key, s => s.Value);

        decimal K(Dictionary<string, List<CostLine>> map, string id, string key) =>
            (map.TryGetValue(id, out var l) ? l.Where(x => x.Key == key).Sum(x => x.Amount) : 0m) / 1000m; // €→€k
        decimal Total(Dictionary<string, List<CostLine>> map, string id) =>
            (map.TryGetValue(id, out var l) ? l.Where(x => x.Key != "savings").Sum(x => x.Amount) : 0m) / 1000m;

        FinRowDto Build(string id, string name, decimal budget, decimal baseSpent, decimal baseForecast, decimal capex,
            decimal baseLaborDev, decimal baseLaborArch, decimal baseLaborInfra)
        {
            var laborDev = baseLaborDev + K(actual, id, "laborDev");
            var laborArch = baseLaborArch + K(actual, id, "laborArch");
            var laborInfra = baseLaborInfra + K(actual, id, "laborInfra");
            var infraCloud = K(actual, id, "licInfra") + K(actual, id, "paasInfra") + K(actual, id, "iaasInfra") + K(actual, id, "saasInfra");
            var devTooling = K(actual, id, "licDev") + K(actual, id, "paasDev") + K(actual, id, "saasDev");
            var vendor = K(actual, id, "vendor");
            var spent = baseSpent + Total(actual, id);

            // Forecast at completion: forecast cost lines if entered, else the base.
            var fcTotal = Total(forecast, id);
            var forecastAtCompletion = fcTotal > 0 ? fcTotal : (baseForecast > 0 ? baseForecast : spent);
            // Benefit: forecast savings line if present, else actual savings.
            var benefit = K(forecast, id, "savings");
            if (benefit == 0) benefit = K(actual, id, "savings");

            var investment = forecastAtCompletion > 0 ? forecastAtCompletion : (budget > 0 ? budget : spent);
            var manual = overrides.TryGetValue($"roi:{scope}:{id}", out var ov) && decimal.TryParse(ov, out var mv);
            var roi = manual
                ? decimal.Parse(overrides[$"roi:{scope}:{id}"])
                : (investment > 0 ? Math.Round((benefit - investment) / investment * 100) : 0);

            var usedPct = budget > 0 ? (int)Math.Round(spent / budget * 100) : 0;
            var variance = budget - forecastAtCompletion;
            return new FinRowDto(id, name, budget, spent, capex, forecastAtCompletion, variance, roi,
                laborDev, laborArch, laborInfra, usedPct, variance >= 0, benefit, infraCloud, devTooling, vendor, manual, scope);
        }

        var rows = new List<FinRowDto>();
        if (scope == "program")
        {
            foreach (var pg in await db.Programs.Where(p => !p.Archived).OrderBy(p => p.Id).ToListAsync())
                rows.Add(Build(pg.Id, pg.Name, pg.Budget, pg.Spent, pg.Budget, 0, 0, 0, 0));
        }
        else if (scope == "product")
        {
            foreach (var pr in await db.Products.OrderBy(p => p.Id).ToListAsync())
                rows.Add(Build(pr.Id, pr.Name, 0, 0, 0, 0, 0, 0, 0));
        }
        else
        {
            foreach (var p in await db.Projects.Where(p => !p.Archived).OrderBy(p => p.Id).ToListAsync())
                rows.Add(Build(p.Id, p.Name, p.Budget, p.Spent, p.Forecast, p.Capex, p.LaborDev, p.LaborArch, p.LaborInfra));
        }
        return rows;
    }

    public static void MapFinancialsEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/financials", async (string? scope, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            // Portfolio financials (budget/actual/ROI) — internal roles only (cap-dashboards).
            if (await Permissions.Deny(http, db, cfg, "cap-dashboards", "V") is { } deny) return deny;
            var s = scope is "program" or "product" ? scope : "project";
            var canEditRoi = await Permissions.Allows(http, db, cfg, "cap-projects", "E");
            var rows = await RowsAsync(db, s);
            return Results.Ok(new FinancialsDto(s, canEditRoi, rows, AutoNote, ManualNote));
        });

        // Set (value) or clear (null) a manual ROI override for one entity.
        api.MapPatch("/financials/{scope}/{id}/roi", async (string scope, string id, RoiOverrideReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            var s = scope is "program" or "product" ? scope : "project";
            var key = $"roi:{s}:{id}";
            var setting = await db.Settings.FindAsync(key);
            if (req.Value is null)
            {
                if (setting is not null) db.Settings.Remove(setting);
            }
            else
            {
                var v = Math.Round(req.Value.Value).ToString(System.Globalization.CultureInfo.InvariantCulture);
                if (setting is null) db.Settings.Add(new Setting { Key = key, Value = v });
                else setting.Value = v;
            }
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Financials", req.Value is null ? "Cleared manual ROI" : "Set manual ROI", $"{s} {id}{(req.Value is null ? "" : $" · {req.Value}%")}"));
            await db.SaveChangesAsync();
            return Results.NoContent();
        });
    }
}
