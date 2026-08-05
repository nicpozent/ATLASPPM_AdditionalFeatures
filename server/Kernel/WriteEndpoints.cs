using System.Security.Claims;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

using Microsoft.Extensions.Logging.Abstractions;

namespace Atlas.Api;

public static partial class WriteEndpoints
{
    // Operational logger — set once at startup so the best-effort auto-sync below
    // leaves evidence. No-op until wired in Program.cs.
    static ILogger _log = NullLogger.Instance;
    public static void UseLogger(ILoggerFactory factory) => _log = factory.CreateLogger("Atlas.WriteEndpoints");

    // The Demand Pipeline funnel is one portfolio-wide collaborative surface, so
    // it shares a single real-time room. Mutations below ping it (presence &
    // cursors come from the hub; this is the "refetch, something moved" signal).
    const string DemandRoom = "demands";

    static readonly string[] Stages = { "draft", "backlog", "approved", "progress", "hold" };
    // Leadership roles auto-notified on every demand create / status change
    // (role-addressed, in-app for anyone holding the role — no subscription needed).
    static readonly string[] DemandWatchRoles = { "pmo", "architect", "cto", "cio", "pmlead" };
    static readonly string[] BlockerStatuses = { "Active", "In progress", "Resolved", "Cancelled", "Archived" };
    static readonly string[] Statuses = { "green", "amber", "red", "hold", "completed" };

    // Keep the display Health string consistent with the traffic-light Status.
    static string HealthFor(string status) => status switch
    {
        "green" => "On track", "amber" => "At risk", "red" => "Critical",
        "hold" => "On hold", "completed" => "Completed", _ => "On track",
    };

    // Who may delete a demand: anyone when auth is off (single-user dev), else the
    // creator or a Platform Administrator. Identity/role helpers live in Rbac.
    static bool CanDelete(Demand d, ClaimsPrincipal u, bool authEnabled) =>
        !authEnabled || Rbac.IsPlatformAdmin(u) || (!string.IsNullOrEmpty(d.CreatedBy) && d.CreatedBy == Rbac.CallerId(u));

    public static void MapAtlasWriteEndpoints(this RouteGroupBuilder api)
    {
        // Registered per entity group; each group lives in WriteEndpoints.<Group>.cs
        // (R18 / #104). Order is cosmetic — routes are independent.
        MapDemandWrites(api);
        MapBlockerWrites(api);
        MapProjectWrites(api);
        MapProgramWrites(api);
        MapProductWrites(api);
        MapReleaseWrites(api);
        MapOkrWrites(api);
    }

    // Resolve a KR's typed link to (type, id, displayName). Validates the target
    // exists across projects/programs/products; anything unknown clears the link.
    static async Task<(string Type, string Id, string Name)> ResolveKrLink(AtlasDbContext db, string? type, string? id)
    {
        type = (type ?? "").Trim().ToLowerInvariant();
        id = (id ?? "").Trim();
        if (id.Length == 0) return ("", "", "");
        var name = type switch
        {
            "project" => await db.Projects.Where(x => x.Id == id).Select(x => x.Name).FirstOrDefaultAsync(),
            "program" => await db.Programs.Where(x => x.Id == id).Select(x => x.Name).FirstOrDefaultAsync(),
            "product" => await db.Products.Where(x => x.Id == id).Select(x => x.Name).FirstOrDefaultAsync(),
            _ => null,
        };
        return name is null ? ("", "", "") : (type, id, name);
    }

    // Next sequential id for a prefix (e.g. "DM-" -> "DM-331"), based on the
    // max numeric suffix currently stored. Small tables, so a materialize is fine.
    static async Task<string> NextId(IQueryable<string> ids, string prefix, AtlasDbContext _)
    {
        var existing = await ids.ToListAsync();
        var max = existing
            .Select(x => int.TryParse(x.Split('-').Last(), out var n) ? n : 0)
            .DefaultIfEmpty(0).Max();
        return $"{prefix}{max + 1}";
    }

    static string Clamp(string? value, string[] allowed, string fallback)
        => value is not null && allowed.Contains(value) ? value : fallback;
}
