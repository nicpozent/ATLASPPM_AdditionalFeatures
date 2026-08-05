# Atlas PPM — Architecture Decision Records (complete set)

_82 ADRs, in numeric order. Each ADR records one significant decision:
context, options considered, the decision, and its consequences. ADRs are
immutable once Accepted; a decision is changed by adding a new ADR that
supersedes it. **Generated from the individual ADR files by build-all.sh —
do not edit by hand; edit the source ADRs and re-run.**_

---

## Index

| ADR | Title | Status |
|-----|-------|--------|
| 0001 | Modular monolith with ASP.NET minimal APIs | Accepted |
| 0002 | PostgreSQL with EF Core | Accepted |
| 0003 | Inline-styled, token-driven frontend (no CSS framework) | Accepted |
| 0004 | Server-authoritative RBAC capability matrix | Accepted |
| 0005 | Microsoft Entra ID SSO, fail-fast on misconfiguration | Accepted |
| 0006 | Jira integration: pull-only, board-optional | Accepted |
| 0007 | In-process background workers (hosted services) | Accepted |
| 0008 | Same-origin nginx edge with security headers | Accepted |
| 0009 | Secrets via environment / Docker secrets, never in VCS | Accepted |
| 0010 | Observability via OpenTelemetry (OTLP) | Accepted |
| 0011 | Documentation as code (Markdown + Mermaid + ADRs) | Accepted |
| 0012 | Empty-by-default data with derive-on-read roll-ups | Accepted |
| 0013 | Time-phased resource allocation (dates, hours↔%, extensions) | Accepted |
| 0014 | Ops as a distinct work type with project-impact tagging | Accepted |
| 0015 | Server-side colour-graded Excel exports (ClosedXML) | Accepted |
| 0016 | Customizable skills matrix, name-keyed ratings | Accepted |
| 0017 | GDPR data-subject actions surfaced in Administration | Accepted |
| 0018 | Jira full-field, comment & attachment import (extends 0006) | Accepted |
| 0019 | Strategic roadmap: dual lane (Now/Next/Later) + timeline model | Accepted |
| 0020 | Task estimate hours count toward allocation (max vs planned) | Accepted |
| 0021 | Jira delta sync + per-entity (project/program/product) sync | Accepted |
| 0022 | JSON backup is a logical export; restore is a merge (pg_dump authoritative) | Accepted |
| 0023 | Time-phased Ops, hours/dates in Resources editing, server-side custom dashboard | Accepted |
| 0024 | Capacity intelligence (insight + staffing) over the shared roster | Accepted |
| 0025 | Accessibility baseline in shared primitives (focus, dialogs, menus) | Accepted |
| 0026 | Automated axe a11y sweep in CI + mobile navigation drawer | Accepted |
| 0027 | Frontend route-level code-splitting + vendor chunking | Accepted |
| 0028 | Over-allocation alerts (delivered, deduplicated via snapshot) | Accepted |
| 0029 | Timelines derive windows from phases, sprints & tasks | Accepted |
| 0030 | Background Jira sync (no 504 on large pulls) | Accepted |
| 0031 | Internal-labour costing: PM/PO cost lines + rate card & calculator | Accepted |
| 0032 | Reference observability stack (Grafana/Tempo/Prometheus/Loki) | Accepted |
| 0033 | Browser-based full-page axe sweep (structural-gated) + extracted screen-logic tests | Accepted |
| 0034 | Ops: Jira board/space re-sync + linked project tasks | Accepted |
| 0035 | Azure DevOps connector (scaffold: connect · discover · map) | Accepted |
| 0036 | Azure DevOps work-item sync (iterations → sprints, work items → epics/tasks) | Accepted |
| 0037 | WCAG AA contrast tokens + gated colour-contrast in the axe sweep | Accepted |
| 0038 | Idle-logout policy (15-min inactivity sign-out, configurable) | Accepted |
| 0039 | Background Azure DevOps sync (queue + worker + poll; cap raised) | Accepted |
| 0040 | Domain metrics, tuned Grafana dashboards & Prometheus alert rules | Accepted |
| 0041 | Decompose large screen files into per-tab modules (project/, resources/) | Accepted |
| 0042 | Ops: full-fidelity Jira import (epics + rich fields + comments/attachments), work-item-status filter, bulk delete | Accepted |
| 0043 | CTO & CIO roles (header persona + Executive RBAC) + role-addressed demand notifications | Accepted |
| 0044 | Azure DevOps delta (changed-since) work-item sync | Accepted |
| 0045 | Per-role email for demand notifications (in-app mapping + per-person opt-out) | Accepted |
| 0046 | Data-driven header role switcher (created roles selectable + enforced) | Accepted |
| 0047 | k6 performance/load-testing suite (smoke·load·stress + API volume seeder) | Accepted |
| 0048 | Web / worker process split (role-selectable container) | Accepted |
| 0049 | Deterministic compliance coverage (multi-framework) + Zero-Trust posture mapping | Accepted |
| 0050 | EU AI Act risk-tiering + ISO 42001 AI-management obligations | Accepted |
| 0051 | Automated AppSec scanning (SAST · SCA/secrets/IaC · DAST) | Accepted |
| 0052 | Tag-triggered release pipeline publishing versioned images to GHCR | Accepted |
| 0053 | AppSec baseline triage → gating SAST + Trivy with scoped exceptions | Accepted |
| 0054 | On-prem single-node Docker as the delivery target (k8s parked) | Accepted |
| 0055 | Need-to-know internal-labour rate card (per-discipline view+edit, +Architect/PM/PO) | Accepted |
| 0056 | Per-profile dark mode via CSS variables (no global stylesheet) | Accepted |
| 0057 | Region-scoped labour rate lines + regional manager roles (APAC/BLOG) | Accepted |
| 0058 | Calendar timeline window (up to 5 years) on an absolute-month model | Accepted |
| 0059 | Task lifecycle timeline + Jira changelog-derived started/resolved timestamps | Accepted |
| 0060 | Microsoft Teams as a third notification channel (channel webhook + Adaptive Card) | Accepted |
| 0061 | Real-time PI Program Board (SignalR presence/cursors + notify-and-refetch) | Accepted |
| 0062 | Individual development plans (manager-scoped, development-framed, redacted) | Accepted |
| 0063 | Personnel-data processing gate (SWOT/dev-plans off until DPIA + MBL sign-off) + Sweden compliance map | Accepted |
| 0064 | Freeform whiteboard (typed rows, live co-edit, templates) | Accepted |
| 0065 | Task-board card moves scoped to planner roles (cap-schedule) | Accepted |
| 0066 | ISO 27001 Annex A Statement of Applicability (per-project) | Accepted |
| 0067 | OpenBao / Vault secrets provider (on-prem, KV v2, opt-in) | Accepted |
| 0068 | Field encryption (AES-GCM) for DPIA-gated personnel notes | Accepted |
| 0069 | Passwordless Postgres via TLS client-certificate auth (opt-in) | Accepted |
| 0070 | Project delivery roles — Technical Lead (always) + Scrum Master (agile-only), from the onboarded roster | Accepted |
| 0071 | Period-windowed resource utilisation + date-range filter (shared time-phased engine) | Accepted |
| 0072 | Enforced per-domain module boundaries (namespaces + Mono.Cecil dependency ratchet) | Accepted |
| 0073 | Migrate the backend to .NET 10 (LTS) | Accepted |
| 0074 | Zeus brand themes (selectable, token-mapped, AA-gated) | Accepted |
| 0075 | Split `primary` into fill + text tokens; contrast-gate all themes | Accepted |
| 0076 | Server-persisted per-user theme (cross-device) + theme-aware charts | Accepted |
| 0077 | Per-theme brand typography (IBM Plex on the Atlas brand themes) | Accepted |
| 0078 | Self-hosted fonts (no external font CDN; air-gapped on-prem) | Accepted |
| 0079 | Stakeholder relationship intelligence (coverage · strength · next engagement) | Proposed |
| 0080 | Jira bidirectional write-back (bounded push actions; amends 0006) | Proposed |

---

# ADR-0001 — Modular monolith with ASP.NET minimal APIs

**Status:** Accepted

## Context
Atlas spans many domains (portfolio, delivery, governance, finance, people). We
need clear internal boundaries and fast iteration, but the team and deployment
footprint are small and there is no independent-scaling requirement per domain.

## Decision
Build the backend as a **single .NET 8 process** exposing **ASP.NET Core minimal
APIs** under `/api/v1`, organised into cohesive endpoint groups (one file per
domain area, composed in `Endpoints.cs`). Each group interacts only through
`AtlasDbContext` and typed DTOs.

## Consequences
- **+** One thing to build, deploy, run, trace and reason about; transactions span
  domains without distributed-transaction machinery.
- **+** Minimal APIs keep the surface terse and testable (`WebApplicationFactory`).
- **+** Clean module seams leave a low-cost path to extract a service later.
- **−** No per-domain isolation or independent scaling; a bad deploy affects all
  domains. Accepted at current scale; revisit if a domain needs separate scaling
  or ownership.

## Alternatives considered
- **Microservices** — rejected: operational overhead and distributed-data
  complexity unjustified at this size.
- **Controllers/MVC** — viable, but minimal APIs are lighter and sufficient.


---

# ADR-0002 — PostgreSQL with EF Core

**Status:** Accepted

## Context
Atlas needs durable, transactional, relational storage for ~80 interrelated
entities, with a managed schema-evolution path and portability across cloud and
on-prem (Nordic data-residency requirements).

## Decision
Use **PostgreSQL 16** as the store and **EF Core 8** (Npgsql provider) as the ORM.
Schema changes ship as **EF migrations applied automatically at API startup**.
Use Postgres-native features where they help (e.g. `text[]` columns with safe
defaults). The InMemory provider backs integration tests.

## Consequences
- **+** Mature, free, widely-hostable (managed or self-hosted); strong SQL + JSON/array support.
- **+** Migrations give a reproducible, reviewable schema history; auto-apply keeps
  environments in step.
- **+** EF gives typed queries and a test-friendly abstraction.
- **−** ORM abstraction can hide query cost; mitigated by projecting to DTOs,
  indexing hot lookups, and deriving roll-ups at read time on bounded sets.
- **−** Auto-migrate on boot assumes a single writer/rolling deploy; acceptable
  for the compose topology.

## Alternatives considered
- **SQL Server** — fine technically, but Postgres avoids licensing and eases
  cross-platform/managed hosting. (The in-app Help still references generic "SQL
  DB" for operators coming from SQL Server; the Postgres specifics are documented.)
- **Dapper / raw SQL** — more control, more boilerplate; EF's migrations and
  change-tracking win for this CRUD-heavy domain.


---

# ADR-0003 — Inline-styled, token-driven frontend (no CSS framework)

**Status:** Accepted

## Context
The UI must be **pixel-faithful** to an approved single-file HTML prototype that is
100% inline-styled. Fidelity and low divergence risk matter more than styling
ergonomics.

## Decision
Style the React SPA with **inline styles only**, sourced from design tokens in
`theme.ts` (`color.*`, `font.*`, `radius`, `layout`). No Tailwind, CSS modules,
styled-components or global stylesheets. Shared visual primitives live in
`components/ui.tsx`; three fonts only (Space Grotesk / Public Sans / Space Mono).

## Consequences
- **+** Structure/styles lift directly from the prototype → high fidelity, no
  design drift, no CSS build/ordering/specificity issues.
- **+** Tokens centralise the palette; theming stays consistent.
- **−** Verbose components; no `:hover`/media queries in pure inline styles →
  handled with small state hooks (focus rings) and JS; a formal responsive/a11y
  pass is tracked separately.
- **−** No utility-class velocity; acceptable given the fidelity requirement.

## Alternatives considered
- **Tailwind / CSS-in-JS** — faster authoring, but reproducing the prototype
  exactly and avoiding drift favoured verbatim inline styles.


---

# ADR-0004 — Server-authoritative RBAC capability matrix

**Status:** Accepted

## Context
Different roles (Platform Admin, PMO, PM, team/managers, Executive, Stakeholder)
get different access. The prototype exposes 9 cosmetic identities; the backend
must enforce a small, auditable authorization model that admins can tune.

## Decision
Model authorization as a **DB-backed capability matrix**: capabilities
(`cap-projects`, `cap-schedule`, `cap-approve`, …) × 6 canonical roles, each cell a
level `N < V < E < F`. Enforcement is **server-side** via
`Permissions.Allows/Deny`. The 9 UI identities and manager slots resolve onto the
6 roles; fine manager identity is retained for scope roll-ups. The client
(`usePermissions`) mirrors the matrix **only to hide affordances** — never as the
control. A boot-time reconcile adds new capabilities/roles with sensible defaults
without overwriting admin edits.

## Consequences
- **+** Single source of truth, editable in Admin → Roles & Permissions, auditable.
- **+** New capabilities roll out safely (idempotent reconcile).
- **+** Security cannot be bypassed from the client.
- **−** Checks exist in two places (server enforce + client hint) that must stay in
  sync; mitigated by shared capability keys and the client defaulting to
  optimistic-until-loaded then matching server ranks.

## Alternatives considered
- **Hard-coded role checks** — brittle, not admin-tunable.
- **External policy engine (OPA)** — overkill for a fixed capability set.


---

# ADR-0005 — Microsoft Entra ID SSO, fail-fast on misconfiguration

**Status:** Accepted

## Context
Birgma/Biltema standardises on Microsoft Entra ID. Atlas must use corporate SSO
(with MFA) rather than manage its own credentials, and must never accidentally
serve unauthenticated in production.

## Decision
Delegate authentication to **Entra ID via OIDC/OAuth2**: MSAL redirect flow in the
SPA; the API validates the JWT **audience/issuer**. MFA is enforced by Entra
**Conditional Access** (Atlas honours it transparently). If auth is enabled but
misconfigured (missing tenant/audience) the API **fails fast at startup**. For
local/dev, auth is explicitly disabled (`VITE_AUTH_ENABLED=false`,
`Auth:Enabled=false`) and role is taken from an `X-Atlas-Role` header.

## Consequences
- **+** No password storage; central identity lifecycle, MFA, Conditional Access.
- **+** Fail-fast removes the "accidentally open" foot-gun.
- **+** Directory reuse (Graph) feeds people/onboarding.
- **−** Local dev must consciously run with auth off; documented.
- **−** Hard dependency on Entra availability for sign-in.

## Alternatives considered
- **Local auth / other IdP** — rejected: violates the corporate-SSO requirement.


---

# ADR-0006 — Jira integration: pull-only, board-optional

**Status:** Accepted

## Context
Teams track delivery in Jira. Atlas must reflect Jira work (projects, issues,
sprints, epics) without becoming a second source of truth or risking writes back
to Jira. Not every Jira project has an agile **board** — some are "spaces" with a
timeline/kanban, a project key, dates and tasks but no board id.

## Decision
Integrate Jira as a **pull-only** sync keyed on the **project key alone**; a board
id is optional:
- **With a board** — use the Agile API for sprints, board epics and issues.
- **Without a board** — page issues via the **enhanced JQL search** (`project = KEY`),
  derive epics from Epic-type issues, and skip sprints.
Three entry points share `Jira.SyncProjectAsync`: manual **Sync**, an automatic
one-shot when a project's Jira key is set, and a scheduled worker (ADR-0007).
Assignees not present in the directory are **flagged** (not dropped) for onboarding.

## Consequences
- **+** Atlas stays the system of record; no accidental write-back.
- **+** Board-less "spaces" map correctly — a common real-world case.
- **+** Idempotent upsert + prune keeps Atlas convergent with Jira.
- **−** No real-time updates (poll-based); staleness bounded by the sync interval.
  A future push model (Jira webhooks) is possible but needs inbound endpoints.
- **−** Enhanced-JQL pagination and API differences add connector complexity.

## Alternatives considered
- **Two-way sync** — rejected: conflict/ownership complexity and blast radius.
- **Board-required only** — rejected: excludes board-less projects entirely.


---

# ADR-0007 — In-process background workers (hosted services)

**Status:** Accepted

## Context
Some work must run off the request path and on a schedule: periodic Jira sync and
data-retention/anonymisation. We want this without standing up separate scheduler
infrastructure at the current scale.

## Decision
Implement recurring work as **`IHostedService` background workers** inside the API
process (`JiraSyncService`, `RetentionHostedService`), each using a `PeriodicTimer`
and opening its own DI scope per pass. Intervals and enable flags are configurable
(`Jira:SyncMinutes`, `Jira:ScheduledSync`, `Retention:Enabled`). Each pass is
best-effort and idempotent; one item's failure is logged and does not abort the pass.

## Consequences
- **+** No extra infrastructure; deploys as part of the API.
- **+** Idempotent + best-effort ⇒ safe to run repeatedly.
- **−** Runs in every API replica → with >1 replica the same pass can run
  concurrently (duplicate work). Acceptable because syncs are idempotent (upsert);
  if replicas grow, add a leader-election/lock or move to an external scheduler.
- **−** Long passes share the process; kept bounded and off the hot path.

## Alternatives considered
- **External scheduler / queue (Hangfire, cron, cloud scheduler)** — more robust
  for scale-out, but unnecessary overhead now. Clean migration path retained.


---

# ADR-0008 — Same-origin nginx edge with security headers

**Status:** Accepted

## Context
The SPA and API must be served securely to browsers. Cross-origin setups add CORS
complexity and preflight overhead, and security headers/CSP need a single, reliable
enforcement point.

## Decision
Serve the built SPA and reverse-proxy `/api` from a single **nginx** container so
the browser is **same-origin** in production (no CORS). nginx applies transport and
**security headers** (CSP, `X-Content-Type-Options`, frame-ancestors/deny, HSTS in
prod). TLS terminates at an ingress/LB in front (or by extending `deploy/nginx.conf`).
The API additionally enforces rate limiting and upload size limits.

## Consequences
- **+** No CORS in prod; one place for headers/CSP; smaller attack surface.
- **+** Static assets cacheable/CDN-friendly; API stays internal.
- **−** One more container and an nginx config to maintain.
- **−** Same-origin coupling means the edge must be part of every deployment
  (documented in DOCKER.md/SETUP.md).

## Alternatives considered
- **Separate API origin + CORS** — more moving parts, preflight cost, header
  duplication. Rejected for the standard single-site deployment.


---

# ADR-0009 — Secrets via environment / Docker secrets, never in VCS

**Status:** Accepted

## Context
Atlas holds sensitive config: DB credentials, Entra client secrets, the Jira API
token, Graph credentials. None may be committed — especially now that the
repository is public.

## Decision
Follow **12-factor config**: all secrets come from **environment variables** or
**Docker secrets** (`docker-compose.secrets.yml` + `deploy/gen-secrets.sh`), read via
`IConfiguration`. `.env` and `secrets/` and dev certs (`deploy/certs/*.key|*.crt`)
are git-ignored; only `.env.example` and tooling are committed. A secret-rotation
age panel + alerts nudge periodic rotation.

## Consequences
- **+** No secrets in source or history; environment-specific injection.
- **+** Works identically for compose, managed Postgres, and orchestrators.
- **+** Public-repo-safe (verified: no `.env`/keys tracked).
- **−** Operators must provision secrets out-of-band (documented in secrets.md).
- **−** No built-in central vault; a vault (e.g. Key Vault) can front the env layer
  later without code change.

## Alternatives considered
- **Secrets in appsettings / committed files** — rejected outright.
- **Cloud vault as the only source** — good, but not assumed; the env/secret
  indirection lets a vault plug in when present.


---

# ADR-0010 — Observability via OpenTelemetry (OTLP)

**Status:** Accepted

## Context
Operators need to diagnose failures and watch health without coupling to one
vendor's agent, and users need a way to reference a specific failure when
contacting support.

## Decision
Instrument the API with **OpenTelemetry** — traces, metrics and logs exported over
**OTLP** (ASP.NET Core, HttpClient and runtime instrumentation). Expose `/health`
(liveness) and `/health/ready` (DB reachable). Stamp a **correlation id** on
unexpected errors and return a coded, friendly message (`SRV-…`, `INT-…`) the UI
surfaces and the Help centre deep-links to.

## Consequences
- **+** Vendor-neutral; point OTLP at Tempo/Jaeger/Grafana/any APM.
- **+** Correlation id ties a user-visible error to server traces/logs.
- **+** Real health probes enable orchestrator liveness/readiness gating.
- **−** Needs an OTLP collector/backend to visualise; absent one, data is dropped
  (no functional impact). Reference dashboards not shipped yet.

## Alternatives considered
- **Vendor SDK (App Insights/Datadog)** — lock-in; OTel can still export to them.
- **Logs only** — insufficient for latency/dependency analysis.


---

# ADR-0011 — Documentation as code (Markdown + Mermaid + ADRs)

**Status:** Accepted

## Context
Architecture and operations docs must stay accurate as the code changes, be
reviewable alongside code, and render without proprietary tooling.

## Decision
Keep documentation **in the repo as Markdown**, with **Mermaid** fenced blocks for
diagrams (context/container/sequence/ER) so they render on GitHub and in IDEs.
Record significant decisions as **ADRs** under `docs/architecture/adr/`. Update the
relevant docs in the **same PR** as any change to a container, trust boundary, data
model shape, or recorded decision.

## Consequences
- **+** Docs are versioned, diffable, and reviewed with the code they describe.
- **+** No diagram binaries or licensed modelling tools; low barrier to update.
- **+** ADRs preserve the "why", not just the "what".
- **−** Mermaid is less expressive than a dedicated modelling tool (e.g. no formal
  ArchiMate); acceptable for communication-grade diagrams.
- **−** Requires discipline to keep docs in step; the "same-PR" rule is the control.

## Alternatives considered
- **Wiki / Confluence** — drifts from code, not diffable in PRs.
- **Dedicated modelling tool (Enterprise Architect, ArchiMate)** — heavyweight;
  reserved for formal enterprise-architecture artefacts if ever required.


---

# ADR-0012 — Empty-by-default data with derive-on-read roll-ups

**Status:** Accepted

## Context
Atlas must reflect *real* portfolio data, never fabricated demo content, and its
many roll-ups (portfolio health, OKR progress, epic completion, capacity
utilisation, ROI, assignee flags) must stay consistent with their sources.

## Decision
**Empty is the correct default**: with no data the UI shows tasteful empty states
inside the real layout, not seed rows. A demo portfolio loads **only** when
`Seed:Enabled=true` (non-prod). Derived/aggregate values are **computed at read
time** from normalised sources rather than stored, so they cannot drift.

## Consequences
- **+** No fabricated data; what you see is real. No stale denormalised roll-ups.
- **+** Sources stay normalised and single-owner; roll-ups are always current.
- **+** Onboarding a fresh tenant is honest (blank until wired to API/Jira/Entra).
- **−** Read-time computation costs CPU on each request; bounded by dataset size,
  small projections, and client-side query caching. If a roll-up becomes hot and
  large, introduce a cached/materialised view behind the same read API.
- **−** First-run screens look empty; mitigated by clear empty-state guidance and
  the Help centre.

## Alternatives considered
- **Stored/denormalised roll-ups** — faster reads, but drift risk and write-time
  complexity; rejected until a measured hotspot justifies caching.
- **Seed data by default** — rejected: fabricated numbers mislead.


---

# ADR-0013 — Time-phased resource allocation

**Status:** Accepted

## Context
Early allocation was a single flat percentage per person per project, summed
over a person's lifetime. That can't answer the questions delivery managers
actually ask: *is this person free in August?*, *who can I staff for this
quarter?*, *what does the extra effort cost when the project runs long?* It also
had no way to enter effort in hours, only a bare %.

## Decision
Model each assignment as a **time-phased segment**. `TeamAssignmentMember` carries
a base segment (`Alloc` % / `AllocHours`, `StartDate`, `EndDate`) plus an optional
**extension** segment (`ExtAlloc`/`ExtHours`/`ExtStartDate`/`ExtEndDate`) for extra
capacity when work runs long — kept separate so the original plan stays intact.

- **Capacity basis** (`AllocMath`): **40 h/week = 100%**; `% = hours ÷ 40`. Weeks
  per month ≈ 4.33 (52/12) drive person-day effort maths.
- **Utilisation is a function of the day**: a segment counts only when live on the
  reference date (`ActiveOn`; empty bounds = open, so pre-dates rows are
  unchanged). `GET /resources?asOf=` and the availability finder both read this.
- People can be assigned **individually** (an "Individuals" bucket, `SubTeamId 0`),
  not only via sub-teams.

## Consequences
- **+** Real capacity planning: per-date over-allocation, availability by
  date/window, and period effort exports all fall out of one model.
- **+** Enter effort as % *or* hours; backward compatible (dateless = always live).
- **−** Read-time computation iterates segments (and, for exports, weekdays);
  bounded by dataset size and the derive-on-read stance of ADR-0012.
- **−** "Extension as a second segment" is a pragmatic two-segment model, not
  unlimited history; a full segment table can supersede this if needed.

## Alternatives considered
- **Flat lifetime %** — simple but can't express *when*; rejected.
- **Unlimited allocation-segment child table** — most general, but a larger
  refactor of the member-list editing UI; deferred until two segments prove
  insufficient.
- **Store utilisation** — drift risk; rejected per ADR-0012 (derive on read).


---

# ADR-0014 — Ops as a distinct work type with project-impact tagging

**Status:** Accepted

## Context
Run-the-business operational work (support, maintenance, monitoring,
infrastructure) is not project delivery, but it competes for the same people —
and that competition is the most common reason delivery slips. It needed a home
that is clearly *not* a project, yet whose load is visible against projects and
against each person's capacity.

## Decision
Add an **Ops** module: `OpsService` (a standing operational area) holding
`OpsItem` work items (type, priority, status, assignee, **allocation %**, and an
optional **impact-project** tag + note).

- **Feeds capacity**: active ops items' allocation rolls up per person into
  Resources' **Ops%** (previously always 0) and the over-allocation check.
- **Impact tag**: an item tagged to a project surfaces on that project's Overview
  as "operational load pulling capacity off delivery", and `GET
  /projects/{id}/ops-impact` totals it.
- **Governed separately**: a dedicated `cap-ops` capability (admin/PMO Full,
  PM/PM-lead/managers Edit, Quality View), reconciled onto existing DBs.

## Consequences
- **+** BAU work is first-class and its drag on delivery is explicit and
  quantified, not invisible.
- **+** Closes the Ops% gap in the capacity model without a bespoke input screen.
- **−** A new top-level section and capability to maintain; mitigated by reusing
  the standard CRUD + RBAC + audit patterns.
- **−** Ops items are dateless today (always "live"); a later change can make ops
  allocation time-phased like ADR-0013 if needed.

## Alternatives considered
- **Model ops as just another project** — blurs delivery vs. run-the-business
  reporting; rejected.
- **A single "impact %" field on projects** — loses the itemised, assignable ops
  backlog and the per-person capacity roll-up; rejected.


---

# ADR-0015 — Server-side colour-graded Excel exports (ClosedXML)

**Status:** Accepted

## Context
Managers asked for Excel exports with colour (a resource-allocation histogram
by day/week/month/quarter/half/year, and the skills matrix). Colours mean cell
fills — which the free SheetJS build doesn't do — and the export should reuse
the numbers the app already computes, not re-derive them in the browser.

## Decision
Generate `.xlsx` **on the backend with ClosedXML**, streamed through the existing
authenticated download path (`apiDownload`, same as artifacts/DSAR).

- `GET /resources/allocation-report.xlsx?from=&to=&period=` — per-person heat grid
  of **average % utilisation** per bucket (green→amber→red, >100% red), with the
  underlying **person-days in the cell comment**. Effort from the ADR-0013
  time-phased allocations, weekdays only; span capped to bound columns.
- `GET /skills/export.xlsx` — the skills matrix as a blue proficiency ramp.

## Consequences
- **+** True cell colouring, frozen headers, comments — first-class Excel.
- **+** No frontend bundle growth; one source of truth for the maths (backend).
- **+** Reuses the proven auth'd file-download flow.
- **−** A managed dependency (ClosedXML) and CPU/memory to build workbooks in
  process; acceptable for on-demand, bounded exports.

## Alternatives considered
- **Client-side ExcelJS** — ships a large lib to every user and re-implements the
  allocation maths in TS; rejected.
- **CSV** — no colour, no comments, poor for a histogram; rejected.


---

# ADR-0016 — Customizable skills matrix, name-keyed ratings

**Status:** Accepted

## Context
My Team needed a competency matrix that managers define themselves (their own
skill columns) and rate their people on, without a fixed taxonomy — and it must
cover the people they actually manage.

## Decision
`Skill` (customizable columns) × person × `SkillRating` (0–4 level). Ratings are
**keyed by person name**, matching how assignments and the directory already
identify people (Atlas has no single stable person entity — people come from
Entra, resources and allocations, all joined by name).

- `GET /skills` returns the matrix scoped to the caller's **Entra management
  roster** (`Teams.ScopeAsync`; Platform Admin/PMO with no scope see everyone),
  ratings pre-filtered to that roster.
- Editing needs `cap-projects` Edit (the managers who own My Team).

## Consequences
- **+** No imposed taxonomy; each team models the skills it cares about.
- **+** Ratings join cleanly to assignments/availability by name — enabling
  skills-based staffing views.
- **−** Name-keying is fragile if a person is renamed; acceptable given the whole
  identity model is name-based, and Entra display names are stable in practice.
- **−** The roster scope means a rating for someone outside the viewer's
  management scope isn't returned by `/skills`; entity-scoped skill views (e.g.
  a project's assigned team) need a dedicated, un-roster-filtered read.

## Alternatives considered
- **Fixed skill list** — simplest but doesn't fit diverse Nordic-retail teams;
  rejected.
- **Rating keyed by a person id** — cleaner, but there is no single person id in
  Atlas; would require a person-master first. Deferred.


---

# ADR-0017 — GDPR data-subject actions surfaced in Administration

**Status:** Accepted

## Context
The GDPR endpoints (DSAR export, right-to-erasure, run-retention-now) existed and
were Platform-Admin gated and audited, but had no UI — an admin had to call the
API by hand. Data-subject rights need to be operable by a governance owner, not
just a developer.

## Decision
Add a **Data Privacy** tab to Administration, visible only to Platform Admin,
wiring the existing endpoints: subject picker (`/gdpr/subjects`) → **Export
(DSAR)** (`/gdpr/export`) and confirm-gated **Erase** (`/gdpr/erase`), plus **Run
retention now** (`/admin/retention/run`).

The API stays authoritative: every action remains Platform-Admin gated and
audited server-side; the tab's role check is **cosmetic** (per ADR-0004).

## Consequences
- **+** Data-subject rights are self-service for the governance owner, with an
  audit trail.
- **+** No new backend surface or risk — pure UI over vetted endpoints.
- **−** Exact-match (case-insensitive) subject matching can miss aliases; chosen
  deliberately over fuzzy matching, which risks exposing a *different* person's
  data.

## Alternatives considered
- **Leave it API-only** — safe but unusable by non-developers; rejected.
- **Fuzzy subject search** — convenience at the cost of a possible personal-data
  breach; rejected in favour of exact match.


---

# ADR-0018 — Jira full-field, comment & attachment import

**Status:** Accepted (extends ADR-0006)

## Context
The pull-only Jira sync (ADR-0006) imported a thin subset — summary, status
category, assignee, priority, due date, points. Teams wanted the *whole* issue in
Atlas: description, people, labels/components/versions, resolution, time,
timestamps, plus comments and attached files.

## Decision
Widen the sync to the full issue record and mirror comments + files, keeping the
one-way, idempotent contract of ADR-0006.

- `ProjectTask` gains description (Jira ADF flattened to plain text), issue type,
  reporter, exact status name, resolution, labels/components/fixVersions, parent
  & epic keys, logged time, created/updated, and a deep link.
- **Comments** upsert by Jira comment id; **attachments** download over the
  authenticated client (size-capped, best-effort) and store bytes in the DB
  (`TaskAttachment`, same bytea pattern as artifacts). Re-sync tops up new
  files/comments without duplicating; locally-created rows are never touched.
- Config: `Jira:ImportComments` / `ImportAttachments` / `MaxAttachmentBytes`.

## Consequences
- **+** Atlas holds the full delivery record; a read-only "Jira details" panel
  surfaces it. Idempotent re-sync is preserved.
- **−** Attachments live in Postgres (bytea) — simple and transactional, but grows
  the DB; the size cap and opt-out bound it. An object store can supersede this
  if volumes demand.
- **−** More Jira API surface + per-attachment downloads lengthen a sync; best-
  effort per item keeps one bad file from failing the run.

## Alternatives considered
- **Keep the thin subset** — insufficient for teams living in Atlas; rejected.
- **Store attachments in object storage/filesystem** — better at scale, but adds
  infra and breaks the single-transaction model; deferred behind the bytea +
  cap approach.


---

# ADR-0019 — Strategic roadmap: dual lane + timeline model

**Status:** Accepted

## Context
Atlas planned delivery at the project/program level (Gantt, PI planning) but had
no place for *strategic* planning above them — the portfolio-level "what are we
doing now, next and later, and why". Two idioms dominate roadmap tools: the
**Now / Next / Later** horizon board (commitment-light, good for stakeholders)
and the **time-based timeline** (date-anchored, good for sequencing). Teams want
both without maintaining two data sets.

## Decision
Model one `RoadmapItem` that carries **both** a horizon lane and optional
start/end dates, so the same initiative renders on either view.

- `RoadmapItem`: `Lane` (Now|Next|Later), `Status`, `Theme` (swimlane), owner,
  optional `StartDate`/`EndDate`, and prioritisation signals `Confidence` (0–100),
  `Effort` (1–5), `Value` (1–5). Business key `RM-n`.
- Children: `RoadmapMilestone` (title/date/done, cascade-deleted), `RoadmapLink`
  (to okr|project|program|product|release, validated against live entities and
  label-snapshotted), and `RoadmapDependency` (a directed edge between two items;
  the DTO exposes both `dependsOn` and the reverse `blocks`).
- The board view drives lane changes (incl. drag-and-drop → `PATCH lane`); the
  timeline places **dated** items in theme swimlanes over a month grid and lists
  undated ones with a prompt. Undated items still live fully on the board.
- Edits gated on a dedicated capability **`cap-roadmap`** (Platform Admin + PMO
  full, PM/PM-lead edit); reading is open with a `canEdit` flag, matching the
  Ops module (ADR-0014). Milestones/links/deps are **replaced wholesale** on
  save (the item is edited as one form), not per-child CRUD.

## Consequences
- **+** One record, two faithful views; no divergence between the horizon board
  and the dated timeline. Links tie strategy to the delivery portfolio.
- **+** Confidence/effort/value make the board prioritisation-aware without a
  separate scoring model.
- **−** Wholesale child replacement is simple but rewrites milestone/link rows on
  every save (fine at roadmap volumes; not a high-write path).
- **−** Dependency edges are between roadmap items only (not to projects); cross-
  object dependency lives in the Gantt/PI modules by design.

## Alternatives considered
- **Two separate entities** (a Kanban board + a timeline) — guarantees drift and
  double entry; rejected.
- **Reuse PI objectives / Gantt** — those are increment- and project-scoped and
  date-mandatory; the roadmap needs portfolio scope and optional dates. Rejected.
- **Per-child CRUD endpoints** for milestones/links/deps — more surface for a
  form that's always edited as a whole; deferred behind wholesale replace.


---

# ADR-0020 — Task estimate hours count toward allocation

**Status:** Accepted (extends ADR-0013)

## Context
Allocation (ADR-0013) was driven only by *planned* signals — explicit team-
assignment %/hours, product allocations, and Ops item %. A person could be
buried in assigned task work yet show near-zero utilisation because no one had
recorded a planned %. Teams asked that **task estimates count as real capacity
consumption** on Resources and in a project's capacity panel.

## Decision
Derive a **bottom-up task load** from each open, assigned task's estimate hours
and combine it with the planned figure per project.

- **Scope:** project tasks (`ProjectTask` has assignee + estimate hours + dates).
  Programs/releases inherit via their linked projects; products use explicit
  `ProductAllocation` (product tasks carry no estimate/assignee); Ops items
  already carry an explicit %.
- **Hours → %:** an open task's estimate is smoothed over its active window and
  converted to a weekly rate via `AllocMath` (40h/wk = 100%). Window = the task's
  own start/target if set, else the project window, else a rolling 4-week
  horizon. Only tasks *live* on the reference day count (time-phased like ADR-0013).
- **Combine rule (the key decision):** per (person, project),
  `load = max(planned %, task %)`, then summed across projects. The planned
  figure is a **floor** and heavy task load can raise it, but the two **never
  double-count** (a planned 50% that already covers the work isn't inflated by
  the tasks that make it up). Rejected alternatives: *sum* (double-counts, blows
  past 100% fast) and *task-replaces-planned* (loses the PM's intent).
- **One engine:** `AllocationEngine.ProjectLoadByPersonAsync` is the single
  source of the project number, reused by the Resources roster **and** a
  project's capacity panel so they can't drift. Task-only assignees now surface
  on both (a person with estimated tasks is working on the project even without
  a formal assignment).
- **Assignee options:** `GET /projects/{id}/assignee-options` returns the
  project's people first (role + team/sub-team/individual) then the onboarded
  roster, so the task-assignee dropdown is always populated.

## Consequences
- **+** Utilisation reflects real committed work, not just planned %. Over-
  allocation surfaces from the bottom up.
- **+** Resources and capacity share one code path (no divergence).
- **−** The hours→% smoothing is an estimate; undated tasks lean on the project
  window or a 4-week default, so the number is directional, not payroll-exact.
- **−** Unparseable project end dates (display-formatted `Due`) fall back to the
  default horizon rather than a precise spread.

## Alternatives considered
- **Sum planned + task** — simplest, but systematically over-counts. Rejected.
- **Only count dated tasks** — precise but under-counts the large body of
  undated backlog work. Rejected in favour of the windowed fallback.


---

# ADR-0021 — Jira delta sync + per-entity sync

**Status:** Accepted (extends ADR-0006, ADR-0018)

## Context
Sync (ADR-0006/0018) was full-only and lived on the project's Tasks tab or the
global "Sync now". Two asks: sync **one entity on demand from its Overview**
(project / program / product), and a **delta** that only pulls what changed so
re-syncs are cheap.

## Decision
- **Delta pulls.** `Project.LastJiraSync` stores the UTC watermark of the last
  successful sync. `SyncProjectAsync(..., delta)` appends `AND updated >= "<watermark>"`
  to the issue JQL (`Jira.DeltaClause`, pure/tested). A delta run:
  - always uses the JQL project search (so the watermark applies even when a
    board is mapped — a full run with a board keeps the board endpoint for
    backlog ordering);
  - **disables pruning and full epic-rollup recompute**, because a delta doesn't
    list every issue and removing "unseen" rows would wrongly delete unchanged
    ones. The first delta (no watermark) behaves as a full pull.
  The watermark is stamped *after* a successful pull; the endpoints accept
  `?delta=true`.
- **Per-entity sync.** `POST /projects/{id}/jira/sync`, plus new
  `POST /programs/{id}/jira/sync` and `POST /products/{id}/jira/sync` which sync
  each **linked, mapped** project (delta by default) and report a roll-up. A
  reusable `JiraSyncButton` on each entity's Overview does a delta on click and
  offers a "Full re-sync"; the project card shows its last-sync time.
- **Import a Jira project as an Ops service.** The import endpoint gains an
  `ops` target (gated on `cap-ops`, not `cap-projects`): it creates an
  `OpsService` carrying the `JiraProjectKey` and upserts the project's issues as
  `OpsItem`s keyed by Jira issue key (idempotent re-import; allocation left 0).
  Issue type/status map to the Ops vocabulary. Ops services also gain
  **archive/unarchive** (`Archived` flag; hidden from the board unless
  `includeArchived`), completing service lifecycle alongside the existing
  create/edit/delete and item CRUD.

## Consequences
- **+** Re-syncs are fast (only changed issues) and can be triggered where the
  user is, per entity. Full re-sync still available for a clean reconcile.
- **+** Delta correctness: no accidental deletion of unchanged rows.
- **−** Delta can't detect issues *deleted* in Jira (they don't appear in an
  "updated since" result) — a periodic full sync reconciles those. Documented.
- **−** The watermark is minute-granular; an issue updated in the same minute as
  a sync may be re-pulled next time (idempotent upsert, so harmless).

## Alternatives considered
- **Always full** — simple but wasteful on large boards; the reason for delta.
- **Track per-issue updated timestamps to prune** — heavier; a periodic full
  sync already reconciles deletions.
- **Webhooks** — the real long-term answer (ADR-0006 "later phases"); delta is
  the pull-only interim.


---

# ADR-0022 — JSON backup is a logical export; restore is a merge

**Status:** Accepted

## Context
Atlas's in-app "Back up all now" produces a downloadable **JSON snapshot** of the
live portfolio data. Users asked what it actually captures and how to restore.
The authoritative recovery path for a relational app is a PostgreSQL dump /
point-in-time restore — but an in-app restore of the logical export is useful for
rolling back edits to the core portfolio objects.

## Decision
Treat the JSON snapshot as a **logical export**, and make its restore a
**merge (upsert by id), never a destructive replace**.

- `POST /backups/restore` parses an uploaded snapshot and, for the **string-keyed
  top-level entities** (projects, programs, products, releases, objectives) and
  **settings**, upserts by id: existing rows are updated from the snapshot,
  missing rows are re-created. It **never deletes** anything.
- Implemented with EF `CurrentValues.SetValues` on a found-or-new tracked entity,
  which copies **scalar properties only** — navigation collections are ignored,
  so no child rows are double-inserted.
- **Out of scope for the JSON restore:** identity-keyed child rows (tasks, epics,
  RAID, cost lines, comments…), attachments (bytea), and RBAC role/permission
  rows. These are captured in the snapshot for portability but restored via a
  **database dump/PITR** — the honest authoritative path. The snapshot download is
  labelled a logical export, and the Backups screen + Help say so.
- Gated on **Backups & restore (Full)** (Platform Admin) and confirm-gated in the
  UI (the confirm text states it's a merge and that child rows/attachments aren't
  covered). Every restore is audited.

## Consequences
- **+** A safe, one-click way to roll back edits to the core portfolio objects and
  settings, with no risk of data loss (merge-only).
- **+** No EF cascade/duplicate-insert hazards (scalar-only copy).
- **−** Not a full recovery: child/identity rows and files need the DB dump. This
  is documented rather than papered over with a fragile deep restore.
- **−** A merge can't remove rows created after the snapshot (by design); a true
  rollback uses the database backup.

## Alternatives considered
- **Destructive full replace** (wipe + insert from JSON) — truer to "restore" but
  dangerous, and brittle across identity ids and attachments; rejected in favour
  of merge + pg_dump for full recovery.
- **No in-app restore** (export only) — simplest, but users wanted to re-apply a
  snapshot; the merge is a safe middle ground.


---

# ADR-0023 — Close allocation gaps: time-phased Ops, hours/dates editing, server-side custom dashboard

**Status:** Accepted (extends ADR-0013, ADR-0014, ADR-0020)

## Context
Three known gaps remained after the allocation work: Ops load ignored dates (so
BAU counted forever), the Resources → By-project editor was **%-only** (no hours
or window, unlike the Team panel), and the Custom dashboard layout lived in one
browser's `localStorage`.

## Decision
- **Time-phase Ops.** `OpsItem` gains `StartDate`/`EndDate`; `Ops.AllocByPersonAsync`
  takes an `asOf` and counts an item only while its window is live (empty = open),
  exactly like project allocation. Resources passes the roster's as-of date;
  capacity uses today. Item create/edit expose the dates.
- **Hours + dates in Resources → By-project.** `SetAllocReq`/the PATCH accept
  weekly hours (hours win over %), a date window, and an extension — reusing the
  `TeamAssignmentMember` fields and `AllocMath` — so an edit made here is
  time-phased, not a flat %. `ResAllocRowDto` returns the full shape; the row has
  an inline hours/date editor.
- **Server-side custom dashboard.** A per-user `DashboardLayout { UserKey, Widgets }`
  with `GET/PUT /dashboard/custom` (keyed by `CallerKey`). The Custom builder
  loads the server layout on mount and saves on every change, with `localStorage`
  as an offline fallback so nothing breaks when signed out.

## Consequences
- **+** Ops utilisation is now correct over time (a June-only incident stops
  counting in August). Capacity math is consistent across project/ops/product.
- **+** Planners get one editing model (hours or %, with dates) wherever they set
  allocation. The custom dashboard follows the user across devices.
- **−** The custom layout is per user key; with auth off (shared dev key) all
  users share one layout — acceptable, and the localStorage fallback covers it.

## Alternatives considered
- **Keep Ops date-less** — simplest but wrong over time; rejected.
- **Custom dashboard in a generic Settings row** — works, but a typed
  per-user entity is clearer and cheap.


---

# ADR-0024 — Capacity intelligence over the shared roster

**Status:** Accepted (extends ADR-0013, ADR-0020, ADR-0023)

## Context
The allocation engine (ADR-0020) and time-phasing (ADR-0013/0023) made per-person
utilisation correct. Teams then needed to *act* on it: spot over-allocation, see
where headroom is, compare demand to capacity by department, and find who to
staff for a given skill.

## Decision
Add read-only **capacity-intelligence** endpoints that derive everything from the
one shared roster, so they can never disagree with the Resources screen.

- **Shared roster.** Extract `ResourcesData.RosterAsync(db, asOf)` — the single
  time-phased roll-up (project via `AllocationEngine`, ops via `Ops`, product via
  `ProductAllocation`, plus directory names) — and reuse it in `/resources` and
  the new endpoints.
- **`GET /capacity/insight`** — portfolio capacity vs demand (headcount × 100 vs
  summed load), over-allocated (>100%), under-utilised (0–50%), unallocated and
  ≥50%-free counts, and a per-department breakdown.
- **`GET /capacity/staffing?skill=&minLevel=&minFree=`** — people rated ≥minLevel
  in a skill who have ≥minFree spare capacity, ranked by free% then rating. Joins
  `SkillRating` to the roster's free capacity.
- **Frontend** — a "Capacity insight" tab on Resources: summary tiles, a
  demand-vs-capacity bar, over/under lists, by-department bars, a skills-based
  staffing finder, and a **My allocations** panel (the signed-in identity's slices
  and free %, matched by name via the availability read).

## Consequences
- **+** Actionable capacity views with zero new data model — pure derivation over
  the existing time-phased allocation. Consistent with the roster by construction.
- **+** Skills-based staffing connects the skills matrix to real availability.
- **−** "My allocations" matches the signed-in identity **by name**; with auth off
  it uses the cosmetic demo identity. Real matching arrives with Entra SSO.
- **−** Over-allocation is surfaced on-screen (pull), not yet pushed as a
  notification — a background emitter can layer on later using the same insight.

## Alternatives considered
- **Precomputed capacity tables / nightly job** — unnecessary; the roster derives
  fast enough on read and stays live.
- **Notify on every allocation change** — noisy and needs a trigger at every write
  site; deferred in favour of the on-screen alert list.


---

# ADR-0025 — Accessibility baseline in shared primitives

**Status:** Accepted

## Context
The UI is 100% inline-styled (ADR-0003), so there's no global stylesheet to hold
`:focus-visible` rings, `prefers-reduced-motion`, etc. Accessibility has to live
in the **shared primitives** (`components/ui.tsx`) so every screen inherits it,
rather than being retrofitted per screen.

## Decision
Bake keyboard/screen-reader behaviour into the shared components and cover it
with component tests:

- **Focus indicators.** `Input`/`Textarea`/`Select` already ring on focus via a
  state-tracked `useFocusRing` (inline styles can't express `:focus`). `Button`
  now uses the same ring so keyboard users can see it.
- **Dialogs.** `Modal` traps focus, moves focus in on open and restores it on
  close, closes on Escape, locks body scroll, and exposes `role="dialog"` +
  `aria-modal` + a label (existing; kept and tested).
- **Menus.** `RowMenu` trigger carries `aria-haspopup`/`aria-expanded`; the popover
  is `role="menu"` with `role="menuitem"` children, closes on Escape and returns
  focus to its trigger; menu items show a focus background (not just hover).
- **Responsive.** The shell tightens content padding on small screens via a
  `matchMedia` hook; wide content (tables, boards, timelines) scrolls inside its
  own `overflow-x` container.
- **Tests.** `ui.test.tsx` covers Button click/disabled/focus-ring, Input change,
  Modal label/Escape/scroll-lock, and RowMenu open/action/close + Escape.

## Consequences
- **+** A consistent a11y floor every screen inherits for free; regressions are
  caught by component tests.
- **−** Not a full WCAG 2.1 AA audit: colour-contrast is by-token (not
  automatically verified), and there's no automated axe sweep in CI yet.
- **−** A true mobile experience still wants a collapsible sidebar drawer; the
  padding tweak is an interim, not a full small-screen layout.

## Alternatives considered
- **A global CSS reset / utility layer for focus** — contradicts ADR-0003
  (inline-only, no framework); rejected.
- **Per-screen a11y fixes** — wouldn't compose or stay consistent; centralising in
  the primitives is the leverage point.

## Follow-ups (tracked, not done here)
- Automated axe/contrast checks in CI.
- Collapsible sidebar drawer for phone widths.
- Broader interaction-test coverage across screens.


---

# ADR-0026 — Automated a11y sweep + mobile navigation drawer

**Status:** Accepted — extends [ADR-0025](./0025-accessibility-baseline.md)

## Context
ADR-0025 baked an accessibility floor into the shared primitives and covered it
with component tests, but left two follow-ups open: (1) there was **no automated
WCAG rule engine** in CI — contrast/label/role regressions could only be caught by
eye, and (2) the small-screen story was a **padding tweak**, not a real layout —
the fixed sidebar rail ate most of a phone's width.

## Decision
**Automated axe sweep.** Add `vitest-axe` (dev-only, wraps `axe-core`) and register
its `toHaveNoViolations` matcher globally in the test setup. `a11y.test.tsx` runs
axe over the shared primitives (Button, labelled form controls, Card + empty state,
Modal dialog). Because these components compose every screen, a violation here would
propagate app-wide, so the primitives are the highest-leverage place to gate. The
suite runs in the existing `npm test` CI step — no new job. (Note: jsdom has no
canvas, so axe's colour-contrast rule is a no-op in CI; structural rules — roles,
names, labels, `aria-*` — are fully enforced. Contrast stays token-governed per
ADR-0003.)

**Mobile navigation drawer.** Below a 900px breakpoint the shell swaps the static
sidebar rail for an **off-canvas drawer**: a hamburger button (rendered only in
narrow mode) in the topbar opens it; it slides in over a dimming backdrop, is a
labelled `role="dialog"` with `aria-modal`, closes on Escape / backdrop click /
navigation, and locks background scroll while open. The effective-open state is
gated on `narrow` so leaving narrow mode can't strand an open panel, and the
route-change reset happens during render (React's "adjust state on prop change"),
not in an effect.

## Consequences
- **+** Structural a11y regressions now fail CI automatically, not just review.
- **+** The app is usable one-handed on a phone; the nav no longer steals width.
- **−** Colour-contrast still isn't machine-verified (jsdom/canvas limitation); a
  full browser-based axe run (Playwright) would close that, deferred.
- **−** The drawer isn't a full focus-trap like `Modal` (it closes on Escape and
  restores context via navigation); acceptable for a nav surface, revisit if it
  grows interactive controls.

## Alternatives considered
- **Playwright + axe in a headed browser** — would verify contrast too, but adds a
  browser to CI and a second test runner; the primitive-level jsdom sweep catches
  the common regressions at a fraction of the cost. Revisit for full-page audits.
- **Keep the padding-only responsive approach** — rejected; it never reclaimed the
  rail's width, which is the actual phone pain point.


---

# ADR-0027 — Frontend route-level code-splitting + vendor chunking

**Status:** Accepted

## Context
The SPA shipped as a **single ~1 MB JS chunk** (250 kB gzipped). Every user
downloaded and parsed the code for all ~24 screens before the first paint, even
though a session typically touches a handful. Vite emitted a chunk-size warning on
every build. The two big costs were (1) all screen code in the entry bundle and
(2) rarely-changing vendor libraries bundled with fast-changing app code, so any
app edit busted the vendor cache.

## Decision
- **Route-level splitting.** Every screen in `App.tsx` is loaded with `React.lazy`,
  so each becomes its own chunk fetched only when its route is first visited. The
  shell wraps `<Outlet/>` in a `<Suspense>` boundary with a minimal `role="status"`
  loader, nested inside the existing route-keyed `ErrorBoundary`.
- **Vendor chunking.** `vite.config.ts` `manualChunks` splits `react`/`react-dom`/
  `react-router-dom`, `@tanstack/react-query`, and the MSAL packages into stable
  `vendor-*` chunks that cache independently of app code.
- **Heavy on-demand libs stay dynamic.** `pptxgen` (exports) was already a dynamic
  import and remains its own chunk, pulled only when a user exports.

## Consequences
- **+** Entry bundle drops from ~1 MB to ~71 kB; the largest eager cost is
  `vendor-react` (~200 kB / 65 kB gz), cached across deploys. No more chunk-size
  warning. Screens range 2–50 kB each and stream in per navigation.
- **+** An app-code change no longer invalidates the vendor chunk cache.
- **−** First visit to a screen incurs a tiny fetch; mitigated by the lightweight
  Suspense loader and HTTP caching. Route prefetch-on-hover could hide it further
  (deferred — not worth the complexity yet).
- **−** `Project` is still a large chunk (~200 kB) because it's a deep, tabbed
  screen; it could be split further by tab if it grows.

## Alternatives considered
- **Keep the monolith, just raise `chunkSizeWarningLimit`** — silences the warning
  without fixing the actual download/parse cost; rejected.
- **Split only vendor, not routes** — leaves all screen code eager; the routes are
  where most of the weight and the natural boundaries are.


---

# ADR-0028 — Over-allocation alerts (delivered, deduplicated)

**Status:** Accepted — builds on [ADR-0024](./0024-capacity-intelligence.md) (capacity intelligence) and the notifications service.

## Context
The Capacity insight screen (ADR-0024) shows who is loaded past 100%, but only
to someone who happens to open it. A resource manager wants to be *told* when a
person tips into over-allocation, not to have to go looking. The notifications
service already delivers in-app + email events with per-user preferences, so the
gap was a source that turns the derived over-allocation state into an event.

## Decision
Add an `over_allocation` **portfolio event type** (opt-in, off by default so it
isn't a firehose) and a background pass that emits it:

- **`CapacityAlerts.RunAsync`** computes the shared roster (`ResourcesData.
  RosterAsync`, the same time-phased load the insight screen uses), takes everyone
  over 100%, and emits one `over_allocation` notification per person to users who
  opted in (`Notifications.EmitPortfolioAsync`).
- **Deduplication via a Settings snapshot.** The set of currently-over names is
  persisted at `capacity.alert.snapshot`. Only people over *now* who weren't over
  at the previous pass are notified, so a persistently-overloaded person isn't
  re-pinged; someone who dips under and climbs back over is alerted again. The
  snapshot is refreshed every pass — even when nobody has opted in — so opting in
  later doesn't dump a backlog of already-known overloads.
- **`CapacityAlertService`** runs the pass on an interval (`Capacity:AlertHours`,
  default 24h) after a start-up delay, best-effort, idle-safe.
- **`POST /capacity/alerts/run`** (capability `cap-ops`, level E) triggers a pass
  on demand and returns the freshly-flagged names — for support and testing.

## Consequences
- **+** Over-allocation becomes a push signal (in-app now, email when Graph mail
  is configured), reusing the whole notifications/preferences pipeline.
- **+** No duplicate spam: the snapshot makes the pass idempotent between changes.
- **−** Alerting granularity is the pass interval (default daily) and the snapshot
  is a single global set, not per-recipient — a user who opts in mid-day sees new
  over-allocations from the next pass, not a replay.
- **−** "Over 100%" is a fixed threshold; a configurable per-department threshold
  could come later.

## Alternatives considered
- **Emit inline when an assignment/estimate changes** — would require hooking every
  allocation-mutating path and recomputing the person's full cross-project load on
  each; the periodic roster pass is simpler and already the source of truth.
- **No dedup, notify every pass** — daily spam for the same overloaded people;
  rejected in favour of the snapshot diff.


---

# ADR-0029 — Timelines derive windows from phases, sprints & tasks

**Status:** Accepted

## Context
The program and portfolio timelines only placed an item if it had **explicit
project dates**. In practice most projects are created without a typed start/
target (the window shows "TBD"), so the program timeline rendered "No phases"
for every row and the portfolio timeline showed "Nothing with dates" — even when
the project clearly had a schedule expressed as phases, sprints or dated tasks.
The project timeline likewise promised "sprints appear below" but showed nothing
when a project had no `Sprint` rows (common for board-less Jira mappings, where
sprint names live on the tasks).

## Decision
Derive a schedule from whatever the project actually has:

- **Program timeline.** Each program row now carries the project's window
  (`startMonth`/`endMonth`, from the project dates, else derived from the min/max
  month across its phases, sprints and dated tasks) plus its **sprint bars**. The
  Schedule tab renders a window bar, phase bars and sprint bars per project, so it
  reflects projects + tasks + sprints instead of an empty grid.
- **Portfolio timeline.** An undated project is placed by the month span its
  phases/sprints/tasks cover, so it appears on the roadmap instead of being
  silently dropped.
- **Project timeline.** When a project has no `Sprint` rows, the Schedule
  synthesises sprint bands from the sprint names its **tasks** carry (windowed by
  the tasks' own dates). The empty-state copy is now honest ("No phases or sprints
  scheduled yet — add a phase, or sync sprints from Jira") instead of promising
  sprints that never render.

## Consequences
- **+** Timelines are populated from the data that already exists; no one has to
  double-enter project dates to see a roadmap.
- **+** Sprints show under the project Schedule even for board-less Jira mappings.
- **−** Derived windows are month-granular and only as good as the phase/sprint/
  task dates present; a project with no dated anything still shows "No schedule
  yet" (correctly).
- **−** The program Tasks/Resources/Sprints sub-tabs remain project-scoped (an
  aggregated per-task grid across a whole program would be noise); the Schedule
  tab is the aggregate view.

## Alternatives considered
- **Require explicit project dates** — simplest, but pushes data-entry burden onto
  users and leaves timelines empty by default; rejected.
- **Aggregate every task onto the program grid** — too dense to be readable;
  sprint-level aggregation on the Schedule tab conveys the shape without the noise.


---

# ADR-0030 — Background Jira sync (no 504 on large pulls)

**Status:** Accepted — extends [ADR-0006](./0006-jira-pull-only-board-optional.md) / [ADR-0021](./0021-jira-delta-and-per-entity-sync.md)

## Context
A manual Jira sync ran **synchronously inside the request**: the endpoint pulled
every issue and only then responded. For a large project (or a portfolio-wide
"Sync now") the pull could exceed the edge/gateway timeout, so the browser saw an
**API 504** even though the sync itself was proceeding. Delta sync helps, but a
full re-sync of a big project still blows past the ~60s proxy limit.

## Decision
Manual syncs can run **in the background**:

- A singleton **`JiraSyncQueue`** (an unbounded `Channel` + a small in-memory
  status map, capped at 200 recent jobs) and a **`JiraSyncWorker`** hosted service
  that drains it one job at a time, each in its own DI scope.
- The four manual-sync endpoints (`/integrations/jira/sync`, `/projects/{id}`,
  `/programs/{id}`, `/products/{id}` `…/jira/sync`) accept **`?background=true`**:
  they enqueue a job under the caller's identity and return **202** with a
  `jobId`. Without the flag they behave exactly as before (synchronous) — so the
  existing tests and any script that wants the counts inline are unaffected.
- **`GET /integrations/jira/sync/status/{jobId}`** returns the job's live state
  (`queued`/`running`/`done`/`failed`) and roll-up counts.
- The worker writes the same kind of completion **audit event** as the
  synchronous path, attributed to the enqueuing user.
- The frontend (`src/lib/jiraSync.ts`, used by `JiraSyncButton`, the Integrations
  "Sync now", and the Project sync) always calls with `background=true` and polls
  status to completion (~90s ceiling), toasting the result — so the request that
  returns to the browser is instant and can't 504.

## Consequences
- **+** Large syncs no longer 504; the UI shows progress via polling and the
  work continues server-side even if the user navigates away.
- **+** Reuses the existing per-project sync logic (`SyncProjectsCoreAsync`) for
  both paths; the scheduled `JiraSyncService` is unchanged.
- **−** Job status is in-memory (not persisted) — a process restart loses
  in-flight job status (the audit log still records completion). Acceptable:
  jobs are short-lived progress, not records.
- **−** One worker drains jobs serially; a burst of syncs queues rather than
  running concurrently (intentional — avoids hammering Jira's rate limits).

## Alternatives considered
- **Raise the gateway timeout** — brittle and unbounded; a big enough project
  would still time out. Rejected.
- **Persist jobs in the DB** — durable status across restarts, but heavier than
  warranted for ephemeral sync progress; the audit log already captures the
  durable outcome. Revisit if job history becomes a requirement.


---

# ADR-0031 — Internal-labour costing (PM/PO lines + rate card)

**Status:** Accepted — extends the cost taxonomy (Costs) and Financials.

## Context
Financials tracked internal-labour cost for Dev, Architecture and Infra, but not
for **Project Management** or **Product Ownership**, and there was no way to turn
an *effort estimate* (days/months/hours) into a labour cost — teams did that in a
spreadsheet. Two gaps: (1) missing PM/PO cost lines editable by the people who own
that budget (PMO / PM Lead), and (2) no blended rate card to drive a calculator.

## Decision
- **PM & PO cost lines.** The standard cost taxonomy gains `laborPM`
  ("Internal labor · PM") and `laborPO` ("Internal labor · PO"), owned by
  `pmlead` (PMO/Admin edit all lines). They're system lines on every project/
  program/product, in `actual` and `forecast`.
- **Self-healing seeding.** `Costs.EnsureAsync` now backfills any *missing*
  system template line on read (keyed by line key), so owners created before
  PM/PO existed gain them automatically without disturbing existing amounts or
  custom lines — no data migration needed.
- **Rate card.** A new `/labor-rates` endpoint stores average blended cost/hour by
  **discipline** (Dev, Infra) × **seniority** (Junior, Semi-Senior, Senior,
  Specialist, Expert) in the Settings store (`rate.<discipline>.<level>`).
  `GET` is open (read); `PUT` is restricted to PMO / PM Lead / Admin.
- **Cost calculator.** My Team renders the rate card plus a calculator: pick a
  discipline + seniority and enter months/days/hours; it computes
  `hours × rate` using 1 month = 21 working days, 1 day = 8 h.

## Consequences
- **+** PM/PO labour is now first-class in Financials, editable by the right role.
- **+** A single source of truth for internal rates, reused by the calculator (and
  available to future auto-costing of task-estimate hours).
- **−** Rates are a flat blended card (no per-person or time-varying rates); a
  historical rate table could come later if finance needs it.
- **−** Calculator assumptions (21 d/month, 8 h/day) are fixed constants, not
  configurable per region/contract yet.

## Alternatives considered
- **Store rates in a dedicated table** — cleaner typing, but the Settings
  key/value store already exists and rates are a small, flat set; a table would be
  over-engineering for now.
- **Per-person cost rates** — most accurate, but needs sensitive salary data and a
  bigger data model; the blended card matches how the PMO estimates today.


---

# ADR-0032 — Reference observability stack (Grafana/Tempo/Prometheus/Loki)

**Status:** Accepted — extends [ADR-0010](./0010-observability-otel.md) (OpenTelemetry).

## Context
ADR-0010 made Atlas emit OTLP traces/metrics/logs, and the docs described a
minimal collector — but **no visualisation shipped**. Operators had to stand up
and wire a backend themselves before they could see anything, which made the
telemetry effectively invisible out of the box (the ABB-08 "dashboards not
shipped" gap).

## Decision
Ship a **runnable reference stack** as an overlay compose file
(`deploy/observability/docker-compose.observability.yml`) that runs alongside the
main stack:

```
docker compose -f docker-compose.yml \
  -f deploy/observability/docker-compose.observability.yml up --build
```

- **OTel Collector** receives OTLP from the API and fans out: traces → **Tempo**,
  metrics → a Prometheus scrape endpoint (`:8889`) → **Prometheus**, logs →
  **Loki** (native OTLP). Configs live in `deploy/observability/`.
- **Grafana** comes with datasources (Prometheus/Tempo/Loki, trace↔log
  correlation both ways) and an **Atlas API — Overview** dashboard
  pre-provisioned: request rate, 5xx ratio, latency p50/p95/p99, audited domain
  writes/min (`atlas_audit_events_total`), and live logs.
- The overlay also enables the API's exporter
  (`OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317`), so it's zero-config
  to try.

## Consequences
- **+** One command gives a full traces+metrics+logs view; the telemetry from
  ADR-0010 is finally visible without bespoke wiring.
- **+** Purely additive — an overlay file + config; the base stack, CI and the
  managed-backend paths (Azure Monitor, Grafana Cloud) are untouched.
- **−** Single-binary Tempo/Loki/Prometheus with local volumes — a **dev/demo**
  reference, not an HA production deployment. Production should point OTLP at a
  managed backend (documented) rather than self-host this.
- **−** Dashboard PromQL assumes current OTel semantic-convention metric names;
  a different exporter/version may need query tweaks (noted in the doc).
- **−** Not exercised by CI (no containers in CI); YAML/JSON are syntax-validated
  and the stack is verified by running it locally.

## Alternatives considered
- **Keep docs-only guidance** — leaves the gap; operators still do all the wiring.
- **Jaeger + Prometheus only** (no logs/Grafana) — lighter, but no single pane of
  glass and no log↔trace correlation; Grafana+LGTM is the common, portable choice.
- **Bake the backends into the main compose** — imposes the stack (and its
  resource cost) on everyone; an opt-in overlay keeps the default lean.


---

# ADR-0033 — Browser-based a11y sweep + extracted screen-logic tests

**Status:** Accepted — extends [ADR-0025](./0025-accessibility-baseline.md) / [ADR-0026](./0026-axe-automation-and-mobile-drawer.md).

## Context
ADR-0026 added an axe sweep over the shared primitives in **jsdom**, which can't
evaluate computed styles or colour-contrast and only saw isolated components, not
composed pages. Two ABB-01 gaps remained: a **browser-based full-page** WCAG sweep
and **broader per-screen tests**. Screen logic (labour-cost maths, roadmap year
grouping, Jira-sync toast mapping) was also inline in components, untestable
without rendering.

## Decision
- **Playwright + axe full-page sweep.** A new `e2e/a11y.spec.ts` (Playwright,
  `@axe-core/playwright`) builds the app, serves it with `vite preview` (no
  backend → empty states), and runs axe over key routes (`/`, `/portfolio`,
  `/gantt`, `/roadmap`, `/resources`, `/admin`) in real Chromium. It runs in a
  dedicated CI job (`Accessibility (Playwright + axe)`); locally it reuses a
  pre-installed Chromium when present.
- **Structural gate, contrast reported.** The test **fails on structural
  violations** (roles, names, labels, aria — e.g. it caught unlabelled `<select>`
  filters, now fixed) and **reports colour-contrast without gating**: the design
  tokens (ADR-0003) carry some low-contrast greys, so gating contrast today would
  block the build on pre-existing debt. Contrast findings are logged for a
  dedicated follow-up.
- **Extracted, unit-tested screen logic.** Pure helpers moved to `src/lib/`
  (`labor.ts`, `roadmap.ts`; `jiraSync.ts` already there) with vitest coverage —
  labour hours/cost maths, roadmap `yearOf`/`yearColumns`, and `syncToast`
  outcome mapping. Frontend test count rose from 45 → 59.

## Consequences
- **+** Real-browser structural a11y is now gated in CI; jsdom's blind spots
  (computed DOM, visibility) are covered for the main routes.
- **+** The unlabelled-control class of bug is caught automatically going forward.
- **+** Screen arithmetic/grouping is tested independently of React.
- **−** Colour-contrast is surfaced but not enforced yet — a token-contrast pass
  is the tracked follow-up before flipping the gate on.
- **−** The sweep covers a curated route list, not every screen or interactive
  state (open modals, populated tables); extend `ROUTES` as coverage grows.
- **−** Adds a CI job that installs Chromium (~cacheable) and ~1–2 min wall time.

_Continued: full user-journey specs were added under `e2e/journeys/` in the same
Playwright job — driving multi-step click-through flows and asserting outcomes,
which the axe sweep (single-page, no interaction) doesn't. **navigation** walks
every Workspace + Configuration link and asserts each route + header + no
error-boundary trip; **role-nav** switches the header role and asserts the
sidebar reshapes (Stakeholder ↔ full nav); **dashboard-layouts** clicks the four
layout tabs and asserts the view switches; **demands-drilldown** stubs the
`/api/v1/*` surface with `page.route()` to prove a real data → render → open-detail
flow (the one backend-dependent journey). The per-test timeout was raised to 60s
since a single axe run alone is ~24s and several heavy tabs share one preview
server._

## Alternatives considered
- **Gate colour-contrast immediately** — would fail on existing token greys and
  block unrelated work; report-first is the pragmatic ramp.
- **Render whole screens in jsdom instead** — still can't do contrast/computed
  styles and needs heavy api/query mocking per screen; a real browser is the
  correct tool for full-page a11y.
- **Keep logic inline** — leaves the maths untested; extraction is cheap and
  durable.


---

# ADR-0034 — Ops: Jira board/space sync + linked project tasks

**Status:** Accepted — extends [ADR-0014](./0014-ops-work-type.md) (Ops work type) and the Jira connector (ADR-0006/0018/0021).

## Context
Ops services could hold **manual work items** and could be **created once** from a
Jira project (import target `ops`). Two gaps: the import target wasn't offered in
the Integrations Discovery UI, a mapped service couldn't be **re-synced** as Jira
moved on, and a service had no way to reference the **real delivery tasks** that
feed it — only hand-entered items.

## Decision
- **Ops as a Discovery import target.** The Integrations "Import" modal now offers
  *"A new Ops service"* alongside project/program targets (backend already
  supported `target=ops`).
- **Per-service re-sync.** `POST /ops/services/{id}/jira/sync` re-pulls the mapped
  Jira project's issues into the service's items, idempotent by Jira key (shared
  `Jira.PullOpsItemsAsync`, extracted from the importer). A **"Sync from Jira"**
  button appears on each Jira-mapped service (background sync, per ADR-0030).
- **Linked project tasks.** A new `OpsTaskLink` (ServiceId ↔ ProjectTask.Id) lets a
  service reference existing Atlas project tasks for traceability. They render as
  read-only rows under the service alongside manual items; **allocation stays with
  the task's own project** (no double-counting into Ops). Endpoints:
  `POST /ops/services/{id}/tasks`, `DELETE /ops/services/{id}/tasks/{taskId}`; the
  board returns `linkedTasks` per service.

## Consequences
- **+** A run-the-business service can be fed by a Jira space (synced items) **and**
  linked to the delivery tasks that drive it — the "Both" model.
- **+** Reuses the existing import/sync plumbing; no new allocation semantics.
- **−** Board-vs-space: the pull is by Jira **project key** (a space); a specific
  agile board isn't scoped separately — sufficient for Ops, revisit if needed.
- **−** Linked tasks are informational; they don't add Ops allocation (deliberate,
  to avoid double-counting the task's project allocation).

## Alternatives considered
- **Re-attribute linked-task allocation to Ops** — would double-count the task's
  project load; rejected in favour of traceability-only links.
- **Only Jira-sync, no task links** (or vice-versa) — the user wanted both feeding
  paths; supporting both is the flexible choice.


---

# ADR-0035 — Azure DevOps connector (scaffold: connect · discover · map)

**Status:** Accepted — first realisation of the roadmap building block "Azure
DevOps connector (next)" in `building-blocks.md` (ABB-05 Integration). Follows
the Jira connector pattern (ADR-0006/0018/0021).

## Context
Only Jira and Microsoft Graph were implemented for ABB-05. Azure DevOps is the
next-most-requested source. A connector is a sizeable surface (auth, discovery,
work-item/board sync, repos, pipelines); shipping it all at once is risky and
delays any value. We want the credential model and the project-mapping model in
place — and independently verifiable — before building the heavier sync.

## Decision
Ship a **scaffold** that mirrors Jira's connector shape and is dormant until a
PAT is configured:

- **Config & auth.** `AzureDevOps:Organization` (bare org name or full
  `https://dev.azure.com/<org>` URL) + `AzureDevOps:Pat`. Auth is HTTP **Basic**
  with an empty username and the PAT as the password (`:PAT`) — the standard
  Azure DevOps PAT scheme, analogous to Jira Cloud's `email:api-token`. All
  empty ⇒ the connector stays off and the rest of Atlas is unaffected.
- **Endpoints** (`/api/v1/integrations/ado/*`): `status` (config only, never
  calls ADO), `test` (lists the org's projects, reports ok/error gracefully),
  `projects` (discovery — lists the org's projects, flagging those already
  mapped), and `import` (map an ADO project to a **new/existing** Atlas project
  or a new project **under a program**). Gated exactly like Jira: `status`/`test`
  need Edit on Integrations; discovery needs Edit and import needs Full on
  Projects & tasks.
- **Mapping storage.** `Project.AdoProject` holds the linked ADO project
  name; surfaced in `ProjectDetailDto`. The org is global config, so it isn't
  stored per project.
- **Frontend.** The Azure DevOps card in Integrations is wired to the real
  status/test; a **"Discover from Azure DevOps"** panel and import modal mirror
  the Jira ones (no board field, no Ops target).

## Consequences
- **+** Credentials and the mapping model are in place and covered by tests
  (`AzureDevOpsTests`), so the follow-up sync has a foundation to build on.
- **+** Reuses Jira's proven patterns (graceful not-configured, capability
  gates, discovery/import) — low conceptual overhead.
- **−** No board / work-item sync yet: importing stores the mapping but does not
  pull tasks, sprints or backlog. Called out in the UI and `docs/azure-devops-
  setup.md`.
- **−** PAT auth is per-token (no OAuth app / Entra-federated identity yet);
  acceptable for a service-account PAT, revisit if org policy forbids PATs.

## Alternatives considered
- **Build the full connector (incl. work-item sync) in one pass** — larger,
  riskier change with no intermediate, verifiable milestone; rejected in favour
  of the connect→discover→map scaffold.
- **Store the ADO mapping in a separate table** — unnecessary; a project links
  to at most one ADO project, so a column on `Project` mirrors `JiraProjectKey`.
- **Entra-federated auth instead of a PAT** — heavier setup; a scoped,
  revocable service-account PAT is the pragmatic first step (ADR can supersede).


---

# ADR-0036 — Azure DevOps work-item sync

**Status:** Accepted — extends [ADR-0035](./0035-azure-devops-connector.md) (the
connect·discover·map scaffold) and follows the Jira sync pattern
([ADR-0006](./0006-jira-pull-only-board-optional.md)).

## Context
ADR-0035 shipped the Azure DevOps connector as connect → discover → map: it
stored `Project.AdoProject` but pulled no delivery data. The mapping was laid
down precisely so this sync could read it. We now turn the scaffold into a
working second connector: ADO iterations → Atlas sprints and ADO work items →
Atlas epics / tasks / backlog.

## Decision
- **`AzureDevOps.SyncProjectAsync`** mirrors the Jira engine's contract: one-way
  (ADO → Atlas), idempotent, prune-on-full-pull. It keys on `Project.AdoProject`
  and on a new `AdoId` column added to `Sprint`, `Epic` and `ProjectTask`
  (parallel to `JiraKey`, so a project could in principle carry either source
  without collision).
- **Iterations → sprints.** `GET .../wit/classificationnodes/iterations` is
  flattened to leaf iterations (nodes carrying a start date); each is upserted as
  a `Sprint` by its `identifier`, carrying name + start/finish dates.
- **Work items.** A **WIQL** query returns the project's work-item ids
  (`WHERE [System.TeamProject] = '<project>'`, capped at 4000), then details are
  fetched in **batches of 200**. Type `Epic` → `Epic` (pass 1, so tasks can link
  by parent); all other types → `ProjectTask` (pass 2). Mapping: `System.State`
  → Atlas status via `MapAdoState` (Agile/Scrum/Basic aware), priority 1–4 →
  Critical/High/Medium/Low, `IterationPath` leaf → sprint name, `System.Parent`
  → epic name, `System.Description` HTML → text. Items with no iteration land in
  the backlog.
- **Two entry points**, both gated on Integrations (Edit): per-project
  `POST /projects/{id}/ado/sync` and all-mapped `POST /integrations/ado/sync`.
  A "Sync now" button on the Azure DevOps card runs the all-mapped pass.

## Consequences
- **+** ADO becomes a real, testable second delivery-data source reusing the
  Jira model (sprints/epics/tasks/backlog, pruning, epic rollups) — no new
  read-side code in the screens.
- **+** Idempotent by `AdoId`; re-syncs never duplicate and never touch manual
  rows. Pure mapping helpers are unit-tested; endpoints degrade gracefully when
  unconfigured/unmapped (no 500s).
- **−** **Bounded & synchronous**: WIQL capped at 4000 items (200/request), a
  `Truncated` flag signals the cap; there is no background-queue path yet (unlike
  Jira's ADR-0030). Large orgs may need that follow-up.
- **−** **No attachments/comments** and **no delta** yet (Jira has both) — the
  sync is a full pull of the current field set.
- **−** Board scoping is by **team project**, not a specific ADO team's board;
  sufficient for the portfolio view, revisit if per-team boards are needed.

## Alternatives considered
- **Reuse `JiraKey` as a generic external key** — would let Jira's prune step
  clobber ADO rows; rejected in favour of a dedicated `AdoId`.
- **Background queue from day one** (mirror ADR-0030) — deferred; a bounded
  synchronous pull is adequate for the first real sync and keeps the diff small.
- **Map ADO `Feature` to a distinct Atlas level** — Atlas has only Epic/Task, so
  Features sync as tasks; only `Epic` becomes an Atlas epic.


---

# ADR-0037 — WCAG AA contrast tokens + gated colour-contrast

**Status:** Accepted — closes the ABB-01 follow-up left open by
[ADR-0033](./0033-browser-a11y-sweep-and-logic-tests.md) (browser axe sweep with
colour-contrast reported-but-not-gated).

## Context
The Playwright + axe sweep (ADR-0033) gated structural WCAG rules but only
**reported** colour-contrast, because several design greys — lifted verbatim from
the prototype — failed WCAG AA (4.5:1) as body text: `faint #7B849A`,
`faint2 #8A92A6`, `faint3 #9AA2B4` (~2.8–3.6:1 on white), the hardcoded control
grey `#6A7488` on light chip/segment backgrounds (~3.8:1), and the sidebar group
label `sidebarLabel #5C6589` on the navy sidebar (~3.1:1). One dashboard emphasis
number used `danger #D13438` as text (4.35:1, just under).

The prototype fidelity rule ("do not invent colours") and accessibility
collide here; accessibility wins for **text** contrast, which is a legal/UX
requirement. The brand hues (primary, status fills, chart palette) are unchanged.

## Decision
- **Darken the muted text greys to the darkest values that stay visually close
  while passing AA on white *and* on the light surfaces they sit on
  (`#F1F3F8` / `#EEF1F6` / `#E4E8F1`):** `faint #7B849A→#5B657B`,
  `faint2 #8A92A6→#616A81`, `faint3 #9AA2B4→#636C83`, and the hardcoded control
  grey `#6A7488→#565F73` (24 call-sites).
- **Lighten `sidebarLabel #5C6589→#7C86AC`** — it only ever sits on the navy
  sidebar / login hero (`#11163A`), where a *lighter* grey is what raises
  contrast (now ≥4.5:1); verified it isn't used on any light surface.
- **Use `dangerInk #A1282B`** (not `danger`) for the dashboard "N projects need
  attention" emphasis text.
- **Flip the gate:** `e2e/a11y.spec.ts` now asserts **zero** WCAG 2 A/AA
  violations including `color-contrast` (previously contrast was logged only).

## Consequences
- **+** Every swept route (`/`, `/portfolio`, `/gantt`, `/roadmap`, `/resources`,
  `/admin`) is WCAG 2 AA clean in a real browser, and regressions now fail CI.
- **+** Muted text is more legible; the change is a small darkening, not a
  redesign — layout, brand and chart colours are untouched.
- **−** A deliberate, documented deviation from pixel-verbatim prototype greys
  for **text** tokens (the prototype's airy greys are decorative-contrast only).
- **−** The gate covers the six representative routes, not every screen/state;
  extend `ROUTES` as new high-traffic views land.

## Alternatives considered
- **Keep contrast reported-not-gated** — leaves a real accessibility gap and lets
  regressions slip in; rejected (the whole point of this pass).
- **Per-element overrides instead of token changes** — 24+ scattered call-sites;
  fixing the tokens is one change with consistent results.
- **Enlarge text to hit the 3:1 large-text threshold** — would break prototype
  layout fidelity far more than a few-shade darker grey.


---

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


---

# ADR-0039 — Background Azure DevOps sync

**Status:** Accepted — applies the background-sync pattern of
[ADR-0030](./0030-background-jira-sync.md) to the Azure DevOps connector
(ADR-0035/0036).

## Context
The ADO work-item sync (ADR-0036) shipped **synchronous** and bounded to 4000
work items, to avoid a request-path 504 on a large project. That cap is an
artificial product limit, and a big org can still be slow enough to time out the
edge/gateway on the request path. Jira already solved this (ADR-0030) with an
in-process queue + hosted worker + poll; ADO should match.

## Decision
- **`AdoSyncQueue` + `AdoSyncWorker`** mirror `JiraSyncQueue`/`JiraSyncWorker`: an
  unbounded `Channel` of jobs, a bounded status map for polling, and a hosted
  service that drains jobs one at a time in their own DI scope and records a
  completion audit event under the enqueuing user's identity.
- **`?background=true`** on `POST /projects/{id}/ado/sync` and
  `POST /integrations/ado/sync` enqueues a job and returns **202 + jobId**; the
  synchronous path stays the **default** (tests and small syncs unchanged).
  Job target is `"all"` (every mapped project) or a single project id.
- **Poll** `GET /integrations/ado/sync/status/{jobId}` → state + counts.
- **Cap raised & configurable.** With the pull off the request path, the low
  anti-504 cap isn't needed: `AzureDevOps:MaxWorkItems` (default **20000**,
  WIQL's own reference ceiling) replaces the hard-coded 4000; detail fetch still
  pages at 200/request.
- **Frontend** `syncAdo`/`adoSyncToast` (`lib/adoSync.ts`) drive the background
  flow from the "Sync now" button, polling to completion and falling back
  gracefully if the server ran synchronously.

## Consequences
- **+** A portfolio-wide ADO pull can't 504; parity with Jira; the connector
  reaches ★★★★★ on the async dimension.
- **+** Reuses a proven pattern; the synchronous path (and its tests) are intact.
- **−** A second near-identical queue/worker rather than one generic pipeline —
  chosen for isolation and to avoid touching the working Jira path; a future
  refactor could unify them behind a connector abstraction.
- **−** Job status is in-memory (per instance), like Jira's — fine for the
  single-node deployment; a multi-instance edge would need shared state.

## Alternatives considered
- **Generalise `JiraSyncQueue` to a connector-agnostic queue now** — more elegant
  but risks regressing the live Jira path for a cosmetic dedupe; deferred.
- **Keep it synchronous, just raise the cap** — doesn't remove the 504 risk on
  the request path; rejected.


---

# ADR-0040 — Domain metrics, tuned dashboards & alert rules

**Status:** Accepted — extends [ADR-0010](./0010-observability-otel.md) (OTel) and
[ADR-0032](./0032-observability-reference-stack.md) (reference stack).

## Context
The reference stack (ADR-0032) shipped an Atlas overview dashboard covering HTTP
RED + the one custom metric (`atlas.audit.events`). Everything else on the
dashboard would come from auto-instrumentation. The application-specific signals
an operator actually watches — connector sync health, background-queue backlog,
capacity alerts, DB latency — weren't emitted as metrics (EF timings live only in
traces), so a "tuned" dashboard had nothing app-specific to show.

## Decision
Emit real domain metrics and ship dashboards + alerts built on them.

- **New instruments** (`AtlasTelemetry`, exported on the `Atlas.Api` meter):
  - `atlas.sync.duration` (histogram, s) — per-project connector sync, tagged
    `connector` (jira|ado) + `outcome`; recorded in both sync cores.
  - `atlas.sync.queue.depth` (observable gauge) — pending background jobs per
    connector, read from the queue singletons' `Pending` count.
  - `atlas.capacity.alerts` (counter) — over-allocation alerts delivered per pass.
  - `atlas.db.command.duration` (histogram, s) — every EF Core command, via a
    `DbCommandInterceptor` (`AtlasDbMetricsInterceptor`), so DB timings exist as a
    Prometheus histogram (traces still go to Tempo).
- **Dashboard** `atlas-operations.json` (Integrations & Operations): sync-duration
  p95 by connector, sync outcomes/min, queue depth, capacity alerts/day, DB
  latency p50/p95/p99, DB rate by outcome. The existing overview keeps HTTP RED.
- **Alert rules** `alerts.yml` (wired via `rule_files`): target-down, 5xx ratio
  >5%, HTTP p95 >2s, DB p95 >1s, connector sync failures, sync-queue backlog.

## Consequences
- **+** The dashboards now reflect what Atlas actually does; regressions in sync
  health / DB latency / error rate surface and can page (attach Alertmanager).
- **+** DB timings become a first-class metric without turning on statement text
  (privacy) — the interceptor times commands only.
- **−** A per-command interceptor adds a tiny overhead on every query (a Stopwatch
  read); negligible, and the metric is a no-op when OTel isn't configured.
- **−** Alerts evaluate in Prometheus but need an Alertmanager receiver to
  actually notify — documented; not bundled to keep the reference stack minimal.

## Alternatives considered
- **Leave DB timings to traces only** — no aggregate latency SLO/alert; rejected.
- **Ship dashboards without new metrics** — panels would be empty; the point of
  "tuned" is app-specific signals, which required the instruments.


---

# ADR-0041 — Decomposing large screen files into per-tab modules

**Status:** Accepted — refines [ADR-0003](./0003-inline-styled-frontend.md)
(inline-styled screens) on the maintainability axis (ABB-01).

## Context
Two screens had grown far past a comfortable size: `Project.tsx` (~4,300 lines,
~50 sub-components across a dozen tabs) and `Resources.tsx` (~750 lines). Big
single files slow navigation, review and fast-refresh, and make ownership of a
tab unclear — the maintainability gap flagged in the application evaluation.

## Decision
Split each large screen into a folder of focused modules, **behaviour-preserving**
(no logic changes — only moves + imports):
- **`screens/project/`** — `shared.tsx` (presentational helpers: `SectionTitle`,
  `PdField`, `KV`, `Meta`, `ChipRow`, `DecLabel`), `util.ts` (non-component
  helpers: `sectionTitleS`, `fmtSize`), and one file per extracted tab
  (`Security`, `Requirements`, `Architecture`, `Quality`). `Project.tsx` imports
  them; the remaining tabs stay inline for now.
- **`screens/resources/`** — `shared.tsx` (`EmptyPanel`), `util.ts`
  (`selectStyle`), `Capacity.tsx` (capacity insight + staffing + my-allocations),
  `Availability.tsx` (availability finder). `Resources.tsx` imports them.
- **Convention**: components-only files stay `.tsx`; non-component helpers live in
  a sibling `.ts` so React fast-refresh stays clean (no mixed-export warning).

Result: `Project.tsx` ~4,300 → ~2,960 lines, `Resources.tsx` ~750 → ~420.

_Continued: the `Artifacts` and `RAID` tabs were later extracted the same way
(`project/Artifacts.tsx`, `project/Raid.tsx`), bringing `Project.tsx` to ~2,660._

_Continued (agile tabs): the `Tasks`, `Backlog`, `Sprints` and `Epics` tabs were
then extracted. Their shared plumbing was relocated first to break the cycle back
into `Project.tsx`: the `Task`/`TaskAttachment` types, board/priority constants,
`isAgileWithSprints` and the assignee/epic/sprint option hooks now live in
`project/taskModel.ts` (non-component); the shared task components (`LinkSelect`,
`SprintTaskRow`, `JiraTaskPanel`, `TaskDetailModal`, `NewTaskModal`) in
`project/TaskModals.tsx`; `useProject`/`ProjectDetail` in `project/useProject.ts`;
and the comment helpers (`CommentItem`, `fmtCommentTime`) in `project/util.ts`.
Each tab is now its own file (`project/Tasks.tsx`, `Backlog.tsx`, `Sprints.tsx`,
`Epics.tsx`). This brought `Project.tsx` to ~1,600._

## Consequences
- **+** Smaller, single-responsibility files; a tab's code (types + component +
  modals) lives together and is easy to find and own.
- **+** Establishes a repeatable extraction pattern (shared/util + per-tab file)
  the remaining Project tabs can follow incrementally.
- **−** A little more cross-file import wiring; shared helpers now have an explicit
  home rather than being co-located.
- **−** `Project.tsx` is now ~1,600. The remaining inline tabs (Overview, People,
  Governance, Decision log, Dependencies, project Blockers, Vacations, Comments)
  and their small shared models are left in place; they don't share the task
  plumbing and can follow the same pattern if the file grows again.

## Alternatives considered
- **Leave the files as-is** — the flagged maintainability cost remains; rejected.
- **Atomise everything in one pass** — larger, riskier diff on a critical screen;
  a staged extraction keeps each step verifiable (build + lint + tests + e2e).


---

# ADR-0042 — Ops: full-fidelity Jira import (epics + rich fields), work-item-status filter, bulk delete

**Status:** Accepted — extends [ADR-0034](./0034-ops-jira-sync-and-task-links.md)
(Ops Jira sync) and [ADR-0014](./0014-ops-work-type.md) (Ops work type), and mirrors
the project-task importer (ADR-0018 full-field + attachments).

## Context
Importing a Jira project into an Ops service pulled only a thin slice —
summary, type, priority, status, assignee — and **skipped epics entirely**. A
project import, by contrast, carries the full field set (description, people,
labels, components, versions, resolution, time tracking, story points, epic /
parent links) plus each issue's comment thread and attachments. Ops imports
were "loose tasks", not the faithful mirror a project import is.

Two board-usability gaps compounded this: the Ops status filter filtered by the
**service lifecycle** (Active / Paused / Retired) rather than by **work-item
status** (the Jira statuses people actually triage by), and items could only be
deleted one at a time.

## Decision
- **Full-fidelity import.** `Jira.PullOpsItemsAsync` now mirrors
  `SyncProjectAsync`: it requests the full field set and maps
  description, issue type, reporter, exact status name, resolution, labels,
  components, fix versions, parent key, epic key/name, story points, original
  estimate, logged time, due date, created/updated timestamps and a deep link
  onto new columns on `OpsItem`. Each issue's **comments and attachments** are
  pulled into new `OpsItemComment` / `OpsItemAttachment` tables (bytes in the DB,
  idempotent by Jira id — a re-import tops up new ones without duplicating),
  exactly as tasks do.
- **Epics come in as items.** Epic-type issues are no longer skipped; they import
  as `OpsItem` rows tagged `Type = "Epic"`, and child items carry `EpicKey` /
  `EpicName` (and `ParentKey`) so the relationship is visible on the board and in
  the item detail — a single-board model, not a separate epic surface.
- **Lazy detail endpoint.** The board response stays lean (rich scalar fields +
  comment/attachment **counts** as badges); `GET /ops/items/{id}` returns the full
  `OpsItemDetailDto` (item + comment thread + attachment metadata) when an item is
  opened, and `GET /ops/item-attachments/{attId}` streams a file.
- **Filter by work-item status.** The board's status dropdown now filters items by
  their Jira-derived status (Open / In progress / Blocked / Done); a service shows
  when it matches the category filter and has a matching item.
- **Bulk delete.** `POST /ops/items/bulk-delete` removes many items in one gated
  call; the board offers multi-select checkboxes and a selection action bar.

## Consequences
- **+** An Ops import is now as complete as a project import — nothing about a
  Jira issue is lost, and epics and their children are represented.
- **+** Triage matches how people think (by work status), and clearing out synced
  noise is a one-gesture operation.
- **+** Counts-on-board / detail-on-open keeps the board payload small despite the
  richer model.
- **−** `OpsItem` grew wide (mirrors `ProjectTask`); acceptable for parity, and the
  new columns default empty so the migration is safe on populated tables.
- **−** Attachment bytes live in the DB (consistent with tasks/artifacts); large
  Ops spaces inherit the same size-cap config (`Jira:MaxAttachmentBytes`).

## Alternatives considered
- **A separate epic board/entity for Ops** — heavier and off-pattern; tagging
  epics as items with a parent link reuses the existing board and matches how the
  data is triaged operationally.
- **Embed full comments/attachments in the board response** — simpler client, but
  bloats the list payload for every service; the counts-plus-detail split is the
  same trade-off the task board already makes.


---

# ADR-0043 — CTO & CIO roles + role-addressed demand notifications

**Status:** Accepted — extends the role model (ADR-0004, CLAUDE.md §7) and the
notifications service (ADR-0037-era Notifications).

## Context
Two asks: (1) add **CTO** and **CIO** as roles, visible in the header switcher —
created roles hadn't appeared there because that switcher is a hardcoded list of
UI identities, separate from the RBAC role definitions; (2) when a demand is
**created or changes status**, always notify **PMO, Chief Architect, CTO, CIO,
PM Lead**, without each person subscribing to that demand.

## Decision
- **CTO / CIO as first-class roles.** Added as header-switcher identities in
  `src/nav.ts` (distinct personas: full nav, impersonable by Platform Admin) and
  mapped in `Permissions.RoleMap` (`cto`/`cio` + Entra `CTO`/`CIO`) to the
  existing **`exec`** RoleDef, so authorization is enforced at Executive level —
  no new RoleDef or migration. Their fine identity is added to `ManagerMap`
  (`cto`/`cio`) for team roll-up and notification targeting. Enforcement stays
  server-authoritative; the switcher remains cosmetic.
- **Role-addressed notifications.** New `Notifications.EmitToRolesAsync` writes an
  in-app notification addressed to `role:<key>` for each target role, excluding
  any role the actor holds (no self-ping). The inbox (`GET /notifications`) and
  mark-read now match the caller's own key **plus** `role:<key>` for every role
  key they hold, resolved by the new `Permissions.CallerRoleKeys` (auth-off: the
  switcher identity and its mappings; auth-on: every role claim through the
  manager + coarse maps). Demand **create** and **status/approval** transitions
  fan out to `{ pmo, architect, cto, cio, pmlead }` on top of the existing
  portfolio-`created` (opt-in prefs) and per-entity subscription paths.
- **Email.** Role-addressed delivery is **in-app** (the always-available channel).
  Per-person email still flows through the existing preference/subscription path;
  true per-role email needs directory-resolved addresses (future, once group→role
  membership is populated).

## Consequences
- **+** Leadership sees every demand and its status moves without subscribing.
- **+** CTO/CIO are selectable personas and enforce as Executive — no schema
  churn.
- **+** `role:<key>` addressing is reusable for any future "notify a role" event.
- **−** In-app-only for the role fan-out until per-role email addresses exist;
  documented, and the in-app bell + per-user email prefs cover the gap.
- **−** The header switcher is still not data-driven — new personas are a small
  `nav.ts` edit by design (cosmetic layer, CLAUDE.md §7).

## Alternatives considered
- **Seed distinct CTO/CIO RoleDefs** — more matrix rows with identical Executive
  enforcement; rejected as redundant (they collapse to `exec` anyway).
- **Per-demand "notify these roles" toggle** — more UI/config; the standing
  leadership set matches the ask and needs no per-demand decision.
- **Auto-subscribe those roles to every demand** — would bloat the subscription
  table and fire the entity path; role-addressing is lighter and centralised.


---

# ADR-0044 — Azure DevOps delta (changed-since) sync

**Status:** Accepted — extends the ADO connector (ADR-0035/0036) and background
sync (ADR-0039); mirrors Jira delta (ADR-0021).

## Context
The ADO work-item sync was **full-pull only**: every run re-fetched every work
item in the mapped project via WIQL, regardless of what had changed. For a large
project that wastes API calls and lengthens each (backgrounded) run. Jira already
supported delta pulls (`LastJiraSync` watermark + `updated >= …`); ADO was the
odd connector out — and its WIQL already sorted `ORDER BY [System.ChangedDate]`,
so the ingredients were in place.

## Decision
- **Watermark.** Added `Project.LastAdoSync` (UTC ISO), the ADO analogue of
  `LastJiraSync`. Captured **before** the fetch and stamped after a successful
  pull, so items that change mid-sync are re-pulled next time (safe overlap).
- **Changed-since WIQL.** `AzureDevOps.ChangedSinceClause(delta, lastSync)` (pure,
  unit-tested) appends `AND [System.ChangedDate] >= '<watermark>'` to the work-item
  WIQL when a delta is requested and a watermark exists. The **first** delta (no
  watermark) behaves as a full pull.
- **No pruning on delta.** A delta doesn't list every item, so removing "unseen"
  rows or recomputing epic roll-ups from a partial set would wrongly delete /
  miscount unchanged rows — prune + roll-up run only on a full pull (same rule as
  Jira).
- **Wired end-to-end.** `?delta=true` on `POST /projects/{id}/ado/sync` and
  `POST /integrations/ado/sync`, threaded through `SyncProjectsCoreAsync`, the
  `AdoSyncQueue`/`AdoSyncWorker` (`AdoSyncJob.Delta`), so delta works synchronously
  **and** in the background. The Integrations screen offers an **Incremental**
  button alongside **Sync now** (full).

## Consequences
- **+** A routine re-sync pulls only changed items — fewer API calls, faster runs.
- **+** Full pull remains the default and the reconciler (prunes deletions,
  rebuilds roll-ups); delta is an explicit opt-in.
- **+** Symmetric with Jira — same watermark/no-prune semantics, easy to reason about.
- **−** Delta never prunes, so items deleted in ADO linger until the next full
  pull; run a periodic full sync to reconcile (documented).
- **−** Relies on `System.ChangedDate` accuracy; clock skew is covered by the
  before-fetch watermark capture (slight re-pull overlap, never a gap).

## Alternatives considered
- **`$expand`/revisions batch diffing** — richer but heavier; the WIQL
  changed-date filter is the same lightweight approach Jira uses.
- **Always full pull** — simplest, but the cost this ADR removes is exactly the
  motivation; kept as the default/reconciling mode instead.


---

# ADR-0045 — Per-role email for demand notifications

**Status:** Accepted — extends role-addressed notifications (ADR-0043) and the
directory group→role mapping (ADR-0030-era Teams).

## Context
Demand create / status changes already fan out **in-app** to leadership roles
(PMO, Chief Architect, CTO, CIO, PM Lead) via role-addressed notifications
(ADR-0043). Email — the channel execs actually watch — was missing for that
fan-out, because "notify a role" needs role → people → addresses, and the naïve
source (the Entra `manager` attribute) can be **overridden** by the in-app
manager mapping, so it isn't authoritative here.

## Decision
- **Resolve recipients via the IN-APP mapping.** `Notifications.ResolveRoleEmailsAsync`
  finds `EntraGroup`s whose `ManagerKey` is one of the target roles and takes their
  members' (`TeamMemberRow`) emails. The in-app group→role mapping (Admin → Teams)
  is authoritative — it wins over the raw directory manager attribute, matching how
  the app already resolves manager identity.
- **Default-on, per-person opt-out.** Everyone in a target role is emailed by
  default; a person opts out with a `NotificationPref` for that event type with
  `Email=false` (the same subscribe/unsubscribe surface users already have). In-app
  role fan-out is unchanged and always delivered.
- **CTO / CIO are mappable.** Added `cto` and `cio` to the Teams manager slots so a
  directory group can be mapped to them (the UI reads slots from the API, so it
  picks them up automatically).
- **Best-effort, degrades cleanly.** Email goes through the existing Graph
  `Mail.Send` path (ADR-config). No directory sync ⇒ no mapped members ⇒ no
  addresses ⇒ **in-app only** — nothing fabricated, nothing breaks.

## Consequences
- **+** Leadership gets demand email without anyone subscribing per-demand, using
  the mapping the org actually maintains — and any individual can still opt out.
- **+** Onboarding a person (directory sync populates `TeamMemberRow.Email`) is all
  that's needed for them to receive it; no per-recipient config.
- **+** Reuses the notification-prefs consent surface (GDPR-friendly: default-on
  but revocable, no new consent store).
- **−** Requires the directory + group→role mapping to be populated; until then the
  fan-out is in-app only (acceptable, and the honest empty-state default).
- **−** Opt-out is keyed by the person's directory `Uid`; a member without a `Uid`
  can't be individually excluded (still receives — conservative, and such rows only
  exist for hand-added manual members).

## Alternatives considered
- **Resolve from the Entra `manager` attribute** — the exact thing the user flagged
  as overridable; rejected in favour of the in-app mapping.
- **Opt-in only (email off by default)** — contradicts "keep the default role
  notifications we have today"; default-on with opt-out matches intent.
- **Per-demand recipient picker** — more UI per demand; the standing leadership set
  plus personal opt-out is simpler and matches the ask.


---

# ADR-0046 — Data-driven header role switcher

**Status:** Accepted — extends the role model (ADR-0004, ADR-0043) and CLAUDE.md §7.

## Context
The header role switcher listed a **hardcoded** set of personas (`nav.ts` ROLES).
Roles created in **Admin → Roles & Permissions** (backend `RoleDef`s) govern
access but never appeared as selectable personas — so a new role felt "invisible",
and adding one (e.g. CTO/CIO earlier) required a code edit. The switcher is a
cosmetic impersonation control (mostly for the auth-off demo and Platform-Admin
support), but the gap was a real inconsistency.

## Decision
- **Merge built-in personas with created roles.** `useRoleIdentities()` fetches the
  `/roles` matrix and appends every `RoleDef` not already represented by a built-in
  persona (dedup against persona values plus the canonical ids `team`/`exec`/
  `stkhldr`). The switcher (Topbar) and the resolved identity (RoleContext) both read
  this merged list; `usePermissions` already falls through to the raw role id, so a
  custom role gates affordances via its own matrix row.
- **A created role carries its own id.** Its switcher value is the `RoleDef` id,
  sent as `X-Atlas-Role`. `Permissions.ResolveRoleId` (auth-off) now returns the
  header as a RoleDef id when it isn't a known alias — so the selection is enforced
  by that role's matrix row. An unknown/typo id has no grants → **least privilege**,
  never full access (previously an unknown non-empty header fell through to full
  access — this also tightens that).
- **Cosmetic layer only.** Under real Entra auth the token fixes the role and only a
  Platform Admin sees the switcher; the API stays authoritative. This changes the
  demo/impersonation experience, not security.

## Consequences
- **+** A role created in Admin is immediately selectable and correctly enforced —
  no deploy, no `nav.ts` edit.
- **+** Removes the special-casing that required CTO/CIO to be hardcoded.
- **+** Tightens the auth-off fallback: unknown header → least privilege, not full.
- **−** The switcher can't show a rich demo persona (name/avatar) for a created
  role — it shows the role's name + derived initials, which is sufficient.
- **−** Relies on `/roles` loading; before it resolves, only the built-in personas
  are listed (built-ins always present, so no functional gap).

## Alternatives considered
- **Keep it hardcoded** — the status quo; rejected as the inconsistency the user
  called out.
- **Make personas fully backend-defined (drop nav.ts ROLES)** — larger change that
  would lose the rich demo identities (names/initials) the prototype relies on; the
  merge keeps both.


---

# ADR-0047 — Performance & load testing with k6

**Status:** Accepted — extends the testing strategy ([ADR-0033](./0033-browser-a11y-sweep-and-logic-tests.md)
covered a11y/e2e) on the non-functional axis (ABB-08 Observability, ABB-12 Delivery).

## Context
The application evaluation flagged the last testing gap: the automated suite
proved correctness (xUnit, vitest), accessibility and full user journeys
(Playwright), but **nothing measured performance under load**. Atlas is
read-heavy and its most-used endpoints (`/dashboard`, `/financials`, `/okrs`,
`/portfolio/gantt`, …) *derive numbers on read* across many rows, so their cost
grows with portfolio size and concurrency — exactly the kind of regression that
slips through functional tests. We wanted a repeatable baseline, not a one-off.

## Decision
Add a **k6** load-test suite under `perf/`, env-driven so the same scripts run
against a local dev API or a deployed test server:

- **`smoke.js`** — single-VU pass over every hot roll-up; strict thresholds
  (errors <1%, p95 <800ms). Deterministic, seconds-long — the CI/post-deploy gate.
- **`load.js`** — ramping-VUs realistic mix (roll-ups + project drill-in). The
  **baseline**; p95<1.5s / p99<3s. Record its numbers so regressions compare.
- **`stress.js`** — ramps to 200 VUs to find the knee; observes latency rather
  than gating it, to size infra and autoscaling.
- **`seed.js`** — generates a realistic portfolio (projects × sprints × tasks +
  demands) **through the real public API**, so roll-ups have volume without any
  backend change.
- **`lib/common.js`** — shared URL/auth config and the hot-endpoint list.

Auth: with auth off the scripts send `X-Atlas-Role` (the demo switcher); with
SSO on they send a bearer `TOKEN`. Results can stream to the reference
observability stack (`deploy/observability`) via k6's Prometheus remote-write,
charted next to the API's own OpenTelemetry metrics (ADR-0032/0040).

**Seeder ≠ seed data.** `seed.js` is a throwaway-DB load fixture, run against a
test environment; it does not violate the "empty by default / never fabricate
persistent seed data" rule (CLAUDE.md §2), which governs *application* behaviour.

## Consequences
- **+** A recorded p95/p99 baseline; latency regressions on the hot paths become
  visible and diffable instead of surfacing in production.
- **+** No backend change — the seeder and tests use the shipping API surface.
- **+** k6 lives outside the TS/eslint/build scope (it's a separate runtime), so
  it adds no weight to the frontend toolchain.
- **−** Meaningful numbers need a seeded, API-running environment, so the full
  load/stress runs are **operated against a test server**, not per-PR CI. The
  fast `smoke.js` is the CI-friendly subset; wiring it into a `workflow_dispatch`
  job (compose up → seed small → smoke) is a low-risk follow-up.
- **−** Sync endpoints are out of scope (external-API-bound); they need a mocked
  upstream to load-test.

## Alternatives considered
- **NBomber (in-process C#)** — lives beside xUnit and devs know C#, but weaker
  dashboarding and it couples perf runs to the test project. k6 aligns with the
  existing Grafana/Prometheus stack (Prometheus remote-write) — chosen.
- **A backend bulk-seed endpoint** — faster to seed, but adds a data-generating
  write endpoint (extra surface to gate off in prod). Seeding via the public API
  keeps the backend untouched — chosen.
- **Artillery** — simplest YAML authoring, but least aligned with the stack and
  weakest reporting — rejected.


---

# ADR-0048 — Web / worker process split (role-selectable container)

**Status:** Accepted — refines the runtime topology (ABB-06 Async, ABB-12 Delivery)
established by [ADR-0001](./0001-modular-monolith-minimal-api.md) (modular monolith) and the
background-sync ADRs [0007](./0007-in-process-background-workers.md) / [0030](./0030-background-jira-sync.md) / [0039](./0039-ado-background-sync.md).

## Context
The API process hosted both the request-serving endpoints **and** every
background service in-process: the timer-driven recurring jobs (scheduled Jira
sync, daily retention, periodic capacity alerts) and the on-demand sync queues.
A portfolio-wide scheduled sync or retention pass therefore competes with user
requests for CPU and threads on the same process — the resource-contention risk
called out when weighing whether Atlas should run in more containers.

We deliberately **did not** break the monolith into microservices: the hot
endpoints derive numbers on read by joining across domains in a single process /
transaction, so splitting domains into services would add network hops,
distributed consistency and operational burden with no benefit at this scale.
The one justified split is **request-serving vs. recurring background work**.

## Decision
Introduce a process **role** selected by `Atlas:Role` (env `Atlas__Role`):

- **`all`** *(default)* — one process runs everything, exactly as before. Single
  `docker compose up` and every existing test/deployment is unchanged.
- **`web`** — serves the API (and the **on-demand** sync consumers, whose queue
  is in-process, so they must live with the endpoints that enqueue into them);
  owns database migrations + reference-data seed.
- **`worker`** — runs only the **timer-driven** recurring services
  (`JiraSyncService`, `RetentionHostedService`, `CapacityAlertService`); maps no
  API surface, only the `/health` + `/readyz` probes for orchestrators.

`docker-compose.yml` now ships `api` (role=web) + a `worker` service (role=worker)
built from the same image, sharing one environment anchor. The worker
`depends_on` the api so the schema exists before its first tick.

## Consequences
- **+** A heavy scheduled sync / retention / capacity scan runs in its own
  container and can't starve user requests; worker and web scale, restart and get
  resource limits independently.
- **+** Zero behaviour change by default (`all`); no new infrastructure, no
  database migration, no queue rewrite — the in-memory queues are untouched, so
  their unit tests and the synchronous sync path are unaffected.
- **+** Same image for both roles → one build, one artifact to promote.
- **−** The **on-demand** sync consumers (`JiraSyncWorker`/`AdoSyncWorker`) still
  run in the web role: their handoff is an in-process `Channel`, so they can't
  move to another container without a **durable queue**. That is the deferred
  follow-up (a DB-backed job/status table so enqueue-in-web / consume-in-worker
  works across processes, replacing the in-memory `Channel` + status dictionary
  that the UI polls). Until then, on-demand syncs are bounded/user-paced and
  return 202 immediately, so co-locating them is acceptable.
- **−** Only the web/all role runs migrations, so a pure worker deployment
  requires the web (or a migration job) to initialise the schema first.

## Alternatives considered
- **Microservices per domain** — rejected: cross-domain read roll-ups become
  distributed joins; consistency + ops cost with no scale justification.
- **Split the on-demand queues now too** — needs the durable-queue migration and
  a queue-semantics rewrite (higher risk); staged as the follow-up above.
- **A separate worker entrypoint/project** — more build/deploy surface than a
  single image that branches on one env var; rejected for the role switch.


---

# ADR-0049 — Compliance framework coverage & Zero-Trust posture

**Status:** Accepted — extends the governance module (ABB-10) and the deterministic
risk engine (`Risks.cs`).

## Context
The security/compliance module mapped controls to GDPR, ISO 27001, PCI-DSS, SOC 2,
NIS2, EU AI Act and the retail sustainability regulations, and the deterministic
risk engine cited standards per finding. A framework review surfaced gaps:

- **NIST** was entirely absent; **ISO 42001** was cited by a risk rule but not even
  selectable as a control framework (an inconsistency).
- **MITRE ATT&CK** produced a single generic advisory, not named technique classes.
- **Zero Trust** had no articulated posture, though the primitives exist.
- New frameworks needed a bespoke engine rule each — no generic coverage.

## Decision
1. **Framework catalogue** — add **NIST CSF 2.0** and **ISO 42001** to the control
   framework options (fixing the ISO 42001 inconsistency); add render tints for
   NIST CSF, SOC 2, NIS2 and EU AI Act findings.
2. **Generic coverage rule** (`Risks.cs`) — for *every* framework a project logs
   controls under, deterministically score implementation (`impl/total`) and raise
   a finding when a gap exists, skipping any framework a specific rule already
   reported and any fully-implemented one. NIST CSF, SOC 2, NIS2 and ISO 42001 now
   get findings from real control data with **no per-framework code**.
3. **MITRE ATT&CK** — the threat-model finding now names tactic/technique classes
   keyed off the architecture change type (e.g. payment → *Credential Access
   T1552*; cloud-platform → *Initial Access T1190, Valid Accounts T1078*).
4. **Zero-Trust posture** — documented here (below): a mapping of Atlas's existing
   controls to the ZT tenets, honest about what is app-level vs. infrastructure.

Everything stays deterministic (no LLM) and needs **no schema change** — controls
carry a free-text `Framework`, so new frameworks are data, not migrations. First-
class *scoping* of NIST/ISO 42001 (profile checkboxes) and AI-Act risk-tiering are
deferred to a follow-up that adds the `SecurityProfile` fields (ADR-0050, planned).

### Zero-Trust posture mapping
| ZT tenet | Atlas today | Gap (infrastructure / follow-up) |
|----------|-------------|----------------------------------|
| **Verify explicitly** | Entra ID OIDC/MSAL sign-in; API validates JWT (audience/issuer); token-driven identity | Device / session-risk conditional-access signals (Entra CA policy) |
| **Least-privilege access** | Server-authoritative RBAC capability matrix; 6 canonical roles; least-privilege DB role; UI checks cosmetic-only | Just-in-time elevation; per-record ABAC |
| **Assume breach** | Security headers/CSP, rate limiting, upload limits, correlation IDs, audit log, idle-logout, retention/anonymisation | Network micro-segmentation, egress control, mTLS between tiers (host/k8s concern) |
| **Continuous monitoring** | OpenTelemetry traces/metrics/logs, health/readiness, domain metrics + alerts | SIEM export, anomaly detection |

The identity/authorisation and observability tenets are met at the app layer; the
network-segmentation half is an infrastructure concern deferred until a hosting
target is chosen (see the deferred k8s/Helm work).

## Consequences
- **+** NIST CSF and ISO 42001 are trackable; SOC 2 / NIS2 / ISO 42001 now yield
  deterministic coverage findings; MITRE findings are specific and actionable.
- **+** Any future framework maps by adding a catalogue label — the generic rule
  scores it automatically.
- **+** A stated Zero-Trust posture with an honest gap list.
- **−** Coverage is control-presence-driven for frameworks without a profile flag:
  a framework in scope with *zero* controls logged raises nothing yet. First-class
  scoping (flags) + AI-Act risk-tiering follow in ADR-0050.

## Alternatives considered
- **A bespoke rule per framework** — doesn't scale; the generic coverage rule
  covers all current and future frameworks. Rejected.
- **Add profile flags now (schema)** — larger, migration-bearing change; separated
  into the AI-governance follow-up so this stays no-migration. Deferred.


---

# ADR-0050 — EU AI Act risk-tiering & ISO 42001 AI management

**Status:** Accepted — the schema follow-up promised by [ADR-0049](./0049-compliance-coverage-and-zero-trust.md)
(compliance coverage). Extends the deterministic risk engine (ABB-10) with
AI-specific governance.

## Context
ADR-0049 added ISO 42001 and NIST to the control catalogue and a generic coverage
rule, but AI governance was still shallow: the EU AI Act was a single boolean
`AiAct` flag with one advisory rule, and there was no way to record a system's
**risk tier** or its Art. 14 / Art. 50 measures — the fields the Act's obligations
actually key off. The AI Act is in force and Birgma is an EU entity, so this is
the highest-value compliance gap.

## Decision
Add first-class AI-Act classification to the per-project `SecurityProfile`
(one migration, `AiActClassification`):

- `AiRiskTier` — `""` (unclassified) | `minimal` | `limited` | `high` | `prohibited`
- `AiAnnexIii` — Annex III high-risk use case (implies the high tier)
- `AiHumanOversight` — Art. 14 human oversight in place
- `AiTransparency` — Art. 50/13 users informed they interact with AI
- `AiSystemName` — the AI system/model in scope (a light ISO 42001 AIMS inventory)

The deterministic risk engine (`Risks.cs`) derives obligations from the tier — no
LLM, reproducible:

| Tier | Findings |
|------|----------|
| `prohibited` | **High** — Art. 5 prohibited practice |
| `high` / Annex III | **High** if no human oversight (Art. 14); **Medium** if no ISO 42001 control Implemented (Art. 9 risk mgmt + Art. 10 data governance) |
| `limited` | **Low** if no transparency measure (Art. 50) |
| in scope but unclassified | **Medium** — classify it (Art. 6) |

The Security tab gains an **AI system classification** card (shown when AI is in
scope) with the tier selector, system name, and the oversight/transparency/Annex-III
toggles, plus a per-tier obligation headline.

## Consequences
- **+** EU AI Act obligations are tracked and deterministically scored per project;
  ISO 42001 AIMS has a concrete home (system name + oversight + controls).
- **+** Reuses the existing profile/PATCH/audit machinery and the risk report —
  the new findings render with the framework tints from ADR-0049.
- **+** One additive migration (five nullable-with-default columns); safe on
  existing rows (default: unclassified, no oversight recorded).
- **−** Classification is self-declared by the governance owner (as with the other
  compliance flags); the engine scores what's declared, it doesn't infer the tier.
- **−** A full AIMS (model cards, dataset lineage, post-market monitoring) is still
  future work; this covers classification + core obligations.

## Alternatives considered
- **A separate `AiSystem` inventory table** — richer, but heavier for the current
  need; profile fields cover per-project classification with no new aggregate.
  Revisit if multiple AI systems per project must be tracked independently.
- **Leave it as the single `AiAct` flag** — fails to capture the tier the Act's
  obligations depend on; rejected.


---

# ADR-0051 — Automated application-security scanning (SAST / SCA / DAST)

**Status:** Accepted — hardening axis (ABB-09 Security, ABB-12 Delivery). Extends
the CI supply-chain gates (ADR-0008, `npm audit` + `dotnet list --vulnerable`).

## Context
The evaluation flagged "no pen-test performed" as the standing Security gap. A
full penetration test is an authorised external engagement we can't run in-repo —
but the **automated** portion of it (the bulk of the OWASP Top 10) can be, and
should gate on every change rather than be a point-in-time exercise. We already
had SCA (dependency CVEs) but no SAST (source analysis) or DAST (probing a running
app).

## Decision
Add a `security-scan.yml` workflow with three scanners, split by how they see the
system:

- **SAST — Semgrep** (`p/security-audit`, `p/owasp-top-ten`, `p/secrets`; OSS
  rules): reads the C#/TypeScript source for injection, authz, crypto and
  hardcoded-secret patterns. "Inside" view.
- **SCA · secrets · IaC — Trivy** (`fs` scan): dependency CVEs (complements the
  existing audit gates), committed secrets, and Dockerfile/compose misconfig.
- **DAST — OWASP ZAP baseline**: probes a *running* deployment from the outside
  (passive + safe-active). "Outside" view.

**Rollout mode.** SAST + Trivy run **report-only** (findings printed, build not
failed) so the scanners land without blocking on the current baseline; the knobs
to gate are in place (`exit-code`, drop the `|| true`) and flipped once the
baseline is triaged. **ZAP is dispatch-only** with a `zap_target` input: DAST
needs a live target, so it's pointed at a running **test environment** (never
production) — the same "run against a test server" model as the k6 perf suite
(ADR-0047), avoiding brittle in-CI stack orchestration.

**CodeQL.** GitHub-native CodeQL (also SAST) is complementary and enabled via the
repo's *Code scanning → Default setup* toggle (a settings action, not code) to
avoid the default-vs-advanced-workflow conflict; Semgrep here is the
code-defined, portable SAST.

## Consequences
- **+** The automated half of a pen-test now runs on every push/PR + weekly, and
  on demand against a test deployment — catching most OWASP-Top-10 classes
  continuously instead of once.
- **+** Report-only introduction means no sudden red build on existing debt; the
  team triages, then flips to gating.
- **+** No new infrastructure; portable (Semgrep/Trivy CLIs, ZAP action).
- **−** Report-only until flipped, so findings are advisory for now — tracked as
  the "flip to gating after triage" follow-up.
- **−** A human penetration test / red-team is still out of scope for CI; this
  reduces, not removes, the need for an external engagement (a scoping doc +
  remediation register is the remaining Security follow-up).

## Alternatives considered
- **CodeQL as the primary SAST in this workflow** — best GitHub integration, but
  an advanced CodeQL workflow conflicts with the one-click default setup and
  needs GHAS config; kept as the settings-toggle option, Semgrep as the portable
  code-defined scanner.
- **Stand the full stack up in CI for ZAP** — real API DAST, but fiddly container
  networking and flaky; the dispatch-against-test-env model is reliable and how
  DAST is run in practice.
- **Gate immediately** — would red-build on the existing baseline; report-first
  is the standard, lower-friction rollout.


---

# ADR-0052 — Release pipeline: versioned images to GHCR

**Status:** Accepted — delivery axis (ABB-12). Complements CI (ADR-0008) and the
image scanning of ADR-0051.

## Context
CI validated every change (lint/test/build, API build/test, a11y, audit + AppSec
scans) but there was **no release step**: images were only ever built ad-hoc via
`docker compose build`, with no versioned, published artifact to promote to an
environment. The evaluation flagged "no automated deploy/release pipeline".

## Decision
Add a tag-triggered `release.yml` workflow that builds and publishes the two
runtime images to the **GitHub Container Registry (GHCR)**:

- Triggers on a semver tag (`v*.*.*`) — or `workflow_dispatch` with a test tag.
- Matrix builds **`api`** (`server/Dockerfile`) and **`web`** (root `Dockerfile`,
  with the public `VITE_*` build args) via Buildx, with GHA layer caching.
- `docker/metadata-action` derives tags: full version, `major.minor`, and
  `latest` (on a real tag push). Image names are
  `ghcr.io/<owner>/atlasppm-{api,web}` (lower-cased by the action).
- Authenticates with the built-in `GITHUB_TOKEN` (`packages: write`) — **no
  external secrets**, works out of the box.
- Runs a **Trivy image scan** (report-only, ADR-0051) on the built image before
  it's relied on.

**Deploy is intentionally out of scope.** Actually rolling the image onto a host
(k8s/Helm, App Service, etc.) is deferred until a target is chosen — the parked
k8s work. This ADR covers the **build-and-publish** half; the images it produces
are what a future deploy step (or a manual `docker pull` / compose `image:`
override) consumes.

## Consequences
- **+** Every tagged release yields immutable, versioned, scanned images ready to
  promote — reproducible and traceable to a commit.
- **+** Zero new infrastructure or secrets (GHCR + `GITHUB_TOKEN`); GHA cache
  keeps rebuilds fast.
- **+** The web image bakes only public `VITE_*` config; an SSO-enabled image is
  a build-arg override, not a code change.
- **−** No automated deploy yet (host-dependent) — the remaining CD gap, parked by
  design.
- **−** The workflow can only be verified end-to-end by pushing a tag /
  dispatching it (it doesn't run on PRs); the build itself is the same multi-stage
  Dockerfile CI already exercises via compose.

## Alternatives considered
- **Docker Hub / another registry** — GHCR needs no extra account or secret and
  is co-located with the repo; chosen.
- **Publish on every push to main** — noisy and unversioned; semver tags give
  deliberate, named releases.
- **Bundle deploy here** — premature without a chosen host; separated so this
  lands cleanly now.


---

# ADR-0053 — AppSec baseline triage & gating

**Status:** Accepted — completes the rollout begun in [ADR-0051](./0051-automated-appsec-scanning.md)
(automated SAST/SCA/DAST, report-only).

## Context
ADR-0051 landed Semgrep (SAST) and Trivy (SCA/secrets/IaC) in **report-only**
mode so they wouldn't red-build on the existing baseline before it was triaged.
The first run flagged **Trivy: 1** (a Dockerfile finding, both images) and
**Semgrep: 28**. This ADR records the triage and flips both scanners to
**gating**.

## Decision
Triage each finding as **fix**, **accept (scoped, documented)**, or
**out-of-scope**, leave a clean baseline, then gate.

**Fixed (real):**
- **API image runs non-root** — `server/Dockerfile` adds `USER 1654` (the .NET 8
  `app` user; literal UID so static scanners confirm non-root). Clears Trivy
  DS-0002 and Semgrep `missing-user-entrypoint` for the API image.
- **Dependabot cooldown** — a 7-day `cooldown` on all three ecosystems so a
  freshly-published (possibly compromised/yanked) version isn't adopted
  immediately. Clears `dependabot-missing-cooldown`.

**Accepted — scoped, documented exceptions:**
- **nginx edge runs as root** (Trivy DS-0002 + Semgrep `missing-user` on the web
  `Dockerfile`) — the master must bind privileged 80/443 and read certs; workers
  drop to the `nginx` user. `AVD-DS-0002` in `.trivyignore` + Semgrep
  `--exclude-rule`; the API image is non-root (USER 1654) so this applies only to
  the nginx edge. Unprivileged-nginx (8080/8443) tracked as a follow-up.
- **`mutable-action-tag`** — actions are pinned to major versions and kept current
  by Dependabot's `github-actions` ecosystem; SHA-pinning is deferred.
- **`gha-curl-pipe-shell`** — the official Trivy installer over TLS from the
  vendor repo.
- **nginx `request-host-used` / `dynamic-proxy-host` / `missing-internal`** —
  standard same-origin reverse proxy; the `proxy_pass` upstream is an internal
  config value (a Docker-DNS resolver workaround), not attacker-controlled input.

**Out of scope:**
- `design/` is excluded via `.semgrepignore` — the approved prototype reference
  (CLAUDE.md §2), never bundled or served, so its demo helpers (e.g. a
  `postMessage` to `"*"`) aren't application AppSec.

Then: Semgrep runs with `--error` (minus the `--exclude-rule` list) and Trivy
with `--exit-code 1`. A new HIGH/CRITICAL finding now **fails the build**.

## Consequences
- **+** SAST + SCA/secret/IaC now **gate** — a regression blocks the PR rather
  than scrolling past in a log.
- **+** Two real hardenings shipped (non-root API image, Dependabot cooldown).
- **+** Every suppression is scoped and documented (security-hardening.md §6), so
  the exceptions are auditable, not blanket-disabled scanners.
- **−** Accepted exceptions mean those specific classes won't re-flag globally
  (e.g. a new unpinned action) — the trade recorded above; revisit if the policy
  changes (e.g. adopt SHA-pinning + unprivileged-nginx).
- **−** DAST (ZAP) stays dispatch-only and non-gating (needs a live target); a
  human pen-test remains a separate engagement.

## Alternatives considered
- **Stay report-only** — leaves the scanners advisory; defeats the point once the
  baseline is clean. Rejected.
- **Fix everything (SHA-pin all actions, unprivileged-nginx)** — higher churn and
  edge-destabilising for marginal gain now; captured as follow-ups instead.
- **Blanket-disable noisy rules** — opaque; scoped per-rule/per-path exceptions
  with rationale keep the gate meaningful.


---

# ADR-0054 — On-prem single-node Docker as the delivery target

**Status:** Accepted — fixes the delivery target for ABB-12 (Delivery & Runtime),
building on [ADR-0008](./0008-docker-compose-nginx-edge.md) (Docker + compose +
nginx edge), [ADR-0048](./0048-web-worker-process-split.md) (web/worker split) and
[ADR-0052](./0052-release-pipeline-ghcr.md) (GHCR release pipeline). Supersedes the
open "no k8s manifests yet / deploy-to-host parked" gap in the evaluation.

## Context
The build-and-publish half of delivery is done: `release.yml` publishes versioned
`api` + `web` images to GHCR on a semver tag (ADR-0052), and `docker-compose.yml`
runs the whole stack (`db` + `api`[role=web] + `worker`[role=worker] + `web` nginx
edge). What was left open was the **deploy-to-host** target: the evaluation carried
a standing gap "single-node compose; no k8s manifests yet," treating the absence of
Kubernetes as a shortfall.

That framing was wrong for Birgma/Biltema's context. Atlas serves a portfolio-
management workload — an internal user population, read-heavy roll-ups derived in a
single process, not an internet-scale multi-tenant service. The operational reality
is an on-prem **Linux VM or Windows Server with Docker** (the two hosts the in-app
Help centre already documents), kept **off the public internet** (the same
constraint that keeps the app from ever calling GitHub). Kubernetes would add a
control plane, an ingress controller, cluster upgrades and a team's worth of
operational surface to run a handful of containers on one node — cost with no
matching scale or availability requirement.

## Decision
Adopt **on-prem single-node Docker (`docker compose`)** as the **supported
delivery target**, not a placeholder for a future orchestrator:

- **One host, four services.** `db` (Postgres 16 + named volume `atlas_db`), `api`
  (role=web, owns migrations/seed, serves `/api/v1` via `expose:8080`), `worker`
  (role=worker, recurring jobs, no HTTP surface), `web` (nginx edge terminating
  TLS on 443/80, same-origin `/api` → api). The single-container fallback (`api`
  role=`all`, drop `worker`) stays supported for the smallest installs.
- **Images from GHCR.** Production hosts pull the tagged `api`/`web` images built
  by `release.yml` rather than building on the host; compose `build:` stays for
  dev. The image is promoted, not rebuilt per environment.
- **Config & secrets by injection.** Environment / Docker secrets
  (`docker-compose.secrets.yml`), never in VCS — DB creds, Entra, Jira/ADO, OTLP.
- **No GitHub↔app path at runtime.** CI (scanners, release build) runs in GitHub;
  the deployed app pulls images and talks only to its DB, the directory/issue
  trackers it's configured for, and its OTLP collector.
- **Upgrades** are a pull-and-recreate: `docker compose pull && docker compose up -d`
  (api applies EF migrations on startup, health-gated by `/readyz`).

## Consequences
- **+** The delivery story is now *complete and matched to the infrastructure* —
  build (CI) → publish (GHCR, ADR-0052) → run (this ADR) — rather than carrying a
  perpetual "k8s TODO." The Delivery dimension moves to fully-realised.
- **+** Minimal operational surface: one host, `docker compose`, named-volume
  backups (BitLocker/at-rest per `security-hardening.md §3`), the unpublished DB
  port keeping Postgres host-internal (§5). Operators already have the Help guides.
- **+** No cloud lock-in; runs air-gapped. The web/worker split still gives
  independent restart/resource limits within the node.
- **−** Single node = no built-in HA/rolling-deploy; an upgrade has a brief
  recreate window. Acceptable for an internal PPM tool with a maintenance window;
  documented rather than engineered around.
- **−** Vertical scaling only. Fine at portfolio scale (read roll-ups are single-
  process joins by design, ADR-0001/0048); revisit only if the user population or
  data volume outgrows one host.

## Alternatives considered
- **Kubernetes + Helm** — rejected *for now*: a control plane, ingress, and cluster
  ops to run ~4 containers on one node; no scale/HA requirement justifies it. If a
  future multi-node/HA need appears, the images and 12-factor config already suit
  k8s — the manifests become a thin add-on, not a rewrite. Parked deliberately, not
  by omission.
- **Managed PaaS (Azure App Service / Container Apps)** — rejected: the deployment
  must stay on-prem and off the public internet; a managed cloud runtime conflicts
  with that constraint. (Azure Database for PostgreSQL remains a documented option
  if they ever move the DB, per `security-hardening.md`.)
- **Bare-metal / systemd (no containers)** — rejected: loses the reproducible image,
  the web/worker isolation, and the promote-the-artifact model already in place.


---

# ADR-0055 — Need-to-know internal-labour rate card

**Status:** Accepted — refines the internal-labour costing of
[ADR-0031](./0031-internal-labour-costing.md) and reuses the per-project cost-line
owner model in `Costs.cs`.

## Context
The internal-labour rate card (My Team → blended €/hour by discipline and
seniority) originally exposed two disciplines (Dev, Infra) to every viewer, with
editing limited to PMO / PM Lead / Admin. Internal cost rates are commercially
sensitive: a discipline's blended rate should only be seen by the manager who
owns that discipline (and senior leadership), not by every persona that can open
My Team. The card was also missing the **Architect**, **PM** and **PO**
disciplines that already exist as per-project cost lines in `Costs.cs`.

## Decision
Make each discipline's rate **need-to-know** — both **visible and editable** only
by the UI identities that own it, mirroring the cost-line owners in `Costs.cs`,
plus CTO/CIO who see every rate:

| Discipline | May view **and** edit |
|-----------|------------------------|
| Dev       | Global Engineering Manager, Developers Manager, CTO, CIO |
| Infra     | Infrastructure Manager, Global Service Manager, CTO, CIO |
| Architect | Chief Architect, CTO, CIO |
| PM        | PMO, PM Lead, CTO, CIO |
| PO        | PMO, PM Lead, CTO, CIO |

- The API (`/labor-rates`) resolves the caller's effective UI role and returns
  **only the disciplines that role may see** — the wire response never carries a
  rate the caller isn't entitled to. `canEdit` is true whenever the caller owns
  at least one discipline (seeing ⇒ editing), and `PUT` silently ignores any rate
  key for a discipline the caller doesn't own.
- A persona that owns no discipline (e.g. a plain PM, Team Member, Stakeholder)
  gets an empty list and a "rates are restricted" state in the card.
- The header personas are cosmetic (CLAUDE.md §7), so this is not a security
  boundary — but the server-side filtering **is** authoritative for what leaves
  the API, so the client cannot render a hidden rate by tampering with the view.

## Consequences
- **+** Commercially sensitive rates follow least-privilege; each manager sees
  only their own discipline, leadership (CTO/CIO) sees all.
- **+** Architect / PM / PO rates are now first-class in the card, consistent with
  the project cost lines.
- **+** No schema change — rates stay in the Settings store under
  `rate.<discipline>.<level>`; new disciplines are just new keys.
- **−** With auth on, the fine-grained (9-persona) distinction isn't one of the 6
  canonical backend roles, so true enforcement still rests on the resolved UI
  role; acceptable because the rate card is an internal management view, not a
  hard authorization surface, and no rate the caller can't see is ever sent.

## Alternatives considered
- **Client-side hide only** — rejected: the rates would still be on the wire and
  visible in dev tools; filtering server-side is strictly better.
- **Admin-sees-all override** — rejected per the product owner's explicit lists;
  administration of rates is by the owning managers + CTO/CIO, not the platform
  admin.


---

# ADR-0056 — Per-profile dark mode via CSS variables

**Status:** Accepted — extends the design-token system (`src/theme.ts`, ADR-0003)
without introducing a CSS framework or global stylesheet (CLAUDE.md §3).

## Context
The app is styled entirely with inline styles that read hex values from the
`color.*` tokens in `theme.ts`, imported statically by ~67 files. A dark mode
therefore can't be a static import swap. Two forces constrain the approach:

1. **No global stylesheet / CSS framework** is allowed (CLAUDE.md §3), and a
   67-file refactor to thread a palette through React context would be invasive
   and error-prone.
2. The preference must be **per profile** (per the cosmetic header identity) and
   **persist per profile selection** — switching persona restores that persona's
   light/dark choice.

## Decision
Drive the palette through **CSS custom properties** and persist the choice per
profile:

- Each `color.*` token is now a `var(--atlas-<key>, <light-hex>)` reference (the
  light hex — the value the a11y contrast gate was tuned against, ADR-0037 —
  stays embedded as the fallback). Because every screen applies colours through
  the React `style` prop (element.style → CSSOM, where `var()` resolves), the
  whole app re-skins with **no per-component change**.
- `applyThemeVars(mode)` writes the active palette's variables onto
  `document.documentElement` and sets `color-scheme` + `data-theme`. A
  `ThemeProvider` (inside `RoleProvider`) calls it on mount and whenever the
  selected profile's mode changes.
- The mode is stored in `localStorage` keyed by role (`atlas.theme.<role>`), so
  each identity keeps its own choice. A sun/moon toggle sits in the top bar next
  to the role switcher.
- **SVG exception:** `var()` does **not** substitute in SVG *presentation
  attributes* (`fill=`, `stroke=`, `stopColor=`). The handful of chart/icon
  elements that set colours that way now apply them via the `style` prop instead
  (where var() resolves), and the sparkline gradient id — previously derived from
  a hex — is sanitised so a `var(--…)` token can't produce an invalid id.
  `chart.*` stays literal hex (its vivid status hues read on either background),
  so charts need no palette variables.

## Consequences
- **+** Full dark theme with a one-line palette flip; no framework, no global
  stylesheet, no 67-file churn. The light palette (and its gated contrast) is
  byte-for-byte unchanged.
- **+** Per-profile persistence falls out of keying on the existing role
  identity; no backend, no schema.
- **+** Exports (PPTX/HTML in `Reports.tsx`) already use literal hex, so
  documents are unaffected by the theme.
- **−** Dark palette contrast isn't gated by the CI axe sweep (it runs light);
  the dark values were chosen for ≥ AA on the dark surfaces by construction. A
  dark-mode axe pass can be added if the sweep is parameterised.
- **−** One conflated token (`navy`, used as both heading text and a dark
  background) had its ~3 background usages repointed to `sidebarBg` so `navy`
  could flip to a light text colour cleanly.

## Alternatives considered
- **ThemeContext palette threaded through props/context** — rejected: touches all
  67 consumers; large diff and regression surface for no gain over CSS variables.
- **A global `[data-theme]` stylesheet** — rejected: violates the inline-styles /
  no-global-CSS rule; CSS variables achieve the same with only `:root` mutated.
- **Per-user (not per-profile) preference** — the header identities are cosmetic;
  keying per identity matches how the rest of the UI treats them and satisfies
  the "persist per profile" requirement.


---

# ADR-0057 — Region-scoped labour rate lines + regional manager roles

**Status:** Accepted — extends the need-to-know rate card of
[ADR-0055](./0055-need-to-know-labour-rates.md).

## Context
The need-to-know rate card (ADR-0055) had one line per discipline
(Dev/Infra/Architect/PM/PO). Birgma/Biltema set internal rates **per region**, and
the regional managers must see only their own region's rate — with senior
leadership (CTO/CIO) seeing all. Three regional manager personas were also
missing from the identity switcher.

## Decision
Make each rate line **discipline × region**, and add three regional manager
identities.

**13 region rate lines** (ids kept dot-free so the `rate.<line>.<level>` Settings
key still splits cleanly), each visible **and** editable only by its owners:

| Region line | Owners (view + edit) |
|-------------|----------------------|
| `infraSweden` | Infrastructure Mgr, Global Service Mgr, CTO, CIO |
| `infraApac` | Infrastructure Mgr APAC, Global Service Mgr, CTO, CIO |
| `infraCh` | Global Service Mgr, CTO, CIO |
| `devSweden` | Global Engineering Mgr, Developers Mgr, CTO, CIO |
| `devApac` | Global Engineering Mgr, Dev APAC Mgr, CTO, CIO |
| `devBlog` | Global Engineering Mgr, BLOG IT Manager, CTO, CIO |
| `devCh` | Global Engineering Mgr, CTO, CIO |
| `architectSweden` / `architectCh` | Chief Architect, CTO, CIO |
| `pmSweden` | PMO, PM Lead, CTO, CIO |
| `pmCh` | PMO, CTO, CIO |
| `poSweden` | PMO, PM Lead, CTO, CIO |
| `poCh` | PMO, CTO, CIO |

**Three new identities** (`nav.ts` `ROLES`), each **cloning its base role's RBAC
capabilities** and differing *only* in labour-rate visibility:

- **Infrastructure Manager APAC** (`inframgr_apac`) — clone of Infrastructure Manager.
- **Dev APAC Manager** (`devapac`) — clone of Developers Manager.
- **BLOG IT Manager** (`blogit`) — clone of Developers Manager.

They collapse onto the same canonical `team` RoleDef as their base in
`Permissions.RoleMap` (and the frontend `UI_TO_ROLE`), so capabilities are
identical; their `ManagerMap` slot mirrors the base so team roll-up is unchanged.
The only behavioural difference is which region line they own in
`LaborRates.Access`.

`LaborRates` still filters server-side: `GET /labor-rates` returns only the region
lines the caller's effective UI role may see; `PUT` scopes writes to owned lines.

## Consequences
- **+** Rates are region-precise and least-privilege: a regional manager sees one
  line, the service/engineering leads see their discipline's regions, CTO/CIO see
  everything.
- **+** No schema change — region lines are just new `rate.<line>.<level>` keys;
  the old per-discipline keys become inert (empty by default).
- **+** New identities reuse the existing role machinery (RoleMap/ManagerMap/
  UI_TO_ROLE) — no new capability rows, no migration.
- **−** More lines to populate; empty is the correct default until leadership
  enters values.
- **−** The three regional personas differ from their base only by rate scope, so
  their broader capabilities are intentionally identical (not a finer authz split);
  the header identity remains cosmetic (CLAUDE.md §7), with the server filtering as
  the authoritative boundary for what leaves the API.

## Amendment — Platform Admin excluded from rate visibility
Originally the Platform Administrator (owning no rate line) could still **preview**
any role's rates by switching persona in the header. On the product owner's
instruction this preview was removed: compensation/rate data is not information the
Platform Admin role should see (segregation of duties — the admin manages the
platform, not pay/rate data). `RateIdentities` now pins every identity to its own
role in both auth modes and explicitly drops `admin`, so the admin resolves to no
rate line and cannot elevate via the header; the API returns no rate for the admin,
and the *My Team* rate card is hidden for that persona. CTO/CIO and the regional
managers are unchanged.

## Alternatives considered
- **A region dropdown on one discipline line** — rejected: visibility is
  per-region, so region must be part of the ownable unit, not a filter.
- **Distinct capability sets for the new managers** — rejected: the requirement is
  *same rights, different rate visibility*; cloning the base RoleDef is exactly
  that with no new matrix rows.


---

# ADR-0058 — Calendar timeline window (up to 5 years), absolute-month model

**Status:** Accepted — extends the derived-window timelines of
[ADR-0029](./0029-timeline-derived-windows.md).

## Context
The project/programme/portfolio Gantt laid items out on a **single-year, 12-month**
grid indexed by month-of-year (0–11). Multi-year work couldn't be seen end-to-end,
and a bar spanning a year boundary had no correct position. Users needed to look up
to five years ahead by calendar date.

## Decision
Model timeline positions as **absolute months** (`year*12 + monthIndex`) and render
against a **user-selected calendar window**:

- A `Win { start, span }` context (`WinCtx`) carries the visible range; span is
  capped at `MAX_SPAN = 60` (5 years).
- From/To `<input type="month">` pickers plus **1y / 2y / 3y / 5y / This-year**
  presets set the window; the default is the current calendar year (identical to
  the old 12-month behaviour).
- Geometry helpers (`barAbs`, `segPct`, `centerPct`, `gridBg`) place/clip bars and
  markers within the window; anything fully outside is hidden, anything crossing an
  edge is clipped. Items with real ISO dates are placed by them; a bare
  month-of-year (manual phases, derived sprints) is anchored to a base year supplied
  by its context (its project's start year).

Frontend-only; no API or schema change.

## Consequences
- **+** Multi-year portfolios render correctly across year boundaries; the horizon
  is selectable up to 5 years.
- **+** Default view is unchanged (current year), so nothing regresses for existing
  single-year use.
- **+** One shared geometry model for every timeline (project/programme/portfolio/
  task), so window behaviour is consistent.
- **−** A very wide window compresses month cells; the month header thins labels to
  years past ~18 months to stay legible.

## Alternatives considered
- **Keep month-of-year, add a year selector** — rejected: can't represent a bar
  that spans two years, and cross-year layout stays wrong.
- **Continuous pixel-per-day scale** — rejected: heavier and unnecessary; month
  granularity matches how phases/sprints/roll-ups are already modelled.


---

# ADR-0059 — Task lifecycle timeline + Jira changelog-derived timestamps

**Status:** Accepted — extends the Jira full-field import
([ADR-0018](./0018-jira-full-field-import.md)) and the calendar window
([ADR-0058](./0058-five-year-calendar-timeline-window.md)).

## Context
The Timeline → Tasks view drew a **duration Gantt bar** (start → target) per issue.
Jira work-items rarely carry a planned start+end span, so every bar stretched
edge-to-edge and the only signal left was the status word — with 1,000+ issues it
read as a wall of identical bars. A work-item is better shown along its **life**
(created → in-progress → closed) than as a fabricated duration.

## Decision
Render each task as a **lifecycle**, and capture the timestamps that requires.

**Frontend** (`Gantt.tsx`, `TaskTimeline`/`TaskLifeRow`): per task, a faint **age
track** (origin→end), a status-coloured **active segment** (work-start→end), and
**created / started / resolved markers**.
- *To Do* → age track only (visibly aging in the backlog, no active segment).
- *In Progress / Blocked* → active segment runs to the **NOW** line.
- *Done* → active segment ends at the resolved date.
- Sort (created / status / longest-running) + status filter; the row list is
  **virtualized** (windowed render) so large backlogs stay smooth. Fully respects
  the calendar window (ADR-0058).

**Backend**: two new `ProjectTask` columns (migration `TaskLifecycleTimestamps`),
surfaced on `ProjectTaskDto`:
- `ResolvedAt` — from Jira `resolutiondate` (already fetched), falling back to
  last-updated for a Done issue with no resolution date.
- `StartedAt` — derived from the **earliest status transition** in the issue
  changelog. `expand=changelog` was added to the issue/JQL fetch helpers;
  `StartedAtFromChangelog` scans histories for the first `status`-field change.
  Workflow-agnostic (no dependency on status names/categories) and **best-effort**:
  a missing/unreadable changelog just leaves it empty (bar omits the ◆ marker).

## Consequences
- **+** The view communicates real progress and aging instead of noise; scales to
  thousands of rows via virtualization.
- **+** `StartedAt`/`ResolvedAt` reuse the existing idempotent sync; no new calls
  beyond the changelog expand on the issue search already being made.
- **−** `expand=changelog` increases sync payload; mitigated by delta sync and the
  existing page caps. Existing rows populate on the **next** sync (older data shows
  created→now until then).
- **−** "Started" is the first status move, a proxy for work-start; full
  cycle-time/lead-time analytics from the complete transition history is a
  candidate (CR-INT-7), not this ADR.

## Alternatives considered
- **Keep the duration bar** — rejected: it's the reported problem.
- **Aging scatter / cumulative-flow instead of bars** — viable and considered;
  the lifecycle bar was chosen as the closest faithful improvement to the existing
  Gantt idiom. The others remain open as complementary views.
- **Status-category mapping for "started"** — rejected as fragile across custom
  workflows; first-transition is robust and needs no status catalogue.


---

# ADR-0060 — Microsoft Teams as a third notification channel

**Status:** Accepted — extends the notification system
([ADR-0028](./0028-over-allocation-alerts.md) alerts,
[ADR-0045](./0045-per-role-demand-email.md) per-role email) and the connector
pattern ([ADR-0006](./0006-jira-pull-only-board-optional.md),
[ADR-0035](./0035-azure-devops-connector.md)).

## Context
Atlas already emits notifications on three paths — entity events (a subscribed
project/program/product changes), portfolio events ("created"), and
role-addressed governance events (a demand pinging the PMO/Architect/CTO). Each
is delivered **in-app** and, when Microsoft Graph Mail.Send is configured, by
**email**. The prototype's Integrations screen lists **Microsoft Teams** as a
connector ("Channel & chat notifications"), but it was cosmetic chrome. Teams is
where the org actually works, so notifications should be able to land there too —
without inventing a new UI or a new delivery contract.

## Decision
Add **Teams as a third channel** to the *existing* emit paths, not a parallel
system. `Notifications.{EmitToEntityAsync, EmitPortfolioAsync, EmitToRolesAsync}`
each call `TeamsNotify.EmitAsync(db, title, body)` after persisting the in-app
copy and sending email, so any event already produced is mirrored to a Teams
channel with the same title/body.

**Delivery** is an **Incoming Webhook** — created in Teams via *Workflows → "Post
to a channel when a webhook request is received"*, the forward-looking
replacement for the retired O365 connectors. Atlas POSTs an **Adaptive Card**
(the `type:"message"` + `attachments[]` envelope Workflows expects). Best-effort:
the in-app copy is always written first, so an unconfigured connector or a Teams
outage degrades silently rather than failing the originating action — identical
to the email contract.

**Configuration** lives in the `Setting` key/value store (`teams.webhookUrl`,
`teams.enabled`), reachable only through **`cap-integrations`-gated** endpoints
(`GET /integrations/teams/status`, `POST …/config`, `POST …/test`). The webhook
URL is a channel secret, so — unlike the generic `GET /settings` — it is **never
returned to the client**: status exposes only a masked `scheme://host` and the
`configured`/`enabled` booleans. The Integrations screen's Teams row becomes a
live connector (Configure modal + Send-test), mirroring the Jira/ADO rows.

## Consequences
- **+** Notifications reach Teams with zero new event plumbing and no new Graph
  permissions/consent (webhook is channel-scoped, not tenant-wide).
- **+** Fully degradable and opt-in: idle until an admin pastes a URL and enables
  it; muting keeps the URL but stops delivery.
- **+** Secret-safe: the URL is write-only over the API and kept out of the
  broadly-readable `/settings` payload.
- **−** A single channel per instance (one webhook). Per-event or per-team routing
  is a candidate follow-up, not this ADR.
- **−** Outbound-only. Two-way (actionable cards, replies) would need a Teams app
  / bot registration and is out of scope.

## Alternatives considered
- **Graph channel messages** (`POST /teams/{id}/channels/{id}/messages`) — richer,
  but needs `ChannelMessage.Send` application permission (protected API, heavier
  consent/licensing) for app-only posting. Rejected for the default path; the
  webhook is the lowest-friction fit and reuses the connector mental model.
- **Legacy O365 "Incoming Webhook" connector** (MessageCard) — simplest, but
  Microsoft is retiring O365 connectors; targeting the Workflows Adaptive-Card
  envelope is future-proof.
- **A separate Teams preference per event type** — deferred; the channel rides the
  existing in-app/email preferences and subscriptions rather than adding a third
  column to every preference row now.


---

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

## Addendum — generalised to a "room" hub; Demand funnel added

**Status:** Accepted — extends this ADR.

The live layer proved useful beyond PI planning, so `BoardHub` was generalised
from a PI-only hub to a reusable **room** concept without changing its security
model:

- A **room** is an opaque scope string naming one collaborative surface —
  `pi:{id}` for a PI increment, `demands` for the portfolio Demand Pipeline
  funnel. The hub's client methods are now `JoinRoom(roomId, name)` /
  `LeaveRoom(roomId)` / `Cursor(roomId, x, y)`, and the out-of-band ping is
  `NotifyRoomAsync(hub, roomId)`. `NotifyGroupAsync(hub, int)` is kept as a thin
  `pi:{id}` convenience so the many Pip/PiBoard callers are unchanged.
- Room keys are **validated server-side** (`Normalize`: trim, lowercase, allow
  only `[a-z0-9:_-]`, ≤64 chars) so a client can never inject an arbitrary
  SignalR group name — tightening the segregation control above.
- The client transport moved to a surface-agnostic `useRoomRealtime(roomId, …)`
  hook; `useBoardRealtime` is now a one-line wrapper (`pi:${id}`). The presence
  chrome (live dot, avatar stack, cursor layer) was extracted to
  `src/realtime/Presence.tsx` and is shared by every surface.

**First application — Demand Pipeline funnel.** The `demands` screen joins room
`demands`; the demand **create / stage-move / delete** REST endpoints call
`NotifyRoomAsync(hub, "demands")` after committing, so a card dragged across the
funnel by one person refetches for everyone. Presence + cursors show who else is
triaging intake. Same contract as the board: no domain data over the socket,
writes stay behind `cap-submit-demand` / `cap-demand-scoring`, presence is
minimal (name/initials/colour), nothing persisted.

The observability metrics keep their stable `atlas.board.*` names but now count
across all rooms (see `docs/observability.md`).


---

# ADR-0062 — Individual development plans (manager-scoped, development-framed)

**Status:** Accepted — extends the manager surface on *My Team* (Team SWOT,
[ADR-0016] skills matrix) with a per-person note.

## Context
Managers asked for a per-person qualitative note alongside the team-level SWOT
and the skills matrix. A raw **individual SWOT** was considered and rejected:
"weaknesses/threats" recorded against a named person is subjective personnel
data that reads as adversarial, invites grievance, and normally lives in an HRIS
(Workday/SuccessFactors) — not a PPM tool. But a lightweight, development-focused
note that a manager keeps for the people they manage is genuinely useful and
low-friction, provided it is handled as sensitive personal data.

## Decision
Add **individual development plans** with a deliberately development-focused
shape — **Strengths · Growth areas · Goals** (no weaknesses/threats) — on the
*My Team* member cards.

- **Scope = authorization.** A manager can read/write a plan only for people in a
  team within their roll-up (`Teams.MembersInScopeAsync`); Platform Admin all.
  Out-of-scope person → `403`, missing person → `400`.
- **Manager-visible only.** Plans are **never** exposed to the individual or to
  peers. The UI states this ("Visible to managers only — not shown to the team
  member"). There is no self-service read path.
- **Audited.** Every write records *who edited whose plan* (not the content) in
  the audit log.
- **Migration-free storage.** Persisted as JSON in the `Setting` store, keyed by
  display name (`devplan.{person}`, consistent with the skills matrix), and
  **redacted from the broadly-readable `GET /settings`** (confidential-prefix
  rule, ADR-0060/§2) — so it is only ever read back through the scoped
  `GET /devplans` endpoint. Text fields are length-capped.

## Consequences
- **+** Managers get a private development record next to skills/SWOT, in the
  existing UI, with no new screen and no migration.
- **+** Tight blast radius: scoped read/write, redacted from the settings dump,
  audited, and never shown to the subject.
- **−/GDPR.** This is personal data. Lawful basis, purpose limitation, retention,
  and **subject-access** still apply — a person may request what a manager wrote.
  For Birgma/Biltema (Nordic), works-council / co-determination consultation is
  advisable before switching this on in production. Treat as an org policy gate,
  not just a feature flag.
- **−** Display-name keying can collide/rename like the skills matrix; a stable
  key (Entra `Uid`) is a later refinement once the member DTO carries it.
- **−** Not integrated with an HRIS; if the org standardises on one, this should
  link out rather than duplicate.

## Alternatives considered
- **Individual SWOT** — rejected: adversarial framing for a person; higher HR/
  legal sensitivity for no added value over strengths/growth/goals.
- **Store in HRIS only / link out** — cleaner system-of-record, but heavier and
  not available now; revisit if an HRIS integration lands.
- **A first-class `DevelopmentPlan` entity + table** — preferable long-term
  (typed, per-row, FK to the person), but needs an EF migration; the `Setting`-
  JSON interim ships without one and is easy to promote later.


---

# ADR-0063 — Personnel-data processing gate + Sweden compliance posture

**Status:** Accepted — governs the personnel-assessment features
([ADR-0062](./0062-individual-development-plans.md) development plans, Team SWOT)
and extends the compliance coverage work
([ADR-0049](./0049-compliance-coverage-and-zero-trust.md)).

## Context
Team SWOT and individual development plans process **sensitive employee personal
data**. In Sweden that pulls in obligations beyond baseline GDPR — notably a
**DPIA (GDPR Art. 35)** and **MBL §11 co-determination negotiation** with unions
*before* such a system goes live, plus transparency, retention reconciliation
with the Accounting Act, and processor/transfer diligence. Shipping the features
"on by default" would risk processing personal data before those gates are met.
(Full map: `docs/compliance-sweden.md`.)

## Decision
Add a single **compliance gate** that keeps the personnel-assessment features
**off until an organisation explicitly approves data processing**.

- A `Setting` flag, `personnel.assessmentsEnabled`, **defaults to off**.
- **Server-enforced** (`Teams.PersonnelEnabledAsync`): while off, the SWOT and
  development-plan write endpoints return **403**, and the read endpoints return
  `enabled:false` with **no data** — so nothing is served or stored regardless of
  the client.
- **UI**: the *My Team* SWOT panels and per-member development-plan affordances
  are hidden while off. A Platform Admin flips the flag in **Integrations &
  Settings → Governance**, where the copy names the prerequisites (DPIA + MBL §11).
- The flag is a normal operator toggle (not a secret), so it round-trips through
  `GET/PATCH /settings` like the other governance toggles.

The gate is the **technical enforcement point** for the compliance to-dos in
`docs/compliance-sweden.md`; the go/no-go is an org-policy decision, not a code
change.

## Consequences
- **+** Personal-data processing cannot happen until a deliberate, admin-level
  opt-in — a clean control to point auditors/works-council at.
- **+** Enforced at the API, not just the UI, so it holds regardless of client.
- **+** Reuses the existing settings machinery; no migration.
- **−** The features ship **disabled** — after this lands, SWOT/dev-plans are
  invisible until an admin enables the flag (intended, but a visible behaviour
  change; documented in the PR and here).
- **−** A single global flag (not per-team/per-region). Finer-grained gating is a
  later refinement if a market needs staged rollout.

## Alternatives considered
- **Ship on by default** — rejected: risks processing personal data before the
  DPIA/MBL gates, in a jurisdiction where that ordering matters.
- **Build-time feature flag / config value** — rejected: not runtime-toggleable
  by an admin, and not visible/auditable in-product.
- **Separate flags per feature** — deferred; one personnel-data gate is simpler
  and matches how the sign-off (DPIA/MBL) is granted (for the capability as a
  whole), with per-feature/region splits as a future refinement.


---

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


---

# ADR-0065 — Task board moves scoped to the planner roles

**Status:** Accepted — product-owner decision. **Revised 2026-07-13:** the move
right, briefly opened to *every* role, is now scoped to the four planner roles
(Platform Admin, PMO, Project Manager, PM Lead). Authorization stays
server-authoritative per ADR-0004.

## Context
Real-time collaboration on the project Tasks (Kanban) board shipped in #19.
*Moving* a card (changing its status column) originally required Edit on
`cap-projects`. In the first cut of this ADR the product owner asked that **every
role** be able to move cards; on review that was judged too broad — moving a card
advances delivery state, which is a **planning/scheduling** act, not something a
read-mostly stakeholder or an unrelated team member should do on any board. The
product owner therefore narrowed it: **only Platform Admin, PMO, Project Manager
and PM Lead may move cards.** Live collaboration itself (presence, peer cursors,
instant refresh) remains open to every role — you can watch the board move in
real time regardless of role; you just can't move a card unless you plan the work.

## Decision
A **status-only** `PATCH /tasks/{id}` requires Edit on **`cap-schedule`**
("Project schedule") — the capability held by exactly Platform Admin, PMO,
Project Manager and PM Lead, and the same right that already gates *creating* a
task. The server detects that the request changes *only* `Status` (every other
field absent) and applies `cap-schedule`; any request touching another field
still requires `cap-projects` Edit as before. Every move writes an audit event
(`Tasks · Moved task · {from} → {to}`). The `GET /projects/{id}/tasks` response
carries a `canMove` flag (= `cap-schedule` Edit) that drives the board's drag
affordance on the client; it is an affordance only — the server is authoritative.

## Security & compliance
- **Least privilege (NIST AC-6).** Moving a card is now bound to the schedule
  right, so the permission tracks the people who own delivery state. This is the
  *tightening* of the earlier open stance, not a relaxation — the least-privilege
  posture is restored. It still grants no create, delete, rename, re-plan,
  assignment or field edit; those remain behind `cap-projects`.
- **Authorization stays server-authoritative (ISO 27001 A.5.15).** The client
  `canMove` flag is only an affordance; the server allows/denies. A request that
  smuggles extra fields alongside `Status` is treated as a non-status edit and
  gated by `cap-projects`.
- **Accountability / audit (ISO A.8.15; NIST AU-2).** Every move is audited with
  actor, task and the from→to transition, so the action remains fully traceable.
- **Input validation.** The target status is still checked against the allowed
  set; unknown values are rejected `400`.

## Consequences
- **+** Board state changes are limited to the roles accountable for planning,
  while everyone can still collaborate live (watch, point, follow).
- **+** Reuses an existing capability (`cap-schedule`) — no schema/seed migration,
  and the RBAC matrix already shows who holds it.
- **−** A team member who previously (very briefly) could drag a card no longer
  can; they update task state via the task detail edit if they hold `cap-projects`.
  This is the intended narrowing.

## Alternatives considered
- **Keep it open to every role** — the first version of this ADR; rejected by the
  product owner as too broad for a delivery-state change.
- **A dedicated `cap-task-move` capability** — cleaner to show a distinct cell in
  the matrix, but `cap-schedule` already partitions exactly the intended four
  roles and needs no migration; a dedicated capability is an easy follow-up if the
  matrix should name it explicitly.
- **Enable/scope it purely client-side** — rejected: authorization must be
  enforced on the server, never by the client.


---

# ADR-0066 — ISO 27001 Statement of Applicability

**Status:** Accepted — product-owner-approved extension (post-prototype). Built in
the existing design language on Project → Security; recorded here and in
CLAUDE.md §2 until `design/` is regenerated.

## Context
The Security, privacy & compliance tab (ADR era of the security module) already
carried a data-classification/privacy profile, a framework-scope toggle set
(incl. ISO 27001), a *control-evidence register* and review gates. But the
register only held the controls someone typed in — there was no view of the
**full** Annex A control set, and no **Statement of Applicability (SoA)**, which
ISO/IEC 27001:2022 clause 6.1.3 d) makes a **mandatory** ISMS record: for *every*
Annex A control, state whether it applies, justify inclusion/exclusion, and give
its implementation status. The evaluation flagged this gap ("SoA adoption +
broader control-coverage automation pending").

## Decision
Add a per-project SoA covering all **93 ISO 27001:2022 Annex A controls** across
the four themes (Organizational 37, People 8, Physical 14, Technological 34).

- **Catalogue is static reference data** (`server/Soa.cs` `Catalogue`) — it is the
  standard, not user data, so it needs no table or seed and can't drift per
  environment. The full set always renders, so **control coverage is complete by
  construction** rather than limited to ad-hoc entries (the "broader coverage" the
  evaluation asked for).
- **Only the decision is persisted** — `SoaEntry(ProjectId, Ref, Applicable,
  Justification, Status, Owner)`, one row per (project, control), unique on
  `(ProjectId, Ref)` (migration `SoaEntries`). An absent row is the baseline:
  *applicable, "Not started"*. Upserts are single-row writes.
- **Endpoints** (`/projects/{id}/soa`, `PUT …/soa/{ref}`): GET merges catalogue +
  decisions, groups by theme and returns a **coverage roll-up** (applicable /
  excluded / reviewed / implemented / % implemented of applicable). PUT validates
  the ref against the catalogue and the status against the allowed set.
- **UI** (`src/screens/project/SoaPanel.tsx`): collapsible theme sections, each
  row an applicability toggle, status select, justification and owner; coverage
  KPIs in the header. Inline-styled with theme tokens, shared UI, no new deps.

## Security & compliance
- **Authorization is server-authoritative (ISO A.5.15).** Reads are open to any
  authenticated caller (parity with the rest of the Security tab); recording a
  decision requires Edit on **`cap-approve`** ("Approve demands & gates") — the
  governance right that already gates controls and review gates. UI `canEdit` is a
  cosmetic affordance only.
- **Accountability / audit (ISO A.8.15; NIST AU-2).** Every decision writes an
  audit event with the actor, control ref, applicability and status, so the SoA's
  change history is traceable — itself an ISMS expectation.
- **Input validation.** Control ref must be in the Annex A catalogue; status must
  be one of the allowed values; both are rejected `400` otherwise.
- **Data minimisation.** The SoA holds only governance metadata (applicability,
  justification, status, owner) — no personal or sensitive data.

## Consequences
- **+** The ISMS's mandatory SoA now exists in-tool with complete Annex A
  coverage, beside the evidence register and review gates it complements.
- **+** Reuses the existing capability, screen, audit and theme — no new
  authorization surface, framework or dependency.
- **−** The catalogue is ISO 27001:2022-specific; other frameworks (SOC 2, NIST
  CSF) would each need their own catalogue if the org wants their SoAs too — a
  clean follow-up (the coverage roll-up and row model generalise).
- **+** **Automated platform-evidence linkage:** ~20 Annex A controls the Atlas
  platform satisfies by construction (RBAC → A.5.15/A.5.18/A.8.3; append-only
  audit log → A.8.15; backups → A.8.13; OTel → A.8.16; CI SAST/SCA/DAST →
  A.8.8/A.8.25/A.8.28/A.8.29; secret redaction → A.8.11; TLS/CSP →
  A.8.20/A.8.24; Entra SSO → A.5.16/A.5.17/A.8.5) carry a standing evidence note
  (`Soa.PlatformEvidence`) and a "platform-evidenced" coverage count, so a SoA
  review starts from what the product already provides instead of a blank sheet.
- **−** Per-control evidence beyond the platform set is still owner-entered;
  linking to *project-specific* artefacts (a specific backup schedule, a DPA) is a
  future enhancement. SoAs for other frameworks (SOC 2, NIST CSF) would each need
  their own catalogue — the row model and coverage roll-up generalise, so it is a
  data-addition, not a redesign.

## Alternatives considered
- **Keep only the free-form control-evidence register** — rejected: it can't be a
  Statement of Applicability (no guarantee every Annex A control is addressed).
- **Seed the 93 controls as DB reference data** (like the RBAC matrix) — rejected:
  the catalogue is a fixed standard, so a static code array avoids a seed/reconcile
  path and can never be partially populated; only the per-project decision varies
  and is what deserves a row.
- **Org-level single SoA** — deferred: Atlas governs per initiative, and the
  existing Security tab is per-project, so a per-project SoA fits the model and the
  screen; a portfolio roll-up across projects is a later addition.


---

# ADR-0067 — OpenBao / Vault secrets provider (on-prem)

**Status:** Accepted

## Context

Secrets today are layered on the .NET configuration stack (ADR-0009): file-
mounted `/run/secrets` (KeyPerFile) with an optional Azure Key Vault provider
(ADR-0009 / `docs/secrets.md`). The deployment target is on-prem single-node
Docker (ADR-0054), where Azure Key Vault isn't a fit. Teams that already run a
central secrets manager wanted an on-prem, cloud-neutral option that also gives
audited, centralized secret access and a path to automated rotation — the two
things Docker file-secrets alone don't provide (rotation is manual today, via
the Admin card).

## Options

1. **Do nothing** — keep file-secrets + (deferred) Key Vault. On-prem stays
   manual-rotation only.
2. **HashiCorp Vault** — the incumbent, but BSL-licensed since 2023.
3. **OpenBao** — the Linux Foundation's MPL-2.0 fork of Vault, API-compatible.

## Decision

Add an **OpenBao/Vault KV v2 configuration provider** as one more layer in the
existing secret seam (`Secrets.AddAtlasSecrets`), and ship a ready-to-run
`docker-compose.openbao.yml` overlay. Because OpenBao is API-compatible with
Vault, the single provider serves both.

- **Inert unless configured** — active only when `Bao:Address` **and** a token
  are set, mirroring the Key Vault switch. The token itself can be delivered by
  the file-secrets layer (`Bao__Token`), so it never has to sit in an env var.
- **Read path** — `GET {Address}/v1/{Mount}/data/{Path}` with `X-Vault-Token`;
  each KV key maps to a config key with `__` → `:` (identical to KeyPerFile /
  Key Vault), so `ConnectionStrings__Postgres` → `ConnectionStrings:Postgres`.
- **Added after the default + file layers**, so a vaulted secret wins over
  appsettings/env, and precedence stays predictable: Key Vault > OpenBao >
  file-secrets > env > appsettings.
- **Non-fatal** — a read failure is logged and boot continues on the lower
  layers, so an unreachable/sealed vault never wedges startup.
- **No new dependency** — implemented over `HttpClient` (the KV v2 read is a
  single authenticated GET); the pure response→config mapping is unit-tested.

The compose overlay runs OpenBao in **dev mode** for a one-command trial;
production is expected to use a real storage backend (file/raft), TLS and a
proper unseal/token flow (documented, not scripted).

## Consequences

- On-prem deployments get centralized, audited secrets and a foundation for
  **dynamic DB credentials / automated rotation** (a future ADR can wire the
  database secrets engine, closing the manual-rotation gap).
- One more optional moving part to operate (the vault itself, its unseal keys).
  It stays **opt-in**; the default single-node story is unchanged.
- The live read path can't be exercised in CI (no vault there); it's guarded and
  the mapping is unit-covered. First real use should be smoke-tested against a
  running OpenBao.


---

# ADR-0068 — Field encryption for DPIA-gated personnel notes

**Status:** Accepted

## Context

Team SWOT and individual development-plan notes are sensitive personnel data
(ADR-0062/0063): manager-scoped, redacted from the broad settings read, gated
off until DPIA + MBL sign-off. They're stored as JSON in the `Settings` table
(`team.swot.{slot}`, `devplan.{person}`). Encryption **in transit** (TLS to
Postgres) and **at the volume** (disk encryption) are deployment concerns; what
was missing was **application-level at-rest encryption** so a stolen database —
or, more realistically, a stolen DB backup — doesn't expose these notes in the
clear. The target is on-prem single-node Docker with **no HSM and no cloud KMS**.

## Options

1. **pgcrypto** (DB-side `pgp_sym_encrypt`). Rejected: these values are written/
   read through EF Core as ordinary `Setting` rows, so pgcrypto means raw SQL for
   just these keys and the key travelling inside SQL statements (log-leak risk).
2. **EF `ValueConverter` on the Settings value.** Rejected: would encrypt *all*
   settings (including non-sensitive config), and can't be scoped to two keys.
3. **App-level field encryption at the two call sites.** Chosen.

## Decision

Encrypt only the SWOT and dev-plan JSON values in the application, at the four
`Teams.cs` read/write sites, with **AES-256-GCM** and a per-value random nonce
(`PersonnelCrypto`).

- **Key from the secret layer** — config `Personnel:EncryptionKey`, delivered by
  a `/run/secrets` file, env var, or OpenBao/Vault. **Never stored in the DB.**
- **Inert until set** — with no key, `Protect` returns plaintext, so the
  gated-off default is unchanged and **no migration/backfill** is needed.
- **Backward-compatible reads** — a value is decrypted only if it carries the
  `enc:v1:` marker; legacy plaintext passes through, and is upgraded to ciphertext
  the next time it's saved.
- **Zero-downtime rotation** — a second key `Personnel:EncryptionKeyOld` is
  accepted for reads; write-new / read-old, re-save, then drop the old key.
- **Fails closed, never crashes** — a marked value that no configured key can
  decrypt (missing/rotated-away key, or tampering caught by the GCM tag) returns
  null and the note is simply *not shown*, rather than corrupting output or
  throwing. No first-class local-key-file auto-anything: the key is a secret like
  any other.

Opt-in compose overlay `docker-compose.personnel.yml` mounts the key; the
step-by-step operator runbook (generate, back up **separately from the DB**,
verify, rotate) lives in `docs/secrets.md`.

## Consequences

- These notes are unreadable from a stolen DB/backup without the separately-held
  key — a materially better GDPR posture for the most sensitive data in Atlas.
- **Key custody is now load-bearing:** losing the key loses the notes (by design);
  it must be backed up apart from the data. Documented prominently.
- Encrypted fields can't be searched/sorted — fine, they're free-text notes.
- No per-restart ceremony (unlike a vault unseal): the app reads the key at boot.
- Nothing else depends on the key, so the blast radius of a lost key is bounded to
  these two note types.


---

# ADR-0069 — Passwordless Postgres via TLS client-certificate auth

**Status:** Accepted

## Context

The database connection string is the single biggest secret Atlas holds. We
already layer secret *storage* (file-secrets, optional Key Vault / OpenBao —
ADR-0009/0067) and can encrypt sensitive columns (ADR-0068), but the DB password
still exists and must be protected, rotated and vaulted. On the on-prem target
(no HSM, no cloud KMS) the strongest move is to **not have a password at all**:
authenticate the app to Postgres with a client certificate.

## Decision

Support **TLS client-certificate (mutual-TLS) auth** to Postgres as an opt-in
overlay, with **no application code change** — Npgsql takes the client cert/key +
CA via connection-string keywords, and the string carries no `Password=`.

- `pg_hba.conf` TCP rule `hostssl … cert clientcert=verify-full`: every network
  login must present a cert signed by the server CA whose **CN equals the DB
  role**. No password path over TCP.
- `deploy/gen-pg-cert.sh` mints a dev CA + server cert (SAN = DB host) + client
  cert (CN = role), and sets each private key's mode/owner so the shipped
  containers can read it (server.key → uid 70; client.key → uid 1654).
- `docker-compose.pgcert.yml` turns on TLS + the cert `pg_hba`, mounts the certs,
  and sets the passwordless connection string for api/worker.
- Step-by-step runbook + the file-permission gotcha in `docs/postgres-cert-auth.md`.

Verified end-to-end against a real Postgres 16: a passwordless client-cert
connection succeeds over TLS (`current_user=atlas`, `ssl=true`); a connection with
no client cert, or a password without a cert, is rejected
("connection requires a valid client certificate").

## Alternatives

- **Password in a vault (OpenBao) or Docker secret** — still a password to hold
  and rotate; strictly weaker than removing it. Kept as the option when cert
  infra isn't available.
- **SCRAM with a strong password** — fine, but doesn't remove the secret.
- **Cloud Managed-Identity passwordless** — not applicable on-prem.

## Consequences

- The DB password stops being a secret to manage; auth becomes "hold a client
  cert signed by our CA." Fewer secrets, no DB-password rotation chore.
- New operational item: **certificate lifecycle** (issue, distribute, renew before
  expiry) and correct **key file permissions** per container user — documented,
  and the only part that must be validated per-environment.
- Pairs with disk encryption + `postgres-least-privilege.sql` + ADR-0068 field
  encryption for a defence-in-depth on-prem posture with **no HSM required**.


---

# ADR-0070 — Project delivery roles (Technical Lead + Scrum Master)

**Status:** Accepted

## Context

The project Overview *People & roles* panel named the Project Manager (assigned
by the PMO) and eight architecture roles (assigned by the Chief Architect, with
candidates drawn from mapped Entra teams — ADR-0057). Delivery leadership — the
**Technical Lead** and, on agile projects, the **Scrum Master** — had no home,
so those assignments lived outside the tool. The product owner asked for them to
be first-class, picking from the people actually onboarded to Atlas rather than a
mapped architecture team.

## Decision

Add a **Delivery roles** group to the People & roles panel:

- **Technical Lead** — always offered.
- **Scrum Master** — offered **only when the project's methodology is agile**
  (`Scrum`, `Kanban`, `SAFe`, `Scrumban`, `Disciplined Agile`, `Extreme
  Programming`). The decision is **server-side** (`Assignments.IsAgile`), so the
  UI simply renders whatever `deliveryRoles` the API returns — the client never
  decides eligibility.
- Candidates come from the **onboarded application roster** — the resource
  directory plus Entra-synced members (`Assignments.OnboardedAsync`), **not** a
  mapped architecture team. This is the key difference from the architecture
  roles: delivery leadership is picked from whoever is actually in the app.
- Assignment is gated on `admin`/`pmo`/`pm`/`pmlead` (`CanAssignDelivery`),
  server-enforced and audited, and persisted as `RoleAssignment` rows exactly
  like the lead and architecture roles (no new table, no migration).
- `AssignmentsDto` gains `CanAssignDelivery` + `DeliveryRoles`; the assignment
  `PUT` accepts the new keys (`techLead`, `scrumMaster`).

## Consequences

- **+** Delivery leadership is named in-tool, consistent with the existing role
  model; no schema change (reuses `RoleAssignment`).
- **+** Eligibility is authoritative on the server — a non-agile project can
  never surface (or be tricked into showing) a Scrum Master.
- **+** The onboarded-roster pool means the dropdown is populated out of the box,
  without requiring an Entra team mapping first.
- **−** Two role keys are now methodology-conditional, so the panel's role set is
  no longer static; the DTO carries the resolved list rather than the client
  hard-coding it.
- The header identity remains cosmetic (CLAUDE.md §7); the server filter is the
  authoritative boundary for who may assign.

## Alternatives considered

- **Client-side methodology gate** — rejected: eligibility is an authorization/
  data decision, so it belongs on the server (the API returns the resolved list).
- **Candidates from a mapped "delivery" team** — rejected: delivery leads are
  drawn from the whole onboarded roster, not a single team; reusing the arch-team
  pool would hide valid candidates.
- **A new `DeliveryAssignment` table** — rejected: `RoleAssignment` already models
  (project, roleKey, person); new keys need no storage change.


---

# ADR-0071 — Period-windowed resource utilisation + date-range filter

**Status:** Accepted

## Context

The Resources *By-person* view showed a **single-day snapshot** (default today).
The day/week/month/quarter/half/year toggle only relabelled the header —
`GET /resources` took no period, and the client never even sent one — so the
utilisation numbers never changed with the selected period. Managers also had no
way to see utilisation over an arbitrary date range.

The underlying allocation engine (ADR-0020) is already correctly time-phased
per-day: `ProjectPlannedFor` / `TaskLoadFor` / `CombineProjectLoad` compute a
person's project load "as of a day", honouring per-assignment and per-task date
windows, and taking the higher of planned-% vs task-estimate load per project.
Manual project allocations and Jira-derived task load both feed it. The single
missing piece was aggregation over a window.

## Decision

`GET /resources` gains optional `from`/`to`. When a window is supplied the roster
is the **average of each person's per-working-day Ops/Project/Product load across
the window** (weekends excluded; if the window is all-weekend the days are counted
so a single Sat/Sun query still returns a value); with no window it stays the
single-day snapshot (default today, or `?asOf=`), preserving every existing
caller.

To guarantee the windowed roster, the single-day roster and the Excel export
never drift, the allocation engine was refactored to expose **shared in-memory
helpers** (`ProjectPlannedFor`, `TaskLoadFor`, `CombineProjectLoad`) that all
three call; `RosterWindowAsync` loads the sources once and iterates the window's
working days in memory (capped at 800 days, mirroring the report guard).

Client: the period toggle maps to a concrete calendar window (`periodWindow`),
and a **date-to-date filter** overrides it for an arbitrary range; the allocation
Excel export follows the selected window.

## Consequences

- **+** The period toggle and the date filter now actually change the numbers,
  computed by the same authoritative engine as the snapshot and the export.
- **+** No schema change; the windowing is pure aggregation over existing data.
- **+** Both manual allocations and Jira task load feed the window, unchanged.
- **−** A long day-granularity window iterates many days in memory; bounded by the
  800-day cap and the working-day set, matching the allocation-report behaviour.
- **−** Averaging over a window can mask a short over-allocation spike within it;
  this matches the Excel export's per-bucket average and is the intended reading
  of "utilisation over the period".

## Alternatives considered

- **Peak (max) over the window instead of average** — rejected for the default
  view: it diverges from the Excel export's per-bucket average and would read
  inconsistently against the shared engine; the average is the natural
  "utilisation over the period".
- **Sample a single representative day** — rejected: cheap but wrong for windows
  where allocations start/stop partway through.
- **A separate windowed query path duplicating the per-day maths** — rejected:
  the whole point of the engine is one source of truth; the in-memory helpers keep
  snapshot, window and export on identical logic.


---

# ADR-0072 — Enforced per-domain module boundaries

**Status:** Accepted
**Date:** 2026-07-20
**Supersedes / relates to:** ADR-0001 (modular monolith), ADR-0041 (screen decomposition)

## Context

The API is a modular monolith (ADR-0001): one process, one assembly, endpoint
groups organised by domain. Until now that organisation was **by file only** —
every server type lived in a single flat `namespace Atlas.Api`. The module
boundaries in the HLD component view were therefore a **convention, not an
enforced constraint**: nothing at compile or test time stopped, say, the Finance
code from reaching directly into the Jira integration's internals. As the surface
grew (83 server files, 92 entities), that softness became a real risk to
long-term maintainability and to any future service extraction.

Two of the largest files also worked against the per-domain story: `Domain.cs`
(1,405 lines, 92 entities — the whole model centralised) and `WriteEndpoints.cs`
(820 lines). See the companion refactor that split those.

## Decision

1. **Per-domain namespaces.** Feature/service files move into
   `Atlas.Api.<Domain>` namespaces — `Comms`, `Delivery`, `Finance`,
   `Governance`, `Integrations`, `Operations`, `People`, `Platform`, `Portfolio`.
   (`Operations`/`Finance` are named to avoid colliding with the `Ops`/`Financials`
   static classes.)

2. **Shared kernel stays in the root `Atlas.Api`.** Entities (`Domain.*.cs`),
   DTOs, `AtlasDbContext`/`Db`, RBAC (`Rbac`/`Permissions`), the composition root
   (`Program`/`Endpoints`/`WriteEndpoints`) and cross-cutting infrastructure
   (logging, telemetry, observability, hardening, secrets) remain in root. Every
   module may depend on the kernel; child namespaces see it via enclosing-namespace
   lookup, so no per-file `using` churn was needed. A `GlobalUsings.cs` imports the
   sibling domain namespaces to keep cross-module references compiling. Keeping the
   **entities in root** deliberately avoids changing their CLR type identity, so the
   EF Core model snapshot — and the 169 existing migrations — are untouched.

3. **Boundaries are enforced by tests, not by usings.**
   `Atlas.Tests/ArchitectureTests.cs` analyses the compiled assembly with
   Mono.Cecil and enforces:
   - **A dependency ratchet** — the actual module→module edge set must stay a
     subset of an approved graph (`Allowed`). Any *new* cross-module edge fails the
     build with a clear message; deliberate ones are added to the map (and here).
   - **Clean modules** — `Finance`, `Integrations`, `Platform`, `Portfolio` must
     depend on **no** other domain module (Integrations especially: driven adapters
     must not reach up into business logic).
   - **No new cycles** — beyond the two known, grandfathered cycles below.
   - An idiomatic NetArchTest cross-check of the Integrations leaf rule.

   The analysis resolves compiler-generated nested types (async state machines,
   closures, iterators) to their declaring type's namespace — without that,
   dependency hidden inside `async` methods is invisible, which is exactly where
   most of this codebase's logic lives. The Cecil ratchet is therefore the
   authoritative guard; NetArchTest's own scan does not descend into those.

### Approved module dependency graph (as of this ADR)

```
Comms        -> People
Delivery     -> Comms, Integrations, People, Platform
Finance      -> (none)
Governance   -> Comms, Integrations, People
Integrations -> (none)
Operations   -> People
People       -> Comms, Operations
Platform     -> (none)
Portfolio    -> (none)
```

**Known cycles (accepted tech debt, to decouple later):**
- `People ↔ Comms` — capacity logic raises notifications.
- `People ↔ Operations` — ops load feeds the resource roster.

Both are candidates for inversion via the shared kernel (an event/interface in
root) rather than a direct module→module reference. Tracked here; not blocking.

## Consequences

**Positive**
- Module boundaries are now **real and regression-proof**: new coupling or a new
  cycle fails CI, forcing a conscious decision instead of silent drift.
- The dependency graph is now **documented and measured** (the ratchet is
  generated from reality, not aspiration), surfacing the two genuine cycles that
  the flat namespace had hidden.
- A future service extraction becomes mechanical: a module's kernel dependencies
  and its (few, explicit) sibling dependencies are enumerated.

**Negative / trade-offs**
- `GlobalUsings.cs` means cross-module references still *compile* freely; the stop
  is the test, not the compiler. This is the standard arch-test model and keeps the
  diff mechanical, but it does mean the boundary lives in `ArchitectureTests`, which
  must be kept honest.
- The `Allowed` map and known-cycle set are hand-maintained; extending a boundary is
  a deliberate two-line edit here (by design).
- Two cycles remain as tech debt (documented above).

## Verification

`dotnet build` clean; `dotnet test` green (470 tests, incl. 4 architecture tests).
The ratchet was mutation-tested (removing an approved edge makes it fail, naming the
exact `source -> target`), confirming it is not a hollow pass.


---

# ADR-0073 — Migrate the backend to .NET 10 (LTS)

**Status:** Accepted
**Date:** 2026-07-20
**Relates to:** ADR-0001 (modular monolith / minimal API), ADR-0002 (PostgreSQL + EF Core), ADR-0054 (on-prem single-node Docker)

## Context

The server (API + tests) targeted **.NET 8** with **EF Core 9** and **ASP.NET Core 8**.
Two forces make a move to **.NET 10** timely:

1. **Support lifecycle.** .NET 8 is LTS but its support ends **~November 2026**.
   .NET 10 is the current LTS. Staying on 8 past EOL means no security servicing.
2. **System.Text.Json version friction.** The test project carried an explicit
   `System.Text.Json` **9.x pin** to force version unification (EF Core 9 references
   STJ 9.0.x; the ASP.NET Core 8 test host pulls 8.0.x) and avoid a `CS1705`
   assembly-version clash. That pin repeatedly blocked dependency updates whose
   transitive graph wanted **STJ 10** (e.g. the Azure SDK bumps in Dependabot #49/#52),
   surfacing as `NU1605` downgrade errors. On net10, **STJ 10 is the framework
   default**, so the mismatch — and the pin — disappear.

## Decision

Migrate the backend from `net8.0` to **`net10.0`** (LTS → LTS, skipping the net9 STS):

- **TFM** `net8.0 → net10.0` for `Atlas.Api` and `Atlas.Tests`.
- **EF Core 9 → 10**: `Npgsql.EntityFrameworkCore.PostgreSQL` 10.x,
  `Microsoft.EntityFrameworkCore.Design`/`.InMemory` 10.x.
- **ASP.NET Core 8 → 10**: `JwtBearer`, `Mvc.Testing` 10.x.
- **Remove the explicit `System.Text.Json` pin** — the framework provides STJ 10.
- **Remove the `Microsoft.Extensions.Configuration.KeyPerFile` package** — it is part
  of the shared framework on net10 (`AddKeyPerFile` resolves from it; `NU1510`).
- **Runtime/CI**: Dockerfile `sdk`/`aspnet` base images 8.0 → 10.0; CI
  `actions/setup-dotnet` 8.0.x → 10.0.x.

Existing EF migrations are **not** regenerated — EF Core 10 applies the EF 9-authored
migration history as-is (verified below).

## Consequences

**Positive**
- On a supported LTS ahead of the .NET 8 EOL.
- The STJ pin and the recurring `NU1605`/`CS1705` friction are gone; STJ-10-dependent
  updates (Azure SDK, etc.) merge normally.
- Fewer explicit package references (KeyPerFile, STJ) — less to maintain.

**Negative / trade-offs**
- **Deployment surface changes**: container base images move to 10.0 (ADR-0054) —
  runtime hosts / image pull must provide .NET 10.
- EF packages are pinned to the Npgsql provider's current aligned patch; keep the EF
  family in lockstep on future bumps.
- Third-party packages must have net10-compatible builds (verified for the current set:
  ClosedXML, OpenTelemetry, Swashbuckle, Azure SDK).

## Alternatives considered

- **Stay on .NET 8, adopt STJ 10 explicitly.** Rejected: running a JSON stack a full
  major ahead of the host framework is unsupported-by-design, adds runtime risk on the
  serialization layer, and still leaves the EOL problem.
- **Migrate to .NET 9 (STS).** Rejected: shorter support window than the net8 it
  replaces; net10 LTS is the durable target.

## Verification

On the .NET 10 SDK: `restore` + `build -c Release` clean; **472/472 tests pass** on
`net10.0`. Against a **real PostgreSQL 16**, the app applied **all existing
(EF 9-authored) migrations under the EF Core 10 runtime with no pending-model-changes
error**, then served `/api/v1/projects`,`/demands`,`/resources`,`/releases`,
`/notifications` (all 200) with STJ 10 serialization.


---

# ADR-0074 — Zeus brand themes (selectable, token-mapped)

**Status:** Accepted
**Date:** 2026-07-22
**Relates to:** ADR-0003 (inline-styled, token-driven frontend), ADR-0037 (WCAG AA
contrast tokens + gated colour-contrast), ADR-0056 (per-profile dark mode via CSS
variables)

## Context

The product owner approved a set of three **"Zeus" brand themes** — *Command* (deep
navy), *Daylight* (light) and *Carbon* (near-black) — supplied as a portable
`zeusthemes.css` of CSS custom properties (`--panel`, `--brandA`, `--accent`,
`--ok`, …). A standalone preview rendered real Atlas components in all three; the
next step is to make them **selectable inside the app**.

Atlas is inline-styled with no CSS framework (ADR-0003); every colour is a
`var(--atlas-<key>, <light-hex>)` reference written onto `:root` by
`applyThemeVars()`, keyed by a palette map (ADR-0056). Flipping the palette
re-skins the whole app with no per-component change. Zeus is therefore a natural
extension of the **existing** theming mechanism, not a new one.

## Decision

Add the three Zeus themes as **additional palettes in the same `colorPalettes`
map**, selected through a per-profile theme picker.

- **Palettes.** Each Zeus source palette is translated into the full Atlas token
  key set (`primary`, `surface`, `bg`, `accent`, status, borders, tints, `*Ink`
  text-on-tint pairs, sidebar tokens). Keys Zeus does not define are **derived**
  (tint washes; the `*Ink` readable-on-tint colours; sidebar tokens — the sidebar
  stays dark on the light *Daylight* theme, matching the Atlas layout idiom).
- **Selection.** `ThemeMode` (`light`/`dark`) is generalised to a `ThemeId`
  (`light` | `dark` | `zeus-command` | `zeus-daylight` | `zeus-carbon`). Each id
  maps to a palette and a light/dark `color-scheme`. `ThemeContext` stores the
  chosen id per profile (keyed by the cosmetic role identity, as ADR-0056), and a
  **theme picker** in the top bar replaces the old dark-mode toggle.
- **Default unchanged.** **Atlas Light stays the default** — the axe-gated palette
  (ADR-0037) is untouched, so nothing changes look unless a user opts in. **Atlas
  Dark** remains gated behind `DARK_MODE_ENABLED` (still off); the Zeus themes are
  not gated.
- **Fonts unchanged.** Colours only. Atlas keeps Space Grotesk / Public Sans /
  Space Mono (Space Grotesk display already matches Zeus). Adopting Zeus's IBM Plex
  body/mono is a separate, larger change (bundled font files) and is out of scope.
- **Charts.** `chart.*` stays literal hex — SVG presentation attributes don't
  resolve `var()` (as ADR-0056 notes); the vivid status hues read on every ground.
  Fully themeable charts are a noted follow-up.

## Consequences

**Positive**
- Three brand themes with zero per-screen changes — the token indirection already
  in place carries them.
- **Zeus Daylight is fully WCAG AA and colour-contrast gated** by the browser axe
  sweep (ADR-0037), alongside Atlas Light. Body text, tables, headings, surfaces,
  borders, status inks and sidebar tokens are AA on **all** palettes (the derived
  pairs were tuned with a contrast calculator).
- Reversible and low-risk: default look is unchanged; a profile can switch back to
  Atlas Light at any time.

**Negative / trade-offs**
- `color.primary` is a single token used **both** as the white-text button
  background (on every page) **and** as accent *text* (labels, KPI numbers, tab
  text — 144 call sites). On a light ground one mid-blue satisfies both; on a
  near-black ground it cannot (a blue dark enough for white button text is
  unreadable as text on the dark surface, and vice-versa). So the two **dark** Zeus
  themes (**Command**, **Carbon**) are **not colour-contrast gated yet**: they are
  selectable and structurally a11y-gated, exactly as **Atlas Dark** already is
  (ADR-0056). Only `primary`-coloured accents are low-contrast there; the rest is
  AA. **Follow-up:** split `primary` into a fill token and a text token app-wide
  (which also fixes Atlas Dark's white-on-primary buttons), then contrast-gate all
  five palettes.
- Charts don't yet re-skin per theme (follow-up).
- `design/` (the frozen prototype) does not include a theme picker or these
  palettes — flagged for the design team to regenerate; not hand-edited here.

## Alternatives considered

- **A separate CSS file / `data-theme` on `:root` (as shipped in `zeusthemes.css`).**
  Rejected: Atlas forbids global stylesheets (ADR-0003) and already resolves colours
  through `--atlas-*` tokens; a second variable namespace would fight the existing
  one and bypass the contrast gate.
- **Replace Atlas Light with Zeus.** Rejected: needlessly changes the default look
  and retires the axe-tuned reference palette; offering Zeus alongside is safer.
- **Include the Zeus fonts now.** Deferred: bundling IBM Plex is independent of the
  colour work and adds weight/licensing review; can be a follow-up ADR.

## Verification

`tsc` + production build clean. The browser axe sweep (`e2e/a11y.spec.ts`) runs the
7 routes on **Atlas Light** and a dense route subset on **Zeus Daylight** with the
**full** WCAG 2 A/AA rule set (colour-contrast included) — all pass. **Zeus Command**
and **Zeus Carbon** are swept for the same rule set **minus colour-contrast**
(structural a11y) — all pass. Each palette was screenshotted for visual
confirmation.


---

# ADR-0075 — Split `primary` into fill + text tokens; contrast-gate all themes

**Status:** Accepted
**Date:** 2026-07-22
**Relates to:** ADR-0037 (WCAG AA contrast tokens + gated colour-contrast),
ADR-0056 (per-profile dark mode), ADR-0074 (Zeus brand themes)

## Context

ADR-0074 shipped the three Zeus brand themes but could only colour-contrast-gate
the light ones (Atlas Light, Zeus Daylight). The two **dark** themes (Command,
Carbon) were selectable but structurally-gated only, because a single `color.primary`
token was doing two incompatible jobs:

- **A white-text button/badge background** (used on every page — the Export button,
  primary CTAs, active segmented controls, avatars). White text on it must meet AA,
  so it has to be a reasonably **dark** blue.
- **A foreground accent** — text, KPI numbers, tab labels, icons, borders, meter
  fills, indicator dots (144 `color:` uses). As text on a near-black surface it must
  be a **light** blue.

On a light ground one mid-blue satisfies both. On a near-black ground it cannot: dark
enough for white-on-fill is unreadable as text, and vice-versa. Atlas Dark (ADR-0056)
had quietly accepted the broken side (a light `primary`, so its white-on-primary
buttons fail); it ships disabled and was never gated, so nobody hit it.

## Decision

Split the brand colour into **two tokens**:

- **`primary`** — the **foreground/accent** (text, icons, borders, meters, dots).
  Tuned to read as text on each theme's surfaces (light-on-dark in the dark themes).
- **`primaryFill`** — the **background for white-content** buttons/badges/avatars.
  Dark enough for white text ≥ AA in every theme.

They are set **equal** in the light palettes (Atlas Light `#0F6CBD`, Zeus Daylight
`#0e6ab0`), so the default look is byte-for-byte unchanged. They diverge only in the
dark themes:

| theme | `primary` (accent text) | `primaryFill` (white-text bg) |
|-------|-------------------------|-------------------------------|
| Zeus Command | `#6fa8ef` | `#2c6fce` |
| Zeus Carbon  | `#6fb0f5` | `#2f6fd0` |
| Atlas Dark   | `#4C9DE0` | `#2c6fce` |

Call sites were repointed by role: **white-content backgrounds** (`background`/`bg`/
`tint` carrying `#fff` text) → `primaryFill`; **everything else** (all foreground text,
icons, borders, and decorative fills like unread dots, progress meters and timeline
markers) stays `primary`. The ~113 `color:` foreground sites were left untouched — the
lighter `primary` simply makes them readable on the dark grounds.

The axe sweep (`e2e/a11y.spec.ts`) now colour-contrast-gates **all three Zeus themes**,
promoting Command and Carbon from structural-only. This supersedes the ADR-0074
follow-up note.

## Consequences

**Positive**
- All three Zeus themes are fully WCAG AA and CI-gated for colour-contrast.
- The fix also repairs **Atlas Dark's** white-on-primary buttons (should it be
  re-enabled).
- Default look unchanged: `primary === primaryFill` on every light palette.

**Negative / trade-offs**
- One more brand token to keep in sync when defining a palette.
- New white-content buttons must use `primaryFill`, not `primary`, for their
  background — documented in `theme.ts`. Missing it is caught by the gate on the swept
  routes.
- Charts still don't re-skin per theme (unchanged from ADR-0074; SVG presentation
  attributes don't resolve `var()`).

## Alternatives considered

- **Leave the dark themes structurally-gated (ADR-0074 status quo).** Rejected: the
  product owner asked for all three fully AA.
- **Split the 144 foreground `color:` sites instead** (add `primaryText`, keep
  `primary` as the fill). Rejected: more call sites, higher churn, and every future
  brand-coloured label would need the non-default token; splitting the ~30 fill sites
  is smaller and the default (foreground) token keeps the intuitive name.

## Verification

`tsc` + build clean; 124 unit tests pass. The browser axe sweep runs the 7 routes on
Atlas Light and a dense subset on **each** Zeus theme with the **full** WCAG 2 A/AA
rule set (colour-contrast included) — all pass. Each palette re-screenshotted.


---

# ADR-0076 — Server-persisted theme preference + theme-aware charts

**Status:** Accepted
**Date:** 2026-07-22
**Relates to:** ADR-0056 (per-profile dark mode), ADR-0074 (Atlas brand themes),
ADR-0075 (primary fill/text split)

## Context

Two follow-ups to the Atlas brand themes (ADR-0074):

1. **Persistence was per-browser only.** The chosen theme was saved in
   `localStorage`, keyed by the cosmetic role persona — so it did not follow a
   signed-in user to another device or browser.
2. **Charts didn't re-skin.** `chart.*` was literal hex, so on the dark themes the
   structural greys (grid, progress-bar track, planned line) stayed light-grey and
   the status hues were fixed. (Text/surface tokens already themed via ADR-0074.)

## Decision

### Server-persisted theme (cross-device)

Add a per-user theme preference, mirroring the existing `DashboardLayout`
per-user store (which already "follows the user across devices; client falls back
to localStorage when signed out"):

- **Entity** `ThemePref { UserKey (PK), Theme }`, keyed by `Permissions.CallerKey`.
- **Endpoints** `GET /api/v1/prefs/theme` → `{ theme }` and `PUT /api/v1/prefs/theme`
  `{ theme }`. The PUT **whitelists** the known theme ids (server-authoritative;
  an unknown id is rejected 400) — kept in sync with `theme.ts` `THEMES`.
- **Client** (`ThemeContext`): signed **in**, hydrate the theme from the server on
  mount and write it back on change (best-effort); the theme is then **per user**,
  not per persona (persona switches don't reset it). Signed **out**, unchanged —
  `localStorage` per persona. `localStorage` remains an optimistic/offline cache.

### Theme-aware charts

Make `chart.*` themeable through the **same** CSS-variable mechanism as `color.*`:
each flat token becomes `var(--atlas-chart-<key>, <light-hex>)`, `applyThemeVars`
writes `--atlas-chart-*` for the active theme, and per-theme `chartPalettes` supply
the values. The chart primitives already apply colours via the `style` prop
(CSSOM), where `var()` resolves; the one remaining raw SVG `stroke=` attribute was
flipped to `style`. `chart.method` (methodology chip hues) stays literal — it reads
on every ground. Chart hues are graphics, not text, so they are **not**
contrast-gated; per-theme values are tuned for harmony.

## Consequences

**Positive**
- A signed-in user's theme follows them across devices/browsers; server is
  authoritative and validates the id.
- Charts (grid, track, planned, status hues, pipeline stages) re-skin per theme —
  the dark themes no longer show light-grey chart chrome.
- Both reuse existing machinery (the `DashboardLayout` pattern; the `--atlas-*`
  var system), so little new surface.

**Negative / trade-offs**
- One more per-user table + migration (`ThemePref`).
- New white-content charts must keep applying colours via `style` (not SVG
  attributes) for the var to resolve — documented in `charts.tsx`.
- Signed-in first paint on a new device briefly shows the local/default theme
  before the server value hydrates (one-frame flash; acceptable).

## Alternatives considered

- **A generic `UserSetting { UserKey, Key, Value }` KV** instead of a dedicated
  table. Rejected: the codebase uses dedicated per-feature per-user tables
  (`DashboardLayout`); matching that idiom is clearer than introducing a KV.
- **Keep charts literal and only theme the greys inline.** Rejected: piecemeal;
  the var mechanism already exists and covers all chart tokens uniformly.

## Verification

Backend: `dotnet build` clean; **472/472 tests pass** on net10; migration creates
only the `ThemePrefs` table. Frontend: `tsc` + build clean; 124 unit tests; axe
sweep 16/16. Verified end-to-end that `:root` carries the active theme's
`--atlas-chart-*` values (e.g. Atlas Carbon → `--atlas-chart-grid: #20242e`).


---

# ADR-0077 — Per-theme brand typography (IBM Plex on the Atlas brand themes)

**Status:** Accepted
**Date:** 2026-07-22
**Relates to / amends:** ADR-0074 (Atlas brand themes — "colours only, fonts
unchanged"), ADR-0003 (inline-styled, token-driven frontend), ADR-0056 (theming
via CSS variables)

## Context

ADR-0074 shipped the three Atlas brand themes as a **colours-only** change and
explicitly left fonts unchanged (Space Grotesk / Public Sans / Space Mono). The
brand themes originated from a preview whose typography paired Space Grotesk
(display) with **IBM Plex Sans** (body) and **IBM Plex Mono** (labels). The
product owner has now asked to bring that typography in.

Atlas Light must stay pixel-faithful to the prototype (CLAUDE.md §2), which uses
Public Sans / Space Mono — so the fonts cannot change globally.

## Decision

Make body/mono fonts **theme-aware**, through the same CSS-variable mechanism as
colours and chart hues:

- `font.body` / `font.mono` become `var(--atlas-font-body|mono, <light-stack>)`
  references; `applyThemeVars` writes `--atlas-font-body|mono` for the active theme.
- **Atlas Light & Atlas Dark keep** Public Sans / Space Mono (prototype-faithful).
- **Atlas Command / Daylight / Carbon use** IBM Plex Sans / IBM Plex Mono.
- `font.head` (display) stays **Space Grotesk** on every theme.
- The fonts are loaded the same way the app already loads its type — added to the
  Google Fonts `<link>` in `index.html` (IBM Plex Sans + IBM Plex Mono).

This **amends** ADR-0074's "colours only / fonts unchanged" note for the brand
themes; Atlas Light's typography is unchanged.

## Consequences

**Positive**
- The brand themes match their intended typographic identity; Atlas Light stays
  prototype-faithful.
- Reuses the `--atlas-*` var mechanism — `font.*` is applied via the `style` prop
  everywhere (364 sites), where `var()` resolves, so no per-component change.

**Negative / trade-offs**
- Two more webfont families on the Google Fonts request (slightly larger font
  payload; only fetched because they're in the CSS `<link>`). If the on-prem
  deployment has no egress to Google Fonts, self-hosting the families (or the
  embedded-@font-face approach) would be a follow-up — this matches the app's
  existing CDN-font strategy, so it's no worse than today.
- A brand-theme first paint may show the Public Sans fallback for a frame before
  the IBM Plex face loads (`display=swap`).

## Alternatives considered

- **Swap fonts globally to IBM Plex.** Rejected: breaks Atlas Light's prototype
  fidelity (CLAUDE.md §2) and ADR-0003's "match the prototype exactly".
- **Self-host / embed the fonts now.** Deferred: the app already loads fonts from
  the Google Fonts CDN; matching that keeps the change minimal. Self-hosting is a
  separate hardening step that would apply to all four families, not just IBM Plex.

## Verification

`tsc` + build clean; axe sweep 16/16 (fonts don't affect contrast). Confirmed
`:root` carries `--atlas-font-body: 'IBM Plex Sans', …` under Atlas Command and
`'Public Sans', …` under Atlas Light.


---

# ADR-0078 — Self-hosted fonts (no external font CDN)

**Status:** Accepted
**Date:** 2026-07-22
**Relates to:** ADR-0054 (on-prem single-node Docker), ADR-0003 (inline-styled,
token-driven frontend), ADR-0074/0077 (themes + per-theme typography)

## Context

The app loaded all its webfonts from the Google Fonts CDN via a `<link
rel="stylesheet">` in `index.html` (Space Grotesk, Public Sans, Space Mono, and —
after ADR-0077 — IBM Plex Sans/Mono). The on-prem deployment target (ADR-0054) has
**no outbound internet egress**, so those requests fail and every family falls back
to a system font — the app renders in the wrong typography.

## Decision

**Bundle the fonts and serve them same-origin.** No external font CDN.

- The latin + latin-ext subsets (Nordic/European glyph coverage) of every used
  family/weight are committed as `.woff2` under `src/fonts/`, with a generated
  `src/fonts/fonts.css` of `@font-face` rules referencing them by relative path.
- `fonts.css` is imported once in `main.tsx`; Vite bundles it, fingerprints the
  `.woff2` into `/assets/`, and nginx serves them same-origin. The Google Fonts
  `<link>` and its `preconnect`s are removed from `index.html`.
- Variable families (Space Grotesk, Public Sans, IBM Plex Sans) ship as one file
  per subset with each weight's `@font-face` mapping onto it; static families
  (Space Mono, IBM Plex Mono) ship one file per weight. After de-duplication:
  **18 files, ~334 KB** total (cached after first load).

`fonts.css` contains **only `@font-face` rules** — no component styling — so it
does not conflict with the inline-styles / no-global-stylesheet rule (ADR-0003);
it is the self-hosted equivalent of the font `<link>` it replaces.

## Consequences

**Positive**
- The app is **fully self-contained** — verified with all non-localhost requests
  blocked: **zero external requests** attempted, and IBM Plex Sans/Mono, Public
  Sans and Space Grotesk all load from local assets.
- Works in air-gapped on-prem; also removes a third-party runtime dependency and
  the privacy/latency cost of the CDN.

**Negative / trade-offs**
- ~334 KB of fonts committed to the repo and shipped in the image (small; cached).
- Adding a new family/weight now means adding its subset `.woff2` + `@font-face`
  (a small documented step) rather than editing a URL.
- Coverage is latin + latin-ext; scripts outside those ranges (e.g. Cyrillic,
  Greek, Vietnamese — offered by the CDN) are not bundled. Add those subsets if a
  future locale needs them.

## Alternatives considered

- **Keep the CDN link.** Rejected: breaks on the air-gapped target.
- **Base64-embed the fonts directly in the CSS.** Rejected: inflates the CSS bundle
  and forgoes separate caching/fingerprinting; separate `.woff2` assets are the
  standard, cache-friendly approach.
- **Bundle every subset (Cyrillic/Greek/Vietnamese too).** Deferred: latin +
  latin-ext covers the current locales; extra subsets are dead weight until needed.

## Verification

`tsc` + build clean; **0** `googleapis`/`gstatic` references in `dist`; with the
network blocked to all non-localhost hosts the page makes **0 external requests**
and `document.fonts` reports the families loaded. Axe sweep 16/16.


---

# ADR-0079 — Stakeholder relationship intelligence (coverage, strength, next engagement)

**Status:** Proposed — *awaiting product-owner decision (scope + fit)*
**Date:** 2026-07-23
**Relates to:** ADR-0001 (modular monolith), ADR-0004 (RBAC), ADR-0012
(empty-by-default / derive-on-read), ADR-0049 (deterministic risk engine, no LLM
in the decision path), ADR-0025/0037 (a11y), ADR-0074 (theming)

> This is a **scoping/decision record**, not an accepted design. It exists so the
> product owner can **accept, reshape, or reject** the capability before any code
> is written. If accepted, it graduates to *Accepted*, is added to CLAUDE.md §2
> "Approved extensions", and `design/` is flagged for regeneration.

## Context

A feature was proposed: *"Identify meaningful account stakeholders, assess
influence and relationship strength, surface coverage gaps and risks, and
recommend the next engagement."*

**What Atlas has today.** A per-project/programme **stakeholder register** with a
**power/interest (Mendelow) 2×2 matrix** (`StakeholderEntry`: name, role, Power
High/Low, Interest High/Low; `StakeholderMatrixCard`), plus a static
**communication plan** on the project Overview and periodic **Delivery Status**
stakeholder reporting.

**What it does not have.** Relationship *strength* (warmth/owner/last-contact),
**coverage-gap/risk** analysis, **next-engagement** recommendations, or any
**"account"** grouping. Atlas stakeholders are scoped to a *project* or
*programme*, never to an account.

**The fit question.** The request is **account / relationship-management** in
flavour — closer to CRM / customer-success than to Portfolio & Project Management.
Atlas deliberately has no account object. So this is not a defect in Atlas's
intended scope; it is a **new capability in an adjacent domain**. The first
decision is therefore *whether it belongs in Atlas at all* (build) vs *belongs in
the CRM* (integrate/defer).

## Proposed decision (for the PO to confirm)

**Recommended: a bounded, PMO-flavoured extension of the existing stakeholder
register — not a CRM.** Keep it scoped to the entities Atlas already owns
(project / programme; optionally a lightweight *engagement scope* grouping),
reuse the power/interest foundation, and keep every recommendation
**deterministic and rule-based** (no LLM in the decision path, ADR-0049). If the
org actually needs account-centric selling/relationship management, that belongs
in a CRM and Atlas should **integrate** rather than reimplement it.

### Scope if accepted

1. **Richer stakeholder profile.** Extend `StakeholderEntry` (or a new
   `StakeholderProfile`) with: **influence** (reuse Power), **relationship
   strength** (e.g. Champion / Supporter / Neutral / Blocker, or 1–5),
   **sentiment**, **owner** (the Atlas person accountable for the relationship),
   and **last-engaged date**. All manually maintained (empty-by-default, ADR-0012).
2. **Engagement log.** A new `StakeholderEngagement` row (date, channel, owner,
   note, optional outcome) so "last engaged" and cadence are derived, not typed.
3. **Coverage & risk view.** A derive-on-read panel that flags, per scope:
   *unowned* high-power stakeholders, *single-threaded* relationships (one owner /
   one contact), *stale* engagements (no contact in N days), *blockers/detractors*
   among high-power, and low-coverage quadrants of the matrix. These surface as
   stakeholder-coverage **risks** (distinct from RAID delivery risks).
4. **Next-engagement recommendation.** A **deterministic** ranker (owner-less →
   stalest → highest power × weakest relationship first) producing a prioritised
   "who to engage next and why" list. Explainable rule output, not a black box.

### Data / API / UI (sketch, if accepted)
- **Data:** extend `StakeholderEntry` + add `StakeholderEngagement`; per-scope,
  server-authoritative, audited; capability-gated (reuse `cap-approve`/governance,
  or a new `cap-stakeholders`).
- **API:** additive under the existing stakeholder group — coverage roll-up +
  engagement CRUD; roll-ups **derive on read** (ADR-0012), no new hot path.
- **UI:** built in the existing design language/tokens (theming per ADR-0074),
  extending the stakeholder matrix card with a **Coverage/Risks** tab and a
  **Next engagement** list; a11y-gated (ADR-0037). `design/` regen flagged.

## Consequences

**Positive** — turns the static 2×2 into an actionable engagement tool; reuses the
existing register, RBAC, derive-on-read, theming and a11y machinery; recommendations
stay explainable and auditable.

**Negative / risks** — **scope creep toward CRM** is the main danger (accounts,
pipelines, contacts belong elsewhere — hold the line at project/programme scope);
relationship/sentiment data is **people data** with GDPR implications (may fall
under the personnel-data processing gate, ADR-0063 — needs a DPIA check); manual
upkeep means the coverage view is only as good as the data entered.

## Alternatives considered

- **Do nothing** — the power/interest matrix stays as-is. Cheapest; leaves the
  ask unmet.
- **Integrate with a CRM** (read stakeholders/engagements from an external CRM and
  render coverage/risk in Atlas). Best if the org already runs a CRM — avoids
  reimplementing relationship management. Larger integration surface.
- **Full account-relationship module in Atlas** (accounts, contacts, pipelines).
  Rejected as a first step: it re-scopes Atlas from PPM into CRM.

## Open questions for the product owner

1. **Fit:** does this belong in Atlas (PPM) or in the CRM? Build vs integrate?
2. **Scope object:** project/programme only, or a new account/engagement grouping?
3. **Data sensitivity:** is relationship/sentiment data in scope for the
   personnel-data / DPIA gate (ADR-0063)?
4. **Recommendation transparency:** confirm deterministic-rules-only (no LLM),
   per ADR-0049.
5. **Ownership:** who maintains the register + engagement log (PM? PMO? account
   owner?), and which capability gates edits?


---

# ADR-0080 — Jira bidirectional write-back (push actions)

**Status:** Proposed — *awaiting product-owner decision (scope + fit)*
**Date:** 2026-08-03
**Amends / would supersede in part:** ADR-0006 (Jira pull-only, board-optional)
**Relates to:** ADR-0007 (background workers), ADR-0018 (full-field import),
ADR-0021 (delta + per-entity sync), ADR-0030 (background Jira sync),
ADR-0004 (RBAC), ADR-0009 (secrets), ADR-0065 (task-board moves = cap-schedule),
the platform threat model (`docs/threat-model.md`)

> This is a **scoping / decision record**, not an accepted design. It exists so
> the product owner can **accept, reshape, or reject** the capability before any
> code is written. Because it reverses a foundational decision, it must not be
> implemented until it graduates to *Accepted*, is recorded in CLAUDE.md §2
> "Approved extensions", and `design/` is flagged for regeneration.

## Context

Atlas integrates Jira as a **pull-only** sync (ADR-0006): every call in the
connector is a `GET` (issues, sprints, boards, JQL search, attachments), Atlas is
the **system of record for its own planning layer**, and the connector converges
by idempotent upsert + prune. ADR-0006 **explicitly rejected two-way sync** for
"conflict/ownership complexity and blast radius", and noted a future push model
"is possible but needs inbound endpoints".

A request has been raised to make the connector **bidirectional** — to write back
to Jira: create issues, transition state (move board columns), set
owner/assignee, edit details, and — at the far end — create new projects/boards
and then populate them.

**The core tension.** Reading is safe and convergent because data flows one way.
Writing makes Atlas and Jira **co-authoritative over the same objects**, which
introduces conflict, echo (a write that bounces back through the next sync and
clobbers), attribution, workflow-validity and blast-radius problems that ADR-0006
deliberately avoided. This ADR's first job is to decide *whether* and *how far* to
open write-back, not to assume a symmetric mirror.

## Feasibility (all capabilities map to real Jira APIs)

| Capability | Jira REST/Agile API | Notes |
|---|---|---|
| Create issue/task | `POST /rest/api/3/issue` | needs project + issuetype + required fields |
| Transition state / move column | `GET` then `POST /issue/{key}/transitions` | workflow-driven; a *column* is a board status |
| Set assignee/owner | `PUT /issue/{key}/assignee` | by Jira `accountId` |
| Edit details (summary/description/estimate/fields) | `PUT /issue/{key}` | ADF for rich text; custom-field ids per project |
| Create / manage sprint | `POST /rest/agile/1.0/sprint`, `POST /sprint/{id}/issue` | board-scoped |
| Create project | `POST /rest/api/3/project` | **Jira admin**; template + lead required |
| Create board | `POST /rest/agile/1.0/board` | **admin**; requires a saved filter |

The API surface is entirely available. The difficulty is **semantics and safety**,
not the calls.

## Proposed decision (for the PO to confirm)

**Recommended: bounded, explicit, user-initiated *push actions* — not a symmetric
background mirror.** Atlas stays system-of-record for its planning layer; writes
are discrete, intentional, audited operations a user triggers (e.g. "push this
card's status to Jira"), not a continuous two-way reconciliation. This keeps most
of the conflict/echo complexity out of scope while delivering the high-value
cases. Deliver in tiers; ship **Tier 1 first** and gate everything behind config +
capability + per-project opt-in.

### Scope if accepted — tiers

- **Tier 1 — issue write-back (recommended first pass).** Create issue, transition
  status (board-column move), reassign, edit summary/description/estimate. Maps
  directly onto the Kanban board and task edits Atlas already has. Highest value,
  most contained.
- **Tier 2 — sprint operations.** Create sprint, move issues in/out. Moderate.
- **Tier 3 — project & board creation (recommended *parked*).** Rare, needs Jira
  admin, highest blast radius; normally a one-time admin task. Left manual (or a
  heavily-guarded one-off), not a standing Atlas feature, unless the PO
  specifically requires it.

### The hard parts any implementation must solve

1. **Conflict & echo model.** Both sides now mutate the same issue. Need a
   resolution policy (recommend **Jira-wins on the mirrored fields**, Atlas
   authoritative only for its own planning overlay), an **echo-suppression** marker
   so a push doesn't re-import and clobber on the next sync, and a durable
   Atlas-id ↔ Jira-key mapping valid in both directions.
2. **Workflow/transition validity.** Cannot set `status = "Done"` directly — must
   read the valid transitions from the current status and only offer those, and
   handle transition screens / required fields (e.g. resolution).
3. **Reverse field & user mapping.** The read mappings (`MapIssueStatus`,
   `MapPriority`, ADF↔text) are intentionally lossy; write-back needs the inverse,
   per-project custom fields, required-field validation, and Atlas-person → Jira
   `accountId` resolution (today unknown assignees are only *flagged*).
4. **Attribution & auth (ADR-0009).** A service-account token makes every Atlas
   edit appear as one bot user and needs elevated scopes (Create/Edit/Transition;
   **admin** for Tier 3). True per-user attribution means OAuth 3LO — a large lift;
   call it out as an explicit decision.
5. **Authorization (ADR-0004, server-authoritative).** Reuse the existing
   capabilities — status/column moves under `cap-schedule` (consistent with
   ADR-0065), field edits under `cap-projects`; Tier 3 admin-only. Never a client
   security decision.
6. **Blast radius & safety.** Writes hit the team's *live* Jira. Require:
   **config guard** (`Jira:WriteEnabled`, default off), **per-project write opt-in**,
   full **audit** of every push, rate-limiting, a **dry-run/preview**, and
   confirm-before-push UX for destructive/irreversible actions.

### Data / API / UI (sketch, if accepted)
- **Data:** a per-issue link/mapping row (Atlas task ↔ Jira key) with a
  `lastPushedHash` / origin marker for echo-suppression; a per-project
  `jiraWriteEnabled` flag. No new hot path — writes are on-demand.
- **API:** additive, action-shaped endpoints under the existing Jira group
  (e.g. `POST /tasks/{id}/jira/push`, `POST /tasks/{id}/jira/transition`), each
  capability-gated and audited; reuse the existing `Jira.Client` (with write
  scopes) and paging/ADF helpers.
- **UI:** built in the existing design language — a "push to Jira" affordance on
  the task card / board move, a transition picker fed by *valid* Jira transitions,
  and a clear per-project write-enable switch in Integrations. `design/` regen
  flagged.
- **Freshness (related, separate):** for near-real-time convergence, replace
  polling with inbound **Jira webhooks** — the inbound endpoints ADR-0006 foresaw.
  Trackable as its own ADR; not required for Tier 1.

## Consequences

**Positive** — closes the loop so planners can drive Jira from Atlas (create,
transition, assign, edit) without leaving the tool; reuses the existing connector,
capability matrix, audit and theming; action-based scope avoids the worst of the
mirror-conflict problem.

**Negative / risks** — reverses ADR-0006's "no accidental write-back" guarantee;
introduces real conflict/echo/attribution complexity; a bug writes to production
Jira (mitigated by config guard + per-project opt-in + audit + dry-run); elevated
Jira scopes widen the connector's trust boundary (threat-model review required);
Tier 3 creation is high-privilege and low-frequency — poor cost/benefit as a
routine feature.

## Alternatives considered

- **Do nothing (stay pull-only).** Cheapest; leaves the ask unmet. Atlas remains a
  read-only mirror of Jira delivery.
- **Symmetric background two-way sync.** Rejected — this is exactly the
  conflict/ownership/blast-radius model ADR-0006 walked away from; the echo and
  merge complexity is high and the failure modes are silent.
- **Bounded push actions (recommended).** User-initiated, discrete, audited writes;
  most value for least conflict surface.
- **Full project/board provisioning from Atlas.** Rejected as a first step —
  admin-scoped, rare, high blast radius; re-scopes Atlas toward Jira
  administration.

## Open questions for the product owner

1. **Scope:** Tier 1 only for the first pass, or also Tier 2? Is Tier 3 (project/
   board creation) actually required, or can it stay a manual Jira-admin task?
2. **Conflict policy:** confirm **Jira-wins** on mirrored fields, with Atlas
   authoritative only for its own planning overlay?
3. **Attribution / auth:** acceptable to write as a single service account
   (simpler, but all edits show as one bot user), or is per-user OAuth 3LO
   required?
4. **Authorization:** reuse `cap-schedule` (moves) + `cap-projects` (edits), or
   introduce a dedicated `cap-jira-write`?
5. **Safety envelope:** confirm config-guarded + per-project opt-in + audited +
   dry-run as the minimum bar before any write ships.
6. **Freshness:** is inbound Jira-webhook support in scope now, or a later ADR?


---

# ADR-0081 — Generated API type contract (OpenAPI → TypeScript)

**Status:** Accepted
**Date:** 2026-08-04
**Relates to:** ADR-0041 (shared project-detail query hook), CLAUDE.md §6
(Data & API). Implements remediation item **R11 / #97**.

## Context

The backend defines ~177 DTO records (`server/Kernel/Dtos.cs` and per-module
files). The frontend re-typed those shapes **by hand**: ~173 `interface`
declarations across `src/screens/**/*.tsx`, and **zero** typed helpers in
`src/api.ts` — even though `api.ts` and CLAUDE.md §6 both point developers
there. Consequences:

- A backend DTO rename or type change **breaks nothing at compile time**. It
  produces `undefined` at runtime, in one panel, on one tab.
- The same contract gets typed more than once and drifts. The clearest case:
  `GET /projects/{id}/capacity` was fetched **identically in two places** —
  `Project.tsx` (types `CapacityRow` + `Capacity`) and `Gantt.tsx` (types
  `CapPerson` + `Capacity`) — same URL, same query key, same options, two
  independently hand-written type sets. (A *third*, unrelated `CapPerson` for
  `/capacity/insight` lived in `resources/Capacity.tsx` — a pure name
  collision, now `StaffPerson`.)

## Decision

Generate the frontend's API types from the server's OpenAPI document and check
the result into the repo, guarded by a CI drift check.

1. **Toolchain.** `openapi-typescript` (devDependency) + two npm scripts:
   - `api:openapi` → `server/openapi/dump-openapi.sh` emits
     `server/openapi/atlas-v1.json`.
   - `api:types` → runs `api:openapi`, then `openapi-typescript` →
     `src/api/generated.ts`.
   Both the document and the generated types are committed.

2. **Getting the document without a database.** Swashbuckle's
   `dotnet swagger tofile` does not understand this project's minimal-API
   top-level `Program` (it falls back to scanning for a `Startup` class). So the
   dump script takes the reliable route: it **boots the API briefly and reads
   the document it actually serves** at `/swagger/v1/swagger.json`. To run
   without Postgres, a new **off-by-default** config flag `Atlas:SkipDbInit`
   skips the startup migrate/seed block (endpoints still map, so the document is
   complete). The script also runs in the `Development` environment with auth
   disabled so the "anonymous-in-Production" boot fuse doesn't trip. `SkipDbInit`
   must never be set in a real deployment — the schema must be migrated before
   serving traffic.

3. **CI drift check.** A `contract` job regenerates both files and runs
   `git diff --exit-code`; any difference fails the build with "run
   `npm run api:types` and commit the result." Backend and frontend types can no
   longer silently diverge.

4. **Proof + first typed helpers.** `src/api.ts` now exports
   `Schemas = components["schemas"]` (the generated contract). The `/capacity`
   duplication is resolved: one shared `useCapacity` hook
   (`src/screens/project/useProject.ts`) consumed by both screens, typed from
   `Schemas["CapacityDto"]` / `Schemas["CapacityRowDto"]`. The stale
   commented-out example in `api.ts` is deleted.

## The response-schema limitation (important)

The generated file covers a contract **only where the server publishes a
schema for it**. Two things limit that today:

- **Anonymous responses.** Many handlers return `Results.Ok(new { … })`
  (anonymous objects), which publish no schema at all. (Known going in.)
- **Type-erased responses (the bigger one).** Even handlers that return a
  **named DTO** publish no *response* schema, because they return
  `Results.Ok(dto)` — whose static type is `IResult`, which erases the DTO.
  Swashbuckle only records a 200 body when the endpoint **declares** it, via
  `TypedResults.Ok<T>` or `.Produces<T>()`. At the time of writing **no**
  endpoint did either, so **only 5 of 334 operations publish a 200 response
  schema** (the `/capacity` one this change annotates, plus a handful of
  incidental ones). The 134 named schemas in the document are therefore almost
  all **request** DTOs.

Net: request shapes are well covered; **response shapes — which is what most of
the 173 hand-written interfaces are — are not, until each endpoint declares its
response.** This is a larger, more actionable finding than the "anonymous
objects" caveat in the issue: the fix is per-endpoint `.Produces<T>()` (for
already-named DTOs) applied as each screen is adopted. The `/capacity` endpoint
in this change is the worked example of that pattern.

## Adoption order (no wholesale migration in this change)

Adopt per screen, heaviest first, pairing each screen's interfaces with adding
`.Produces<T>()` to the GET endpoints it consumes (naming the DTO first where a
handler currently returns an anonymous object):

| # | Screen | Hand-written interfaces |
|---|--------|-------------------------|
| 1 | `screens/Project.tsx` | 16 |
| 2 | `screens/Gantt.tsx` | 15 |
| 3 | `screens/Admin.tsx` | 14 |
| 4 | `screens/Reports.tsx` | 9 |
| 5 | `screens/Products.tsx` | 9 |
| 6 | `screens/Ops.tsx` | 9 |
| 7 | `screens/Teams.tsx` | 8 |
| 8 | `screens/resources/Capacity.tsx`, `screens/Resources.tsx`, `screens/Okrs.tsx`, `screens/Methodologies.tsx` | 6 each |
| … | remaining screens | 1–5 each |

Each adoption step: add `.Produces<T>()` server-side → `npm run api:types` →
replace the screen's hand-written interfaces with `Schemas["…"]` → build.

## Consequences

- **Positive.** A backend DTO change now breaks the frontend at **compile
  time** (or fails the CI drift check), not at runtime. New response types are
  free once an endpoint declares its shape. The `/capacity` duplication — and
  the confusing triple `CapPerson`/`CapacityRow` naming — is gone.
- **Cost.** `api:types` boots the API (a few seconds) and needs the .NET SDK; the
  `contract` CI job carries that. `SkipDbInit` is a new startup branch (guarded,
  off by default, documented).
- **Follow-up.** Per-screen adoption (above) is tracked on #97's follow-ups; it
  is deliberately **not** attempted here. openapi-typescript marks every C#
  record field optional/nullable (it can't see C# non-nullability), so consumers
  either tolerate that or normalise at the boundary — `useCapacity` shows the
  normalise pattern (defaults applied once, view type derived from the generated
  one via a mapped `-? NonNullable<…>`).


---

# ADR-0082 — Persist dates as real `date`/`timestamptz`, format at the edge

**Status:** Proposed — *ADR only; no schema change in the introducing PR*
**Date:** 2026-08-04
**Relates to:** ADR-0081 (generated API type contract — the migrated shapes must
flow through `npm run api:types`), ADR-0018 / ADR-0021 (Jira import already
carries real ISO timestamps), CLAUDE.md §6 (Data & API). Implements
remediation item **R14 / #100**.

> This records a **decision + migration plan**. Per #100 the introducing change
> writes only this ADR and the interim CLAUDE.md rule — **no column is migrated
> and no EF migration is added here**. Each module's migration is a separate
> follow-up (listed at the end), sequenced *after* R11 so the regenerated types
> pick up the new shapes.

## Context

Atlas stores dates in **three different conventions, all typed `string`**,
distinguishable only by a trailing comment:

- **Display strings** — `"12 Sep 2026"`, `"Aug 04"`. ~23 columns.
- **ISO strings** — `"2026-09-12"`, ISO timestamps from Jira. ~25 columns.
- **Month labels** — `"Aug"`. A couple of columns.

Because the type is `string` for all three, nothing distinguishes them at the
type level, and the display ones carry real defects:

1. **Unsortable / unfilterable in SQL.** "Demands raised last quarter" cannot be
   a `WHERE` clause; no query orders by any display-date column because it can't.
2. **`Demand.Date` is lossy.** `Kernel/Domain.Portfolio.cs:46` is `"MMM dd"`
   (`"Jun 23"`), written at `Kernel/WriteEndpoints.cs:65`
   (`DateTime.UtcNow.ToString("MMM dd")`) — **no year**. Two demands twelve
   months apart are indistinguishable in storage. This is the worst offender.
3. **Locale-fragile read-back.** `Delivery/Gantt.cs:26` parses a display date
   with `DateTime.TryParse(display, …)` and **no `CultureInfo`** — it works only
   because `<InvariantGlobalization>true</InvariantGlobalization>` is set in
   `Atlas.Api.csproj:7`. Elsewhere (`Jira.cs`, `SecretRotation.cs`) parsing
   passes `InvariantCulture` explicitly, so even the convention is inconsistent.
4. **Frontend duplication.** The string contract forces the client to convert
   both ways: **12 near-duplicate `toIso`/`toDisplay` functions across 6 screens,
   with 6 separate month-name arrays** (Methodologies, Okrs, Products, Programs,
   Project, Portfolio).

There are **22 display-format write sites**, re-derivable with:

```bash
grep -rnoE 'ToString\("[^"]*MMM[^"]*"\)' server/**/*.cs   # 18 display-format sites
grep -rn 'ToString("yyyy-MM-dd HH:mm")' server/**/*.cs     # 4 watermark sites (Jira.cs)
```

## Options considered

1. **Leave as-is.** Zero cost now; the SQL-blindness, the lossy `Demand.Date`,
   the locale fuse and the frontend converter sprawl all remain. Rejected.
2. **ISO strings everywhere.** Normalise all date columns to ISO-8601 `string`.
   Fixes lexicographic sortability and losslessness cheaply (no type change), and
   kills the month-label/display conventions. But the column stays `string`: the
   database still can't do date arithmetic or range indexes, EF can't project a
   `DateOnly`, and "last quarter" is still a string comparison. A half-measure.
3. **Real `date` / `timestamptz` types (chosen).** Store each date as the
   Postgres type that matches its meaning, map to `DateOnly` / `DateTime` (UTC)
   in EF Core, and format for display **once, at the edge**. Highest migration
   cost, but it is the only option that makes dates first-class: sortable,
   filterable, range-indexable, and typed end-to-end through the ADR-0081
   generated contract.

## Decision

Adopt option 3.

- **Storage.** Each date column becomes a real Postgres type:
  - **`date` → `DateOnly`** for calendar dates with no time-of-day meaning:
    `Project.Target` / `Due` / `StartDate`, `Program`/`Product`/`Objective`
    start/end/target dates, `Demand.Date`, gate `Date`, decision `Date`,
    delivery-report `Date`, blocker/activity `Date`.
  - **`timestamptz` → `DateTime` (UTC)** for true instants:
    `*.CreatedAt` / `UploadedAt` / `DecidedAt`, backup timestamps, and the Jira
    sync watermarks. Npgsql maps `timestamptz` to a UTC `DateTime`; all writes
    use `DateTime.UtcNow` (already the case).
  - Columns that already hold **ISO strings** from Jira (`JiraCreated`,
    `StartedAt`, `ResolvedAt`, sprint dates, …) migrate opportunistically with
    their module — they are correct in value, just still `string`.
- **Wire format.** DTOs project dates to **ISO-8601 strings** (`date` →
  `yyyy-MM-dd`, `timestamptz` → round-trip `o`) at the API boundary, with
  `InvariantCulture`. ISO is stable, sortable and culture-independent, and flows
  through the ADR-0081 generated types unchanged.
- **Display.** Formatting moves to the **frontend edge**: one shared
  `formatDate(iso, style)` helper replaces all 12 converters and 6 month arrays.
  The server no longer produces display strings.
- **Read-back.** `Delivery/Gantt.cs`-style parsing disappears — the value is
  already a real date. `InvariantGlobalization=true` stays (it is defensible on
  its own), but no code will *depend* on it for date correctness.

## Consequences

- **Positive.** Dates become sortable/filterable/indexable in SQL; `Demand.Date`
  stops losing the year; the locale fuse stops being load-bearing; the frontend
  loses ~12 converters + 6 month arrays for one formatter; the three-conventions
  ambiguity is gone (the *type* now says what a column is).
- **Cost.** ~23 columns migrate with data-preserving EF migrations that must
  **parse existing display strings** into real dates (and, for `Demand.Date`,
  **infer the year** — see below). Each migration touches its module's DTOs,
  write sites, and the frontend screen that consumed the strings. This is why it
  is staged per module, not attempted at once.
- **`Demand.Date` back-fill is best-effort.** Existing `"MMM dd"` values have no
  year; the migration assigns the year that makes the date most recent but not
  in the future (nearest-past heuristic), logs each inference, and — because it
  cannot be certain — this is called out in the migration's PR. New writes store
  the full date, so the ambiguity ends at migration time.
- **EF mapping note.** `DateOnly` requires Npgsql's built-in `date` mapping (no
  converter needed on .NET 8+/Npgsql 8+). `timestamptz` requires the `DateTime`
  to be `DateTimeKind.Utc`; a model-level convention will assert this so a
  `Local`/`Unspecified` write can't slip through.

## Interim rule (holds until the migration completes)

Added to CLAUDE.md §9: **no new display-string date columns.** Every new date
field is `DateOnly` (calendar date) or `DateTime` UTC (instant), stored as
`date`/`timestamptz`, serialised as ISO at the API, and formatted for display on
the frontend. No `ToString("…MMM…")` into a persisted column.

## Migration order (per-module follow-ups — one PR each)

Each follow-up migrates one module's columns **and deletes that module's
frontend converter(s) in the same change**, then regenerates the R11 types.

1. **Portfolio — `Demand.Date` first** (actively lossy), then
   `Program`/`Product`/`Objective` start/end/target, blocker/activity `Date`,
   `CreatedAt`. Deletes `Portfolio.tsx`, `Programs.tsx`, `Products.tsx`,
   `Okrs.tsx` converters.
2. **Delivery** — `Project.Target`/`Due`/`StartDate`, delivery-report `Date`,
   artifact `UploadedAt`. Deletes `Project.tsx` converters.
3. **Governance** — decision `Date`/`DecidedAt`, artifact `UploadedAt`, gate
   `Date`.
4. **Operations** — demand/incident `Date`, `CreatedAt`.
5. **Platform** — audit/activity `Date`.
6. **Comms** — `Date`. Deletes `Methodologies.tsx` converter (create-project
   wizard) if still present.

Acceptance for the whole track (not this PR): the two `grep` patterns above
return **zero** persisted-column write sites, and
`grep -rn 'toIso\|toDisplay' src/screens` is empty.


---
