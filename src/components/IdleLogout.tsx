// ============================================================================
//  Idle-logout watcher — renders nothing; signs the user out after a period of
//  inactivity (VITE_AUTH_IDLE_MINUTES, default 15). Mounted only when auth is
//  enabled and someone is signed in (see AuthProvider). Pure timing logic lives
//  in lib/idle.ts (unit-tested); this file is the DOM wiring. See ADR-0038.
// ============================================================================
import { useEffect, useRef } from "react";
import { resolveIdleMs, isIdle } from "@/lib/idle";

// Activity that counts as "the user is still here". Pointer, keyboard, scroll,
// touch and regaining tab focus all reset the clock.
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "wheel"] as const;
// Shared across tabs so activity in one tab keeps the others alive.
const LS_KEY = "atlas.lastActivity";
const CHECK_INTERVAL_MS = 30_000;   // how often we test the threshold
const ACTIVITY_THROTTLE_MS = 5_000; // don't write on every mousemove

export function IdleLogout({ onIdle }: { onIdle: () => void }) {
  const idleMs = resolveIdleMs(import.meta.env.VITE_AUTH_IDLE_MINUTES as string | undefined);
  const last = useRef<number>(0);
  const lastWrite = useRef<number>(0);
  const firedRef = useRef(false);

  useEffect(() => {
    last.current = Date.now();   // start the clock on mount (not during render)
    const mark = () => {
      const now = Date.now();
      last.current = now;
      // Throttle the cross-tab broadcast so we don't hammer localStorage.
      if (now - lastWrite.current > ACTIVITY_THROTTLE_MS) {
        lastWrite.current = now;
        try { localStorage.setItem(LS_KEY, String(now)); } catch { /* private mode */ }
      }
    };
    // Another tab saw activity → adopt its timestamp (keeps this tab alive).
    const onStorage = (e: StorageEvent) => {
      if (e.key === LS_KEY && e.newValue) last.current = Math.max(last.current, Number(e.newValue));
    };

    ACTIVITY_EVENTS.forEach((ev) => window.addEventListener(ev, mark, { passive: true }));
    document.addEventListener("visibilitychange", mark);
    window.addEventListener("storage", onStorage);

    const timer = window.setInterval(() => {
      if (firedRef.current) return;
      if (isIdle(last.current, Date.now(), idleMs)) {
        firedRef.current = true;               // guard against double-fire
        onIdle();
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, mark));
      document.removeEventListener("visibilitychange", mark);
      window.removeEventListener("storage", onStorage);
      window.clearInterval(timer);
    };
  }, [idleMs, onIdle]);

  return null;
}
