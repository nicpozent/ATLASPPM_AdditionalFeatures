using Microsoft.EntityFrameworkCore;

namespace Atlas.Api;

// One slice of a person's load on a given day — a single project/program/release/
// product/ops commitment.
public record AllocSliceDto(string Type, string EntityId, string EntityName, int Pct);
public record AvailabilityRowDto(string Name, string Title, string Dept, string Initials, string Color,
    int Allocated, int Free, bool OnLeave, string LeaveNote, List<AllocSliceDto> Slices);
public record AvailabilityDto(string On, string From, string To, List<AvailabilityRowDto> People);

// ============================================================================
//  Resource availability — who is free (and by how much) on a date, or across a
//  window, with each person's load broken down by the projects / programs /
//  releases / products / ops pulling on them. Booked absences net capacity to 0
//  for that person. Time-phased: only segments live on the day count, so this
//  reads straight off the same allocation model the Team panel writes.
//
//  Single day: ?on=YYYY-MM-DD (default today).
//  Window:     ?from=…&to=…  → free = capacity free across the WHOLE window
//              (100 − peak allocation), so it answers "who can I staff for this".
// ============================================================================
public static class Availability
{
    public static void MapAvailabilityEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/resources/availability", async (AtlasDbContext db, string? on, string? from, string? to) =>
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            var d0 = !string.IsNullOrWhiteSpace(on) && DateOnly.TryParse(on, out var od) ? od : today;
            DateOnly f = default, t = default;
            var isRange = !string.IsNullOrWhiteSpace(from) && !string.IsNullOrWhiteSpace(to)
                && DateOnly.TryParse(from, out f) && DateOnly.TryParse(to, out t) && t >= f;

            var assignments = await db.TeamAssignments.Include(a => a.Members)
                .Where(a => a.EntityType == "project" || a.EntityType == "program" || a.EntityType == "release").ToListAsync();
            var projNames = await db.Projects.ToDictionaryAsync(p => p.Id, p => p.Name);
            var progNames = await db.Programs.ToDictionaryAsync(p => p.Id, p => p.Name);
            var relNames = await db.Releases.ToDictionaryAsync(p => p.Id, p => p.Name);
            var productAllocs = await db.ProductAllocations.ToListAsync();
            var prodNames = await db.Products.ToDictionaryAsync(p => p.Id, p => p.Name);
            var opsItems = await db.OpsItems.Where(i => i.Status != "Done" && i.Assignee != "" && i.Alloc > 0).ToListAsync();
            var opsSvc = await db.OpsServices.ToDictionaryAsync(s => s.Id, s => s.Name);
            var groups = await db.EntraGroups.Include(g => g.Members).ToListAsync();
            var absences = await db.Absences.ToListAsync();

            string NameOf(string type, string id) => type switch
            {
                "project" => projNames.TryGetValue(id, out var n) ? n : id,
                "program" => progNames.TryGetValue(id, out var n) ? n : id,
                "release" => relNames.TryGetValue(id, out var n) ? n : id,
                _ => id,
            };

            // Everyone we might report on (directory + anyone carrying an allocation),
            // with light metadata. Keyed case-insensitively by name.
            var meta = new Dictionary<string, (string Title, string Dept)>(StringComparer.OrdinalIgnoreCase);
            void Meta(string name, string title, string dept)
            {
                if (string.IsNullOrWhiteSpace(name)) return;
                var cur = meta.TryGetValue(name, out var v) ? v : ("", "");
                meta[name] = (string.IsNullOrEmpty(cur.Item1) ? title : cur.Item1, string.IsNullOrEmpty(cur.Item2) ? dept : cur.Item2);
            }
            foreach (var g in groups) foreach (var m in g.Members) Meta(m.DisplayName, m.JobTitle, g.DisplayName);
            foreach (var a in assignments) foreach (var m in a.Members) Meta(m.Name, m.Title, "");
            foreach (var pa in productAllocs) Meta(pa.MemberName, pa.MemberTitle, "");
            foreach (var oi in opsItems) Meta(oi.Assignee, "", "");

            // Slices for one person on one day.
            List<AllocSliceDto> SlicesOn(string name, DateOnly day)
            {
                var slices = new List<AllocSliceDto>();
                foreach (var a in assignments)
                    foreach (var m in a.Members.Where(m => string.Equals(m.Name, name, StringComparison.OrdinalIgnoreCase)))
                    {
                        var p = (AllocMath.ActiveOn(m.StartDate, m.EndDate, day) ? m.Alloc : 0)
                              + (m.ExtAlloc > 0 && AllocMath.ActiveOn(m.ExtStartDate, m.ExtEndDate, day) ? m.ExtAlloc : 0);
                        if (p > 0) slices.Add(new AllocSliceDto(a.EntityType, a.EntityId, NameOf(a.EntityType, a.EntityId), p));
                    }
                foreach (var pa in productAllocs.Where(x => string.Equals(x.MemberName, name, StringComparison.OrdinalIgnoreCase) && x.Alloc > 0))
                    slices.Add(new AllocSliceDto("product", pa.ProductId, prodNames.TryGetValue(pa.ProductId, out var pn) ? pn : pa.ProductId, pa.Alloc));
                foreach (var oi in opsItems.Where(x => string.Equals(x.Assignee, name, StringComparison.OrdinalIgnoreCase)))
                    slices.Add(new AllocSliceDto("ops", "svc:" + oi.ServiceId, opsSvc.TryGetValue(oi.ServiceId, out var sn) ? sn : "Ops", oi.Alloc));
                return slices;
            }

            bool OnLeave(string name, out string note)
            {
                note = "";
                foreach (var ab in absences.Where(x => string.Equals(x.Person, name, StringComparison.OrdinalIgnoreCase)))
                {
                    var covers = isRange
                        ? string.CompareOrdinal(ab.From, t.ToString("yyyy-MM-dd")) <= 0 && string.CompareOrdinal(ab.To, f.ToString("yyyy-MM-dd")) >= 0
                        : AllocMath.ActiveOn(ab.From, ab.To, d0);
                    if (covers) { note = ab.Type; return true; }
                }
                return false;
            }

            // Days to evaluate: a single day, or (for a window) the window start plus
            // every segment boundary inside it — the allocation peak sits on one of these.
            var days = new List<DateOnly>();
            if (isRange)
            {
                days.Add(f);
                foreach (var a in assignments)
                    foreach (var m in a.Members)
                        foreach (var ds in new[] { m.StartDate, m.ExtStartDate })
                            if (DateOnly.TryParse(ds, out var d) && d > f && d <= t) days.Add(d);
                days = days.Distinct().ToList();
            }
            else days.Add(d0);

            var rows = new List<AvailabilityRowDto>();
            foreach (var kv in meta)
            {
                var name = kv.Key;
                // Peak-allocation day within the window (or the single day).
                var best = days.Select(d => SlicesOn(name, d)).OrderByDescending(s => s.Sum(x => x.Pct)).First();
                var allocated = best.Sum(s => s.Pct);
                var leave = OnLeave(name, out var note);
                var free = leave ? 0 : Math.Max(0, 100 - allocated);
                rows.Add(new AvailabilityRowDto(name, string.IsNullOrEmpty(kv.Value.Item1) ? "Team member" : kv.Value.Item1, kv.Value.Item2,
                    ResourcesData.Initials(name), ResourcesData.ColorFor(name),
                    allocated, free, leave, note, best.OrderByDescending(s => s.Pct).ToList()));
            }

            var ordered = rows.OrderByDescending(r => r.Free).ThenBy(r => r.Name).ToList();
            return Results.Ok(new AvailabilityDto(
                isRange ? "" : d0.ToString("yyyy-MM-dd"),
                isRange ? f.ToString("yyyy-MM-dd") : "", isRange ? t.ToString("yyyy-MM-dd") : "", ordered));
        });
    }
}
