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

**Persistence.** A scene is stored as typed rows — `WhiteboardNode` /
`WhiteboardEdge`, keyed by the canonical scope `{kind}:{id}` (migration
`WhiteboardTables`). Each live co-editing op is a single-row upsert/delete, so
edits to *different* items are independent (the residual write-race below is
resolved). Scenes that predate the table are migrated at startup by
`Whiteboards.BackfillAsync` from the old `whiteboard.{scope}` `Setting` blobs,
which are then deleted. *(History: this first shipped as a migration-free JSON
blob in the `Setting` store — the same interim pattern as the PI board — until a
`.NET` SDK was available to generate the EF migration.)*

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
- **+** Scene persists as typed rows (`WhiteboardNode`/`WhiteboardEdge`); each
  co-editing op is an independent single-row write — no whole-scene read-modify-
  write, so the storage-layer race below is closed. It still rides along in the
  admin backup snapshot (intended).
- **−** Only edits to the *exact same field* of one node remain last-write-wins
  (cross-field edits now merge). A full CRDT/OT was evaluated and declined as
  disproportionate — see the addendum. This is field-level convergence, not
  conflict-free character-level merge.

## Alternatives considered
- **Embed a third-party board (Miro/Mural) via iframe/SDK** — rejected: sends
  portfolio context to an external processor (GDPR/vendor review), adds a hard
  dependency, and can't reuse our auth/theme.
- **A global infinite canvas** — rejected for the first cut: unbounded scope,
  harder permissioning; the per-entity canvas maps cleanly onto existing
  authorization and is what planning/kick-off sessions actually need.
- **Full CRDT co-editing** — deferred: heavier than needed for sticky-note
  brainstorming; notify-and-refetch reuses the proven board path.
- **First-class whiteboard table** — **adopted** once a `.NET` SDK was available
  to generate the migration (`WhiteboardTables`); the `Setting`-backed blob was
  the migration-free interim and is now backfilled away at startup.

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
independent. Edits to the *same* node are now **field-level**: a co-editing op
carries only the properties that changed (a move sends geometry, a recolour sends
the colour, a text edit sends the text), and the server merges per field — so two
people editing different aspects of one node (A moves it, B recolours it) both
survive. Only two edits to the *exact same field* remain last-write-wins,
reconciling on the next refetch. A full CRDT/OT engine was **evaluated and
declined**: it would mean a heavy dependency (Yjs/Automerge), replacing the typed
rows with an opaque CRDT document and a binary update protocol, and conflict-free
merge semantics for spatial data — disproportionate for a bounded brainstorming
canvas whose realistic conflict (a sub-RTT race on the *same field* of the *same*
node) is already rare and self-heals. Field-level merge is the proportionate step:
it removes the cross-field clobber with no new dependency and keeps the typed-row
model.

**Residual race — resolved.** The first cut persisted each op by rewriting the
whole `Setting` scene blob, so two writers to the *same* scene within the same
instant could still lose an update at the storage layer. Persistence is now typed
rows and every op is a **single-row upsert/delete**, so writers to *different*
items never touch the same row and can't clobber each other. Only edits to the
*same* item remain last-write-wins (by design — see "Convergence, not CRDT").

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

## Addendum — fluid authoring & templates (xmind-style)

**Status:** Accepted — extends this ADR. Frontend-only (reuses the existing
kinds, granular ops and bulk save; no server change).

- **Drag-to-create with live resize.** With a shape tool armed, press-drag on the
  canvas rubber-bands the new shape to size (a live dashed preview follows the
  pointer); a plain click still drops a default-sized shape. Persisted as the
  usual single node op.
- **Drag-to-connect (flexible arrows).** A selected shape shows a connector
  handle; dragging from it draws a live arrow to wherever the pointer goes and
  links to whatever shape it's dropped on (point-in-box hit test). The
  click-source→click-target connector tool remains for keyboard/precision use.
- **Templates dropdown.** A **Templates** menu drops a ready-made scene
  (nodes + connectors) onto the board, grouped: **Brainstorm** (Mind map,
  Fishbone/Ishikawa), **SDLC** (Iterative/Incremental, Spiral, Waterfall,
  V-Model, RAD, DevOps), **Agile** (Scrum, Kanban, Scrumban, SAFe) and
  **Governance** (Stage-Gate G0–G5) — one per methodology the tool supports
  (CLAUDE.md §5) plus the named brainstorming/SDLC models. Templates are pure
  builders (`src/whiteboard/templates.ts`, unit-tested for self-consistent
  edges) and insert through the cap-checked bulk `PUT`, so they co-edit and
  persist like anything else.
