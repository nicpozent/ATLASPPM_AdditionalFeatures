using ClosedXML.Excel;
using Microsoft.EntityFrameworkCore;

namespace Atlas.Api.People;

// ============================================================================
//  Allocation histogram export — a colour-graded Excel of per-person utilisation
//  bucketed by day / week / month / quarter / half / year. Each cell shows the
//  average % utilisation over the period (green→amber→red heat), with the
//  underlying person-days in the cell comment. Effort per period is computed
//  from the real time-phased allocations (project/program/release + product +
//  ops), counting weekdays only. 40h/week = 100%.
// ============================================================================
public static class AllocationReport
{
    static readonly string[] Periods = { "day", "week", "month", "quarter", "half", "year" };

    public static void MapAllocationReportEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/resources/allocation-report.xlsx", async (AtlasDbContext db, IConfiguration cfg, HttpContext http, string? from, string? to, string? period) =>
        {
            // Whole-roster export — internal roles only (cap-dashboards), matching
            // the JSON /resources gate so the Excel path can't be used to bypass it.
            if (await Permissions.Deny(http, db, cfg, "cap-dashboards", "V") is { } deny) return deny;
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            var f = DateOnly.TryParse(from, out var pf) ? pf : new DateOnly(today.Year, 1, 1);
            var t = DateOnly.TryParse(to, out var pt) && pt >= f ? pt : new DateOnly(today.Year, 12, 31);
            var per = Periods.Contains((period ?? "").ToLowerInvariant()) ? period!.ToLowerInvariant() : "month";
            // Cap the span so a day-granularity year can't produce thousands of columns.
            if (t.DayNumber - f.DayNumber > 800) t = f.AddDays(800);

            // Sources (same as availability): dated project/program/release members
            // + product allocations + active ops items.
            var assignments = await db.TeamAssignments.Include(a => a.Members)
                .Where(a => a.EntityType == "project" || a.EntityType == "program" || a.EntityType == "release").ToListAsync();
            var productAllocs = await db.ProductAllocations.ToListAsync();
            var opsItems = await db.OpsItems.Where(i => i.Status != "Done" && i.Assignee != "" && i.Alloc > 0).ToListAsync();
            var groups = await db.EntraGroups.Include(g => g.Members).ToListAsync();

            var titles = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            void Title(string n, string ti) { if (!string.IsNullOrWhiteSpace(n) && !string.IsNullOrWhiteSpace(ti) && !titles.ContainsKey(n)) titles[n] = ti; }
            foreach (var g in groups) foreach (var m in g.Members) Title(m.DisplayName, m.JobTitle);
            foreach (var a in assignments) foreach (var m in a.Members) Title(m.Name, m.Title);
            foreach (var pa in productAllocs) Title(pa.MemberName, pa.MemberTitle);

            var names = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var a in assignments) foreach (var m in a.Members) if (m.Name.Length > 0) names.Add(m.Name);
            foreach (var pa in productAllocs) if (pa.MemberName.Length > 0) names.Add(pa.MemberName);
            foreach (var oi in opsItems) names.Add(oi.Assignee);
            var people = names.OrderBy(n => n, StringComparer.OrdinalIgnoreCase).ToList();

            int AllocOn(string name, DateOnly day)
            {
                var total = 0;
                foreach (var a in assignments)
                    foreach (var m in a.Members)
                        if (string.Equals(m.Name, name, StringComparison.OrdinalIgnoreCase))
                            total += (AllocMath.ActiveOn(m.StartDate, m.EndDate, day) ? m.Alloc : 0)
                                   + (m.ExtAlloc > 0 && AllocMath.ActiveOn(m.ExtStartDate, m.ExtEndDate, day) ? m.ExtAlloc : 0);
                foreach (var pa in productAllocs) if (string.Equals(pa.MemberName, name, StringComparison.OrdinalIgnoreCase)) total += pa.Alloc;
                foreach (var oi in opsItems) if (string.Equals(oi.Assignee, name, StringComparison.OrdinalIgnoreCase)) total += oi.Alloc;
                return total;
            }

            // Buckets over [f,t] for the chosen period.
            var buckets = Buckets(f, t, per);
            var idxOf = new Dictionary<int, int>();   // day-number → bucket index
            var workingDays = new int[buckets.Count];
            for (int bi = 0; bi < buckets.Count; bi++)
                for (var d = buckets[bi].Start; d <= buckets[bi].End; d = d.AddDays(1))
                {
                    if (d.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday) continue;
                    idxOf[d.DayNumber] = bi; workingDays[bi]++;
                }

            // Per person: person-days per bucket.
            var personDays = people.ToDictionary(p => p, _ => new double[buckets.Count], StringComparer.OrdinalIgnoreCase);
            for (var d = f; d <= t; d = d.AddDays(1))
            {
                if (d.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday) continue;
                if (!idxOf.TryGetValue(d.DayNumber, out var bi)) continue;
                foreach (var p in people)
                {
                    var a = AllocOn(p, d);
                    if (a > 0) personDays[p][bi] += a / 100.0;
                }
            }

            // ---- Build the workbook -------------------------------------------
            using var wb = new XLWorkbook();
            var ws = wb.Worksheets.Add("Allocation");
            ws.Cell(1, 1).Value = $"Resource allocation — {per}  ({f:yyyy-MM-dd} → {t:yyyy-MM-dd})";
            ws.Cell(1, 1).Style.Font.Bold = true;
            ws.Cell(1, 1).Style.Font.FontSize = 13;
            ws.Range(1, 1, 1, buckets.Count + 2).Merge();

            var hdr = 2;
            ws.Cell(hdr, 1).Value = "Resource";
            for (int bi = 0; bi < buckets.Count; bi++) ws.Cell(hdr, bi + 2).Value = buckets[bi].Label;
            ws.Cell(hdr, buckets.Count + 2).Value = "Total (days)";
            var hRange = ws.Range(hdr, 1, hdr, buckets.Count + 2);
            hRange.Style.Font.Bold = true;
            hRange.Style.Fill.BackgroundColor = XLColor.FromHtml("#11163A");
            hRange.Style.Font.FontColor = XLColor.White;

            var r = hdr + 1;
            foreach (var p in people)
            {
                var title = titles.TryGetValue(p, out var tt) ? tt : "";
                ws.Cell(r, 1).Value = title.Length > 0 ? $"{p} — {title}" : p;
                double totalDays = 0;
                for (int bi = 0; bi < buckets.Count; bi++)
                {
                    var days = personDays[p][bi];
                    totalDays += days;
                    var util = workingDays[bi] > 0 ? (int)Math.Round(days / workingDays[bi] * 100) : 0;
                    var cell = ws.Cell(r, bi + 2);
                    cell.Value = util == 0 ? "" : $"{util}%";
                    cell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
                    var heat = Heat(util);
                    if (heat.Length > 0) cell.Style.Fill.BackgroundColor = XLColor.FromHtml(heat);
                    if (days > 0) cell.GetComment().AddText($"{days:0.0} person-days of {workingDays[bi]} working days");
                }
                ws.Cell(r, buckets.Count + 2).Value = Math.Round(totalDays, 1);
                ws.Cell(r, buckets.Count + 2).Style.Font.Bold = true;
                r++;
            }
            if (people.Count == 0) ws.Cell(hdr + 1, 1).Value = "No allocations in this window.";

            ws.SheetView.FreezeRows(2);
            ws.SheetView.FreezeColumns(1);
            ws.Column(1).Width = 30;
            for (int bi = 0; bi < buckets.Count; bi++) ws.Column(bi + 2).Width = per == "day" ? 6 : 10;
            ws.Column(buckets.Count + 2).Width = 12;

            using var ms = new MemoryStream();
            wb.SaveAs(ms);
            return Results.File(ms.ToArray(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                $"atlas-allocation-{per}-{f:yyyyMMdd}-{t:yyyyMMdd}.xlsx");
        });
    }

    record Bucket(string Label, DateOnly Start, DateOnly End);

    static List<Bucket> Buckets(DateOnly f, DateOnly t, string period)
    {
        var list = new List<Bucket>();
        var d = f;
        switch (period)
        {
            case "day":
                for (; d <= t; d = d.AddDays(1))
                    if (d.DayOfWeek is not (DayOfWeek.Saturday or DayOfWeek.Sunday))
                        list.Add(new Bucket(d.ToString("dd MMM"), d, d));
                break;
            case "week":
                // Start on the Monday of f's week.
                var wk = f.AddDays(-(((int)f.DayOfWeek + 6) % 7));
                for (; wk <= t; wk = wk.AddDays(7))
                {
                    var end = wk.AddDays(6);
                    list.Add(new Bucket($"w/c {Max(wk, f):dd MMM}", Max(wk, f), Min(end, t)));
                }
                break;
            case "quarter":
                var q = new DateOnly(f.Year, ((f.Month - 1) / 3) * 3 + 1, 1);
                for (; q <= t; q = q.AddMonths(3))
                {
                    var end = q.AddMonths(3).AddDays(-1);
                    list.Add(new Bucket($"Q{(q.Month - 1) / 3 + 1} {q:yyyy}", Max(q, f), Min(end, t)));
                }
                break;
            case "half":
                var h = new DateOnly(f.Year, f.Month <= 6 ? 1 : 7, 1);
                for (; h <= t; h = h.AddMonths(6))
                {
                    var end = h.AddMonths(6).AddDays(-1);
                    list.Add(new Bucket($"H{(h.Month <= 6 ? 1 : 2)} {h:yyyy}", Max(h, f), Min(end, t)));
                }
                break;
            case "year":
                var y = new DateOnly(f.Year, 1, 1);
                for (; y <= t; y = y.AddYears(1))
                {
                    var end = new DateOnly(y.Year, 12, 31);
                    list.Add(new Bucket($"{y.Year}", Max(y, f), Min(end, t)));
                }
                break;
            default: // month
                var m = new DateOnly(f.Year, f.Month, 1);
                for (; m <= t; m = m.AddMonths(1))
                {
                    var end = m.AddMonths(1).AddDays(-1);
                    list.Add(new Bucket(m.ToString("MMM yyyy"), Max(m, f), Min(end, t)));
                }
                break;
        }
        return list;
    }

    static DateOnly Max(DateOnly a, DateOnly b) => a > b ? a : b;
    static DateOnly Min(DateOnly a, DateOnly b) => a < b ? a : b;

    // Utilisation heat: light→green→amber→red; over 100% is over-allocated (red).
    static string Heat(int pct) => pct <= 0 ? "" : pct <= 50 ? "#EAF3EC" : pct <= 85 ? "#C6E7D0" : pct <= 100 ? "#FBF0CE" : "#F6C9CB";
}
