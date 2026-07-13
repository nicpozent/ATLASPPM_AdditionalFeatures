# Atlas PPM — User Stories

User stories for every feature and capability in Atlas, organised by **section**
(module) and tagged by **role**. Format:

> **US-<section>-<n>** — _As a **role**, I want **capability**, so that **benefit**._
> **Acceptance:** the conditions that make the story done.

> This catalogue is also browsable in-app under **Admin → User Stories**, and the
> readiness assessment under **Admin → Application Evaluation**. The structured
> source is `src/data/adminDocs.ts`; keep it and this doc in step.

### Roles

**Server-authoritative (canonical, 6):** `PlatformAdmin`, `PMO`,
`ProjectManager`, `TeamMember`, `Executive`, `Stakeholder`. The API enforces
these; UI role checks are cosmetic.

**UI identities (cosmetic, 16 — extensible):** Platform Admin, PMO, PM, PM Lead,
Global Engineering Manager, Global Service Manager, Developers Manager, Dev APAC
Manager, BLOG IT Manager, Infrastructure Manager, Infrastructure Manager APAC,
Chief Architect, CTO, CIO, Quality Manager, Stakeholder. Switching identity
changes visible nav + affordances (and which internal-labour rate lines are
visible). The regional managers (Dev APAC, BLOG IT, Infra APAC) clone a base
role's capabilities and differ only in rate visibility (ADR-0057). More can be
created in Admin → Roles & permissions.

**Capabilities** (examples): `cap-projects`, `cap-demands`, `cap-integrations`,
`cap-ops`, `cap-roadmap`, `cap-financials`, `cap-okrs`, view (V) / edit (E) /
full (F) levels. Authorization is always server-side.

---

## 1. Access & Identity

- **US-AUTH-1** — _As a **user**, I want to sign in with my Microsoft Entra
  account, so that I use one corporate identity with MFA._
  **Acceptance:** MSAL redirect sign-in; MFA honoured via Conditional Access;
  active account resolved before first render; API roles decoded from the access
  token.
- **US-AUTH-2** — _As a **PlatformAdmin (security)**, I want unattended sessions
  to sign out after 15 minutes of inactivity, so that an unlocked workstation
  can't be misused._
  **Acceptance:** idle > `VITE_AUTH_IDLE_MINUTES` (default 15, clamped 1–480) →
  MSAL logout; timer resets on pointer/keyboard/scroll/touch/focus; shared across
  tabs; inert when auth disabled.
- **US-AUTH-3** — _As a **user**, I want my role to decide what I can see and do,
  so that I'm not shown actions I can't perform._
  **Acceptance:** nav + affordances reflect role; every write re-checked
  server-side; a forbidden call returns 403 with a friendly message.
- **US-AUTH-4** — _As a **PlatformAdmin**, I want to run the whole UI without a
  backend during evaluation, so that stakeholders can browse the mockup._
  **Acceptance:** `VITE_AUTH_ENABLED=false` → no gate, empty states everywhere.
- **US-AUTH-5** — _As a **user**, I want a clear signed-in identity and a way to
  switch my UI role view, so that I understand which persona's nav I'm seeing._
  **Acceptance:** topbar shows identity + role switcher; switching changes nav
  only, never server permissions.
- **US-AUTH-6** — _As a **user**, I want a dark mode I can toggle per profile, so
  that each persona I use keeps my preferred appearance._
  **Acceptance:** a sun/moon toggle in the top bar flips light/dark app-wide via
  CSS variables; the choice persists in `localStorage` keyed by the selected
  identity (`atlas.theme.<role>`), so switching persona restores that persona's
  choice; the light palette (and its gated WCAG-AA contrast) is unchanged
  (ADR-0056).

## 2. Dashboard

- **US-DASH-1** — _As an **Executive/PMO**, I want an Executive dashboard (health
  donut, budget burn, KPI cards with sparklines, active projects, needs-attention,
  demand pipeline, recent activity), so that I see portfolio health at a glance._
  **Acceptance:** four layouts via segmented control; KPIs zero and tables empty
  until data loads.
- **US-DASH-2** — _As a **PM/Team member**, I want an Operational dashboard (my
  tasks/sprint, approvals, KPIs), so that I can run my day._
- **US-DASH-3** — _As a **power user**, I want a drag-and-drop Custom dashboard
  (widget palette, add/remove/reset) persisted server-side, so that I keep my own
  layout across sessions._
  **Acceptance:** layout saved per user; reset restores defaults.
- **US-DASH-4** — _As a **user**, I want a Compact dense layout, so that I can
  scan many items in little space._
- **US-DASH-5** — _As a **user**, I want the dashboard to auto-refresh and surface
  errors clearly, so that I trust the numbers._
  **Acceptance:** a failed load shows a friendly error, not a blank crash.

## 3. Portfolio & Blockers

- **US-PORT-1** — _As a **PMO/PM**, I want a Projects sub-tab with filter chips and
  project cards/table, so that I can scan and drill into any project._
  **Acceptance:** clicking a project opens Project Detail; filters by
  status/department.
- **US-PORT-2** — _As a **PM**, I want a Blockers sub-tab (list + side panel,
  status, description, filter), so that I can triage what's stuck._
  **Acceptance:** blockers clickable, editable, status lifecycle; also on a
  project's Blockers tab.
- **US-PORT-3** — _As an **Executive**, I want the portfolio timeline to show items
  even before rich data exists, so that the view isn't empty._
  **Acceptance:** windows derived from phases/tasks/sprints.
- **US-PORT-4** — _As a **PMO**, I want to filter the portfolio by department and
  owner, so that I focus on my slice._

## 4. Project Detail

- **US-PROJ-1** — _As a **PM**, I want an Overview tab (summary, communication plan,
  stakeholder matrix, skills panel, linked products) editable in place, so that the
  project's context is current._
- **US-PROJ-2** — _As a **PM/Team member**, I want Tasks in board and list views
  with drag, edit/delete, fields, sprint/epic dropdowns, assignee filter, and a
  Backlog tab, so that I can manage delivery work._
  **Acceptance:** manual create gated on capability; synced tasks read-only where
  appropriate; completion % auto-derived from task states.
- **US-PROJ-3** — _As a **PM**, I want Epics (clickable, edit/delete, multiple
  dependencies), so that scope structure is tracked._
- **US-PROJ-4** — _As a **PM**, I want Requirements (edit/delete, description,
  attachments, status categories), so that requirements trace to delivery._
- **US-PROJ-5** — _As a **PM**, I want a RAID log (risks/assumptions/issues/
  dependencies) with lifecycle, so that governance is auditable._
- **US-PROJ-6** — _As a **PM**, I want Artifacts with an artifact window, versions,
  upload, and status lifecycle, so that deliverables are versioned._
- **US-PROJ-7** — _As a **PMO/Finance**, I want a Costs tab (labor/license/PaaS/
  IaaS/SaaS + internal-labor lines), so that project spend is itemised._
- **US-PROJ-8** — _As a **Chief Architect/PMO**, I want Gates (G0–G5) with gate
  reviews, so that stage-gate governance is enforced._
- **US-PROJ-9** — _As a **PM**, I want Change Requests (editable fields, status,
  delete) and threaded Comments, so that change and discussion are recorded._
- **US-PROJ-10** — _As a **PM**, I want to edit project details (dates, owner,
  methodology, Jira/ADO mapping) from the detail screen, so that I don't need an
  admin._
  **Acceptance:** start/end reflected in Gantt; edits gated on capability.
- **US-PROJ-11** — _As a **PM**, I want the project detail content to match the
  chosen methodology, so that the screen fits how we work._
  **Acceptance:** e.g. Sprints tab only for agile-with-sprints.
- **US-PROJ-12** — _As a **PM**, I want an Ops-impact panel on Overview, so that I
  see run-the-business load pulling on delivery capacity._

## 5. Demands

- **US-DEM-1** — _As a **PMO**, I want a value-vs-effort scored intake funnel with
  drag across stages, so that I can prioritise demand._
- **US-DEM-2** — _As a **requester**, I want to create a demand with the full
  scoring form, so that my request is captured and comparable._
- **US-DEM-3** — _As an **approver**, I want to approve/reject a demand, so that
  intake is governed._
  **Acceptance:** create/approve modals; edits gated on `cap-demands`.
- **US-DEM-4** — _As a **Stakeholder**, I want to see my own demands, so that I
  track my requests without full portfolio access._
- **US-DEM-5** — _As a **PMO**, I want to convert an approved demand into a project,
  so that intake flows into delivery without re-keying._

## 6. Timeline / Gantt

- **US-GANTT-1** — _As a **PM**, I want a project timeline (phases, bars, milestones
  with an add-milestone modal, dependency arrows, month grid, export), so that I can
  plan and communicate schedule._
- **US-GANTT-2** — _As a **PM**, I want sprints shown below the schedule as
  collapsible phases, so that iteration cadence is visible._
- **US-GANTT-3** — _As a **PM**, I want synced Jira/ADO sprints to appear in the
  Schedule view, so that imported cadence shows without manual phases._
  **Acceptance:** project gantt returns sprint bars; undated sprints fall back to
  the project window.
- **US-GANTT-4** — _As a **PMO**, I want a Program-scope timeline derived from its
  projects, tasks and sprints, so that cross-project schedule is visible._
- **US-GANTT-5** — _As a **PM**, I want Resources and Sprints views on the timeline,
  so that I see allocation and cadence in context._
- **US-GANTT-6** — _As a **PMO/PM**, I want to choose a calendar window of up to five
  years (From/To + 1y/2y/3y/5y presets), so that I can see multi-year project,
  programme and portfolio schedules end-to-end._
  **Acceptance:** absolute-month layout spanning year boundaries; default is the
  current year; items outside the window are clipped/hidden (ADR-0058)._
- **US-GANTT-7** — _As a **PM**, I want the Tasks timeline to show each work-item's
  lifecycle (created → work-started → resolved) rather than a flat bar, so that I
  can see real progress and what's aging in the backlog._
  **Acceptance:** age track + status-coloured active segment + created/started/
  resolved markers; To-Do shows aging only; open runs to NOW; done ends at resolved;
  sort + status filter; virtualized for large backlogs; `StartedAt` from the Jira
  changelog's first status change and `ResolvedAt` from `resolutiondate`, best-effort
  and populated on the next sync (ADR-0059)._

## 7. Programs

- **US-PROG-1** — _As a **PMO**, I want a program list and detail (stakeholder
  power/interest matrix, linked projects, status, start/end), so that I manage
  programs._
- **US-PROG-2** — _As a **PMO**, I want to create programs and link/unlink projects,
  so that the program portfolio stays accurate._
- **US-PROG-3** — _As a **PMO**, I want to archive/delete a program, so that retired
  programs don't clutter the view._

## 8. Products

- **US-PROD-1** — _As a **PMO/Product owner**, I want a product portfolio with
  Jira/ADO tasks mapped to releases and linked projects, so that product delivery is
  tracked._
- **US-PROD-2** — _As a **Product owner**, I want product start/end dates and a
  timeline, so that product horizon is planned._
- **US-PROD-3** — _As a **Product owner**, I want a product team assignment with
  per-member allocations, so that product capacity is planned._

## 9. OKRs

- **US-OKR-1** — _As an **Executive/PMO**, I want objectives with key results linked
  to projects/programs/products, so that strategy connects to delivery._
- **US-OKR-2** — _As a **PMO**, I want KR progress auto-derived from linked entities
  with a manual RAG override, so that OKR status is trustworthy._
  **Acceptance:** edit/delete gated on `cap-okrs`.
- **US-OKR-3** — _As a **PMO**, I want an OKR timeline with spillover/warning/missed
  states, so that I see objectives against time._

## 10. Resources & Availability

- **US-RES-1** — _As a **resource manager**, I want people synced from Entra with
  allocation vs availability and per-person input rows by reporting period, so that
  capacity is planned._
- **US-RES-2** — _As a **manager**, I want time-phased allocation (per-assignment
  start/end, %-or-hours), so that allocation reflects reality over time._
- **US-RES-3** — _As a **manager**, I want an availability finder (who's free by
  date/range, stacked allocation), so that I can staff work._
- **US-RES-4** — _As a **PMO**, I want colour-graded Excel exports (allocation
  histogram, skills matrix), so that I can share offline._
- **US-RES-5** — _As a **manager**, I want allocation to include Ops load and
  absences, so that capacity numbers are honest._

## 11. Financials & ROI

- **US-FIN-1** — _As **Finance/PMO**, I want budget vs actual, CapEx/OpEx split,
  forecast-at-completion, savings/benefit, and portfolio ROI, so that I steer spend._
- **US-FIN-2** — _As **PMO/PM Lead**, I want internal-labor cost lines (Dev, Infra,
  PM, PO) editable by owning roles, so that internal cost is captured._
- **US-FIN-3** — _As an **Executive**, I want financials per project/program/product
  and overall, with a source toggle and forecast, so that I compare._
- **US-FIN-4** — _As an **Executive**, I want ROI per entity (manual + auto) with an
  explanation, so that I understand the number._

## 12. Delivery Status

- **US-DEL-1** — _As a **Stakeholder/Executive**, I want a stakeholder report by
  period (weekly→yearly): completed/in-progress/planned, velocity, on-time %,
  blockers, budget burn, so that I get a consistent status._

## 13. Releases

- **US-REL-1** — _As a **release manager**, I want a release calendar and deployment
  tracking with per-status tabs and an overall view, so that I plan deployments._
- **US-REL-2** — _As a **release manager**, I want Cancelled status plus archive/
  delete and edit, so that the calendar stays clean._
- **US-REL-3** — _As a **release manager**, I want to link a release to a project/
  product/program via a dropdown of both connector-mapped and manually-created
  entities, so that I don't hand-type ids and can't mistype._
  **Acceptance:** scope-aware dropdown fed by the list endpoints; legacy free-text
  kept as a "(current)" option.

## 14. Weekly Updates (News)

- **US-NEWS-1** — _As a **PMO**, I want an editable news wall (headline, highlight
  metric, shout-out, image, milestone, doc blocks) with themes + masonry and an edit
  mode, so that I broadcast curated updates._

## 15. My Team, Skills & Labor Rates

- **US-TEAM-1** — _As a **manager**, I want My Team with members, skills, and a
  roll-up view, so that I see my org._
- **US-TEAM-2** — _As a **manager**, I want a customizable skills/competency matrix
  (name-keyed ratings), so that I plan by capability._
- **US-TEAM-3** — _As a **manager**, I want an internal-labour rate card
  (Junior→Expert) with a day/month/hour calculator, so that I estimate internal
  cost._
  **Acceptance:** rates are **region-scoped** and **need-to-know** — each
  discipline×region line is visible **and** editable only by its owners, filtered
  server-side (no hidden rate on the wire); a persona owning none sees a restricted
  state. Lines & owners: Infra Sweden (Infra Mgr, Global Service Mgr, CTO, CIO),
  Infra APAC (Infra Mgr APAC, Global Service Mgr, CTO, CIO), Infra CH (Global
  Service Mgr, CTO, CIO); Dev Sweden (Global Eng Mgr, Developers Mgr, CTO, CIO),
  Dev APAC (Global Eng Mgr, Dev APAC Mgr, CTO, CIO), Dev BLOG (Global Eng Mgr,
  BLOG IT Manager, CTO, CIO), Dev CH (Global Eng Mgr, CTO, CIO); Architect
  Sweden/CH (Chief Architect, CTO, CIO); PM/PO Sweden (PMO, PM Lead, CTO, CIO),
  PM/PO CH (PMO, CTO, CIO). Three regional manager identities (Infrastructure
  Manager APAC, Dev APAC Manager, BLOG IT Manager) clone their base role's
  capabilities and differ only in rate visibility (ADR-0055, ADR-0057).

## 16. Methodologies & Create-Project Wizard

- **US-METH-1** — _As a **PMO/PM**, I want a methodology library (Waterfall, V-Model,
  Stage-Gate, Scrum, Kanban, SAFe, Scrumban, Spiral, Iterative, RAD, DevOps), so
  that projects follow a chosen way of working._
- **US-METH-2** — _As a **PM**, I want a create-project wizard (methodology →
  name/dept/owner → integration), so that projects start consistently._
  **Acceptance:** methodology drives the project's detail content.

## 17. Integrations

- **US-INT-1** — _As a **PlatformAdmin**, I want to configure connectors and Test
  connection, so that I confirm access before syncing._
  **Acceptance:** status never calls the remote; test/discovery degrade gracefully;
  gated on `cap-integrations`.
- **US-INT-2** — _As a **PM/PMO**, I want to discover and import Jira projects (to a
  new/existing project, a program, or an Ops service) with an optional board id, so
  that delivery data flows in._
- **US-INT-3** — _As a **PM/PMO**, I want to discover and import Azure DevOps
  projects and map them to Atlas projects, so that ADO work is tracked in Atlas._
- **US-INT-4** — _As a **PM**, I want a Sync now that pulls Jira/ADO into
  tasks/epics/sprints/backlog idempotently, so that Atlas mirrors the tracker
  without duplicates or clobbering manual rows._
  **Acceptance:** ADO iterations→sprints, work items→epics/tasks, no iteration ⇒
  backlog; prune-on-full-pull; bounded.
- **US-INT-5** — _As a **PM**, I want large syncs to run in the background, so that a
  portfolio-wide pull doesn't time out._
  **Acceptance:** 202 + jobId poll.
- **US-INT-6** — _As a **Service Manager**, I want the Jira → Ops import to carry the
  full issue (description, people, labels, components, versions, points, time,
  epics, comments, attachments), so that an Ops import is as faithful as a project
  import._
  **Acceptance:** epics import as items tagged Epic; children link by epic/parent
  key; comments/attachments idempotent by Jira id.
- **US-INT-7** — _As a **PlatformAdmin**, I want to connect a Microsoft Teams
  channel so that Atlas notifications also post there._
  **Acceptance:** an Incoming-webhook URL is configured, tested ("Send test") and
  saved; notifications post as an Adaptive Card; the raw webhook URL is a secret —
  it is never returned by any read endpoint, only a masked host via the connector
  status; gated on `cap-integrations` (ADR-0060, `docs/teams-setup.md`).

## 18. Reports

- **US-REP-1** — _As a **PMO**, I want branded portfolio/demand/blocker/audit
  reports with export formats, so that I share governed outputs._

## 19. Administration

- **US-ADM-1** — _As a **PlatformAdmin**, I want a roles & permissions matrix, so
  that I assign capabilities to roles._
- **US-ADM-2** — _As a **PlatformAdmin**, I want backups/restore, an audit log, AD
  sync, and install/integration guides, so that I operate the platform._
- **US-ADM-3** — _As a **Data Protection Officer**, I want a Data Privacy tab: DSAR
  export, erase, run-retention, and deletion requests, so that I meet GDPR
  obligations._
- **US-ADM-4** — _As a **PlatformAdmin**, I want to configure the idle-logout timeout
  and SSO/MFA, so that session policy meets our standard._
- **US-ADM-5** — _As a **PlatformAdmin**, I want an Application Evaluation view and a
  User Stories catalogue in-app, so that I can review readiness and scope without
  leaving Atlas._
- **US-ADM-6** — _As a **PlatformAdmin**, I want a database password rotation age
  panel with 90/180-day nudges, so that credential hygiene is visible._
- **US-ADM-7** — _As a **PlatformAdmin / security lead**, I want an in-app Security
  Posture view, so that I can see the application-security scanning posture without
  leaving Atlas._
  **Acceptance:** a read-only **Admin → Security Posture** tab lists the scanners
  (SAST/SCA/DAST + CodeQL), how to run them (CI, the off-GitHub
  `scripts/security-scan.sh`, or air-gapped), the scoped documented exceptions, and
  the manual-pen-test pointer; the page makes **no external calls** and the app
  runs no scans itself (ADR-0051/0053).

## 20. Help

- **US-HELP-1** — _As a **user**, I want role-based guides, articles, and contact,
  plus troubleshooting with support codes, so that I self-serve._

## 21. Governance

- **US-GOV-1** — _As a **Chief Architect**, I want stage gates (G0–G5) and gate
  reviews (architecture/security), so that decisions are gated._
- **US-GOV-2** — _As a **Chief Architect**, I want an ARB sign-off panel, architecture
  domains/waivers, and TOGAF ADM phases, so that architecture is governed._
- **US-GOV-3** — _As a **governance lead**, I want a decision log (ADR) with
  edit/delete, so that decisions are recorded._
- **US-GOV-4** — _As a **compliance officer**, I want a security/compliance module
  with control mappings and configurable review gates, so that controls have
  evidence._
  **Acceptance:** a deterministic risk engine (`Risks.cs`, no LLM) evaluates each
  project's real data and maps findings to GDPR, ISO 27001, ISO 42001, PCI-DSS,
  SOC 2, NIS2, NIST CSF 2.0 and MITRE ATT&CK, with a generic per-framework
  coverage rule so a new framework maps without code; a Zero-Trust posture
  (verify-explicitly / least-privilege / assume-breach / continuous-monitoring)
  is mapped to existing controls (ADR-0049).
- **US-GOV-5** — _As a **QA lead**, I want a Quality module (plan → stages → tests +
  defects, tasks/test cases per plan), so that quality is tracked._
- **US-GOV-6** — _As a **compliance officer**, I want each project's AI use
  classified under the EU AI Act and ISO 42001, so that AI obligations are explicit
  and evidenced._
  **Acceptance:** the security profile records a risk tier
  (minimal/limited/high/prohibited), an Annex III flag, human-oversight and
  transparency measures, and the AI system/model name; the engine derives
  obligations from the tier — prohibited → Art 5; high/Annex III → human oversight
  (Art 14) + risk-management & data-governance (Art 9/10, ISO 42001); limited →
  transparency (Art 50); in-scope-but-unclassified is flagged to triage (Art 6).
  The Security tab shows an AI-classification card when AI is in scope (ADR-0050).
- **US-GOV-7** — _As a **compliance officer**, I want a Statement of Applicability
  covering every ISO 27001:2022 Annex A control, so that I can record — and
  evidence to an auditor — which controls apply, why, and their implementation
  status._
  **Acceptance:** the Security tab shows all 93 Annex A controls grouped by the
  four themes (Organizational/People/Physical/Technological); each has an
  applicability toggle, justification, status and owner, with a coverage roll-up
  (applicable / excluded / reviewed / implemented %); the catalogue is fixed
  reference data so coverage is complete by construction; editing needs
  `cap-approve` and is audited (ADR-0066).

## 22. Ops (run-the-business)

- **US-OPS-1** — _As a **Service Manager**, I want Ops services with work items
  (type/priority/status/assignee/allocation %), archivable, so that BAU work is
  tracked and counts against capacity._
- **US-OPS-2** — _As a **Service Manager**, I want to import/sync a Jira space as an
  Ops service and link existing project tasks to a service, so that a service is fed
  by both Jira and real delivery tasks._
  **Acceptance:** linked tasks read-only; allocation stays with their project (no
  double-counting).
- **US-OPS-3** — _As a **Service Manager**, I want to filter the board by Jira
  work-item status and multi-select items for bulk delete, so that I triage the way
  I think and clear synced noise quickly._
- **US-OPS-4** — _As a **PM**, I want an Ops "impact project" tag, so that a project's
  Overview shows operational load pulling on its capacity._

## 23. Roadmap

- **US-ROAD-1** — _As a **PMO/Exec**, I want a strategic roadmap in Now/Next/Later
  **and** by-year boards plus a timeline, with milestones/links/dependencies, so
  that I plan strategy at the right horizon._
  **Acceptance:** create initiatives by year; gated on `cap-roadmap`.

## 24. PI Planning

- **US-PIP-1** — _As a **RTE/PMO**, I want a Program Increment Planning module
  showing team free-time for the PI period, so that I plan increments against real
  capacity._

## 25. Notifications & Capacity Intelligence

- **US-NOTIF-1** — _As a **user**, I want a notification center, subscribe buttons,
  and preferences, so that I follow what matters._
- **US-NOTIF-2** — _As a **manager**, I want over-allocation alerts (delivered,
  deduplicated), so that I catch capacity problems early._
- **US-CAP-1** — _As a **manager**, I want capacity intelligence (skills-based
  staffing suggestions, my-allocations, capacity-vs-demand), so that I staff
  effectively._
- **US-NOTIF-3** — _As **PMO / Chief Architect / CTO / CIO / PM Lead**, I want to
  be notified automatically whenever a demand is created or changes status, so
  that portfolio leadership sees intake without subscribing to each demand._
  **Acceptance:** role-addressed in-app notification on create + status/approval;
  email to those role members too, resolved via the in-app group→role mapping
  (`EntraGroup.ManagerKey` → member email), default-on with per-person opt-out;
  the actor isn't self-notified._
- **US-NOTIF-4** — _As a **team**, I want Atlas notifications to also land in our
  Microsoft Teams channel, so that we see portfolio activity where we already
  work._
  **Acceptance:** when a Teams webhook is configured and enabled, notifications
  post as an Adaptive Card to the channel in addition to in-app + email; the
  webhook secret is never exposed by a read endpoint (ADR-0060).

## 26. Stakeholder Experience

- **US-STK-1** — _As a **Stakeholder**, I want a reduced navigation (my projects, my
  demands, delivery, releases, weekly updates, help), so that I see only what's
  relevant._
  **Acceptance:** `Stakeholder` role gets `NAV_STAKEHOLDER_*`; the API scopes data
  to the stakeholder.

## 27. Platform & Observability (operator)

- **US-OBS-1** — _As an **operator**, I want traces, metrics, logs (OTLP),
  health/readiness endpoints, and correlation IDs on errors, so that I can diagnose
  incidents._
- **US-OBS-2** — _As an **operator**, I want a reference Grafana/Tempo/Prometheus/
  Loki stack and dashboard with tuned alert rules, so that I stand up observability
  quickly._
- **US-OBS-3** — _As an **operator**, I want same-origin nginx edge, security
  headers/CSP, rate limiting, and secrets via env/Docker secrets, so that the
  deployment is hardened._
- **US-OBS-4** — _As an **operator**, I want the recurring background jobs to run in
  a separate container from the request-serving API, so that a portfolio-wide
  scheduled sync or retention pass can't starve user requests._
  **Acceptance:** a process role (`Atlas__Role` = web/worker/all) selects behaviour
  from one image; `docker-compose.yml` ships `api` (web) + `worker` (worker); the
  default `all` keeps single-container behaviour for the smallest installs
  (ADR-0048).
- **US-OBS-5** — _As a **security lead**, I want automated application-security
  scanning on every change and runnable off GitHub, so that the OWASP-Top-10
  baseline stays clean between manual pen-tests._
  **Acceptance:** `security-scan.yml` runs gating SAST (Semgrep) + SCA/secrets/IaC
  (Trivy) on push/PR and on-demand DAST (OWASP ZAP) against a test server;
  `scripts/security-scan.sh` runs the same SAST + SCA (and optional `--dast`) from
  any machine or on-prem agent with no GitHub connection; CodeQL is enabled via the
  repo's default-setup toggle; the scope and remediation register for the manual
  engagement live in `docs/pentest-scope.md` (ADR-0051/0053).
- **US-OBS-6** — _As an **operator**, I want a performance-smoke gate and a k6
  load/perf suite, so that a latency regression on the hot roll-up endpoints is
  caught before release._
  **Acceptance:** `perf-smoke.yml` (`workflow_dispatch`) stands up a throwaway
  Postgres + a seeded API and runs the single-VU k6 smoke pass over the hot roll-up
  endpoints, failing on any error or p95 past budget; `load`/`stress` stay manual
  against a real test server; the seeder is a throwaway-DB fixture, never production
  (ADR-0047).
- **US-OBS-7** — _As an **operator**, I want a tag-triggered release pipeline and a
  documented on-prem Docker deployment, so that I can ship a reproducible build to
  our own infrastructure._
  **Acceptance:** pushing a `v*.*.*` tag builds and publishes versioned `api`/`web`
  images to GHCR (Buildx + report-only image scan, ADR-0052); the supported target
  is on-prem single-node Docker (`docker compose`: web/worker/db/nginx edge), off
  the public internet, upgraded by pull-and-recreate — Kubernetes is parked, not
  required, at portfolio scale (ADR-0054).

## 28. Real-time Collaboration & Whiteboard

- **US-RT-1** — _As **any user**, I want to see who else is on a board with me and
  where their cursor is, so that we can plan together in real time._
  **Acceptance:** presence avatars, live peer cursors and off-screen peer
  indicators appear on the PI Program Board, the demand funnel, the project task
  board and the whiteboard; a live indicator shows the connection; collaboration
  (presence/cursors/refresh) is open to every role — only the writes are
  capability-gated (ADR-0061).
- **US-RT-2** — _As **Platform Admin / PMO / Project Manager / PM Lead**, I want to
  move task cards on the project board and have everyone see the move instantly,
  so that the board stays current for the team._
  **Acceptance:** a status-only card move needs Edit on `cap-schedule` (those four
  roles); the move is audited and broadcast to peers within ~1s; every other task
  edit still needs `cap-projects`; keyboard: focus a card, Arrow Left/Right moves
  it between columns (ADR-0065).
- **US-WB-1** — _As a **planner**, I want a freeform whiteboard on an entity (PI,
  project, program, release, product, roadmap), so that I can brainstorm with
  shapes, connectors, freehand, icons and methodology templates._
  **Acceptance:** drag-to-create-and-resize shapes, drag-from-a-handle to connect,
  a Templates dropdown (mind map / fishbone / one per methodology), colour
  palette, and Save menu export/import (PNG/SVG/JSON) + clear; the scene persists
  as typed rows and is scope-gated by the same capability as the entity (ADR-0064).
- **US-WB-2** — _As a **planner**, I want to co-edit the whiteboard live with
  colleagues without our changes clobbering each other, so that a workshop works._
  **Acceptance:** each node/edge op is an authorized, sanitised single-row write
  broadcast to peers (server-only op broadcast — clients can't inject ops); edits
  to different items are independent; same-item edits reconcile on refetch
  (ADR-0064).
- **US-WB-3** — _As a **keyboard / assistive-tech user**, I want to operate the
  whiteboard without a mouse, so that the canvas is accessible._
  **Acceptance:** the canvas is a labelled application region; each node is a
  focusable, labelled button; focusing selects it; arrow keys move it (Shift =
  fine nudge), Enter/F2 edits text, Delete removes it.

---

_Traceability: each story maps to a built feature (see the tracked feature list
and `building-blocks.md` ABB/SBB) and the in-app **Admin → User Stories** tab.
Authorization statements are enforced server-side per ADR-0004; UI role behaviour
is cosmetic per CLAUDE.md §7._
