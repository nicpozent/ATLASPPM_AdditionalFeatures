// ============================================================================
//  Real-time room transport (ADR-0061). Wraps the SignalR client into a small
//  hook that any collaborative surface can use: live presence, peer cursors, and
//  a "room changed" ping that tells the view to refetch from the authoritative
//  REST API. No domain data travels over the socket. Everything degrades
//  gracefully — if the hub can't connect, the surface still works, just without
//  the live layer.
//
//  A "room" is an opaque scope string ("pi:5" for PI increment #5, "demands" for
//  the portfolio demand funnel). The server validates it and scopes all traffic
//  to that room's group, so a client only sees events for the room it joined.
// ============================================================================
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { HubConnectionBuilder, type HubConnection, LogLevel } from "@microsoft/signalr";
import { getToken } from "@/auth";

export interface Peer { id: string; name: string; initials: string; color: string }
export interface PeerCursor { id: string; x: number; y: number }

export function useRoomRealtime(roomId: string | null, myName: string, onChanged: () => void, onOp?: (op: unknown) => void) {
  const [peers, setPeers] = useState<Peer[]>([]);
  const [cursors, setCursors] = useState<Record<string, PeerCursor>>({});
  const [connected, setConnected] = useState(false);
  const connRef = useRef<HubConnection | null>(null);
  const lastCursor = useRef(0);
  // Keep the latest callbacks without re-subscribing the socket each render.
  const onChangedRef = useRef(onChanged);
  useLayoutEffect(() => { onChangedRef.current = onChanged; }, [onChanged]);
  const onOpRef = useRef(onOp);
  useLayoutEffect(() => { onOpRef.current = onOp; }, [onOp]);

  useEffect(() => {
    if (roomId == null) return;
    let disposed = false;
    const conn = new HubConnectionBuilder()
      // Relative URL ⇒ same-origin (dev: Vite proxy; prod: nginx /hubs). The
      // bearer token rides the query string because the WS handshake can't carry
      // an Authorization header (the server accepts it only for /hubs).
      .withUrl("/hubs/board", { accessTokenFactory: async () => (await getToken()) ?? "" })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build();
    connRef.current = conn;

    const join = () => conn.invoke("JoinRoom", roomId, myName).catch(() => {});
    conn.on("Presence", (list: Peer[]) => setPeers(list));
    conn.on("PeerJoined", (p: Peer) => setPeers((cur) => (cur.some((x) => x.id === p.id) ? cur : [...cur, p])));
    conn.on("PeerLeft", (id: string) => {
      setPeers((cur) => cur.filter((x) => x.id !== id));
      setCursors((cur) => { const n = { ...cur }; delete n[id]; return n; });
    });
    conn.on("Cursor", (id: string, x: number, y: number) => setCursors((cur) => ({ ...cur, [id]: { id, x, y } })));
    conn.on("BoardChanged", () => onChangedRef.current());
    // Authorized live delta from a peer's server-side mutation (whiteboard).
    conn.on("Op", (op: unknown) => onOpRef.current?.(op));

    conn.onreconnecting(() => setConnected(false));
    // On reconnect, re-join and refetch authoritative state — we may have missed
    // ops while offline, so a full resync reconciles.
    conn.onreconnected(() => { setConnected(true); join(); onChangedRef.current(); });
    conn.onclose(() => setConnected(false));

    conn.start()
      .then(() => { if (!disposed) { setConnected(true); return join(); } })
      .catch(() => { /* no realtime — the surface remains fully usable */ });

    return () => {
      disposed = true;
      conn.stop().catch(() => {});
      connRef.current = null;
      setPeers([]); setCursors({}); setConnected(false);
    };
  }, [roomId, myName]);

  // Broadcast my cursor, throttled (~16/s) so a fast mouse can't flood the hub.
  const sendCursor = useCallback((x: number, y: number) => {
    const c = connRef.current;
    if (!c || roomId == null) return;
    const now = Date.now();
    if (now - lastCursor.current < 60) return;
    lastCursor.current = now;
    c.invoke("Cursor", roomId, x, y).catch(() => {});
  }, [roomId]);

  // Note: change broadcasts are server-driven — the REST mutation endpoints ping
  // the room group (BoardHub.NotifyRoomAsync), so the client doesn't relay changes
  // over the hub. This hook only sources presence + cursors.
  return { peers, cursors: Object.values(cursors), connected, sendCursor };
}
