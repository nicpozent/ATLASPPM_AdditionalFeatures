using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.SignalR;

namespace Atlas.Api;

// ---- Wire model (a scene = free-form nodes + connectors) -------------------
public record WbNode(string Id, string Kind, double X, double Y, double W, double H, string? Text, string? Color, string? Icon);
public record WbEdge(string Id, string From, string To, string? Color);
public record WbScene(List<WbNode>? Nodes, List<WbEdge>? Edges);
public record SaveWhiteboardReq(WbScene? Scene);

// ============================================================================
//  Freeform Whiteboard (ADR-0064) — a per-entity brainstorming canvas: sticky
//  notes, shapes (rectangle / ellipse / diamond / actor), text, icons and
//  connectors, worked live by several people via the shared real-time room hub
//  (ADR-0061). Built for PI Planning first and reused on projects / programs /
//  releases / products.
//
//  Persistence (migration-free, like the PI board): the scene is a small JSON
//  document stored in the existing Setting store under "whiteboard.{scope}",
//  where {scope} is "{kind}:{id}" (e.g. "pi:5", "project:PRJ-1"). This
//  environment can't generate an EF migration; promoting the scene to a typed
//  table is a clean follow-up. The blob is content, not a global setting, so it
//  is redacted from the broad GET /settings dump (see Backups.IsSecretSetting)
//  and served only through the scoped endpoints below.
//
//  Security:
//  - Authorization is server-authoritative and scope-aware: editing a whiteboard
//    requires the SAME capability as editing the thing it hangs off (pi →
//    cap-schedule; project/program/release → cap-projects; product →
//    cap-products). Reads are open to any authenticated caller, matching the
//    other /increments-style reads. UI gating is cosmetic only.
//  - The scope is validated (kind whitelist + id charset) so it can neither
//    escape the "whiteboard." key namespace nor inject a SignalR group name.
//  - The scene is sanitised on write — bounded node/edge counts, clamped
//    coordinates, capped text, whitelisted kinds, validated colours, dangling
//    edges dropped — so a client can't persist an unbounded or malformed blob.
// ============================================================================
public static class Whiteboards
{
    // Scope kind → capability required to edit that surface's whiteboard.
    static readonly Dictionary<string, string> KindCap = new()
    {
        ["pi"] = "cap-schedule",
        ["project"] = "cap-projects",
        ["program"] = "cap-projects",
        ["release"] = "cap-projects",
        ["product"] = "cap-products",
    };

    // Node kinds the editor understands; anything else is rejected on write.
    static readonly HashSet<string> Kinds = new() { "note", "rect", "ellipse", "diamond", "actor", "text", "icon" };

    // Sanitisation bounds — generous for real brainstorming, finite for safety.
    const int MaxNodes = 500, MaxEdges = 800, MaxText = 4000, MaxIdLen = 64;
    const double MaxCoord = 20000, MinSize = 8, MaxSize = 8000;

    static readonly Regex IdRe = new("^[A-Za-z0-9_-]{1,64}$", RegexOptions.Compiled);
    static readonly Regex ColorRe = new("^#[0-9a-fA-F]{6}$", RegexOptions.Compiled);
    static readonly Regex IconRe = new("^[a-z0-9-]{1,32}$", RegexOptions.Compiled);

    static string SettingKey(string scope) => $"whiteboard.{scope}";
    static string Room(string scope) => $"wb:{scope}";

    // Validate {kind}/{id} and return the canonical scope string, or null if the
    // pair is unknown/malformed (the caller then 400/404s rather than touching a
    // key). id charset excludes '.' so the derived room stays within the hub's
    // group-name normaliser.
    static string? Scope(string kind, string id)
    {
        kind = (kind ?? "").Trim().ToLowerInvariant();
        if (!KindCap.ContainsKey(kind)) return null;
        if (string.IsNullOrWhiteSpace(id) || !IdRe.IsMatch(id)) return null;
        return $"{kind}:{id.Trim()}";
    }

    static async Task<WbScene> LoadAsync(AtlasDbContext db, string scope)
    {
        var raw = (await db.Settings.FindAsync(SettingKey(scope)))?.Value;
        if (string.IsNullOrWhiteSpace(raw)) return new(new(), new());
        try { return JsonSerializer.Deserialize<WbScene>(raw) ?? new(new(), new()); }
        catch { return new(new(), new()); }   // tolerate a hand-edited/corrupt blob
    }

    static double Clamp(double v, double lo, double hi) =>
        double.IsFinite(v) ? Math.Clamp(v, lo, hi) : lo;

    static string? Trim(string? s, int max) =>
        s is null ? null : (s.Length > max ? s[..max] : s);

    static string? Color(string? c) => c is not null && ColorRe.IsMatch(c) ? c : null;
    static string? Icon(string? i) => i is not null && IconRe.IsMatch(i) ? i : null;

    // Coerce an arbitrary incoming scene into a safe, bounded one.
    static WbScene Sanitize(WbScene? scene)
    {
        var seen = new HashSet<string>();
        var nodes = new List<WbNode>();
        foreach (var n in scene?.Nodes ?? new())
        {
            if (n is null || n.Id is null || !IdRe.IsMatch(n.Id) || !seen.Add(n.Id)) continue;
            if (n.Kind is null || !Kinds.Contains(n.Kind)) continue;
            nodes.Add(new WbNode(
                n.Id, n.Kind,
                Clamp(n.X, -MaxCoord, MaxCoord), Clamp(n.Y, -MaxCoord, MaxCoord),
                Clamp(n.W, MinSize, MaxSize), Clamp(n.H, MinSize, MaxSize),
                Trim(n.Text, MaxText), Color(n.Color), Icon(n.Icon)));
            if (nodes.Count >= MaxNodes) break;
        }

        var nodeIds = nodes.Select(n => n.Id).ToHashSet();
        var edgeIds = new HashSet<string>();
        var edges = new List<WbEdge>();
        foreach (var e in scene?.Edges ?? new())
        {
            if (e is null || e.Id is null || !IdRe.IsMatch(e.Id) || !edgeIds.Add(e.Id)) continue;
            // Drop dangling connectors — both endpoints must be real nodes.
            if (e.From is null || e.To is null || !nodeIds.Contains(e.From) || !nodeIds.Contains(e.To)) continue;
            edges.Add(new WbEdge(e.Id, e.From, e.To, Color(e.Color)));
            if (edges.Count >= MaxEdges) break;
        }

        return new WbScene(nodes, edges);
    }

    public static void MapWhiteboardEndpoints(this RouteGroupBuilder api)
    {
        // Read a scene. Open to any authenticated caller (parity with other
        // per-entity reads); `canEdit` tells the UI whether to show tools.
        api.MapGet("/whiteboards/{kind}/{id}", async (string kind, string id, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            var scope = Scope(kind, id);
            if (scope is null) return Results.NotFound();
            var cap = KindCap[kind.Trim().ToLowerInvariant()];
            var canEdit = await Permissions.Allows(http, db, cfg, cap, "E");
            var scene = await LoadAsync(db, scope);
            return Results.Ok(new { canEdit, scene });
        });

        // Replace a scene (last-write-wins; the real-time ping tells peers to
        // refetch). Requires Edit on the scope's capability. The incoming scene is
        // sanitised before it is persisted.
        api.MapPut("/whiteboards/{kind}/{id}", async (string kind, string id, SaveWhiteboardReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http, IHubContext<BoardHub> hub) =>
        {
            var scope = Scope(kind, id);
            if (scope is null) return Results.NotFound();
            var cap = KindCap[kind.Trim().ToLowerInvariant()];
            if (await Permissions.Deny(http, db, cfg, cap, "E") is { } denied) return denied;

            var scene = Sanitize(req.Scene);
            var json = JsonSerializer.Serialize(scene);
            var key = SettingKey(scope);
            var s = await db.Settings.FindAsync(key);
            if (s is null) db.Settings.Add(new Setting { Key = key, Value = json });
            else s.Value = json;

            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Whiteboard", "Saved whiteboard",
                $"{scope} · {scene.Nodes!.Count} nodes, {scene.Edges!.Count} links"));
            await db.SaveChangesAsync();
            await BoardHub.NotifyRoomAsync(hub, Room(scope));
            return Results.Ok(new { scene });
        });
    }
}
