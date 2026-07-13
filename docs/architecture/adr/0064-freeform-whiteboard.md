# ADR-0064 — Freeform Whiteboard (per-entity brainstorming canvas)

**Status:** Accepted — builds on the real-time room hub
([ADR-0061](./0061-realtime-pi-program-board.md)) and the migration-free
`Setting`-JSON persistence pattern it established.

## Context
Teams run PI planning and project/product kick-offs as visual, generative
sessions — sticky notes, boxes and arrows on a wall — for which they leave Atlas
for a separate whiteboard tool (Miro/Mural). The product owner asked for that
capability *inside* Atlas: a colourful, freeform canvas with sticky notes,
shapes, connectors, icons and actors that several people can brainstorm on live,
available on PI Planning first and then on projects, programs, releases and
products. The PI Program Board (ADR-0061) already gave us a real-time transport
and a migration-free persistence pattern to build on.

## Decision
Add a reusable **Whiteboard** — a *bounded, per-entity* canvas (not a global
infinite Miro): one whiteboard per PI increment / project / program / release /
product, mounted as a tab on that entity's screen. Shipped first as a
**Whiteboard tab on PI Planning**.

**Scene model.** A scene is a small JSON document: a flat list of `nodes`
(sticky `note`, `rect`, `ellipse`, `diamond`, `actor`, `text`, `icon`) and
`edges` (connectors between nodes). Nodes carry position/size, optional text, a
`#RRGGBB` colour and (for icons) an icon name. Pure scene helpers
(`src/whiteboard/scene.ts`) do all mutations immutably and are unit-tested; the
editor (`src/whiteboard/Whiteboard.tsx`) is pure inline-styled React using the
existing theme tokens and `Icon` set — **no new UI framework, no redesign**.

**Persistence (migration-free).** The scene is stored as JSON in the existing
`Setting` store under `whiteboard.{kind}:{id}` (e.g. `whiteboard.pi:5`) — the
same interim pattern as the PI board, because this environment can't generate an
EF migration. Promoting it to a typed `Whiteboard` table is a clean follow-up.

**Real-time.** The whiteboard joins a room `wb:{kind}:{id}` on the shared hub
(ADR-0061): presence, peer cursors, and a contentless "refetch" ping. Saves are
debounced full-scene `PUT`s; a peer's save pings the room and everyone refetches
(**notify-and-refetch, last-write-wins** — no CRDT, matching the board). No
domain data travels over the socket.

## Security & compliance
Designed against the platform's control baseline
([ADR-0049](./0049-compliance-coverage-and-zero-trust.md)):

- **Authorization is server-authoritative and scope-aware (ISO 27001 A.5.15;
  NIST AC-3, AC-6).** Editing a whiteboard requires the SAME capability as
  editing the entity it hangs off — `pi → cap-schedule`, `project/program/
  release → cap-projects`, `product → cap-products` — checked on the server.
  Reads are open to any authenticated caller (parity with the other per-entity
  reads). UI gating is cosmetic only.
- **Input validation / resource abuse (NIST SC-5; ISO A.8.28).** The scope is
  validated (kind whitelist + id charset, no `.`) so it can neither escape the
  `whiteboard.` key namespace nor inject a hub group name. The scene is
  **sanitised on every write**: bounded node/edge counts, clamped coordinates
  and sizes, capped text length, whitelisted kinds, `#RRGGBB`-validated colours,
  charset-checked icon names, and dangling connectors dropped. A client cannot
  persist an unbounded or malformed blob.
- **Confidentiality (GDPR data minimisation).** Whiteboard content is per-entity
  working material, not a global setting, so it is **redacted from the broad
  `GET /settings` dump** (`Backups.IsSecretSetting`, prefix `whiteboard.`) and
  served only through the scoped endpoints. Presence over the hub stays minimal
  (name/initials/colour); nothing about cursors is persisted.
- **Auditability (ISO A.8.15).** Each save writes an audit event
  (`Whiteboard · Saved whiteboard`, scope + node/edge counts — never the content).

## Consequences
- **+** Visual brainstorming lives in Atlas, reusing the real-time hub and the
  existing design language; no new dependency or framework.
- **+** One reusable canvas component + one generic scoped endpoint ⇒ extending
  to projects/programs/releases/products is UI mounting only (Phase 3).
- **+** Migration-free — ships where `dotnet ef` can't run.
- **−** Last-write-wins (notify-and-refetch) can drop a concurrent edit made in
  the same debounce window; acceptable at brainstorming cadence, a CRDT/OT
  upgrade remains open.
- **−** Scene lives in a key/value blob rather than a typed table (promotion is a
  follow-up); it also rides along in the admin backup snapshot (intended).
- **−** The .NET pieces were written to the codebase's patterns but **not
  compiled here** (no SDK); the CI `dotnet build`/`test` gate is the confirmation.

## Alternatives considered
- **Embed a third-party board (Miro/Mural) via iframe/SDK** — rejected: sends
  portfolio context to an external processor (GDPR/vendor review), adds a hard
  dependency, and can't reuse our auth/theme.
- **A global infinite canvas** — rejected for the first cut: unbounded scope,
  harder permissioning; the per-entity canvas maps cleanly onto existing
  authorization and is what planning/kick-off sessions actually need.
- **Full CRDT co-editing** — deferred: heavier than needed for sticky-note
  brainstorming; notify-and-refetch reuses the proven board path.
- **First-class `Whiteboard` table now** — deferred until a migration can be
  generated; the `Setting`-backed blob is the migration-free interim.
