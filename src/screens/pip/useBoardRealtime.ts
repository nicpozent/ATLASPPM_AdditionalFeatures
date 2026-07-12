// ============================================================================
//  Real-time board transport (ADR-0061). Wraps the SignalR client into a small
//  hook: live presence, peer cursors, and a "board changed" ping that tells the
//  view to refetch from the authoritative REST API. No domain data travels over
//  the socket. Everything degrades gracefully — if the hub can't connect, the
//  board still works, just without the live layer.
// ============================================================================
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { HubConnectionBuilder, type HubConnection, LogLevel } from "@microsoft/signalr";
import { getToken } from "@/auth";

export interface Peer { id: string; name: string; initials: string; color: string }
export interface PeerCursor { id: string; x: number; y: number }

export function useBoardRealtime(incrementId: number | null, myName: string, onChanged: () => void) {
  const [peers, setPeers] = useState<Peer[]>([]);
  const [cursors, setCursors] = useState<Record<string, PeerCursor>>({});
  const [connected, setConnected] = useState(false);
  const connRef = useRef<HubConnection | null>(null);
  const lastCursor = useRef(0);
  // Keep the latest onChanged without re-subscribing the socket each render.
  const onChangedRef = useRef(onChanged);
  useLayoutEffect(() => { onChangedRef.current = onChanged; }, [onChanged]);

  useEffect(() => {
    if (incrementId == null) return;
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

    const join = () => conn.invoke("JoinBoard", incrementId, myName).catch(() => {});
    conn.on("Presence", (list: Peer[]) => setPeers(list));
    conn.on("PeerJoined", (p: Peer) => setPeers((cur) => (cur.some((x) => x.id === p.id) ? cur : [...cur, p])));
    conn.on("PeerLeft", (id: string) => {
      setPeers((cur) => cur.filter((x) => x.id !== id));
      setCursors((cur) => { const n = { ...cur }; delete n[id]; return n; });
    });
    conn.on("Cursor", (id: string, x: number, y: number) => setCursors((cur) => ({ ...cur, [id]: { id, x, y } })));
    conn.on("BoardChanged", () => onChangedRef.current());

    conn.onreconnecting(() => setConnected(false));
    conn.onreconnected(() => { setConnected(true); join(); });
    conn.onclose(() => setConnected(false));

    conn.start()
      .then(() => { if (!disposed) { setConnected(true); return join(); } })
      .catch(() => { /* no realtime — the board remains fully usable */ });

    return () => {
      disposed = true;
      conn.stop().catch(() => {});
      connRef.current = null;
      setPeers([]); setCursors({}); setConnected(false);
    };
  }, [incrementId, myName]);

  // Broadcast my cursor, throttled (~16/s) so a fast mouse can't flood the hub.
  const sendCursor = useCallback((x: number, y: number) => {
    const c = connRef.current;
    if (!c || incrementId == null) return;
    const now = Date.now();
    if (now - lastCursor.current < 60) return;
    lastCursor.current = now;
    c.invoke("Cursor", incrementId, x, y).catch(() => {});
  }, [incrementId]);

  // Tell peers I changed the board (after a successful REST write) so they refetch.
  const notifyChanged = useCallback(() => {
    const c = connRef.current;
    if (c && incrementId != null) c.invoke("NotifyChanged", incrementId).catch(() => {});
  }, [incrementId]);

  return { peers, cursors: Object.values(cursors), connected, sendCursor, notifyChanged };
}
