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
interface ToastItem { id: number; message: string; kind: ToastKind; code?: string; }

let seq = 0;
const listeners = new Set<(t: ToastItem) => void>();

// eslint-disable-next-line react-refresh/only-export-components -- toast API co-located with the Toaster component; affects dev HMR only
export function toast(message: string, kind: ToastKind = "info", code?: string) {
  const item: ToastItem = { id: ++seq, message, kind, code };
  listeners.forEach((l) => l(item));
}

// Surface any thrown error as a friendly toast. When it's an unexpected (5xx)
// failure carrying a correlation code, show the code with copy + troubleshooting.
// eslint-disable-next-line react-refresh/only-export-components -- toast API co-located with the Toaster component; affects dev HMR only
export function toastError(err: unknown) {
  const anyErr = err as { message?: string; errorId?: string };
  toast(anyErr?.message || "Something went wrong.", "error", anyErr?.errorId);
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
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, lineHeight: 1.4, color: color.text }}>{t.message}</div>
              {t.code && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 7, flexWrap: "wrap" }}>
                  <button type="button" title="Copy code" onClick={() => navigator.clipboard?.writeText(t.code!)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: font.mono, fontSize: 11.5, fontWeight: 700, color: color.textMuted, background: color.bg, border: `1px solid ${color.border}`, borderRadius: 6, padding: "3px 8px", cursor: "pointer" }}>
                    {t.code} <Icon name="sheet" size={12} />
                  </button>
                  <a href={`/help?code=${encodeURIComponent(t.code)}`}
                    style={{ fontSize: 11.5, fontWeight: 600, color: color.primary, textDecoration: "none" }}>Troubleshooting →</a>
                </div>
              )}
            </div>
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
