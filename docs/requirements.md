# Atlas PPM — Requirements Specification

Consolidated requirements for **Atlas**, the Portfolio & Project Management
platform for Birgma / Biltema Group. This is the normative companion to the
role-framed [`user-stories.md`](./user-stories.md), the [architecture building
blocks](./architecture/building-blocks.md) and the [decision log](./architecture/adr/).

## How to read this document

- Requirements use RFC-2119 keywords: **SHALL** (mandatory), **SHOULD**
  (recommended), **MAY** (optional).
- IDs are stable: **FR-** functional, **NFR-** non-functional, **CR-** candidate
  (proposed / not yet built). Never renumber; retire with a status of *Withdrawn*.
- Each requirement carries a **status**:
  - **[Implemented]** — built and in `main`.
  - **[Partial]** — core built; a named aspect is outstanding.
  - **[Candidate]** — proposed, not built (see §5).
- **Trace** links the requirement to its realising building block (ABB/SBB) and,
  where one exists, the ADR that decided it. Authorization statements are enforced
  **server-side** (ADR-0004); UI role behaviour is cosmetic (CLAUDE.md §7).

---

## 1. Scope & context

Atlas is a **modular-monolith web application**: a React 18 + TypeScript SPA
served same-origin behind an nginx edge, talking to a .NET 10 minimal API
(`/api/v1`) backed by PostgreSQL 16 (EF Core 10). It integrates with Microsoft
Entra ID (SSO + directory), Jira and Azure DevOps (delivery data), and Microsoft
Graph (mail). The supported deployment target is **on-prem single-node Docker**
(ADR-0054). Recurring background work runs in a separate worker process
(ADR-0048).

**In scope:** portfolio/programme/product/project management, demand intake &
governance, resource capacity & financials, delivery reporting, releases,
roadmap, PI planning, Ops (run-the-business) work, governance/compliance, and
platform administration.

**Out of scope (today):** public/anonymous access; a native mobile app; the
connectors listed as candidates in §5; multi-tenant hosting.

---

## 2. Actors & roles

| Actor | Description |
|-------|-------------|
| Platform Admin | Configures the platform, roles, integrations, backups, privacy. |
| PMO / PM Lead / PM | Run the portfolio and projects. PM Lead == PM capabilities (ADR-0029/RBAC). |
| Executive (CTO / CIO) | Portfolio-level oversight, financials, ROI, rate visibility. |
| Managers (Global Engineering, Global Service, Developers, Dev APAC, BLOG IT, Infrastructure, Infrastructure APAC) | Own teams, allocations and region-scoped rate lines. |
| Chief Architect | Architecture governance (ADM, ARB, gates, decisions). |
| Quality Manager | Quality module (test plans, stages, defects). |
| Team Member | Delivery work (tasks, epics, comments). |
| Stakeholder | Reduced experience: own projects/demands + delivery/releases/news/help. |
| Operator | Runs the deployment (observability, hardening, releases). |

**Canonical server-enforced roles (6):** `PlatformAdmin`, `PMO`,
`ProjectManager`, `TeamMember`, `Executive`, `Stakeholder`. UI identities (16,
extensible) are cosmetic; regional managers clone a base role's capabilities and
differ only in labour-rate visibility (ADR-0057).

- **FR-ROLE-1** [Implemented] The system SHALL enforce authorization server-side
  via a capability matrix (`cap-*` with View/Edit/Full levels); a forbidden call
  SHALL return 403 with a friendly message. *Trace: ABB-02 / SBB-04, ADR-0004.*
- **FR-ROLE-2** [Implemented] The system SHALL allow new UI roles to be defined
  in Admin → Roles & permissions and made selectable/enforced. *Trace: SBB-04, ADR-0046.*

---

## 3. Functional requirements

### 3.1 Access & identity
- **FR-AUTH-1** [Implemented] The system SHALL authenticate users via Microsoft
  Entra ID (OIDC/MSAL), resolving the active account before first render and
  decoding API roles from the access token. *Trace: ABB-02 / SBB-03, ADR-0005.*
- **FR-AUTH-2** [Implemented] The system SHALL sign out unattended sessions after
  a configurable idle period (`VITE_AUTH_IDLE_MINUTES`, default 15, clamped
  1–480), reset on user activity and shared across tabs. *Trace: SBB-03, ADR-0038.*
- **FR-AUTH-3** [Implemented] The system SHALL run the full UI without a backend
  when `VITE_AUTH_ENABLED=false`, showing empty states (evaluation mode). *Trace: ABB-01, ADR-0012.*
- **FR-AUTH-4** [Implemented] The system SHALL provide a top-bar identity display
  and a UI role switcher that changes visible navigation/affordances only, never
  server permissions. *Trace: SBB-04, ADR-0046.*
- **FR-AUTH-5** [Implemented] The system SHALL offer a per-profile dark mode
  toggle persisted in `localStorage` keyed by identity, leaving the (WCAG-AA
  gated) light palette unchanged. *Trace: SBB-01, ADR-0056.* **Note:** the toggle
  is currently feature-flagged **off** (`DARK_MODE_ENABLED`) pending completion.

### 3.2 Dashboard
- **FR-DASH-1** [Implemented] The system SHALL provide four dashboard layouts —
  Executive, Operational, Compact, and a drag-and-drop Custom builder — selectable
  via a segmented control. *Trace: ABB-01.*
- **FR-DASH-2** [Implemented] The Custom dashboard layout SHALL persist per user
  server-side, with add/remove/reset. *Trace: SBB-01, ADR-0023.*
- **FR-DASH-3** [Implemented] The dashboard SHALL auto-refresh and render a
  friendly error (not a blank crash) on a failed load. *Trace: ABB-01, ADR-0044-error handling.*

### 3.3 Portfolio & blockers
- **FR-PORT-1** [Implemented] The system SHALL provide a Projects view (filter
  chips by status/department/owner, cards/table) that drills into Project Detail. *Trace: ABB-01.*
- **FR-PORT-2** [Implemented] The system SHALL provide a Blockers view (list +
  side panel, description, status lifecycle, filter), mirrored on a project's
  Blockers tab. *Trace: ABB-10.*

### 3.4 Project detail
- **FR-PROJ-1** [Implemented] The system SHALL provide a Project Detail screen
  with tabs: Overview, Tasks, Epics, Requirements, RAID, Artifacts, Costs, Gates,
  plus Change Requests, Comments and (methodology-dependent) Sprints. *Trace: ABB-01/ABB-10.*
- **FR-PROJ-2** [Implemented] Tasks SHALL be manageable in board and list views
  (drag, edit/delete, fields, sprint/epic dropdowns, assignee filter, Backlog
  tab); manual create SHALL be capability-gated; project completion % SHALL be
  auto-derived from task states. *Trace: SBB-24, ADR-0020.*
- **FR-PROJ-3** [Implemented] Overview SHALL support in-place editing of summary,
  communication plan, stakeholder matrix, skills panel and linked products. *Trace: ABB-01.*
- **FR-PROJ-4** [Implemented] Requirements SHALL support description, attachments
  and status categories; Artifacts SHALL support versions, upload and a status
  lifecycle; RAID SHALL support a lifecycle. *Trace: ABB-04/ABB-10.*
- **FR-PROJ-5** [Implemented] Costs SHALL itemise labour / license / PaaS / IaaS /
  SaaS plus internal-labour PM & PO lines editable only by owning roles. *Trace: SBB-04, ADR-0031.*
- **FR-PROJ-6** [Implemented] Project detail content SHALL adapt to the chosen
  methodology (e.g. Sprints tab only for agile-with-sprints). *Trace: ABB-01.*
- **FR-PROJ-7** [Implemented] Editing project details (dates, owner, methodology,
  Jira/ADO mapping) SHALL be possible from the detail screen and reflected in the
  Gantt; edits SHALL be capability-gated. *Trace: ABB-03.*
- **FR-PROJ-8** [Implemented] The task board SHALL be a real-time collaboration
  room (live presence, peer cursors, instant refresh, open to all roles). Moving a
  card between columns is a status-only change gated on `cap-schedule` (Platform
  Admin, PMO, Project Manager, PM Lead) and audited; every other task edit stays
  behind `cap-projects`. The board SHALL be keyboard-operable (focus a card;
  Arrow Left/Right moves columns). *Trace: SBB-27, ADR-0061/0065.*
- **FR-PROJ-9** [Implemented] The Overview People & roles panel SHALL provide a
  **Delivery roles** group — a **Technical Lead** (always) and a **Scrum Master**
  (offered only when the project's methodology is agile: Scrum / Kanban / SAFe /
  Scrumban / Disciplined Agile / XP, decided server-side). Candidates SHALL come
  from the **onboarded application roster** (resource directory + Entra members),
  not a mapped architecture team; assignment SHALL be gated on
  `admin`/`pmo`/`pm`/`pmlead`, server-enforced, audited, and stored as
  `RoleAssignment` rows. *Trace: ABB-01, ADR-0070.*

### 3.5 Demands (intake)
- **FR-DEM-1** [Implemented] The system SHALL provide a value-vs-effort scored
  intake funnel with drag across stages. *Trace: ABB-01.*
- **FR-DEM-2** [Implemented] Users SHALL create demands via a full scoring form
  (with attachments) and approvers SHALL approve/reject; edits SHALL be gated on
  `cap-demands`. *Trace: ABB-10.*
- **FR-DEM-3** [Implemented] Approved demands SHALL be convertible into projects
  without re-keying. *Trace: ABB-03.*
- **FR-DEM-4** [Implemented] Demand submission SHALL require an authenticated
  Entra session — there is **no anonymous/public intake endpoint** (the `/api/v1`
  surface requires authorization; CORS is same-origin). Stakeholders submit as
  signed-in internal users via *My Demands*. *Trace: ABB-02/SBB-03, ADR-0004.
  See CR-INT-6 for a proposed external intake portal.*
- **FR-DEM-5** [Implemented] On demand create and status/approval change, the
  system SHALL notify portfolio leadership (PMO / Chief Architect / CTO / CIO /
  PM Lead) in-app and by role-addressed email (default-on, per-person opt-out),
  never self-notifying the actor. *Trace: SBB-12, ADR-0043/0045.*

### 3.6 Timeline / Gantt
- **FR-GANTT-1** [Implemented] The system SHALL provide project, programme and
  portfolio timelines with phases, bars, milestones (add-milestone modal),
  dependency arrows, a month grid and export. *Trace: ABB-01, ADR-0029.*
- **FR-GANTT-2** [Implemented] The timeline SHALL show sprints (manual and
  Jira/ADO-synced) as collapsible phases below the schedule; undated sprints SHALL
  fall back to the project window; sprint bars SHALL carry their real dates and the
  Project Schedule SHALL **auto-fit the visible window to the selected project's
  own span** so a project whose timeline is in another year is not hidden behind
  the default calendar year. *Trace: SBB-09/SBB-25.*
- **FR-GANTT-6** [Implemented] The system SHALL render **dependency arrows**
  between timeline items — project/program/product/release/sprint — for
  hand-added and Jira-derived links (generic `TimelineDependency`, source
  manual\|jira\|project). The Portfolio timeline SHALL let planners draw/remove
  links (`cap-projects`) and fold in existing project→project links; sprint-level
  arrows SHALL render on the Project timeline (editable) and Program timeline
  (read-only); a guarded, idempotent endpoint SHALL derive sprint→sprint links
  from a project's cross-sprint Jira issue links. *Trace: SBB-29.*
- **FR-GANTT-3** [Implemented] Programme and portfolio timelines SHALL derive
  windows from their projects', tasks' and sprints' dates so views are not empty. *Trace: ADR-0029.*
- **FR-GANTT-4** [Implemented] The timeline SHALL support a **calendar window of
  up to five years** selected by From/To month pickers plus 1y/2y/3y/5y/This-year
  presets, laying items out on an absolute-month model that spans year boundaries;
  bars outside the window are clipped/hidden. *Trace: ABB-01, ADR-0058.*
- **FR-GANTT-5** [Implemented] The Tasks timeline SHALL present each work-item as
  a **lifecycle** (created → work-started → resolved): an age track, a
  status-coloured active segment, and created/started/resolved markers; To-Do
  items show only the age track (aging in the backlog); open items run to a NOW
  line. It SHALL offer sort (created / status / longest-running) and a status
  filter, and SHALL virtualise the row list for large backlogs. *Trace: ABB-01, ADR-0059.*
- **FR-GANTT-7** [Implemented] Each sprint bar in the project-timeline Schedule
  band SHALL take a distinct hue from the established Atlas palette (cycled by row
  order), with a matching chip in the left rail, so consecutive sprints read as
  separate bands even when they share a status; status stays the rail label and
  undated sprints stay dashed. *Trace: SBB-25.*

### 3.7 Programmes, products, OKRs
- **FR-PROG-1** [Implemented] The system SHALL provide a programme list and detail
  (stakeholder power/interest matrix, linked projects, status, start/end),
  create, link/unlink projects, and archive/delete. Programme **start/end dates
  SHALL be editable from the detail header** (not only at creation), gated on
  `cap-projects`, and reflected on the programme/portfolio timeline. *Trace: ABB-01.*
- **FR-PROD-1** [Implemented] The system SHALL provide a product portfolio with
  Jira/ADO tasks mapped to releases, linked projects, start/end dates and a
  timeline, and a product team with per-member allocations. *Trace: ABB-01/SBB-18.*
- **FR-OKR-1** [Implemented] The system SHALL provide objectives with key results
  linked to projects/programmes/products; KR progress SHALL be auto-derived from
  linked entities with a manual RAG override; an OKR timeline SHALL show
  spillover/warning/missed states. *Trace: ABB-01, ADR-0012.*

### 3.8 Resources, availability & financials
- **FR-RES-1** [Implemented] The system SHALL sync people from Entra and show
  allocation vs availability with per-person input rows by reporting period. *Trace: SBB-10.*
- **FR-RES-2** [Implemented] The system SHALL support time-phased allocation
  (per-assignment start/end, %-or-hours) and an availability finder (who's free by
  date/range, stacked allocation). *Trace: SBB-18, ADR-0013.*
- **FR-RES-3** [Implemented] Capacity numbers SHALL include Ops load and absences;
  the system SHALL raise deduplicated over-allocation alerts and provide capacity
  intelligence (skills-based staffing, my-allocations, capacity-vs-demand). *Trace: SBB-24, ADR-0024/0028.*
- **FR-RES-4** [Implemented] The system SHALL export colour-graded Excel
  (allocation histogram, skills matrix). *Trace: SBB-21, ADR-0015.*
- **FR-RES-5** [Implemented] The My-Team skills/competency matrix SHALL be
  **manager-scoped**: visible only to a team's manager (or Platform Admin), with
  each skill column owned by a manager slot so a manager sees only their own team's
  skills (plus legacy shared ones); create SHALL be per-team-unique, and
  rename/delete/rating and export SHALL be refused for columns outside the
  caller's scope. *Trace: SBB-20, ADR-0016.*
- **FR-RES-6** [Implemented] By-person utilisation SHALL reflect the selected
  **period** (day/week/month/quarter/half/year) and an arbitrary **date-to-date
  window**: `GET /resources` accepts optional `from`/`to` and SHALL return each
  person's Ops/Project/Product load **averaged over the working days in the
  window**, using the same time-phased engine as the single-day roster and the
  Excel export (shared in-memory helpers so they cannot drift). The period toggle
  SHALL map to a concrete calendar window; a date-range filter SHALL override it
  and the export SHALL follow the selection. *Trace: SBB-24, ADR-0071.*
- **FR-FIN-1** [Implemented] The system SHALL present budget vs actual, CapEx/OpEx
  split, forecast-at-completion, savings/benefit and ROI, overall and per
  project/programme/product, with a source toggle and an ROI explanation. *Trace: ABB-01.*
- **FR-FIN-2** [Implemented] The system SHALL provide an internal-labour rate card
  (Junior→Expert) with a day/month/hour calculator, where each **discipline×region
  line** is visible **and** editable only by its owning roles, filtered
  server-side (no hidden rate on the wire). The **Platform Administrator SHALL
  never see rates** (segregation of duties): it owns no line and — unlike before —
  SHALL NOT preview rates by switching persona; `RateIdentities` pins every
  identity to its own role in both auth modes and drops `admin`, and the rate card
  is hidden for that persona. *Trace: SBB-04, ADR-0055/0057.*

### 3.9 Delivery, releases, weekly updates
- **FR-DEL-1** [Implemented] The system SHALL produce a stakeholder delivery report
  by period (weekly→yearly): completed/in-progress/planned, velocity, on-time %,
  blockers and budget burn. *Trace: ABB-01.*
- **FR-REL-1** [Implemented] The system SHALL provide a release calendar and
  deployment tracking with per-status tabs (incl. Cancelled), an overall view,
  edit/archive/delete, and scope-aware linking to connector-mapped or manual
  projects/products/programmes. The **calendar view SHALL render a month grid**
  (Monday-first, prev/next/Today) with each release as a status-coloured chip on
  its target date plus an undated footer, clickable to open the editor. *Trace: ABB-01.*
- **FR-NEWS-1** [Implemented] The system SHALL provide an editable news wall
  (headline, highlight metric, shout-out, image, milestone, doc blocks) with
  themes, masonry layout and an edit mode. *Trace: ABB-07.*

### 3.10 Methodologies, integrations, reports
- **FR-METH-1** [Implemented] The system SHALL provide a methodology library
  (Waterfall, V-Model, Stage-Gate, Scrum, Kanban, SAFe, Scrumban, Spiral,
  Iterative, RAD, DevOps) and a create-project wizard (methodology → details →
  integration) that drives detail content. *Trace: ABB-01.*
- **FR-INT-1** [Implemented] The system SHALL let admins configure connectors and
  run a Test connection that never calls the remote for status; gated on
  `cap-integrations`. *Trace: SBB-09/SBB-25.*
- **FR-INT-2** [Implemented] The system SHALL discover and import Jira projects (to
  a new/existing project, a programme, or an Ops service) with an optional board
  id, and sync idempotently into tasks/epics/sprints/backlog without duplicating
  or clobbering manual rows; a full pull prunes, a delta does not. *Trace: SBB-09, ADR-0006/0018/0021.*
- **FR-INT-3** [Implemented] The Jira import SHALL carry the full issue
  (description, people, labels, components, versions, points, time, epics,
  comments, attachments) **and** the issue changelog needed to derive lifecycle
  timestamps (started/resolved). *Trace: SBB-09, ADR-0018/0059.*
- **FR-INT-4** [Implemented] The system SHALL discover, map and sync Azure DevOps
  projects (WIQL work items → epics/tasks, iterations → sprints, delta pulls),
  idempotent by `AdoId`. *Trace: SBB-25, ADR-0035/0036/0044.*
- **FR-INT-5** [Implemented] Large syncs SHALL run in the background (202 + jobId
  poll) so a portfolio-wide pull cannot time out. *Trace: SBB-11, ADR-0030/0039.*
- **FR-INT-6** [Implemented] The system SHALL post notifications to a configured
  Microsoft Teams channel (Incoming-webhook + Adaptive Card) as a third channel;
  the webhook secret SHALL NOT be returned by any read endpoint (only a masked
  host via the connector status); gated on `cap-integrations`. *Trace: SBB-12, ADR-0060.*
- **FR-REP-1** [Implemented] The system SHALL produce branded portfolio / demand /
  blocker / audit reports with export formats. *Trace: ABB-01.*

### 3.11 Ops, roadmap, PI planning
- **FR-OPS-1** [Implemented] The system SHALL model Ops services and work items
  (type/priority/status/assignee/allocation %), archivable, counting against
  capacity, with a project-impact tag surfaced on the project Overview. *Trace: SBB-19, ADR-0014.*
- **FR-OPS-2** [Implemented] Ops SHALL import/sync a Jira space and link existing
  project tasks (read-only, no double-counting), filter by Jira status and
  bulk-delete. *Trace: SBB-19, ADR-0034/0042.*
- **FR-ROAD-1** [Implemented] The system SHALL provide a strategic roadmap in
  Now/Next/Later **and** by-year boards plus a timeline, with
  milestones/links/dependencies, gated on `cap-roadmap`. *Trace: SBB-23, ADR-0019.*
- **FR-PIP-1** [Implemented] The system SHALL provide PI Planning showing team
  free-time for the PI period against real capacity. *Trace: SBB-18.*
- **FR-RT-1** [Implemented] The system SHALL provide real-time collaboration on a
  SignalR room hub — live presence, peer cursors and off-screen peer indicators —
  across the PI Program Board, demand funnel, task board and whiteboard.
  Collaboration is open to all roles; domain writes stay capability-gated, and
  peers render only server-authorised operation broadcasts (clients cannot send
  ops). *Trace: SBB-27, ADR-0061.*
- **FR-WB-1** [Implemented] The system SHALL provide a per-entity freeform
  whiteboard (PI, project, program, release, product, roadmap) with shapes,
  connectors, freehand, icons, methodology templates and PNG/SVG/JSON
  export/import. Scenes SHALL persist as typed rows with per-row co-editing ops
  (single-row writes), be server-sanitised, and be gated by the same capability as
  the entity. *Trace: SBB-28, ADR-0064.*

### 3.12 Governance & compliance
- **FR-GOV-1** [Implemented] The system SHALL enforce stage gates (G0–G5) with
  architecture/security gate reviews and an ARB sign-off panel, TOGAF ADM phases,
  architecture domains/waivers, and an editable decision log (ADR). The Governance
  tab's architecture & security **review checkpoints** SHALL be an add/editable
  list (Gate/Type/Reviewer/Date/Status) backed by the project security record,
  scope-gated and audited. *Trace: SBB-15, ABB-10.*
- **FR-GOV-2** [Implemented] The system SHALL provide a deterministic risk engine
  (no LLM) mapping each project's real data to GDPR, ISO 27001, ISO 42001,
  PCI-DSS, SOC 2, NIS2, NIST CSF 2.0 and MITRE ATT&CK via a generic per-framework
  coverage rule, plus a Zero-Trust posture mapping. *Trace: SBB-15, ADR-0049.*
- **FR-GOV-3** [Implemented] The system SHALL classify each project's AI use under
  the EU AI Act (tier + Annex III) and ISO 42001 and derive obligations
  (Art 5/6/9/10/14/50). *Trace: SBB-15, ADR-0050.*
- **FR-GOV-4** [Implemented] The system SHALL provide a Quality module (plan →
  stages → tests + defects, tasks/test cases per plan). Each test task SHALL carry
  description/steps, start & due dates, assignee and a planned time-to-spend,
  editable in a task window (due-before-start validated); a plan MAY link a Jira
  agile board and ingest its issues as test tasks (reusing the Jira sync client,
  idempotent by issue key, config- and board-guarded, `cap-quality`, audited).
  *Trace: SBB-15, SBB-30, ADR-0018.*
- **FR-GOV-6** [Implemented] The data-classification & privacy profile SHALL list
  **every** applicable DPIA/PIA obligation when multiple processing factors are in
  scope (special-category → Art. 9/35, automated decisions → Art. 22, Restricted
  classification, personal data → Art. 30, cardholder data → PCI-DSS), reporting
  the strongest applicable level. *Trace: SBB-15.*
- **FR-GOV-5** [Implemented] The system SHALL provide a per-project ISO 27001:2022
  Statement of Applicability covering all 93 Annex A controls (four themes), each
  with an applicability decision, justification, implementation status and owner,
  plus a coverage roll-up. The catalogue SHALL be fixed reference data (complete
  coverage by construction); editing a decision SHALL require `cap-approve` and be
  audited. *Trace: SBB-15, ADR-0066.*

### 3.13 Administration & privacy
- **FR-ADM-1** [Implemented] The system SHALL provide a roles & permissions matrix,
  backups/restore, audit log, AD sync, install/integration guides, an Application
  Evaluation view and a User Stories catalogue in-app. *Trace: ABB-10.*
- **FR-ADM-2** [Implemented] The system SHALL provide a Data Privacy surface (DSAR
  export, erase, run-retention, deletion requests) for GDPR. *Trace: SBB-22, ADR-0017.*
- **FR-ADM-3** [Implemented] The system SHALL show a DB password-rotation age panel
  (90/180-day nudges) and a read-only Security Posture view (scanners, how to run,
  exceptions) that makes no external calls. *Trace: SBB-14, ADR-0051/0053.*
- **FR-ADM-4** [Implemented] The system SHALL map Entra app-registration groups to
  manager slots; group members SHALL feed the assignee dropdowns (Project
  Manager/Product Owner from PM Lead + PMO pools; architecture roles from the
  Chief-Architect-mapped team; a Security Officer slot). *Trace: SBB-04, ADR-0057.*

### 3.14 Stakeholder & help
- **FR-STK-1** [Implemented] The `Stakeholder` role SHALL receive a reduced nav (my
  projects, my demands, delivery, releases, weekly updates, help) with the API
  scoping data to the stakeholder. *Trace: SBB-04.*
- **FR-HELP-1** [Implemented] The system SHALL provide role-based guides, articles,
  contact and troubleshooting with support codes. *Trace: ABB-01, ADR-0044.*

---

## 4. Non-functional requirements

### 4.1 Performance & scalability
- **NFR-PERF-1** [Implemented] Hot roll-up endpoints SHALL meet a p95 latency
  budget enforced by a k6 smoke gate; load/stress suites SHALL exist. *Trace: SBB-26, ADR-0047.*
- **NFR-PERF-2** [Implemented] Large views (e.g. 1,000+ task timelines) SHALL
  virtualise rendering to stay responsive. *Trace: ADR-0059.*
- **NFR-PERF-3** [Implemented] The SPA SHALL be route-level code-split with vendor
  chunking so initial download is shell + vendor only. *Trace: ADR-0027.*
- **NFR-PERF-4** [Implemented] Connector syncs SHALL be paged and bounded and, for
  large pulls, run off the request path. *Trace: ADR-0030/0039.*

### 4.2 Availability & resilience
- **NFR-AVL-1** [Implemented] The system SHALL expose `/health` (liveness) and
  `/readyz` (DB-reachability, 503 when down) so orchestrators don't route to a
  broken instance. *Trace: ABB-08, ADR-0010.*
- **NFR-AVL-2** [Implemented] Recurring background jobs SHALL be runnable in a
  separate worker container so a scheduled sync/retention pass can't starve user
  requests. *Trace: SBB-11, ADR-0048.*
- **NFR-AVL-3** [Implemented] A stale code-split chunk after deploy SHALL recover
  via a guarded one-time reload rather than a persistent crash. *Trace: ADR-0027.*

### 4.3 Security & hardening
- **NFR-SEC-1** [Implemented] All state-changing operations SHALL be authorized
  server-side; the client SHALL never be the authorization boundary. *Trace: ADR-0004.*
- **NFR-SEC-2** [Implemented] The edge SHALL apply security headers/CSP, CORS
  (same-origin), rate limiting and upload size limits; the API image SHALL run
  non-root with a least-privilege DB role. *Trace: SBB-14, ADR-0008.*
- **NFR-SEC-3** [Implemented] Secrets SHALL come from a layered provider stack —
  environment/Docker `/run/secrets` (never VCS), with optional Azure Key Vault and
  an on-prem **OpenBao/HashiCorp Vault (KV v2)** provider — each inert unless
  configured, a vaulted secret taking precedence over env/appsettings, and a vault
  read failure non-fatal to boot. *Trace: SBB-16, ADR-0009, ADR-0067.*
- **NFR-SEC-6** [Implemented] The system SHALL support **passwordless database
  authentication** via TLS client-certificate auth (server `hostssl … cert
  clientcert=verify-full`; app presents a client cert whose CN is the DB role; no
  password in the connection string), so the database credential need not exist.
  *Trace: SBB-16, ADR-0069, `docs/postgres-cert-auth.md`.*
- **NFR-SEC-7** [Implemented] Sensitive personnel notes (DPIA-gated Team SWOT +
  development plans) SHALL be **encryptable at rest** with AES-256-GCM using a key
  sourced from the secret layer and never stored in the database; encryption SHALL
  be inert until the key is set (no forced migration), support zero-downtime key
  rotation, and fail closed (an undecryptable value is not shown, never crashes).
  *Trace: SBB-31, ADR-0068.*
- **NFR-SEC-4** [Implemented] Every change SHALL be scanned by gating SAST
  (Semgrep) + SCA/secrets/IaC (Trivy) with a triaged baseline, on-demand DAST
  (OWASP ZAP), and a portable off-GitHub scan script. *Trace: SBB-14, ADR-0051/0053.*
- **NFR-SEC-5** [Implemented] Sessions SHALL idle-time-out per policy (NFR default
  15 min). *Trace: ADR-0038.*

### 4.4 Privacy & compliance
- **NFR-PRIV-1** [Implemented] The system SHALL support GDPR data-subject actions
  (export, erase) and a retention/anonymisation job. *Trace: SBB-22, ADR-0017.*
- **NFR-PRIV-2** [Implemented] Significant actions SHALL be recorded in an audit
  log. *Trace: ABB-10.*
- **NFR-PRIV-3** [Implemented] Compliance mappings SHALL be deterministic and
  evidence-based (no LLM in the risk path). *Trace: ADR-0049/0050.*

### 4.5 Accessibility, i18n & usability
- **NFR-A11Y-1** [Implemented] Shared primitives SHALL meet an accessibility
  baseline (focus management, dialogs, menus, ≥44px targets); CI SHALL run a
  browser-based full-page axe sweep with **gated colour-contrast** (WCAG AA). *Trace: ADR-0025/0026/0033/0037.*
- **NFR-A11Y-2** [Implemented] The pointer-first surfaces SHALL be keyboard/AT
  operable: the whiteboard canvas is a labelled application region with focusable,
  labelled nodes (arrow-move, Enter/F2 edit, Delete), and the Kanban/funnel drag
  boards support focus + Arrow-key moves. *Trace: SBB-27/SBB-28.*
- **NFR-I18N-1** [Implemented] The UI SHALL be driven by a message catalogue with
  6 locales and a completeness test. *Trace: SBB-02.*
- **NFR-UX-1** [Implemented] Every data view SHALL have loading / empty / error
  states; empty SHALL be the correct default with no fabricated seed data. *Trace: ADR-0012, CLAUDE.md §2.*
- **NFR-UX-2** [Implemented] The UI SHALL match the approved prototype and use only
  the design tokens and three fonts (no CSS framework/global styles). *Trace: ADR-0003, CLAUDE.md §3.*

### 4.6 Observability & maintainability
- **NFR-OBS-1** [Implemented] The system SHALL emit OTLP traces/metrics/logs,
  correlation IDs on unexpected errors, and domain metrics (sync duration, queue
  depth, capacity alerts, DB command duration), with a reference
  Grafana/Tempo/Prometheus/Loki stack, tuned dashboards and alert rules. *Trace: SBB-13, ADR-0010/0032/0040.*
- **NFR-MNT-1** [Implemented] The backend SHALL ship an xUnit suite (run in CI) and
  the frontend lint/typecheck/build + per-screen logic tests; large screens SHALL
  be decomposed into per-tab modules. *Trace: ADR-0033/0041.*
- **NFR-MNT-2** [Implemented] Decisions SHALL be captured as immutable ADRs;
  documentation SHALL be code (Markdown + Mermaid). *Trace: ADR-0011.*

### 4.7 Data & portability
- **NFR-DATA-1** [Implemented] Persistence SHALL be transactional and migratable
  (EF Core migrations); roll-ups SHALL derive on read from empty-by-default data. *Trace: SBB-07/08, ADR-0002/0012.*
- **NFR-DATA-2** [Implemented] A JSON backup SHALL be a logical export and restore
  a merge; `pg_dump` remains authoritative for full DR. *Trace: ADR-0022.*
- **NFR-DEP-1** [Implemented] The system SHALL deploy as on-prem single-node Docker
  (api=web + worker + db + nginx, one image/role) via a tag-triggered pipeline
  publishing versioned images to GHCR; hosts upgrade by pull-and-recreate. *Trace: SBB-17, ADR-0052/0054.*
- **NFR-CFG-1** [Implemented] Configuration SHALL be externalised and
  environment-specific; the process role (`Atlas__Role`) SHALL select
  web/worker/all from one image. *Trace: SBB-16, ADR-0048.*

---

## 5. Candidate requirements (proposed, not built)

These are tracked with the product team; each will get an ADR when a concrete
technology/design is chosen.

- **CR-INT-1** [Candidate] Additional connectors, each mirroring the Jira/ADO
  pattern: ServiceNow, ManageEngine SDP, GitHub, Confluence, Microsoft Teams,
  Slack, Power BI. *Trace gap: ABB-05.*
- **CR-INT-6** [Candidate] **External / anonymous demand intake** — a public,
  unauthenticated demand-submission form (or a scoped external portal) feeding the
  intake funnel with anti-abuse controls (captcha, rate limit, moderation queue),
  since today intake requires an internal Entra session (FR-DEM-4). *Trace gap: ABB-05/ABB-02.*
- **CR-UX-1** [Candidate] Re-enable per-profile dark mode (currently flagged off)
  after completing the remaining surface sweep. *Trace: ADR-0056.*
- **CR-UX-2** [Candidate] Extend the browser axe sweep and end-to-end journeys to
  each new high-traffic view as it lands. *Trace: ADR-0033.*
- **CR-INT-7** [Candidate] Import per-status transition history beyond first-move
  (full cycle-time / lead-time analytics) from Jira/ADO changelogs. *Trace: ADR-0059.*
- **CR-DEP-1** [Candidate] Kubernetes deployment target (parked; not required at
  current portfolio scale). *Trace: ADR-0054.*
- **CR-PLAT-1** [Candidate] Native/responsive mobile app beyond the current
  responsive web + mobile drawer. *Trace gap: ABB-01.*

---

## 6. Traceability

Each functional requirement links to its realising **ABB/SBB**
([building-blocks.md](./architecture/building-blocks.md)) and, where decided, its
**ADR** ([adr/](./architecture/adr/)). Role-framed acceptance criteria for the
same scope live in [user-stories.md](./user-stories.md); the in-app **Admin →
Application Evaluation** view tracks readiness. This document, the user stories,
and `src/data/adminDocs.ts` are kept in step.
