using System.Collections.Concurrent;
using Microsoft.AspNetCore.SignalR;

namespace Atlas.Api;

// ============================================================================
//  Real-time collaboration hub (ADR-0061). A single SignalR hub that gives any
//  shared surface — the PI Program Board, the Demand Pipeline funnel, and future
//  canvases — live presence, shared cursors and change-notifications so multiple
//  people can work the same thing together.
//
//  Rooms:
//  - A "room" is an opaque scope string that names one collaborative surface,
//    e.g. "pi:5" (PI increment #5) or "demands" (the portfolio demand funnel).
//    Clients join a room, receive presence/cursors for that room only, and are
//    pinged when its underlying data changes. Rooms are validated (§Normalize)
//    so a client can never inject an arbitrary SignalR group name.
//
//  Design & security:
//  - Each room's data is owned by the REST API (PiBoard/Pip enforce cap-schedule;
//    the demand endpoints enforce cap-submit-demand / cap-demand-scoring). This
//    hub carries NO domain writes — it only relays presence/cursors and a
//    "something changed, refetch" ping. That keeps the authorization surface
//    small: there is no way to mutate portfolio data through the hub, so a socket
//    can't escalate past what REST already allows.
//  - Access mirrors the API: the hub is mapped with RequireAuthorization when
//    Auth:Enabled, so only authenticated principals can connect (Program.cs also
//    teaches JwtBearer to read the access_token query string that browsers must
//    use for the WebSocket handshake).
//  - Traffic is scoped to a per-room group, so a client only ever receives events
//    for the room it explicitly joined — no cross-room leakage.
//  - Data minimisation (GDPR): presence is display-name + initials + a colour
//    derived from the connection id. No email or stable user id is broadcast,
//    and nothing here is persisted — presence/cursor state lives only in memory
//    for the life of the connection and is dropped on disconnect.
// ============================================================================
public class BoardHub : Hub
{
    // Lightweight, non-PII presence broadcast to peers in a room.
    public record Peer(string Id, string Name, string Initials, string Color);

    // room key → (connectionId → peer). In-memory only; a process restart simply
    // re-derives it as clients reconnect.
    static readonly ConcurrentDictionary<string, ConcurrentDictionary<string, Peer>> Rooms = new();

    // Observability accessors (atlas.board.* gauges — see AtlasTelemetry).
    public static int ActiveConnections => Rooms.Values.Sum(b => b.Count);
    public static int ActiveBoards => Rooms.Count;

    // The connection's current room, so OnDisconnected can clean up without the
    // client having to tell us which room it left.
    string? CurrentRoom
    {
        get => Context.Items.TryGetValue("room", out var v) && v is string s ? s : null;
        set { if (value is null) Context.Items.Remove("room"); else Context.Items["room"] = value; }
    }

    // Room keys are opaque scope strings ("pi:5", "demands"). Normalise defensively
    // so a client can't inject arbitrary group names or unbounded strings: trim,
    // lowercase, allow only [a-z0-9:_-], cap the length. Returns null for anything
    // invalid — callers then no-op rather than touching a group.
    static string? Normalize(string? roomId)
    {
        if (string.IsNullOrWhiteSpace(roomId)) return null;
        var r = roomId.Trim().ToLowerInvariant();
        if (r.Length > 64) return null;
        foreach (var c in r)
            if (!(c is (>= 'a' and <= 'z') or (>= '0' and <= '9') or ':' or '_' or '-')) return null;
        return r;
    }

    // Broadcast a "room changed, refetch" ping to everyone in a room, from OUTSIDE
    // the hub (a REST mutation). This is how server-side changes — a demand moved
    // through the funnel on another tab, an objective edited via the API — reach
    // open surfaces live, not just changes made in the room itself. Contentless,
    // like the in-hub ping; peers refetch the authoritative state. Best-effort:
    // a transport hiccup must never fail the originating write.
    public static async Task NotifyRoomAsync(IHubContext<BoardHub> hub, string roomId)
    {
        var room = Normalize(roomId);
        if (room is null) return;
        AtlasTelemetry.RecordBoardBroadcast();
        try { await hub.Clients.Group(room).SendAsync("BoardChanged"); }
        catch { /* the REST write already succeeded; the ping is advisory */ }
    }

    // Convenience for PI increments — the increment board's room key is "pi:{id}".
    // Keeps the many Pip/PiBoard callers reading naturally.
    public static Task NotifyGroupAsync(IHubContext<BoardHub> hub, int incrementId) =>
        NotifyRoomAsync(hub, $"pi:{incrementId}");

    // Broadcast an authorized collaboration op to everyone in a room so peers can
    // apply the delta live — richer than the contentless BoardChanged ping, used
    // for whiteboard co-editing (a node moved/edited, a connector added, …). This
    // is server-only: it is called from cap-checked REST mutations that have
    // already validated, sanitised and persisted the change. Clients CANNOT send
    // ops (there is no hub method to do so), so a peer only ever receives a change
    // the server already authorised — the hub's authorization surface stays as
    // small as before (no client-originated domain writes). Best-effort.
    public static async Task NotifyRoomOpAsync(IHubContext<BoardHub> hub, string roomId, object op)
    {
        var room = Normalize(roomId);
        if (room is null) return;
        AtlasTelemetry.RecordBoardBroadcast();
        try { await hub.Clients.Group(room).SendAsync("Op", op); }
        catch { /* the REST write already succeeded; the op is advisory */ }
    }

    // A stable, pleasant colour per connection (no identity leak — derived from
    // the opaque connection id, not from the user).
    static readonly string[] Palette =
        { "#5B7CFA", "#00A88F", "#E0A100", "#E05252", "#8B5CF6", "#0E9F9F", "#D9488B", "#5A9E4B" };
    static string ColorFor(string connectionId)
    {
        int h = 0;
        foreach (var c in connectionId) h = (h * 31 + c) & 0x7fffffff;
        return Palette[h % Palette.Length];
    }

    static string InitialsOf(string name)
    {
        var parts = (name ?? "").Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length == 0) return "··";
        var first = parts[0][..1];
        var last = parts.Length > 1 ? parts[^1][..1] : "";
        return (first + last).ToUpperInvariant();
    }

    // Join a room: register presence and hand the caller the current roster, then
    // tell peers someone arrived. `name` is the caller's display name; it is
    // cosmetic (identity is still enforced by the API), so we cap its length and
    // never trust it for authorization. An unrecognised room is a silent no-op.
    public async Task JoinRoom(string roomId, string? name)
    {
        var room = Normalize(roomId);
        if (room is null) return;

        var display = string.IsNullOrWhiteSpace(name) ? "Guest" : name.Trim();
        if (display.Length > 60) display = display[..60];

        // Leave any previous room first (a client that switches surfaces).
        if (CurrentRoom is { } prev && prev != room) await LeaveRoom(prev);

        await Groups.AddToGroupAsync(Context.ConnectionId, room);
        CurrentRoom = room;

        var peer = new Peer(Context.ConnectionId, display, InitialsOf(display), ColorFor(Context.ConnectionId));
        var members = Rooms.GetOrAdd(room, _ => new());
        members[Context.ConnectionId] = peer;

        // Send the joiner the full roster; tell everyone else just the newcomer.
        await Clients.Caller.SendAsync("Presence", members.Values.ToArray());
        await Clients.OthersInGroup(room).SendAsync("PeerJoined", peer);
    }

    public async Task LeaveRoom(string roomId)
    {
        var room = Normalize(roomId);
        if (room is null) return;
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, room);
        if (Rooms.TryGetValue(room, out var members) && members.TryRemove(Context.ConnectionId, out _))
        {
            if (members.IsEmpty) Rooms.TryRemove(room, out _);
            await Clients.OthersInGroup(room).SendAsync("PeerLeft", Context.ConnectionId);
        }
        if (CurrentRoom == room) CurrentRoom = null;
    }

    // Relay a cursor position to peers. Coordinates are normalised [0,1] fractions
    // of the room surface (resolution-independent); we clamp defensively and drop
    // anything for a room the caller hasn't joined. Ephemeral — never stored.
    public async Task Cursor(string roomId, double x, double y)
    {
        var room = Normalize(roomId);
        if (room is null || CurrentRoom != room) return;
        static double Clamp(double v) => v < 0 ? 0 : v > 1 ? 1 : v;
        await Clients.OthersInGroup(room)
            .SendAsync("Cursor", Context.ConnectionId, Clamp(x), Clamp(y));
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        if (CurrentRoom is { } room) await LeaveRoom(room);
        await base.OnDisconnectedAsync(exception);
    }
}
