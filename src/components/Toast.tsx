import { useEffect, useState } from "react";
import { color, font, radius } from "@/theme";
import { Icon } from "./Icon";

// ============================================================================
//  Minimal global toast. A single <Toaster/> near the root subscribes to a
//  module-level emitter; anywhere in the app (and the React Query mutation
//  cache) can call toast(message). Used to surface API errors — notably the
//  permission-matrix 403 — which would otherwise fail silently.
// ============================================================================
export type ToastKind = "error" | "info";
interface ToastItem { id: number; message: string; kind: ToastKind; }

let seq = 0;
const listeners = new Set<(t: ToastItem) => void>();

export function toast(message: string, kind: ToastKind = "info") {
  const item: ToastItem = { id: ++seq, message, kind };
  listeners.forEach((l) => l(item));
}

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const add = (t: ToastItem) => {
      setItems((cur) => [...cur, t]);
      setTimeout(() => setItems((cur) => cur.filter((x) => x.id !== t.id)), 6000);
    };
    listeners.add(add);
    return () => { listeners.delete(add); };
  }, []);

  if (items.length === 0) return null;

  return (
    <div style={{ position: "fixed", bottom: 20, right: 20, zIndex: 2000, display: "flex", flexDirection: "column", gap: 10, maxWidth: 380 }}>
      {items.map((t) => {
        const bad = t.kind === "error";
        return (
          <div key={t.id} role="status" style={{
            display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px",
            background: color.surface, border: `1px solid ${bad ? color.danger : color.border}`,
            borderLeft: `4px solid ${bad ? color.danger : color.primary}`, borderRadius: radius.lg,
            boxShadow: "0 12px 30px rgba(17,22,58,0.18)", fontFamily: font.body,
          }}>
            <span style={{ color: bad ? color.danger : color.primary, flex: "none", marginTop: 1 }}>
              <Icon name={bad ? "alert" : "bell"} size={17} />
            </span>
            <div style={{ fontSize: 13, lineHeight: 1.4, color: color.text }}>{t.message}</div>
            <button type="button" aria-label="Dismiss" onClick={() => setItems((cur) => cur.filter((x) => x.id !== t.id))}
              style={{ border: "none", background: "transparent", color: color.faint2, cursor: "pointer", padding: 0, marginLeft: 4, flex: "none" }}>
              <Icon name="x" size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
