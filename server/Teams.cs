using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;

namespace Atlas.Api;

public record MapGroupReq(string? ManagerKey);
public record AddGroupReq(string DisplayName);
public record AddMemberReq(string DisplayName, string? Email, string? JobTitle);
public record SetParentReq(string? ParentKey);

// ============================================================================
//  Teams. Entra groups are synced from the directory (Microsoft Graph) — or
//  added by hand when Graph isn't configured — and the Platform Admin maps each
//  group to a team-manager SLOT inside Atlas (never hardcoded). Managers form a
//  roll-up tree (each slot has a parent), so a senior manager sees their own
//  teams plus every team beneath them. Manager identity is resolved from the
//  Entra app role (Permissions.ManagerKey), separate from the permission role.
// ============================================================================
public static class Teams
{
    // The team-manager slots — aligned to the role-switcher identities.
    public static readonly (string Key, string Label)[] Slots =
    {
        ("teammgr",   "Global Engineering Manager"),
        ("svcmgr",    "Global Service Manager"),
        ("devmgr",    "Developers Manager"),
        ("inframgr",  "Infrastructure Manager"),
        ("architect", "Chief Architect"),
        ("pmo",       "PMO"),
        ("pmlead",    "PM Lead"),
    };
    static string Label(string key) => Slots.FirstOrDefault(s => s.Key == key).Label ?? key;
    public static string SlotLabel(string key) => string.IsNullOrEmpty(key) ? "" : Label(key);
    static bool IsSlot(string? key) => key is not null && Slots.Any(s => s.Key == key);
    public static bool IsValidSlot(string? key) => IsSlot(key);

    // The manager slots in the caller's scope: Platform Admin → all; a manager →
    // self + every team beneath them in the roll-up. Empty for anyone else.
    public static async Task<HashSet<string>> ScopeAsync(AtlasDbContext db, IConfiguration cfg, HttpContext http)
    {
        if (Permissions.IsPlatformAdmin(http, cfg)) return Slots.Select(s => s.Key).ToHashSet();
        var mgr = Permissions.ManagerKey(http, cfg);
        if (mgr is null) return new HashSet<string>();
        return DescendantsOf(mgr, await ParentMapAsync(db));
    }

    static bool GraphConfigured(IConfiguration cfg) =>
        !string.IsNullOrWhiteSpace(cfg["Graph:TenantId"]) &&
        !string.IsNullOrWhiteSpace(cfg["Graph:ClientId"]) &&
        !string.IsNullOrWhiteSpace(cfg["Graph:ClientSecret"]);

    // All manager keys at or below `key` in the parent tree (inclusive).
    internal static HashSet<string> DescendantsOf(string key, Dictionary<string, string> parentOf)
    {
        var result = new HashSet<string> { key };
        bool grew = true;
        while (grew)
        {
            grew = false;
            foreach (var (child, parent) in parentOf)
                if (result.Contains(parent) && result.Add(child)) grew = true;
        }
        return result;
    }

    static async Task<Dictionary<string, string>> ParentMapAsync(AtlasDbContext db)
    {
        var nodes = await db.ManagerNodes.ToListAsync();
        return Slots.ToDictionary(s => s.Key, s => nodes.FirstOrDefault(n => n.Key == s.Key)?.ParentKey ?? "");
    }

    public static void MapTeamEndpoints(this RouteGroupBuilder api)
    {
        // ---- Admin: groups, mapping, hierarchy ----------------------------
        api.MapGet("/teams/admin", async (AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-users-roles", "V") is { } denied) return denied;
            var canManage = await Permissions.Allows(http, db, cfg, "cap-users-roles", "E");
            var groups = await db.EntraGroups.Include(g => g.Members).OrderBy(g => g.DisplayName).ToListAsync();
            var parentOf = await ParentMapAsync(db);
            var managers = Slots.Select(s =>
            {
                var gs = groups.Where(g => g.ManagerKey == s.Key).ToList();
                return new TeamManagerDto(s.Key, s.Label, parentOf[s.Key], gs.Select(g => g.Id).ToList(), gs.Sum(g => g.Members.Count));
            }).ToList();
            var groupDtos = groups.Select(g => new TeamGroupDto(g.Id, g.DisplayName, g.ManagerKey, g.Manual, g.LastSynced, g.Members.Count)).ToList();
            return Results.Ok(new TeamsAdminDto(canManage, GraphConfigured(cfg), managers, groupDtos));
        });

        api.MapPost("/teams/groups/sync", async (AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-users-roles", "E") is { } denied) return denied;
            if (!GraphConfigured(cfg))
                return Results.Ok(new { configured = false, synced = 0, message = "Microsoft Graph isn't configured — add groups manually, or set Graph credentials to sync." });
            try
            {
                var n = await SyncFromGraphAsync(db, cfg);
                db.AuditEvents.Add(Permissions.Audit(http, cfg, "Teams", "Synced Entra groups", $"{n} groups"));
                await db.SaveChangesAsync();
                return Results.Ok(new { configured = true, synced = n });
            }
            catch (Exception ex)
            {
                return Results.Json(new { configured = true, synced = 0, error = $"Graph sync failed: {ex.Message}" }, statusCode: StatusCodes.Status502BadGateway);
            }
        });

        // Manual group add (fallback / demo when Graph isn't wired).
        api.MapPost("/teams/groups", async (AddGroupReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-users-roles", "E") is { } denied) return denied;
            if (string.IsNullOrWhiteSpace(req.DisplayName)) return Results.BadRequest(new { error = "Group name is required." });
            var g = new EntraGroup { Id = $"manual-{Guid.NewGuid():N}", DisplayName = req.DisplayName.Trim(), Manual = true, LastSynced = "" };
            db.EntraGroups.Add(g);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Teams", "Added group (manual)", g.DisplayName));
            await db.SaveChangesAsync();
            return Results.Created($"/api/v1/teams/groups/{g.Id}", new TeamGroupDto(g.Id, g.DisplayName, g.ManagerKey, g.Manual, g.LastSynced, 0));
        });

        // Map a group to a manager slot (or clear with null/empty).
        api.MapPatch("/teams/groups/{id}", async (string id, MapGroupReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-users-roles", "E") is { } denied) return denied;
            var g = await db.EntraGroups.FindAsync(id);
            if (g is null) return Results.NotFound();
            if (!string.IsNullOrEmpty(req.ManagerKey) && !IsSlot(req.ManagerKey)) return Results.BadRequest(new { error = "Unknown manager." });
            g.ManagerKey = req.ManagerKey ?? "";
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Teams", "Mapped group", $"{g.DisplayName} → {(string.IsNullOrEmpty(g.ManagerKey) ? "unmapped" : Label(g.ManagerKey))}"));
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        api.MapDelete("/teams/groups/{id}", async (string id, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-users-roles", "E") is { } denied) return denied;
            var g = await db.EntraGroups.FindAsync(id);
            if (g is null) return Results.NotFound();
            await db.TeamMembers.Where(m => m.GroupId == id).ExecuteDeleteAsync();
            db.EntraGroups.Remove(g);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Teams", "Removed group", g.DisplayName));
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        // Manual member add / remove (demo, or to enrich a manual group).
        api.MapPost("/teams/groups/{id}/members", async (string id, AddMemberReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-users-roles", "E") is { } denied) return denied;
            if (await db.EntraGroups.FindAsync(id) is null) return Results.NotFound();
            if (string.IsNullOrWhiteSpace(req.DisplayName)) return Results.BadRequest(new { error = "Name is required." });
            var m = new TeamMemberRow { GroupId = id, DisplayName = req.DisplayName.Trim(), Email = req.Email?.Trim() ?? "", JobTitle = req.JobTitle?.Trim() ?? "" };
            db.TeamMembers.Add(m);
            await db.SaveChangesAsync();
            return Results.Created($"/api/v1/teams/members/{m.Id}", new TeamMemberDto(m.Id, m.DisplayName, m.Email, m.JobTitle));
        });

        api.MapDelete("/teams/members/{id:int}", async (int id, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-users-roles", "E") is { } denied) return denied;
            var m = await db.TeamMembers.FindAsync(id);
            if (m is null) return Results.NotFound();
            db.TeamMembers.Remove(m);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        // Set a manager's parent in the roll-up tree (guards against cycles).
        api.MapPatch("/teams/managers/{key}", async (string key, SetParentReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-users-roles", "E") is { } denied) return denied;
            if (!IsSlot(key)) return Results.NotFound();
            var parent = req.ParentKey ?? "";
            if (parent == key) return Results.BadRequest(new { error = "A manager can't report to themselves." });
            if (!string.IsNullOrEmpty(parent) && !IsSlot(parent)) return Results.BadRequest(new { error = "Unknown parent." });
            // Cycle guard: parent must not be at or below `key`.
            if (!string.IsNullOrEmpty(parent))
            {
                var parentOf = await ParentMapAsync(db);
                parentOf[key] = ""; // ignore current edge while checking
                if (DescendantsOf(key, parentOf).Contains(parent))
                    return Results.BadRequest(new { error = "That would create a management cycle." });
            }
            var node = await db.ManagerNodes.FindAsync(key);
            if (node is null) { node = new ManagerNode { Key = key, ParentKey = parent }; db.ManagerNodes.Add(node); }
            else node.ParentKey = parent;
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Teams", "Set manager parent", $"{Label(key)} → {(string.IsNullOrEmpty(parent) ? "top" : Label(parent))}"));
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        // ---- My Team (roll-up) --------------------------------------------
        api.MapGet("/myteam", async (AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            var isAdmin = Permissions.IsPlatformAdmin(http, cfg);
            var mgr = Permissions.ManagerKey(http, cfg);
            var parentOf = await ParentMapAsync(db);
            // Which manager slots are in scope: admin → all; a manager → self + descendants.
            HashSet<string> scope = isAdmin ? Slots.Select(s => s.Key).ToHashSet()
                : (mgr is not null ? DescendantsOf(mgr, parentOf) : new HashSet<string>());

            var groups = await db.EntraGroups.Include(g => g.Members).Where(g => g.ManagerKey != "").ToListAsync();
            var teams = Slots.Where(s => scope.Contains(s.Key)).Select(s =>
            {
                var gs = groups.Where(g => g.ManagerKey == s.Key)
                    .Select(g => new MyTeamGroupDto(g.Id, g.DisplayName,
                        g.Members.OrderBy(m => m.DisplayName).Select(m => new TeamMemberDto(m.Id, m.DisplayName, m.Email, m.JobTitle)).ToList()))
                    .ToList();
                return new MyTeamManagerDto(s.Key, s.Label, s.Key == mgr, gs, gs.Sum(g => g.Members.Count));
            }).Where(t => t.Groups.Count > 0 || t.Key == mgr).ToList();

            return Results.Ok(new MyTeamDto(isAdmin, mgr ?? "", mgr is null ? "" : Label(mgr), teams));
        });

        // The team-manager slots as pickable options (for the create-product form).
        api.MapGet("/teams/slots", async (AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-products", "V") is { } denied) return denied;
            return Results.Ok(Slots.Select(s => new TeamOptionDto(s.Key, s.Label)).ToList());
        });

        // ---- Product teams: assign an owning team, allocate members --------
        // Everyone with View on Products can see the allocated team; assigning a
        // team needs Edit on Products; allocating members is manager/admin only
        // (you can only allocate people you manage — their team is in your scope).
        api.MapGet("/products/{id}/team", async (string id, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            // The roster is visible to anyone who can reach a product (the product
            // list is open). Assigning the team and allocating members are gated below.
            var p = await db.Products.Include(x => x.Allocations).FirstOrDefaultAsync(x => x.Id == id);
            if (p is null) return Results.NotFound();

            var canAssignTeam = await Permissions.Allows(http, db, cfg, "cap-products", "E");
            var scope = await ScopeAsync(db, cfg, http);
            var canAllocate = scope.Count > 0;

            var allocations = p.Allocations.OrderBy(a => a.MemberName)
                .Select(a => new ProductAllocationDto(a.Id, a.MemberName, a.MemberEmail, a.MemberTitle, a.SourceTeamKey, SlotLabel(a.SourceTeamKey), a.Alloc))
                .ToList();

            // Assignable pool = members of the caller's in-scope teams, minus those
            // already allocated (matched by email when present, else by name).
            var taken = p.Allocations.Select(a => (string.IsNullOrEmpty(a.MemberEmail) ? a.MemberName : a.MemberEmail).ToLowerInvariant()).ToHashSet();
            var assignable = new List<AllocatableDto>();
            if (canAllocate)
            {
                var groups = await db.EntraGroups.Include(g => g.Members).Where(g => g.ManagerKey != "" && scope.Contains(g.ManagerKey)).ToListAsync();
                foreach (var g in groups)
                    foreach (var m in g.Members)
                    {
                        var key = (string.IsNullOrEmpty(m.Email) ? m.DisplayName : m.Email).ToLowerInvariant();
                        if (taken.Contains(key)) continue;
                        assignable.Add(new AllocatableDto(m.DisplayName, m.Email, m.JobTitle, g.ManagerKey, SlotLabel(g.ManagerKey)));
                    }
                assignable = assignable.GroupBy(a => (string.IsNullOrEmpty(a.Email) ? a.Name : a.Email).ToLowerInvariant())
                    .Select(gr => gr.First()).OrderBy(a => a.Name).ToList();
            }

            var teamOptions = Slots.Select(s => new TeamOptionDto(s.Key, s.Label)).ToList();
            return Results.Ok(new ProductTeamDto(p.Id, p.TeamKey, SlotLabel(p.TeamKey), canAssignTeam, canAllocate, allocations, assignable, teamOptions));
        });

        api.MapPatch("/products/{id}/team", async (string id, SetProductTeamReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-products", "E") is { } denied) return denied;
            var p = await db.Products.FindAsync(id);
            if (p is null) return Results.NotFound();
            if (!string.IsNullOrEmpty(req.TeamKey) && !IsSlot(req.TeamKey)) return Results.BadRequest(new { error = "Unknown team." });
            p.TeamKey = req.TeamKey ?? "";
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Products", "Assigned product team", $"{p.Name} → {(string.IsNullOrEmpty(p.TeamKey) ? "unassigned" : Label(p.TeamKey))}"));
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        api.MapPost("/products/{id}/allocations", async (string id, AddAllocationReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            var p = await db.Products.Include(x => x.Allocations).FirstOrDefaultAsync(x => x.Id == id);
            if (p is null) return Results.NotFound();
            if (string.IsNullOrWhiteSpace(req.Name)) return Results.BadRequest(new { error = "Member name is required." });

            // You may only allocate people you manage: their source team must be in your scope.
            var scope = await ScopeAsync(db, cfg, http);
            var source = req.SourceTeamKey ?? "";
            if (scope.Count == 0) return Results.Json(new { error = "Only a team manager or Platform Admin can allocate members." }, statusCode: StatusCodes.Status403Forbidden);
            if (!string.IsNullOrEmpty(source) && !scope.Contains(source)) return Results.Json(new { error = "That member isn’t in a team you manage." }, statusCode: StatusCodes.Status403Forbidden);

            var email = req.Email?.Trim() ?? "";
            var matchKey = (string.IsNullOrEmpty(email) ? req.Name.Trim() : email).ToLowerInvariant();
            if (p.Allocations.Any(a => (string.IsNullOrEmpty(a.MemberEmail) ? a.MemberName : a.MemberEmail).ToLowerInvariant() == matchKey))
                return Results.BadRequest(new { error = "That member is already on this product team." });

            var a = new ProductAllocation
            {
                ProductId = id, MemberName = req.Name.Trim(), MemberEmail = email,
                MemberTitle = req.Title?.Trim() ?? "", SourceTeamKey = source,
                Alloc = Math.Clamp(req.Alloc, 0, 100),
            };
            db.ProductAllocations.Add(a);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Products", "Allocated member", $"{a.MemberName} → {p.Name} ({a.Alloc}%)"));
            await db.SaveChangesAsync();
            return Results.Created($"/api/v1/products/allocations/{a.Id}",
                new ProductAllocationDto(a.Id, a.MemberName, a.MemberEmail, a.MemberTitle, a.SourceTeamKey, SlotLabel(a.SourceTeamKey), a.Alloc));
        });

        api.MapPatch("/products/allocations/{allocId:int}", async (int allocId, SetAllocationReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            var a = await db.ProductAllocations.FindAsync(allocId);
            if (a is null) return Results.NotFound();
            if (await CanEditAllocation(a, db, cfg, http) is { } forbidden) return forbidden;
            a.Alloc = Math.Clamp(req.Alloc, 0, 100);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        api.MapDelete("/products/allocations/{allocId:int}", async (int allocId, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            var a = await db.ProductAllocations.FindAsync(allocId);
            if (a is null) return Results.NotFound();
            if (await CanEditAllocation(a, db, cfg, http) is { } forbidden) return forbidden;
            db.ProductAllocations.Remove(a);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Products", "Removed allocation", $"{a.MemberName} · {SlotLabel(a.SourceTeamKey)}"));
            await db.SaveChangesAsync();
            return Results.NoContent();
        });
    }

    // Editing/removing an allocation is allowed for the managing chain (admin, or a
    // manager whose scope contains the member's source team) or a product manager
    // (Edit on Products) — the product owner curates their own delivery roster.
    static async Task<IResult?> CanEditAllocation(ProductAllocation a, AtlasDbContext db, IConfiguration cfg, HttpContext http)
    {
        var scope = await ScopeAsync(db, cfg, http);
        var inScope = scope.Count > 0 && (string.IsNullOrEmpty(a.SourceTeamKey) || scope.Contains(a.SourceTeamKey));
        if (inScope || await Permissions.Allows(http, db, cfg, "cap-products", "E")) return null;
        return Results.Json(new { error = "You can’t change this allocation." }, statusCode: StatusCodes.Status403Forbidden);
    }

    // ---- Microsoft Graph sync (client credentials) ------------------------
    // Sync only the groups ASSIGNED to the Atlas Enterprise Application — a
    // small, admin-curated set — instead of crawling the whole directory:
    //   1. Resolve Atlas's own service principal (by client id).
    //   2. Read its appRoleAssignedTo; keep the Group assignments (optionally
    //      just those to the marker app role Graph:SyncAppRoleId).
    //   3. Upsert those groups and expand their members.
    // A wall-clock budget is a final backstop.
    static async Task<int> SyncFromGraphAsync(AtlasDbContext db, IConfiguration cfg)
    {
        using var http = new HttpClient();
        var token = await GraphTokenAsync(http, cfg);
        http.DefaultRequestHeaders.Authorization = new("Bearer", token);
        var deadline = DateTime.UtcNow.AddSeconds(cfg.GetValue("Graph:SyncBudgetSeconds", 45));
        var stamp = DateTime.UtcNow.ToString("dd MMM yyyy HH:mm 'UTC'");
        var clientId = cfg["Graph:ClientId"];
        var markerRole = cfg["Graph:SyncAppRoleId"];   // optional: only this app role's group assignments

        // 1. Atlas's own service principal.
        var spList = await http.GetFromJsonAsync<GraphList<SpRef>>(
            $"https://graph.microsoft.com/v1.0/servicePrincipals?$filter=appId eq '{clientId}'&$select=id");
        var spId = spList?.Value.FirstOrDefault()?.Id
            ?? throw new InvalidOperationException("Atlas service principal not found for the configured Graph:ClientId.");

        // 2. Groups assigned to the app (optionally filtered to the marker role).
        var groups = new Dictionary<string, string>();   // id -> displayName
        var url = $"https://graph.microsoft.com/v1.0/servicePrincipals/{spId}/appRoleAssignedTo?$top=999";
        while (url is not null && DateTime.UtcNow < deadline)
        {
            var page = await http.GetFromJsonAsync<GraphList<AppRoleAssignment>>(url);
            foreach (var a in page?.Value ?? new())
            {
                if (!string.Equals(a.PrincipalType, "Group", StringComparison.OrdinalIgnoreCase)) continue;
                if (!string.IsNullOrWhiteSpace(markerRole) && !string.Equals(a.AppRoleId, markerRole, StringComparison.OrdinalIgnoreCase)) continue;
                groups[a.PrincipalId] = a.PrincipalDisplayName ?? "(group)";
            }
            url = page?.NextLink;
        }

        // 3. Upsert each assigned group and refresh its members. A failing group
        //    is logged and skipped rather than aborting the run.
        foreach (var (gid, name) in groups)
        {
            if (DateTime.UtcNow >= deadline) break;
            try
            {
                var g = await db.EntraGroups.FirstOrDefaultAsync(x => x.Id == gid);
                if (g is null) { g = new EntraGroup { Id = gid }; db.EntraGroups.Add(g); }
                g.DisplayName = name; g.Manual = false; g.LastSynced = stamp;
                await db.SaveChangesAsync();

                await db.TeamMembers.Where(m => m.GroupId == gid).ExecuteDeleteAsync();
                var mUrl = $"https://graph.microsoft.com/v1.0/groups/{gid}/members/microsoft.graph.user?$select=id,displayName,mail,jobTitle&$top=999";
                while (mUrl is not null && DateTime.UtcNow < deadline)
                {
                    var mp = await http.GetFromJsonAsync<GraphList<GraphUser>>(mUrl);
                    foreach (var u in mp?.Value ?? new())
                        db.TeamMembers.Add(new TeamMemberRow { GroupId = gid, DisplayName = u.DisplayName ?? "(unknown)", Email = u.Mail ?? "", JobTitle = u.JobTitle ?? "" });
                    mUrl = mp?.NextLink;
                }
                await db.SaveChangesAsync();
            }
            catch (Exception ex) { _log?.LogWarning(ex, "Graph member sync failed for group {GroupId}: {Message}", gid, ex.Message); }
        }
        return groups.Count;
    }

    static ILogger? _log;
    public static void UseLogger(ILoggerFactory f) => _log = f.CreateLogger("Atlas.Teams");

    public static async Task<string> GraphTokenAsync(HttpClient http, IConfiguration cfg)
    {
        var form = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["client_id"] = cfg["Graph:ClientId"]!,
            ["client_secret"] = cfg["Graph:ClientSecret"]!,
            ["scope"] = "https://graph.microsoft.com/.default",
            ["grant_type"] = "client_credentials",
        });
        var res = await http.PostAsync($"https://login.microsoftonline.com/{cfg["Graph:TenantId"]}/oauth2/v2.0/token", form);
        res.EnsureSuccessStatusCode();
        var tok = await res.Content.ReadFromJsonAsync<TokenResponse>();
        return tok?.AccessToken ?? throw new InvalidOperationException("No access token from Entra.");
    }

    class GraphList<T> { [System.Text.Json.Serialization.JsonPropertyName("value")] public List<T> Value { get; set; } = new(); [System.Text.Json.Serialization.JsonPropertyName("@odata.nextLink")] public string? NextLink { get; set; } }
    class GraphGroup { public string Id { get; set; } = ""; public string? DisplayName { get; set; } }
    class GraphUser { public string Id { get; set; } = ""; public string? DisplayName { get; set; } public string? Mail { get; set; } public string? JobTitle { get; set; } }
    class SpRef { public string Id { get; set; } = ""; }
    class AppRoleAssignment { public string PrincipalId { get; set; } = ""; public string? PrincipalType { get; set; } public string? PrincipalDisplayName { get; set; } public string AppRoleId { get; set; } = ""; }
    class TokenResponse { [System.Text.Json.Serialization.JsonPropertyName("access_token")] public string? AccessToken { get; set; } }
}
