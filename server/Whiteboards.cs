using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace Atlas.Api.Platform;

// ---- Wire model (a scene = free-form nodes + connectors) -------------------
// Points is only used by freehand "draw" nodes: a flat [x0,y0,x1,y1,…] polyline
// in absolute canvas coordinates.
public record WbNode(string Id, string Kind, double X, double Y, double W, double H, string? Text, string? Color, string? Icon, double[]? Points = null);
// A partial node update — every field optional except the id, so a co-editing op
// carries only what changed (field-level merge; see the node endpoint).
public record WbNodePatch(string Id, string? Kind, double? X, double? Y, double? W, double? H, string? Text, string? Color, string? Icon, double[]? Points);
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
//  Persistence: a scene is stored as typed rows — WhiteboardNode / WhiteboardEdge
//  keyed by the canonical scope "{kind}:{id}" (e.g. "pi:5", "project:PRJ-1"). Each
//  live co-editing op (upsert/delete one node or edge) is therefore an independent
//  single-row write, so two people editing different items can't clobber each
//  other (the earlier Setting-blob read-modify-write of the whole scene could lose
//  updates — ADR-0064 addendum). Scenes that predate this table are migrated at
//  startup by BackfillAsync (from the old "whiteboard.{scope}" Setting rows, which
//  are then removed). The old GET /settings redaction of "whiteboard." keys stays
//  as defence-in-depth for any not-yet-migrated row.
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
        ["roadmap"] = "cap-roadmap",
    };

    // Node kinds the editor understands; anything else is rejected on write.
    static readonly HashSet<string> Kinds = new()
        { "note", "rect", "ellipse", "diamond", "actor", "text", "icon",
          "triangle", "hexagon", "parallelogram", "star", "cylinder", "pill", "draw" };

    // Sanitisation bounds — generous for real brainstorming, finite for safety.
    const int MaxNodes = 500, MaxEdges = 800, MaxText = 4000, MaxIdLen = 64, MaxPoints = 4000;
    const double MaxCoord = 20000, MinSize = 8, MaxSize = 8000;

    static readonly Regex IdRe = new("^[A-Za-z0-9_-]{1,64}$", RegexOptions.Compiled);
    static readonly Regex ColorRe = new("^#[0-9a-fA-F]{6}$", RegexOptions.Compiled);
    static readonly Regex IconRe = new("^[a-z0-9-]{1,32}$", RegexOptions.Compiled);

    // Legacy Setting-blob key prefix — only used by the one-time startup backfill.
    const string LegacyPrefix = "whiteboard.";
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

    // Read a whole scene for a scope from its typed rows (used by GET).
    static async Task<WbScene> LoadAsync(AtlasDbContext db, string scope)
    {
        var nodes = await db.WhiteboardNodes.Where(n => n.Scope == scope).ToListAsync();
        var edges = await db.WhiteboardEdges.Where(e => e.Scope == scope).ToListAsync();
        return new WbScene(nodes.Select(ToWbNode).ToList(), edges.Select(ToWbEdge).ToList());
    }

    // ---- Row ⇄ wire mapping -------------------------------------------------
    static WbNode ToWbNode(WhiteboardNode e) =>
        new(e.NodeId, e.Kind, e.X, e.Y, e.W, e.H, e.Text, e.Color, e.Icon, PointsFromJson(e.PointsJson));

    static WbEdge ToWbEdge(WhiteboardEdge e) => new(e.EdgeId, e.FromNode, e.ToNode, e.Color);

    // A sanitised WbNode → a fresh row for `scope` (points serialised to JSON).
    static WhiteboardNode ToRow(string scope, WbNode n) => new()
    {
        Scope = scope, NodeId = n.Id, Kind = n.Kind, X = n.X, Y = n.Y, W = n.W, H = n.H,
        Text = n.Text, Color = n.Color, Icon = n.Icon,
        PointsJson = n.Points is { Length: > 0 } ? JsonSerializer.Serialize(n.Points) : null,
    };

    static WhiteboardEdge ToRow(string scope, WbEdge e) => new()
    {
        Scope = scope, EdgeId = e.Id, FromNode = e.From, ToNode = e.To, Color = e.Color,
    };

    static double[]? PointsFromJson(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try { return JsonSerializer.Deserialize<double[]>(json); }
        catch { return null; }
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
            Trim(n.Text, MaxText), Color(n.Color), Icon(n.Icon), Points(n.Points));
    }

    // Freehand polyline points: cap the count and clamp each coordinate; drop the
    // array entirely if empty/absent.
    static double[]? Points(double[]? pts)
    {
        if (pts is null || pts.Length == 0) return null;
        var take = pts.Length > MaxPoints ? MaxPoints : pts.Length;
        var outp = new double[take];
        for (int i = 0; i < take; i++) outp[i] = Clamp(pts[i], -MaxCoord, MaxCoord);
        return outp;
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

    // Replace the whole scene for a scope (the bulk PUT). Clears the scope's rows
    // and inserts the sanitised set — one transactional SaveChanges by the caller.
    static async Task SaveSceneAsync(AtlasDbContext db, string scope, WbScene scene)
    {
        var oldNodes = await db.WhiteboardNodes.Where(n => n.Scope == scope).ToListAsync();
        var oldEdges = await db.WhiteboardEdges.Where(e => e.Scope == scope).ToListAsync();
        db.WhiteboardNodes.RemoveRange(oldNodes);
        db.WhiteboardEdges.RemoveRange(oldEdges);
        db.WhiteboardNodes.AddRange(scene.Nodes!.Select(n => ToRow(scope, n)));
        db.WhiteboardEdges.AddRange(scene.Edges!.Select(e => ToRow(scope, e)));
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
        // independent. For the *same* item, writes are FIELD-LEVEL: a patch only
        // carries the properties that changed, so two people editing different
        // aspects of one node (A moves it, B recolours it) both survive — no
        // last-write-wins clobber across fields. Two edits to the *same* field are
        // still last-write-wins and reconcile on the next refetch. (This is the
        // proportionate step below a CRDT/OT engine, which would be disproportionate
        // for a bounded brainstorming canvas — see ADR-0064.)

        // Upsert a single node. The body is a partial patch (all fields optional
        // except the id): a brand-new node must carry kind + geometry; an existing
        // node merges only the provided, sanitised fields (single-row write).
        api.MapPut("/whiteboards/{kind}/{id}/node", async (string kind, string id, WbNodePatch patch, AtlasDbContext db, IConfiguration cfg, HttpContext http, IHubContext<BoardHub> hub) =>
        {
            var (scope, denied) = await AuthScope(kind, id, http, db, cfg);
            if (denied is not null) return denied;
            if (patch.Id is null || !IdRe.IsMatch(patch.Id)) return Results.BadRequest(new { error = "Invalid node id." });

            var existing = await db.WhiteboardNodes.FirstOrDefaultAsync(n => n.Scope == scope && n.NodeId == patch.Id);
            WbNode result;
            if (existing is null)
            {
                // Create — needs a kind and full geometry (a bare patch can't seed a node).
                if (patch.Kind is null || patch.X is null || patch.Y is null || patch.W is null || patch.H is null)
                    return Results.BadRequest(new { error = "A new node needs a kind and geometry." });
                var clean = SanitizeNode(new WbNode(patch.Id, patch.Kind, patch.X.Value, patch.Y.Value, patch.W.Value, patch.H.Value, patch.Text, patch.Color, patch.Icon, patch.Points));
                if (clean is null) return Results.BadRequest(new { error = "Invalid node." });
                if (await db.WhiteboardNodes.CountAsync(n => n.Scope == scope) >= MaxNodes)
                    return Results.BadRequest(new { error = "This whiteboard is full." });
                db.WhiteboardNodes.Add(ToRow(scope!, clean));
                result = clean;
            }
            else
            {
                // Merge only the provided fields (kind is immutable once created).
                if (patch.X is { } x) existing.X = Clamp(x, -MaxCoord, MaxCoord);
                if (patch.Y is { } y) existing.Y = Clamp(y, -MaxCoord, MaxCoord);
                if (patch.W is { } w) existing.W = Clamp(w, MinSize, MaxSize);
                if (patch.H is { } h) existing.H = Clamp(h, MinSize, MaxSize);
                if (patch.Text is not null) existing.Text = Trim(patch.Text, MaxText);
                if (patch.Color is not null) existing.Color = Color(patch.Color);
                if (patch.Icon is not null) existing.Icon = Icon(patch.Icon);
                if (patch.Points is not null) { var p = Points(patch.Points); existing.PointsJson = p is null ? null : JsonSerializer.Serialize(p); }
                result = ToWbNode(existing);
            }
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Whiteboard", "Edited whiteboard node", $"{scope} · {patch.Id}"));
            await db.SaveChangesAsync();
            await BoardHub.NotifyRoomOpAsync(hub, Room(scope!), new { t = "node", node = result });
            return Results.Ok(result);
        });

        // Delete a node (and any connectors touching it).
        api.MapDelete("/whiteboards/{kind}/{id}/node/{nodeId}", async (string kind, string id, string nodeId, AtlasDbContext db, IConfiguration cfg, HttpContext http, IHubContext<BoardHub> hub) =>
        {
            var (scope, denied) = await AuthScope(kind, id, http, db, cfg);
            if (denied is not null) return denied;

            // Remove just this node and any connectors touching it (single scoped
            // write; idempotent if the node is already gone).
            var node = await db.WhiteboardNodes.FirstOrDefaultAsync(n => n.Scope == scope && n.NodeId == nodeId);
            if (node is not null) db.WhiteboardNodes.Remove(node);
            var touching = await db.WhiteboardEdges
                .Where(e => e.Scope == scope && (e.FromNode == nodeId || e.ToNode == nodeId)).ToListAsync();
            db.WhiteboardEdges.RemoveRange(touching);
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

            var nodeIds = (await db.WhiteboardNodes.Where(n => n.Scope == scope).Select(n => n.NodeId).ToListAsync()).ToHashSet();
            var clean = SanitizeEdge(edge, nodeIds);
            if (clean is null) return Results.BadRequest(new { error = "Invalid connector." });
            if (await db.WhiteboardEdges.CountAsync(e => e.Scope == scope) >= MaxEdges)
                return Results.BadRequest(new { error = "Too many connectors." });
            // No duplicate id, and no duplicate undirected pair.
            if (await db.WhiteboardEdges.AnyAsync(e => e.Scope == scope && (e.EdgeId == clean.Id
                    || (e.FromNode == clean.From && e.ToNode == clean.To) || (e.FromNode == clean.To && e.ToNode == clean.From))))
                return Results.Ok(clean);   // idempotent — already linked
            db.WhiteboardEdges.Add(ToRow(scope!, clean));
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

            var e = await db.WhiteboardEdges.FirstOrDefaultAsync(x => x.Scope == scope && x.EdgeId == edgeId);
            if (e is not null) db.WhiteboardEdges.Remove(e);
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

    // ---- One-time migration of legacy blob scenes to typed rows -------------
    // Runs at startup (after Migrate/EnsureCreated). For each old
    // "whiteboard.{scope}" Setting row: if that scope has no typed rows yet, parse
    // the blob, re-sanitise it and insert rows; then delete the Setting row either
    // way. Idempotent — once every legacy row is gone this is a no-op, and it
    // never overwrites a scope that already has typed rows.
    public static async Task BackfillAsync(AtlasDbContext db)
    {
        var legacy = await db.Settings.Where(s => s.Key.StartsWith(LegacyPrefix)).ToListAsync();
        if (legacy.Count == 0) return;

        foreach (var s in legacy)
        {
            var scope = s.Key.Substring(LegacyPrefix.Length);
            var alreadyTyped = await db.WhiteboardNodes.AnyAsync(n => n.Scope == scope)
                            || await db.WhiteboardEdges.AnyAsync(e => e.Scope == scope);
            if (!alreadyTyped && !string.IsNullOrWhiteSpace(s.Value))
            {
                WbScene? parsed = null;
                try { parsed = JsonSerializer.Deserialize<WbScene>(s.Value); } catch { /* corrupt blob → drop */ }
                if (parsed is not null)
                {
                    var scene = Sanitize(parsed);   // re-apply current bounds
                    db.WhiteboardNodes.AddRange(scene.Nodes!.Select(n => ToRow(scope, n)));
                    db.WhiteboardEdges.AddRange(scene.Edges!.Select(e => ToRow(scope, e)));
                }
            }
            db.Settings.Remove(s);   // the blob's job is done regardless
        }
        await db.SaveChangesAsync();
    }
}
