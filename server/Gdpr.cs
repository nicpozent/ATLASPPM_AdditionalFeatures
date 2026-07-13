using Microsoft.EntityFrameworkCore;

namespace Atlas.Api;

// ============================================================================
//  GDPR data-subject access & portability (Articles 15 & 20).
//
//  A Platform Administrator can export every record Atlas holds that references
//  a given person — matched by name, email or stable user key — as one portable,
//  human-readable JSON document. The operation is read-only (it never mutates the
//  subject's data) and is itself audited, since accessing personal data across
//  the org is a governed action.
//
//  Matching is EXACT (case-insensitive) on names/emails/keys. That is deliberate:
//  a loose "contains" match would risk pulling a DIFFERENT person's records into
//  someone's export — itself a personal-data breach. Precision over recall here.
// ============================================================================
public static class Gdpr
{
    public static void MapGdprEndpoints(this RouteGroupBuilder api)
    {
        // The people Atlas actually holds data on — used to populate a picker.
        api.MapGet("/gdpr/subjects", async (AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (!Permissions.IsPlatformAdmin(http, cfg)) return AdminOnly();

            var people = new Dictionary<string, (string Name, string Email)>(StringComparer.OrdinalIgnoreCase);
            void Add(string? name, string? email)
            {
                name = (name ?? "").Trim(); email = (email ?? "").Trim();
                if (name.Length == 0 && email.Length == 0) return;
                var key = (email.Length > 0 ? email : name).ToLowerInvariant();
                if (!people.ContainsKey(key)) people[key] = (name, email);
            }
            foreach (var n in await db.Resources.Select(r => r.Name).ToListAsync()) Add(n, null);
            foreach (var m in await db.TeamMembers.Select(m => new { m.DisplayName, m.Email }).ToListAsync()) Add(m.DisplayName, m.Email);
            foreach (var a in await db.ProductAllocations.Select(a => new { a.MemberName, a.MemberEmail }).ToListAsync()) Add(a.MemberName, a.MemberEmail);

            return Results.Ok(people.Values.OrderBy(p => p.Name, StringComparer.OrdinalIgnoreCase)
                .Select(p => new { name = p.Name, email = p.Email }).ToList());
        });

        // Export everything held about `subject` (a name, email or user key) as a
        // downloadable JSON file. Admin-only and audited.
        api.MapGet("/gdpr/export", async (string? subject, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (!Permissions.IsPlatformAdmin(http, cfg)) return AdminOnly();
            var s = (subject ?? "").Trim();
            if (s.Length == 0) return Results.BadRequest(new { error = "A subject (name, email or user key) is required." });

            bool Eq(string? v) => !string.IsNullOrWhiteSpace(v) && string.Equals(v!.Trim(), s, StringComparison.OrdinalIgnoreCase);

            // Pull each table then filter in memory — case-insensitive and provider
            // agnostic (works identically on Postgres and the in-memory test DB).
            var resources = (await db.Resources.ToListAsync()).Where(r => Eq(r.Name))
                .Select(r => new { r.Name, r.Role, r.Dept, r.OpsPct, r.ProjectPct, r.ProductPct, r.Over }).ToList();
            var directory = (await db.TeamMembers.ToListAsync()).Where(m => Eq(m.DisplayName) || Eq(m.Email))
                .Select(m => new { m.DisplayName, m.Email, m.JobTitle, m.GroupId }).ToList();
            var productAllocations = (await db.ProductAllocations.ToListAsync()).Where(a => Eq(a.MemberName) || Eq(a.MemberEmail))
                .Select(a => new { a.ProductId, a.MemberName, a.MemberEmail, a.MemberTitle, a.Alloc }).ToList();
            var productMemberships = (await db.ProductMembers.ToListAsync()).Where(m => Eq(m.Name))
                .Select(m => new { m.ProductId, m.Name, m.Alloc }).ToList();
            var subscriptions = (await db.Subscriptions.ToListAsync()).Where(x => Eq(x.UserKey) || Eq(x.Email))
                .Select(x => new { x.UserKey, x.Email, x.TargetType, x.TargetId, CreatedAt = x.CreatedAt.ToString("o") }).ToList();
            var notificationPreferences = (await db.NotificationPrefs.ToListAsync()).Where(x => Eq(x.UserKey) || Eq(x.EmailAddr))
                .Select(x => new { x.UserKey, x.EmailAddr, x.EventType, x.InApp, x.Email }).ToList();
            var notifications = (await db.Notifications.ToListAsync()).Where(x => Eq(x.UserKey))
                .Select(x => new { x.UserKey, x.EventType, x.Title, x.Body, At = x.At.ToString("o"), x.Read }).ToList();
            var auditActivity = (await db.AuditEvents.ToListAsync()).Where(x => Eq(x.Actor))
                .Select(x => new { At = x.At.ToString("o"), x.Actor, x.Role, x.Category, x.Action, x.Target }).ToList();

            // Free-text ownership / requester references across the portfolio.
            var ownedProjects = (await db.Projects.ToListAsync()).Where(p => Eq(p.Owner)).Select(p => new { p.Id, p.Name }).ToList();
            var ownedPrograms = (await db.Programs.ToListAsync()).Where(p => Eq(p.Owner)).Select(p => new { p.Id, p.Name }).ToList();
            var ownedProducts = (await db.Products.ToListAsync()).Where(p => Eq(p.Owner)).Select(p => new { p.Id, p.Name }).ToList();
            var ownedObjectives = (await db.Objectives.ToListAsync()).Where(o => Eq(o.Owner)).Select(o => new { o.Id, o.Title }).ToList();
            var blockersOwned = (await db.Blockers.ToListAsync()).Where(b => Eq(b.Owner)).Select(b => new { b.Id, b.Title }).ToList();
            var demandsRaised = (await db.Demands.ToListAsync()).Where(d => Eq(d.Requester)).Select(d => new { d.Id, d.Title }).ToList();

            // Manager's development plan for this subject (Setting-stored, keyed by
            // display name — ADR-0062). Sensitive personal data, so it MUST appear
            // in a subject-access export.
            var developmentPlan = new List<object>();
            var devPlanRaw = (await db.Settings.FindAsync($"devplan.{s}"))?.Value;
            if (!string.IsNullOrWhiteSpace(devPlanRaw))
            {
                try
                {
                    if (System.Text.Json.JsonSerializer.Deserialize<DevPlan>(devPlanRaw) is { } p)
                        developmentPlan.Add(new { p.Strengths, p.GrowthAreas, p.Goals, p.UpdatedAt, p.UpdatedBy });
                }
                catch { /* corrupt value — skip */ }
            }

            var categories = new Dictionary<string, object>
            {
                ["developmentPlan"] = developmentPlan,
                ["resourceAllocation"] = resources,
                ["directoryMembership"] = directory,
                ["productAllocations"] = productAllocations,
                ["productMemberships"] = productMemberships,
                ["subscriptions"] = subscriptions,
                ["notificationPreferences"] = notificationPreferences,
                ["notifications"] = notifications,
                ["auditActivity"] = auditActivity,
                ["ownedProjects"] = ownedProjects,
                ["ownedPrograms"] = ownedPrograms,
                ["ownedProducts"] = ownedProducts,
                ["ownedObjectives"] = ownedObjectives,
                ["blockersOwned"] = blockersOwned,
                ["demandsRaised"] = demandsRaised,
            };
            var total = resources.Count + directory.Count + productAllocations.Count + productMemberships.Count
                + subscriptions.Count + notificationPreferences.Count + notifications.Count + auditActivity.Count
                + ownedProjects.Count + ownedPrograms.Count + ownedProducts.Count + ownedObjectives.Count
                + blockersOwned.Count + demandsRaised.Count + developmentPlan.Count;

            // Accessing a subject's full record is itself auditable.
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "GDPR", "Exported data-subject record", $"{s} · {total} record(s)"));
            await db.SaveChangesAsync();

            var doc = new
            {
                subject = s,
                generatedAt = DateTime.UtcNow.ToString("o"),
                generatedBy = Permissions.ActorName(http, cfg),
                note = "Personal data held by Atlas PPM for this subject. Records are matched exactly (case-insensitive) on name, email or user key.",
                totalRecords = total,
                categories,
            };
            var json = System.Text.Json.JsonSerializer.Serialize(doc,
                new System.Text.Json.JsonSerializerOptions
                {
                    WriteIndented = true,
                    PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase,
                });
            return Results.File(System.Text.Encoding.UTF8.GetBytes(json), "application/json", $"atlas-dsar-{Slug(s)}.json");
        });
    }

    static IResult AdminOnly() => Results.Json(
        new { error = "Only a Platform Administrator can access data-subject records." },
        statusCode: StatusCodes.Status403Forbidden);

    static string Slug(string s)
    {
        var slug = new string(s.Trim().ToLowerInvariant().Select(c => char.IsLetterOrDigit(c) ? c : '-').ToArray()).Trim('-');
        return slug.Length == 0 ? "subject" : slug;
    }
}
