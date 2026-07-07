# ADR-0038 — Idle-logout policy (15-minute inactivity sign-out)

**Status:** Accepted — extends [ADR-0005](./0005-entra-sso.md) (Entra SSO) and the
security hardening line (ABB-09 / SBB-14).

## Context
An authenticated Atlas session left open on an unattended workstation is a
standing risk (shoulder-surfing, walk-up access). Access tokens expire on their
own, but that window is long relative to "someone walked away from their desk".
A common control is an **idle timeout**: sign the user out after a period of no
interaction.

## Decision
- **Client-side idle watcher.** When auth is enabled and a user is signed in,
  `IdleLogout` (mounted by `AuthProvider`) tracks activity (pointer, keyboard,
  scroll, touch, tab-focus) and, after the idle window elapses, calls the
  existing MSAL `logout()` (redirect sign-out). Timing logic is pure and
  unit-tested (`lib/idle.ts`); the component is the DOM wiring.
- **Default 15 minutes, configurable.** `VITE_AUTH_IDLE_MINUTES` (default 15)
  sets the window; `resolveIdleMs` clamps it to **[1, 480] minutes** so a typo
  can't disable the policy or set it absurd.
- **Cross-tab.** The last-activity timestamp is mirrored through `localStorage`
  so activity in one tab keeps sibling tabs alive and they log out together.
- **Not a security boundary on its own.** This is a convenience control layered
  on top of token expiry; the **API remains authoritative** (short-lived access
  tokens, server-side authorization). A tampered client that skips the timer
  still can't outlive its token, and the server never trusts the client for
  authZ (ADR-0004).

## Consequences
- **+** Unattended sessions self-terminate; the default meets the common
  "15 minutes" policy and is tunable per deployment without a rebuild of intent
  (env var).
- **+** Inert when auth is disabled (the mockup/dev mode is unaffected) and when
  no user is signed in.
- **−** Purely client-side, so it only protects the SPA session, not the token's
  own lifetime — acceptable given the server-authoritative model.
- **−** A 30-second check interval means logout fires within ~30s of the
  threshold, not to the exact second (deliberate — avoids a per-second timer).

## Alternatives considered
- **Server-driven session timeout** — Atlas has no server session (stateless
  bearer tokens); enforcing this server-side would mean introducing session
  state. Rejected as disproportionate; shortening token lifetime in Entra is the
  server-side lever if needed.
- **Warn-then-logout modal (countdown)** — better UX, more surface; deferred as a
  possible enhancement. The current policy signs out silently and returns to the
  Entra sign-in.
- **Fixed, non-configurable 15 min** — most deployments want 15, but some
  regulated ones differ; a clamped env var costs little and avoids a fork.
