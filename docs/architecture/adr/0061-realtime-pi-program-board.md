# ADR-0061 — Real-time PI Program Board (SignalR)

**Status:** Accepted — extends PI Planning
([Pip endpoints], the increment/objective/dependency model) and the
code-splitting policy ([ADR-0027](./0027-frontend-code-splitting.md)).

## Context
PI Planning already stored the SAFe model — `ProgramIncrement` → iterations,
`PiObjective` (business value + confidence), and `PiDependency` (deliverable→
deliverable links). The Dependencies tab rendered them as a **list**. Planners
run PI planning as a shared, synchronous ritual (the SAFe "program board"), for
which teams typically leave Atlas for a whiteboard tool. We wanted that ritual
*in* Atlas: a live swimlane board — deliverables as lanes, iterations as
columns, objectives as draggable cards, dependencies as arrows — that several
people can work at once.

## Decision
Add a **Program Board** view to the existing PI Planning screen (not a new
module — the data and screen already exist) plus a real-time layer.

**Layout (reuses existing data).** Rows are derived from each objective's linked
deliverable (`EntityType/EntityId`); columns are the increment's iterations.
Only the *column* placement is board-specific state, persisted as a JSON map
(`objectiveId → iterationId`) in the existing `Setting` store under
`pi.board.{incrementId}` — **migration-free** (the build environment can't
generate an EF migration). It's presentation state, not a domain fact;
promoting it to a first-class `PiObjective.IterationId` column is a clean
follow-up. Dependency arrows are drawn between lanes from the existing
`PiDependency` links.

**Real-time transport.** A SignalR hub (`/hubs/board`, `BoardHub`) provides
**presence**, **peer cursors**, and a **change ping**. Crucially, *no domain
data travels over the hub* — all reads/writes still go through the REST API
(`cap-schedule`), and the ping is contentless ("refetch"). Clients are grouped
per increment (`pi:{id}`). The ping is **server-driven**: the REST mutation
endpoints (objectives, dependencies, iterations, and board placement) call
`BoardHub.NotifyGroupAsync` after committing, so a change reaches every open
board whether it was made *on* the board or on another tab / by another API
client — not just changes the board UI itself makes (notify-and-refetch — no
CRDT). The client is lazy-loaded so the SignalR bundle only loads with the board.

## Security & compliance
Designed against the platform's control baseline
([ADR-0049](./0049-compliance-coverage-and-zero-trust.md)):

- **Authentication / access control (ISO 27001 A.9, A.5.15; NIST AC-3, IA-2).**
  The hub is mapped with `RequireAuthorization()` whenever `Auth:Enabled`, in
  lock-step with the API. Browsers can't set an `Authorization` header on the
  WebSocket handshake, so the client passes the Entra bearer as an `access_token`
  query value; JwtBearer is configured to read it **only** for `/hubs` paths.
- **Least privilege / no privilege escalation (NIST AC-6).** The hub carries no
  mutations — it cannot change portfolio data. Every write remains behind the
  `cap-schedule` REST checks and the existing audit log, so a socket can never do
  more than the caller's REST permissions already allow.
- **Segregation (NIST SC-7; ISO A.8.22).** Per-increment groups mean a client
  only receives events for the board it explicitly joined — no cross-board leakage.
- **Data minimisation & storage limitation (GDPR Art. 5(1)(c),(e)).** Presence
  broadcasts a display name, initials and a colour derived from the opaque
  connection id — **no email or stable user identifier**. Cursors are normalised
  coordinates. None of it is persisted: presence/cursor state lives only in
  process memory for the life of a connection and is dropped on disconnect.
- **Availability / resource abuse (NIST SC-5).** Cursor messages are
  client-throttled (~16/s) and server-clamped; the connection auto-reconnects and
  the board degrades to non-realtime if the hub is unreachable.
- **Transport security (ISO A.8.24).** Same-origin behind the TLS edge; nginx
  proxies `/hubs` with the WebSocket upgrade (`docs` + `deploy/nginx.conf`).

## Consequences
- **+** PI planning becomes a live, multi-user board without leaving Atlas, on
  top of data that already existed.
- **+** Small, auditable security surface: presence/cursor relay only; the DB
  stays the single source of truth via REST.
- **+** Migration-free — ships in an environment that can't run `dotnet ef`.
- **−** Placement lives in a key/value blob rather than a typed column (promotion
  is a follow-up); board layout also appears in the broad `GET /settings` dump
  (non-sensitive).
- **−** Notify-and-refetch is coarser than field-level co-editing; sufficient for
  planning cadence, and a CRDT/OT upgrade remains open if needed.
- **−** The .NET pieces were written to the codebase's patterns but **not compiled
  here** (no SDK); a `dotnet build`/`test` gate on CI is the real confirmation.

## Alternatives considered
- **New top-level "Board" module** — rejected: duplicates the PI model and adds a
  screen outside the approved prototype.
- **Poll the REST API for liveness** — rejected: no presence/cursors, and either
  laggy or wasteful; SignalR is the right transport for a synchronous ritual.
- **Full CRDT co-editing** — deferred: heavier and unnecessary for card placement
  and dependency links at planning cadence.
- **First-class `IterationId` column now** — deferred until a migration can be
  generated; the `Setting`-backed map is the migration-free interim.
