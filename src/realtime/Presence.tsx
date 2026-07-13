// ============================================================================
//  Shared real-time presence chrome (ADR-0061). The live-status dot, the stacked
//  peer avatars and the floating peer cursors are identical across every
//  collaborative surface (PI board, demand funnel, …), so they live here rather
//  than being re-implemented per screen. Pure presentation — all state comes from
//  useRoomRealtime.
// ============================================================================
import { color } from "@/theme";
import { Icon } from "@/components/Icon";
import type { Peer, PeerCursor } from "./useRoomRealtime";

// A small "Live"/"Offline" pill reflecting the hub connection.
export function LiveDot({ connected }: { connected: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 600, color: connected ? color.successInk : color.faint }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: connected ? color.success : color.border2, boxShadow: connected ? `0 0 0 3px ${color.successTint}` : "none" }} />
      {connected ? "Live" : "Offline"}
    </div>
  );
}

// Stacked, overlapping avatars for everyone currently in the room.
export function PresenceRow({ peers }: { peers: Peer[] }) {
  if (peers.length === 0) return null;
  return (
    <div style={{ display: "flex", alignItems: "center" }} aria-label={`${peers.length} here now`}>
      {peers.slice(0, 6).map((p, i) => (
        <span key={p.id} title={p.name}
          style={{ width: 26, height: 26, borderRadius: "50%", background: p.color, color: "#fff", fontSize: 10.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid " + color.surface, marginLeft: i ? -8 : 0 }}>
          {p.initials}
        </span>
      ))}
      {peers.length > 6 && <span style={{ marginLeft: 6, fontSize: 11.5, color: color.faint }}>+{peers.length - 6}</span>}
    </div>
  );
}

// Edge markers for peers whose cursor is outside the current scroll viewport of a
// large canvas — a little avatar pinned to the nearest edge, with an arrow that
// points toward where the peer actually is. Render inside a non-scrolling overlay
// sized to the viewport (position it over the scroll container). `view` is the
// scroll position + client size of the scroll container; canvasW/H are the full
// canvas size the cursors are normalised against.
export function OffscreenPeers({ cursors, peers, canvasW, canvasH, view }: {
  cursors: PeerCursor[]; peers: Peer[]; canvasW: number; canvasH: number;
  view: { left: number; top: number; w: number; h: number };
}) {
  if (!view.w || !view.h) return null;
  const M = 16;
  return (
    <>
      {cursors.map((cur) => {
        const peer = peers.find((p) => p.id === cur.id);
        if (!peer) return null;
        const vx = cur.x * canvasW - view.left, vy = cur.y * canvasH - view.top;
        if (vx >= 0 && vx <= view.w && vy >= 0 && vy <= view.h) return null;   // on-screen already
        const cx = Math.max(M, Math.min(view.w - M, vx));
        const cy = Math.max(M, Math.min(view.h - M, vy));
        const ang = (Math.atan2(vy - cy, vx - cx) * 180) / Math.PI;
        return (
          <div key={cur.id} title={`${peer.name} is working over here`}
            style={{ position: "absolute", left: cx, top: cy, transform: "translate(-50%,-50%)", pointerEvents: "none", zIndex: 6, display: "flex", alignItems: "center", gap: 2 }}>
            <span style={{ width: 22, height: 22, borderRadius: "50%", background: peer.color, color: "#fff", fontSize: 9.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #fff", boxShadow: "0 1px 4px rgba(20,26,60,0.35)" }}>{peer.initials}</span>
            <span style={{ transform: `rotate(${ang}deg)`, color: peer.color, display: "flex" }}><Icon name="arrowRight" size={13} /></span>
          </div>
        );
      })}
    </>
  );
}

// Floating peer cursors, positioned by normalised [0,1] fractions of a surface of
// the given pixel size. Render inside a position:relative container that matches
// (w, h); the layer itself is non-interactive.
export function CursorLayer({ cursors, peers, w, h }: { cursors: PeerCursor[]; peers: Peer[]; w: number; h: number }) {
  return (
    <>
      {cursors.map((cur) => {
        const peer = peers.find((p) => p.id === cur.id);
        if (!peer) return null;
        return (
          <div key={cur.id} style={{ position: "absolute", left: cur.x * w, top: cur.y * h, pointerEvents: "none", transform: "translate(-2px,-2px)", transition: "left .08s linear, top .08s linear", zIndex: 5 }}>
            <Icon name="mousePointer" size={16} color={peer.color} />
            <span style={{ marginLeft: 2, fontSize: 10.5, fontWeight: 700, color: "#fff", background: peer.color, padding: "1px 6px", borderRadius: 6, whiteSpace: "nowrap" }}>{peer.name}</span>
          </div>
        );
      })}
    </>
  );
}
