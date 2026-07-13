using System.Collections.Concurrent;
using Microsoft.AspNetCore.SignalR;

namespace Atlas.Api;

// ============================================================================
//  Real-time PI Program Board (ADR-0061). A SignalR hub that gives the board
//  live presence, shared cursors and change-notifications so multiple planners
//  can work the same increment together.
//
//  Design & security:
//  - The board's data is owned by the REST API (PiBoard/Pip endpoints, which
//    enforce cap-schedule). This hub carries NO domain writes — it only relays
//    presence/cursors and a "something changed, refetch" ping. That keeps the
//    authorization surface small: there is no way to mutate portfolio data
//    through the hub, so a socket can't escalate past what REST already allows.
//  - Access mirrors the API: the hub is mapped with RequireAuthorization when
//    Auth:Enabled, so only authenticated principals can connect (Program.cs
//    also teaches JwtBearer to read the access_token query string that browsers
//    must use for the WebSocket handshake).
//  - Traffic is scoped to a per-increment group ("pi:{id}"), so a client only
//    ever receives events for the board it explicitly joined — no cross-board
//    leakage.
//  - Data minimisation (GDPR): presence is display-name + initials + a colour
//    derived from the connection id. No email or stable user id is broadcast,
//    and nothing here is persisted — presence/cursor state lives only in memory
//    for the life of the connection and is dropped on disconnect.
// ============================================================================
public class BoardHub : Hub
{
    // Lightweight, non-PII presence broadcast to peers on a board.
    public record Peer(string Id, string Name, string Initials, string Color);

    // incrementId → (connectionId → peer). In-memory only; a process restart
    // simply re-derives it as clients reconnect.
    static readonly ConcurrentDictionary<int, ConcurrentDictionary<string, Peer>> Boards = new();

    // Observability accessors (atlas.board.* gauges — see AtlasTelemetry).
    public static int ActiveConnections => Boards.Values.Sum(b => b.Count);
    public static int ActiveBoards => Boards.Count;

    // The connection's current board, so OnDisconnected can clean up without the
    // client having to tell us which board it left.
    int? CurrentBoard
    {
        get => Context.Items.TryGetValue("pi", out var v) && v is int i ? i : null;
        set { if (value is null) Context.Items.Remove("pi"); else Context.Items["pi"] = value; }
    }

    static string Group(int incrementId) => $"pi:{incrementId}";

    // Broadcast a "board changed, refetch" ping to everyone viewing an increment,
    // from OUTSIDE the hub (a REST mutation). This is how server-side changes —
    // an objective edited on another tab, a dependency added via the API — reach
    // open boards live, not just changes made on the board itself. Contentless,
    // like the in-hub ping; peers refetch the authoritative state. Best-effort:
    // a transport hiccup must never fail the originating write.
    public static async Task NotifyGroupAsync(IHubContext<BoardHub> hub, int incrementId)
    {
        AtlasTelemetry.RecordBoardBroadcast();
        try { await hub.Clients.Group(Group(incrementId)).SendAsync("BoardChanged"); }
        catch { /* the REST write already succeeded; the ping is advisory */ }
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

    // Join a board: register presence and hand the caller the current roster,
    // then tell peers someone arrived. `name` is the caller's display name; it is
    // cosmetic (identity is still enforced by the API), so we cap its length and
    // never trust it for authorization.
    public async Task JoinBoard(int incrementId, string? name)
    {
        var display = string.IsNullOrWhiteSpace(name) ? "Planner" : name.Trim();
        if (display.Length > 60) display = display[..60];

        // Leave any previous board first (a client that switches increments).
        if (CurrentBoard is { } prev && prev != incrementId) await LeaveBoard(prev);

        await Groups.AddToGroupAsync(Context.ConnectionId, Group(incrementId));
        CurrentBoard = incrementId;

        var peer = new Peer(Context.ConnectionId, display, InitialsOf(display), ColorFor(Context.ConnectionId));
        var board = Boards.GetOrAdd(incrementId, _ => new());
        board[Context.ConnectionId] = peer;

        // Send the joiner the full roster; tell everyone else just the newcomer.
        await Clients.Caller.SendAsync("Presence", board.Values.ToArray());
        await Clients.OthersInGroup(Group(incrementId)).SendAsync("PeerJoined", peer);
    }

    public async Task LeaveBoard(int incrementId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, Group(incrementId));
        if (Boards.TryGetValue(incrementId, out var board) && board.TryRemove(Context.ConnectionId, out _))
        {
            if (board.IsEmpty) Boards.TryRemove(incrementId, out _);
            await Clients.OthersInGroup(Group(incrementId)).SendAsync("PeerLeft", Context.ConnectionId);
        }
        if (CurrentBoard == incrementId) CurrentBoard = null;
    }

    // Relay a cursor position to peers. Coordinates are normalised [0,1] fractions
    // of the board surface (resolution-independent); we clamp defensively and drop
    // anything for a board the caller hasn't joined. Ephemeral — never stored.
    public async Task Cursor(int incrementId, double x, double y)
    {
        if (CurrentBoard != incrementId) return;
        static double Clamp(double v) => v < 0 ? 0 : v > 1 ? 1 : v;
        await Clients.OthersInGroup(Group(incrementId))
            .SendAsync("Cursor", Context.ConnectionId, Clamp(x), Clamp(y));
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        if (CurrentBoard is { } id) await LeaveBoard(id);
        await base.OnDisconnectedAsync(exception);
    }
}
