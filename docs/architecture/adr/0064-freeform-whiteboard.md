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

## Addendum — live co-editing (granular authorized ops)

**Status:** Accepted — extends this ADR. Replaces the first cut's
notify-and-refetch / last-write-wins whole-scene save.

The first cut PUT the entire scene on a debounce and adopted the server copy on a
peer's "refetch" ping — so two people editing the same board could clobber each
other's whole scene. Co-editing replaces that with **granular, authorized ops**:

- **Per-item endpoints** (`server/Whiteboards.cs`): `PUT …/node`, `DELETE
  …/node/{id}`, `PUT …/edge`, `DELETE …/edge/{id}`. Each is cap-checked and
  sanitised (the same `SanitizeNode`/`SanitizeEdge` used by the bulk path),
  persists just its item into the scene, and broadcasts the exact delta.
- **Server-only op broadcast** (`BoardHub.NotifyRoomOpAsync`): the REST handler
  emits an `Op` message (`{t:"node",node}` / `{t:"delNode",id}` / `{t:"edge",edge}`
  / `{t:"delEdge",id}`) to the room. **Crucially, clients cannot send ops** —
  there is no hub method to do so — so a peer only ever receives a change the
  server already authorized and persisted. This keeps the hub's "no
  client-originated domain writes" property intact and closes the obvious
  escalation (a view-only user cannot inject an op that an editor peer would
  persist), because persistence only ever happens through the cap-checked REST
  call of the acting editor.
- **Client** (`src/whiteboard/*`): each local edit applies optimistically, then
  fires its granular REST op; a peer's `Op` is merged via the pure, unit-tested
  `applyRemoteOp` (`scene.ts`). Remote *upserts* to the node the local user is
  actively dragging/editing are skipped so a peer can't fight an in-progress
  interaction; deletes still apply. On error or reconnect the client refetches
  the whole scene to reconcile.

**Convergence, not CRDT.** Concurrent edits to *different* items are fully
independent. Concurrent edits to the *same* item are last-write-wins and
reconcile on the next reconnect/refetch. This is a large step up from whole-scene
LWW without the weight of a CRDT/OT engine.

**Residual race.** Persistence is still a read-modify-write of the `Setting`
scene blob, so two writers to the *same* scene within the same instant can still
lose an update at the storage layer. The typed-table promotion (per-row writes)
is the real fix and is tracked as a **pending follow-up**
(`docs/pi-board-followups.md` §3).

## Addendum — richer toolset, freehand, export & the Roadmap surface

**Status:** Accepted — extends this ADR.

- **More shapes.** Added `triangle`, `hexagon`, `parallelogram`, `star`, `pill`
  (rounded) and `cylinder` (database) to the node kinds, alongside the original
  note / rect / ellipse / diamond / actor / text / icon. Polygon shapes render
  via CSS `clip-path` (shared `CLIP` map); cylinder via inline SVG.
- **Connector tool.** Connectors (arrows) are now a first-class toolbar tool —
  pick it, click the source shape, click the target — in addition to the
  select-then-Connect path. Available on every surface (the component is shared),
  so e.g. the Programs whiteboard has arrows too.
- **Freehand pen (handwriting).** A `draw` node stores a `points` polyline
  (absolute coords, server-bounded to `MaxPoints`). The pen tool captures pointer
  strokes; strokes render in the SVG layer and are selectable/movable/deletable
  like any node (moving translates every point). Persisted and broadcast as a
  normal node op, so freehand co-edits live too.
- **Save / export & clear.** A **Save** menu exports the board — **PNG** and
  **SVG** (built from our own model via a dependency-free SVG serialiser +
  canvas rasterisation — nothing leaves the browser) and **JSON** (re-importable
  backup). **Import JSON** and **Clear board** (confirmed) round out lifecycle
  management; per-item **Delete** and Del-key deletion already existed. Clear and
  Import use the bulk-scene `PUT` (cap-checked) and ping peers to refetch.
- **Roadmap surface.** Added a `roadmap` scope kind (single portfolio-wide board,
  id `portfolio`, gated on `cap-roadmap`) and a **Whiteboard** view on the Roadmap
  screen. The whiteboard now spans PI Planning, projects, programs, releases,
  products and the roadmap.

All additions reuse the existing granular-op + sanitisation + capability model:
new kinds are whitelisted server-side, freehand points are clamped/capped, and
`roadmap` joins the scope→capability map. No new dependency, no redesign.
