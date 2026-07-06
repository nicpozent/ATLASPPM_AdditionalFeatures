using Microsoft.EntityFrameworkCore;

namespace Atlas.Api;

public record SetAllocReq(int? Alloc);

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

    static string Initials(string name)
    {
        var parts = name.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length == 0) return "?";
        return parts.Length == 1 ? parts[0][..Math.Min(2, parts[0].Length)].ToUpperInvariant()
            : $"{char.ToUpperInvariant(parts[0][0])}{char.ToUpperInvariant(parts[^1][0])}";
    }
    static string ColorFor(string name)
    {
        var h = 0; foreach (var c in name) h = (h * 31 + c) & 0x7fffffff;
        return Palette[h % Palette.Length];
    }

    public static void MapResourceEndpoints(this RouteGroupBuilder api)
    {
        // The capacity roster: everyone with an allocation (product or project) or
        // on the synced directory, with their rolled-up utilisation.
        api.MapGet("/resources", async (AtlasDbContext db) =>
        {
            var productAllocs = await db.ProductAllocations.ToListAsync();
            var projAssignments = await db.TeamAssignments.Where(t => t.EntityType == "project").Include(t => t.Members).ToListAsync();
            var groups = await db.EntraGroups.Include(g => g.Members).ToListAsync();

            // Accumulate per person (keyed case-insensitively by name).
            var people = new Dictionary<string, (string Name, string Title, string Dept, int Project, int Product)>(StringComparer.OrdinalIgnoreCase);
            (string, string, string, int, int) Get(string name) =>
                people.TryGetValue(name, out var v) ? v : (name, "", "", 0, 0);

            foreach (var a in productAllocs)
            {
                var p = Get(a.MemberName);
                people[a.MemberName] = (p.Item1, string.IsNullOrEmpty(p.Item2) ? a.MemberTitle : p.Item2, p.Item3, p.Item4, p.Item5 + a.Alloc);
            }
            foreach (var t in projAssignments)
                foreach (var m in t.Members)
                {
                    var p = Get(m.Name);
                    people[m.Name] = (p.Item1, string.IsNullOrEmpty(p.Item2) ? m.Title : p.Item2, p.Item3, p.Item4 + m.Alloc, p.Item5);
                }
            foreach (var g in groups)
                foreach (var m in g.Members)
                {
                    var p = Get(m.DisplayName);
                    people[m.DisplayName] = (p.Item1, string.IsNullOrEmpty(p.Item2) ? m.JobTitle : p.Item2,
                        string.IsNullOrEmpty(p.Item3) ? g.DisplayName : p.Item3, p.Item4, p.Item5);
                }

            var rows = people.Values
                .OrderByDescending(p => p.Project + p.Product).ThenBy(p => p.Name)
                .Select(p => new ResourceDto(p.Name, string.IsNullOrEmpty(p.Title) ? "Team member" : p.Title, p.Dept,
                    Initials(p.Name), ColorFor(p.Name), 0, p.Project, p.Product, p.Project + p.Product > 100))
                .ToList();
            return Results.Ok(rows);
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
                        .Select(m => new ResAllocRowDto(m.Id, m.Name, m.Title, m.Alloc)).ToList()))
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

        // Set a project team member's allocation %.
        api.MapPatch("/resources/project-members/{memberId:int}", async (int memberId, SetAllocReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-schedule", "E") is { } denied) return denied;
            var m = await db.TeamAssignmentMembers.FindAsync(memberId);
            if (m is null) return Results.NotFound();
            m.Alloc = Math.Clamp(req.Alloc ?? 0, 0, 100);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Resources", "Set allocation", $"{m.Name} · {m.Alloc}%"));
            await db.SaveChangesAsync();
            return Results.Ok(new ResAllocRowDto(m.Id, m.Name, m.Title, m.Alloc));
        });
    }
}
