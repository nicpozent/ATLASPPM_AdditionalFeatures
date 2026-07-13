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

    // Coerce one incoming node into a safe, bounded one — or null if unusable
    // (bad/absent id, unknown kind). Shared by the bulk and per-node paths.
    static WbNode? SanitizeNode(WbNode? n)
    {
        if (n is null || n.Id is null || !IdRe.IsMatch(n.Id)) return null;
        if (n.Kind is null || !Kinds.Contains(n.Kind)) return null;
        return new WbNode(
            n.Id, n.Kind,
            Clamp(n.X, -MaxCoord, MaxCoord), Clamp(n.Y, -MaxCoord, MaxCoord),
            Clamp(n.W, MinSize, MaxSize), Clamp(n.H, MinSize, MaxSize),
            Trim(n.Text, MaxText), Color(n.Color), Icon(n.Icon));
    }

    // Coerce one connector — or null if unusable / dangling (both endpoints must
    // be real nodes in `nodeIds`).
    static WbEdge? SanitizeEdge(WbEdge? e, ISet<string> nodeIds)
    {
        if (e is null || e.Id is null || !IdRe.IsMatch(e.Id)) return null;
        if (e.From is null || e.To is null || !nodeIds.Contains(e.From) || !nodeIds.Contains(e.To)) return null;
        return new WbEdge(e.Id, e.From, e.To, Color(e.Color));
    }

    // Coerce an arbitrary incoming scene into a safe, bounded one.
    static WbScene Sanitize(WbScene? scene)
    {
        var seen = new HashSet<string>();
        var nodes = new List<WbNode>();
        foreach (var n in scene?.Nodes ?? new())
        {
            var clean = SanitizeNode(n);
            if (clean is null || !seen.Add(clean.Id)) continue;
            nodes.Add(clean);
            if (nodes.Count >= MaxNodes) break;
        }

        var nodeIds = nodes.Select(n => n.Id).ToHashSet();
        var edgeIds = new HashSet<string>();
        var edges = new List<WbEdge>();
        foreach (var e in scene?.Edges ?? new())
        {
            var clean = SanitizeEdge(e, nodeIds);
            if (clean is null || !edgeIds.Add(clean.Id)) continue;
            edges.Add(clean);
            if (edges.Count >= MaxEdges) break;
        }

        return new WbScene(nodes, edges);
    }

    // Persist a full scene blob under the scope key (read-modify-write; a typed
    // table is a pending follow-up — see docs/pi-board-followups.md §3).
    static async Task SaveSceneAsync(AtlasDbContext db, string scope, WbScene scene)
    {
        var key = SettingKey(scope);
        var json = JsonSerializer.Serialize(scene);
        var s = await db.Settings.FindAsync(key);
        if (s is null) db.Settings.Add(new Setting { Key = key, Value = json });
        else s.Value = json;
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
            await SaveSceneAsync(db, scope, scene);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Whiteboard", "Saved whiteboard",
                $"{scope} · {scene.Nodes!.Count} nodes, {scene.Edges!.Count} links"));
            await db.SaveChangesAsync();
            await BoardHub.NotifyRoomAsync(hub, Room(scope));
            return Results.Ok(new { scene });
        });

        // ---- Live co-editing: granular, authorized deltas (ADR-0064 addendum) --
        // Each mutation is cap-checked and sanitised, persists just its item into
        // the scene blob, and broadcasts the exact delta so peers apply it live.
        // Because the op originates from an authorized REST call, peers can trust
        // and render it without re-checking permissions (the hub never lets a
        // client send an op). Concurrent edits to *different* items are
        // independent; same-item edits are last-write-wins and reconcile on the
        // next reconnect/refetch.

        // Upsert a single node (add or replace by id).
        api.MapPut("/whiteboards/{kind}/{id}/node", async (string kind, string id, WbNode node, AtlasDbContext db, IConfiguration cfg, HttpContext http, IHubContext<BoardHub> hub) =>
        {
            var (scope, denied) = await AuthScope(kind, id, http, db, cfg);
            if (denied is not null) return denied;
            var clean = SanitizeNode(node);
            if (clean is null) return Results.BadRequest(new { error = "Invalid node." });

            var scene = await LoadAsync(db, scope!);
            var nodes = scene.Nodes!.Where(n => n.Id != clean.Id).ToList();
            if (nodes.Count >= MaxNodes) return Results.BadRequest(new { error = "This whiteboard is full." });
            nodes.Add(clean);
            await SaveSceneAsync(db, scope!, new WbScene(nodes, scene.Edges));
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Whiteboard", "Edited whiteboard node", $"{scope} · {clean.Id}"));
            await db.SaveChangesAsync();
            await BoardHub.NotifyRoomOpAsync(hub, Room(scope!), new { t = "node", node = clean });
            return Results.Ok(clean);
        });

        // Delete a node (and any connectors touching it).
        api.MapDelete("/whiteboards/{kind}/{id}/node/{nodeId}", async (string kind, string id, string nodeId, AtlasDbContext db, IConfiguration cfg, HttpContext http, IHubContext<BoardHub> hub) =>
        {
            var (scope, denied) = await AuthScope(kind, id, http, db, cfg);
            if (denied is not null) return denied;

            var scene = await LoadAsync(db, scope!);
            var nodes = scene.Nodes!.Where(n => n.Id != nodeId).ToList();
            var edges = scene.Edges!.Where(e => e.From != nodeId && e.To != nodeId).ToList();
            await SaveSceneAsync(db, scope!, new WbScene(nodes, edges));
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Whiteboard", "Deleted whiteboard node", $"{scope} · {nodeId}"));
            await db.SaveChangesAsync();
            await BoardHub.NotifyRoomOpAsync(hub, Room(scope!), new { t = "delNode", id = nodeId });
            return Results.NoContent();
        });

        // Add a single connector.
        api.MapPut("/whiteboards/{kind}/{id}/edge", async (string kind, string id, WbEdge edge, AtlasDbContext db, IConfiguration cfg, HttpContext http, IHubContext<BoardHub> hub) =>
        {
            var (scope, denied) = await AuthScope(kind, id, http, db, cfg);
            if (denied is not null) return denied;

            var scene = await LoadAsync(db, scope!);
            var nodeIds = scene.Nodes!.Select(n => n.Id).ToHashSet();
            var clean = SanitizeEdge(edge, nodeIds);
            if (clean is null) return Results.BadRequest(new { error = "Invalid connector." });
            if (scene.Edges!.Count >= MaxEdges) return Results.BadRequest(new { error = "Too many connectors." });
            // No duplicate id, and no duplicate undirected pair.
            if (scene.Edges!.Any(e => e.Id == clean.Id
                    || (e.From == clean.From && e.To == clean.To) || (e.From == clean.To && e.To == clean.From)))
                return Results.Ok(clean);   // idempotent — already linked
            var edges = scene.Edges!.Append(clean).ToList();
            await SaveSceneAsync(db, scope!, new WbScene(scene.Nodes, edges));
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Whiteboard", "Linked whiteboard nodes", $"{scope} · {clean.Id}"));
            await db.SaveChangesAsync();
            await BoardHub.NotifyRoomOpAsync(hub, Room(scope!), new { t = "edge", edge = clean });
            return Results.Ok(clean);
        });

        // Delete a connector.
        api.MapDelete("/whiteboards/{kind}/{id}/edge/{edgeId}", async (string kind, string id, string edgeId, AtlasDbContext db, IConfiguration cfg, HttpContext http, IHubContext<BoardHub> hub) =>
        {
            var (scope, denied) = await AuthScope(kind, id, http, db, cfg);
            if (denied is not null) return denied;

            var scene = await LoadAsync(db, scope!);
            var edges = scene.Edges!.Where(e => e.Id != edgeId).ToList();
            await SaveSceneAsync(db, scope!, new WbScene(scene.Nodes, edges));
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Whiteboard", "Unlinked whiteboard nodes", $"{scope} · {edgeId}"));
            await db.SaveChangesAsync();
            await BoardHub.NotifyRoomOpAsync(hub, Room(scope!), new { t = "delEdge", id = edgeId });
            return Results.NoContent();
        });
    }

    // Validate the scope and enforce Edit on its capability. Returns the canonical
    // scope string (denied == null) or the failing IResult (404 unknown scope /
    // 403 forbidden).
    static async Task<(string? scope, IResult? denied)> AuthScope(string kind, string id, HttpContext http, AtlasDbContext db, IConfiguration cfg)
    {
        var scope = Scope(kind, id);
        if (scope is null) return (null, Results.NotFound());
        var cap = KindCap[kind.Trim().ToLowerInvariant()];
        if (await Permissions.Deny(http, db, cfg, cap, "E") is { } denied) return (null, denied);
        return (scope, null);
    }
}
