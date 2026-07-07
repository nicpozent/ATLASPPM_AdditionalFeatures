// ============================================================================
//  Idle-logout policy (pure helpers).
//
//  Security policy: an authenticated session is signed out after a period of
//  inactivity (default 15 minutes) so an unattended workstation can't be used.
//  This is a client-side convenience on top of the token's own expiry — the API
//  stays authoritative (short-lived access tokens; the server never trusts the
//  client for authorization). See ADR-0038.
//
//  These functions are pure so they're unit-tested without a DOM or timers; the
//  wiring (activity listeners + interval + MSAL logout) lives in
//  components/IdleLogout.tsx.
// ============================================================================

export const DEFAULT_IDLE_MINUTES = 15;
const MIN_IDLE_MINUTES = 1;
const MAX_IDLE_MINUTES = 480; // 8h ceiling — a policy, not "never"

// Parse the configured idle window (VITE_AUTH_IDLE_MINUTES) to milliseconds.
// Empty / non-numeric / out-of-range falls back to the 15-minute default,
// clamped to [1, 480] minutes so a typo can't disable the policy or set it absurd.
export function resolveIdleMs(raw: string | undefined | null, fallbackMinutes = DEFAULT_IDLE_MINUTES): number {
  const n = Number((raw ?? "").toString().trim());
  const minutes = Number.isFinite(n) && n > 0 ? n : fallbackMinutes;
  const clamped = Math.min(MAX_IDLE_MINUTES, Math.max(MIN_IDLE_MINUTES, minutes));
  return Math.round(clamped * 60_000);
}

// True when the last activity is at least `idleMs` in the past.
export function isIdle(lastActivityMs: number, nowMs: number, idleMs: number): boolean {
  return nowMs - lastActivityMs >= idleMs;
}
