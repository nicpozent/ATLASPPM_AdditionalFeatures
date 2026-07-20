using Microsoft.EntityFrameworkCore;

namespace Atlas.Api.People;

public record SetAllocReq(int? Alloc, int? AllocHours, string? StartDate, string? EndDate,
    int? ExtAlloc, int? ExtHours, string? ExtStartDate, string? ExtEndDate);
public record RosterRow(string Name, string Title, string Dept, int Project, int Product, int Ops)
{
    public int Total => Project + Product + Ops;
}
public record OnboardReq(string? Name, string? Email, string? Title);

// ============================================================================
//  Resources & capacity — derived from the REAL allocation data in the system
//  rather than a standalone sheet: product allocations (ProductAllocation),
//  project team assignments (TeamAssignment for project entities), and the
//  Entra-synced roster (TeamMembers). This is what populates the By-person /
//  By-project / By-product views and the people filter, and it refreshes as
//  allocations change elsewhere.
// ============================================================================
public static class ResourcesData
{
    static readonly string[] Palette =
        { "#0F6CBD", "#7A3FB0", "#15A34A", "#C98A00", "#0E7C7B", "#C24A1F", "#5B8FCB", "#A1282B" };

    public static string Initials(string name)
    {
        var parts = name.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length == 0) return "?";
        return parts.Length == 1 ? parts[0][..Math.Min(2, parts[0].Length)].ToUpperInvariant()
            : $"{char.ToUpperInvariant(parts[0][0])}{char.ToUpperInvariant(parts[^1][0])}";
    }
    public static string ColorFor(string name)
    {
        var h = 0; foreach (var c in name) h = (h * 31 + c) & 0x7fffffff;
        return Palette[h % Palette.Length];
    }

    // Blank for empty/unparseable; else ISO yyyy-MM-dd.
    static string NormDate(string? s)
    {
        var v = (s ?? "").Trim();
        if (v.Length == 0) return "";
        return DateOnly.TryParse(v, out var d) ? d.ToString("yyyy-MM-dd") : v;
    }

    // The capacity roster as-of a day: everyone with an allocation (product or
    // project/task or ops) or on the synced directory, with their rolled-up
    // time-phased utilisation. Shared by /resources and the capacity-intelligence
    // endpoints so they can't drift.
    public static async Task<List<RosterRow>> RosterAsync(AtlasDbContext db, DateOnly on)
    {
        var productAllocs = await db.ProductAllocations.ToListAsync();
        var projAssignments = await db.TeamAssignments.Where(t => t.EntityType == "project").Include(t => t.Members).ToListAsync();
        var groups = await db.EntraGroups.Include(g => g.Members).ToListAsync();
        var opsByPerson = await Ops.AllocByPersonAsync(db, on);
        var projectByPerson = await AllocationEngine.ProjectLoadByPersonAsync(db, on);

        var people = new Dictionary<string, (string Name, string Title, string Dept, int Project, int Product, int Ops)>(StringComparer.OrdinalIgnoreCase);
        (string, string, string, int, int, int) Get(string name) =>
            people.TryGetValue(name, out var v) ? v : (name, "", "", 0, 0, 0);

        foreach (var a in productAllocs)
        {
            var p = Get(a.MemberName);
            people[a.MemberName] = (p.Item1, string.IsNullOrEmpty(p.Item2) ? a.MemberTitle : p.Item2, p.Item3, p.Item4, p.Item5 + a.Alloc, p.Item6);
        }
        foreach (var t in projAssignments)
            foreach (var m in t.Members)
            {
                var p = Get(m.Name);
                people[m.Name] = (p.Item1, string.IsNullOrEmpty(p.Item2) ? m.Title : p.Item2, p.Item3, p.Item4, p.Item5, p.Item6);
            }
        foreach (var (name, projPct) in projectByPerson)
        {
            var p = Get(name);
            people[name] = (p.Item1, p.Item2, p.Item3, projPct, p.Item5, p.Item6);
        }
        foreach (var g in groups)
            foreach (var m in g.Members)
            {
                var p = Get(m.DisplayName);
                people[m.DisplayName] = (p.Item1, string.IsNullOrEmpty(p.Item2) ? m.JobTitle : p.Item2,
                    string.IsNullOrEmpty(p.Item3) ? g.DisplayName : p.Item3, p.Item4, p.Item5, p.Item6);
            }
        foreach (var (name, ops) in opsByPerson)
        {
            var p = Get(name);
            people[name] = (p.Item1, p.Item2, p.Item3, p.Item4, p.Item5, p.Item6 + ops);
        }

        return people.Values
            .Select(p => new RosterRow(p.Name, string.IsNullOrEmpty(p.Title) ? "Team member" : p.Title,
                string.IsNullOrEmpty(p.Dept) ? "Unassigned" : p.Dept, p.Project, p.Product, p.Ops))
            .OrderByDescending(p => p.Project + p.Product + p.Ops).ThenBy(p => p.Name).ToList();
    }

    // The capacity roster averaged over a [from,to] window: each person's Ops /
    // Project / Product load is the mean of their per-working-day utilisation
    // across the window (weekends excluded; if the window is all-weekend the days
    // are counted anyway so a single Sat/Sun query still returns a value). This is
    // the same per-day, time-phased maths as the single-day roster and the Excel
    // export — reused so the three can't drift — just aggregated over the period.
    public static async Task<List<RosterRow>> RosterWindowAsync(AtlasDbContext db, DateOnly from, DateOnly to)
    {
        if (to < from) to = from;
        // Cap the span so a long window can't spin the per-day loop unbounded
        // (mirrors the allocation-report guard).
        if (to.DayNumber - from.DayNumber > 800) to = from.AddDays(800);

        var productAllocs = await db.ProductAllocations.ToListAsync();
        var projAssignments = await db.TeamAssignments.Where(t => t.EntityType == "project").Include(t => t.Members).ToListAsync();
        var groups = await db.EntraGroups.Include(g => g.Members).ToListAsync();
        var opsItems = await db.OpsItems.Where(i => i.Status != "Done" && i.Assignee != "" && i.Alloc > 0).ToListAsync();
        var pw = (await db.Projects.Where(p => !p.Archived)
            .Select(p => new { p.Id, p.StartDate, p.Due }).ToListAsync())
            .ToDictionary(p => p.Id, p => new AllocationEngine.ProjWin(p.StartDate, p.Due));
        var tasks = await db.ProjectTasks
            .Where(t => t.Status != "Done" && t.EstimateHours > 0 && t.Assignee != "" && t.Assignee != "Unassigned")
            .Select(t => new AllocationEngine.TaskLite(t.Assignee, t.ProjectId, t.EstimateHours, t.StartDate, t.TargetDate))
            .ToListAsync();

        // Days to average over: weekdays in the window, or every day if the window
        // contains no weekday (e.g. a single Saturday).
        var days = new List<DateOnly>();
        for (var d = from; d <= to; d = d.AddDays(1))
            if (d.DayOfWeek is not (DayOfWeek.Saturday or DayOfWeek.Sunday)) days.Add(d);
        if (days.Count == 0) for (var d = from; d <= to; d = d.AddDays(1)) days.Add(d);

        var sumProject = new Dictionary<string, double>(StringComparer.OrdinalIgnoreCase);
        var sumProduct = new Dictionary<string, double>(StringComparer.OrdinalIgnoreCase);
        var sumOps = new Dictionary<string, double>(StringComparer.OrdinalIgnoreCase);
        static void Acc(Dictionary<string, double> m, string name, double v) =>
            m[name] = (m.TryGetValue(name, out var s) ? s : 0) + v;

        foreach (var on in days)
        {
            var proj = AllocationEngine.CombineProjectLoad(
                AllocationEngine.ProjectPlannedFor(projAssignments, on),
                AllocationEngine.TaskLoadFor(tasks, pw, on));
            foreach (var (name, v) in proj) Acc(sumProject, name, v);
            // Product allocations carry no date window today → constant per day.
            foreach (var a in productAllocs) Acc(sumProduct, a.MemberName, a.Alloc);
            foreach (var i in opsItems)
                if (AllocMath.ActiveOn(i.StartDate, i.EndDate, on))
                    Acc(sumOps, i.Assignee.Trim(), i.Alloc);
        }
        var n = days.Count;

        // Identity (title/dept) — everyone on the directory or carrying any load in
        // the window, so people show at 0% too (matches the single-day roster).
        var titles = new Dictionary<string, (string Title, string Dept)>(StringComparer.OrdinalIgnoreCase);
        void Id(string name, string? title, string? dept)
        {
            if (string.IsNullOrWhiteSpace(name)) return;
            titles.TryGetValue(name, out var cur);
            titles[name] = (string.IsNullOrEmpty(cur.Title) ? (title ?? "") : cur.Title,
                            string.IsNullOrEmpty(cur.Dept) ? (dept ?? "") : cur.Dept);
        }
        foreach (var a in projAssignments) foreach (var m in a.Members) Id(m.Name, m.Title, null);
        foreach (var a in productAllocs) Id(a.MemberName, a.MemberTitle, null);
        foreach (var g in groups) foreach (var m in g.Members) Id(m.DisplayName, m.JobTitle, g.DisplayName);
        foreach (var name in sumProject.Keys) Id(name, null, null);
        foreach (var name in sumOps.Keys) Id(name, null, null);

        int Avg(Dictionary<string, double> m, string name) =>
            m.TryGetValue(name, out var s) ? (int)Math.Round(s / n) : 0;

        return titles.Keys
            .Select(name => new RosterRow(name,
                string.IsNullOrEmpty(titles[name].Title) ? "Team member" : titles[name].Title,
                string.IsNullOrEmpty(titles[name].Dept) ? "Unassigned" : titles[name].Dept,
                Avg(sumProject, name), Avg(sumProduct, name), Avg(sumOps, name)))
            .OrderByDescending(p => p.Project + p.Product + p.Ops).ThenBy(p => p.Name).ToList();
    }

    public static void MapResourceEndpoints(this RouteGroupBuilder api)
    {
        // The capacity roster: everyone with an allocation (product or project) or
        // on the synced directory, with their rolled-up utilisation. With no
        // from/to it's a single-day snapshot (default today, or ?asOf=); with a
        // from/to window it's the average utilisation over that period, which is
        // what the Resources period toggle (day/week/…/year) and the date-range
        // filter send.
        api.MapGet("/resources", async (AtlasDbContext db, string? asOf, string? from, string? to) =>
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            List<RosterRow> rows;
            if (!string.IsNullOrWhiteSpace(from) || !string.IsNullOrWhiteSpace(to))
            {
                var f = DateOnly.TryParse(from, out var pf) ? pf : today;
                var t = DateOnly.TryParse(to, out var pt) ? pt : f;
                rows = await RosterWindowAsync(db, f, t);
            }
            else
            {
                var on = !string.IsNullOrWhiteSpace(asOf) && DateOnly.TryParse(asOf, out var d) ? d : today;
                rows = await RosterAsync(db, on);
            }
            var dto = rows
                .Select(p => new ResourceDto(p.Name, p.Title, p.Dept == "Unassigned" ? "" : p.Dept,
                    Initials(p.Name), ColorFor(p.Name), p.Ops, p.Project, p.Product, p.Project + p.Product + p.Ops > 100))
                .ToList();
            return Results.Ok(dto);
        });

        // By project: each project that has a team assigned, with its members and
        // their editable allocation %. Edit needs "Project schedule" (cap-schedule).
        api.MapGet("/resources/by-project", async (AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            var canEdit = await Permissions.Allows(http, db, cfg, "cap-schedule", "E");
            var projects = await db.Projects.Where(p => !p.Archived).ToDictionaryAsync(p => p.Id, p => p.Name);
            var assignments = await db.TeamAssignments.Where(t => t.EntityType == "project").Include(t => t.Members).ToListAsync();
            var byProject = assignments
                .Where(t => projects.ContainsKey(t.EntityId))
                .GroupBy(t => t.EntityId)
                .Select(g => new ResByProjectDto(g.Key, projects[g.Key], canEdit,
                    g.SelectMany(t => t.Members).OrderByDescending(m => m.Alloc).ThenBy(m => m.Name)
                        .Select(m => new ResAllocRowDto(m.Id, m.Name, m.Title, m.Alloc,
                            m.AllocHours, m.StartDate, m.EndDate, m.ExtAlloc, m.ExtHours, m.ExtStartDate, m.ExtEndDate)).ToList()))
                .OrderBy(x => x.Name).ToList();
            return Results.Ok(byProject);
        });

        // By product: each product's allocated members and their allocation %
        // (allocations are maintained on the Products screen; shown here read-only).
        api.MapGet("/resources/by-product", async (AtlasDbContext db) =>
        {
            var products = await db.Products.ToDictionaryAsync(p => p.Id, p => p.Name);
            var allocs = await db.ProductAllocations.ToListAsync();
            var byProduct = allocs
                .Where(a => products.ContainsKey(a.ProductId))
                .GroupBy(a => a.ProductId)
                .Select(g => new ResByProductDto(g.Key, products[g.Key],
                    g.OrderByDescending(a => a.Alloc).ThenBy(a => a.MemberName)
                        .Select(a => new ResAllocRowDto(null, a.MemberName, a.MemberTitle, a.Alloc)).ToList()))
                .OrderBy(x => x.Name).ToList();
            return Results.Ok(byProduct);
        });

        // Set a project team member's allocation — % or weekly hours (hours win),
        // an optional date window, and an optional extension. Time-phased like the
        // Team panel; only the fields present in the request are changed.
        api.MapPatch("/resources/project-members/{memberId:int}", async (int memberId, SetAllocReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-schedule", "E") is { } denied) return denied;
            var m = await db.TeamAssignmentMembers.FindAsync(memberId);
            if (m is null) return Results.NotFound();
            if (req.AllocHours is int ah) { m.AllocHours = Math.Max(0, ah); m.Alloc = AllocMath.Percent(req.Alloc, ah); }
            else if (req.Alloc is int a) { m.Alloc = Math.Clamp(a, 0, 100); m.AllocHours = 0; }
            if (req.StartDate is not null) m.StartDate = NormDate(req.StartDate);
            if (req.EndDate is not null) m.EndDate = NormDate(req.EndDate);
            if (req.ExtHours is int eh) { m.ExtHours = Math.Max(0, eh); m.ExtAlloc = AllocMath.Percent(req.ExtAlloc, eh); }
            else if (req.ExtAlloc is int ea) { m.ExtAlloc = Math.Clamp(ea, 0, 100); m.ExtHours = 0; }
            if (req.ExtStartDate is not null) m.ExtStartDate = NormDate(req.ExtStartDate);
            if (req.ExtEndDate is not null) m.ExtEndDate = NormDate(req.ExtEndDate);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Resources", "Set allocation", $"{m.Name} · {m.Alloc}%"));
            await db.SaveChangesAsync();
            return Results.Ok(new ResAllocRowDto(m.Id, m.Name, m.Title, m.Alloc,
                m.AllocHours, m.StartDate, m.EndDate, m.ExtAlloc, m.ExtHours, m.ExtStartDate, m.ExtEndDate));
        });

        // Assignee options for a project's tasks: everyone actually attached to the
        // project (role assignments + team/sub-team/individual members) first, then
        // the rest of the onboarded roster as a fallback pool — so the task-assignee
        // dropdown is populated even when no sub-team is attached yet.
        api.MapGet("/projects/{id}/assignee-options", async (string id, AtlasDbContext db) =>
        {
            var ordered = new List<string>();
            var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            void AddName(string? n)
            {
                var name = (n ?? "").Trim();
                if (name.Length == 0 || name == "N/A" || name == "Unassigned") return;
                if (seen.Add(name)) ordered.Add(name);
            }

            // 1) People on this project — role assignments + attached team members.
            foreach (var p in await db.RoleAssignments.Where(a => a.ProjectId == id).Select(a => a.Person).ToListAsync()) AddName(p);
            var team = await db.TeamAssignments.Include(a => a.Members)
                .Where(a => a.EntityType == "project" && a.EntityId == id).ToListAsync();
            foreach (var m in team.SelectMany(a => a.Members)) AddName(m.Name);

            // 2) Fallback pool — the whole onboarded roster (Entra members + roster).
            foreach (var m in await db.TeamMembers.Select(m => m.DisplayName).ToListAsync()) AddName(m);
            foreach (var r in await db.Resources.Select(r => r.Name).ToListAsync()) AddName(r);

            return Results.Ok(ordered);
        });

        // Task assignees that aren't in the onboarded set (Resources + Entra members)
        // — typically people imported from Jira. Surfaced so the name isn't lost and
        // an admin can onboard them in one click. Grouped with the projects they're on.
        api.MapGet("/resources/unonboarded", async (AtlasDbContext db) =>
        {
            var known = await KnownNamesAsync(db);
            var projNames = await db.Projects.ToDictionaryAsync(p => p.Id, p => p.Name);
            var tasks = await db.ProjectTasks
                .Where(t => t.Assignee != "" && t.Assignee != "Unassigned")
                .Select(t => new { t.Assignee, t.ProjectId }).ToListAsync();
            var rows = tasks
                .Where(t => !known.Contains(t.Assignee.Trim()))
                .GroupBy(t => t.Assignee.Trim(), StringComparer.OrdinalIgnoreCase)
                .Select(g => new UnonboardedDto(g.Key,
                    g.Select(x => projNames.TryGetValue(x.ProjectId, out var n) ? n : x.ProjectId).Distinct().OrderBy(n => n).ToList()))
                .OrderBy(r => r.Name).ToList();
            return Results.Ok(rows);
        });

        // Onboard a person by adding them to a manual directory group so they become
        // "known" (they'll then match on the next task read / Jira resync). Managing
        // the directory needs Edit on "Users, groups & roles" (cap-users-roles).
        api.MapPost("/resources/onboard", async (OnboardReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-users-roles", "E") is { } denied) return denied;
            if (string.IsNullOrWhiteSpace(req.Name)) return Results.BadRequest(new { error = "A name is required." });
            const string groupId = "manual-onboarded";
            var group = await db.EntraGroups.FindAsync(groupId);
            if (group is null)
            {
                group = new EntraGroup { Id = groupId, DisplayName = "Onboarded (manual)", Manual = true, LastSynced = "" };
                db.EntraGroups.Add(group);
            }
            var name = req.Name.Trim();
            if (!await db.TeamMembers.AnyAsync(m => m.GroupId == groupId && m.DisplayName == name))
                db.TeamMembers.Add(new TeamMemberRow { GroupId = groupId, DisplayName = name, Email = req.Email?.Trim() ?? "", JobTitle = req.Title?.Trim() ?? "" });
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Resources", "Onboarded person", name));
            await db.SaveChangesAsync();
            return Results.Ok(new TeamMemberDto(0, name, req.Email?.Trim() ?? "", req.Title?.Trim() ?? ""));
        });
    }

    // The onboarded set: Resources sheet names + Entra member display names/emails
    // (same basis the task list uses to flag unknown assignees).
    static async Task<HashSet<string>> KnownNamesAsync(AtlasDbContext db)
    {
        var known = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var n in await db.Resources.Select(r => r.Name).ToListAsync()) known.Add(n);
        foreach (var m in await db.TeamMembers.Select(m => new { m.DisplayName, m.Email }).ToListAsync())
        {
            if (!string.IsNullOrWhiteSpace(m.DisplayName)) known.Add(m.DisplayName.Trim());
            if (!string.IsNullOrWhiteSpace(m.Email)) known.Add(m.Email.Trim());
        }
        return known;
    }
}
