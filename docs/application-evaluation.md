# Atlas PPM — Application Evaluation

A structured assessment of the Atlas PPM solution against engineering and product
quality dimensions. Ratings are evidence-based (code, tests, CI, ADRs). Scale:

- **★★★★★ Excellent** — implemented, tested, documented, production-grade.
- **★★★★☆ Strong** — implemented and tested; minor gaps noted.
- **★★★☆☆ Adequate** — implemented; partial tests/docs or known limitations.
- **★★☆☆☆ Partial** — scaffolded / in progress.
- **★☆☆☆☆ Absent** — not started.

_Last reviewed: 2026-07-13 · main (Teams notifications, real-time collaboration, freeform whiteboard, task-board collaboration, typed-table promotions, ISO 27001 SoA)._

## 1. Scorecard

| # | Dimension | Rating | Evidence | Gaps / next |
|---|-----------|--------|----------|-------------|
| 1 | **Functional coverage** (screens vs prototype) | ★★★★★ | All Workspace + Configuration screens built and data-wired; 133 tracked features complete; **product-owner-approved extensions** (Teams notifications, real-time collaboration, freeform whiteboard, task-board collaboration, ISO 27001 SoA, **project delivery roles** Technical Lead/Scrum Master, **period-windowed resource utilisation + date-range filter**, per-sprint timeline colours, editable programme dates) built in the existing design language and recorded (CLAUDE.md §2, ADR-0060/0061/0064/0065/0066/0070/0071) | `design/` regeneration to fold the extensions back into the prototype |
| 2 | **Architecture & modularity** | ★★★★★ | Modular monolith, minimal API grouped `/api/v1`; one C# file per domain; HLD + LLD + 71 ADRs | — |
| 3 | **Frontend engineering** | ★★★★★ | React 18 + TS strict + Vite 8; inline design tokens with **per-profile dark mode (CSS-variable palettes, ADR-0056)**; route code-splitting + vendor chunks; **lint clean (0 warnings)** | — |
| 4 | **Identity & access** | ★★★★★ | Entra SSO (MSAL, PKCE) **verified end-to-end on a live tenant**; server-authoritative RBAC capability matrix; **15-min idle-logout** | — |
| 5 | **Authorization model** | ★★★★★ | 6 canonical server roles; UI checks cosmetic; capability matrix; authz integration tests; **need-to-know + segregation-of-duties** filters where data sensitivity warrants (manager-scoped skills; region-scoped labour rates with the **Platform Admin excluded from rate visibility entirely** — no line owned, no persona-switch preview, ADR-0057) | — |
| 6 | **Data & persistence** | ★★★★★ | PostgreSQL 16 + EF Core 10; migrations auto-applied; empty-by-default, derive-on-read roll-ups | — |
| 7 | **Integrations** | ★★★★☆ | Jira (full sync + attachments), Microsoft Graph, **Azure DevOps (discovery + work-item sync, backgrounded, delta/changed-since pulls)** | ServiceNow/GitHub/Confluence/Teams/Slack/Power BI cosmetic |
| 8 | **Async / background work** | ★★★★★ | Hosted services: Jira + **ADO** background queues/workers (202 + poll), scheduled Jira, retention, capacity alerts; **web/worker process split (`Atlas__Role`) runs recurring jobs in their own container off the request path (ADR-0048)** | — |
| 9 | **Security & hardening** | ★★★★☆ | Security headers/CSP, rate limiting, upload limits, least-privilege DB role + **non-root API image**, secrets via env/Docker secrets + **Dependabot cooldown**, dependency audit gate, idle-logout; **gating** AppSec scanning — SAST (Semgrep) · SCA/secrets/IaC (Trivy), triaged baseline (ADR-0051/0053) + on-demand DAST (ZAP); portable `scripts/security-scan.sh` (runs off GitHub) + in-app **Admin → Security Posture**; CodeQL enablement note + **pen-test scope & remediation register (`docs/pentest-scope.md`)**; **secret-management depth: OpenBao/Vault KV provider (ADR-0067), AES-GCM field encryption for the DPIA-gated personnel notes (ADR-0068), and passwordless Postgres via TLS client-cert auth — removing the DB password entirely, verified against real Postgres (ADR-0069)** | Human pen-test engagement outstanding (secret rotation now has a path via OpenBao dynamic creds / cert rotation) |
| 10 | **Accessibility (WCAG 2 AA)** | ★★★★★ | jsdom axe on primitives + **browser axe sweep gated incl. colour-contrast** across 7 routes, the whiteboard canvas AND the **Tasks Kanban + PI Program boards** (seeded via mocked API); **keyboard/AT operation of every pointer-first surface**; **documented screen-reader test procedure** (`docs/accessibility.md`); mobile drawer; focus/dialog/menu semantics | No third-party assistive-tech audit yet (internal SR procedure documented; external audit recommended pre-GA) |
| 11 | **Observability** | ★★★★★ | OpenTelemetry (traces/metrics/logs), health/readiness, correlation IDs, reference stack; **domain metrics (sync/queue/capacity/DB) + tuned dashboards + Prometheus alert rules** | — |
| 12 | **Testing** | ★★★★★ | Backend 465 xUnit (incl. windowed-roster + delivery-roles pool/agile-gate); frontend 124 vitest + per-screen logic (incl. Gantt-geometry/window-fit, `periodWindow`, whiteboard field-merge/backfill, SoA roll-up/evidence, OpenBao/personnel-crypto); Playwright e2e — axe sweep over 7 routes + whiteboard + Kanban/PI boards, **deterministic native-DnD drag specs for both boards**, dependency-arrow render, **resources period/date-window refetch**, **programme-date edit**, + full user-journey specs; **k6 load/perf suite (ADR-0047)**; smoke wired into CI. **Full migration chain verified against a live Postgres 16** (not only the in-memory provider) | — |
| 13 | **CI/CD** | ★★★★★ | GitHub Actions: frontend lint/test/build, API build/test, a11y sweep, NuGet + npm audit gates, SAST/SCA/DAST, **on-demand perf-smoke gate (seeded API + k6)**; **tag-triggered release pipeline publishing versioned api/web images to GHCR (Buildx + image scan, ADR-0052)** | Deploy-to-host step host-dependent (parked with k8s) |
| 14 | **Delivery & runtime** | ★★★★★ | **On-prem single-node Docker (`docker compose`: web/worker/db/nginx edge) as the chosen, documented target (ADR-0054)**; images promoted from GHCR (ADR-0052); migrations on start; health-gated; secrets overlay; upgrade = pull-and-recreate | k8s parked (no scale/HA need at portfolio scale); HA is a single-node trade-off |
| 15 | **Governance & compliance** | ★★★★★ | Stage gates, RAID, ARB sign-off, decision log, security controls, GDPR DSAR + retention; deterministic risk engine maps findings to GDPR/ISO 27001/ISO 42001/PCI-DSS/SOC 2/NIS2/NIST CSF/MITRE ATT&CK + generic per-framework coverage; **EU AI Act risk-tiering + ISO 42001 AI-management (tier→obligation rules, ADR-0050)**; Zero-Trust posture (ADR-0049); **ISO 27001:2022 Statement of Applicability — full 93-control Annex A coverage per project (ADR-0066)** | Per-control automated evidence linkage; SoAs for other frameworks |
| 16 | **i18n** | ★★★★★ | 6 locales; completeness test gates missing keys | — |
| 17 | **Documentation** | ★★★★★ | HLD, LLD, building-blocks (ABB/SBB), 71 ADRs, in-app Help + **Security Posture** page, setup guides (incl. `secrets.md` with a cross-platform rebuild/verify quick-reference, `postgres-cert-auth.md`), a **STRIDE + LINDDUN threat model** (`threat-model.md`, risk register + MITRE ATT&CK mapping tied to implemented controls), this evaluation, user stories & requirements (all refreshed for the post-prototype extensions incl. delivery roles + windowed resources) | — |
| 18 | **Maintainability / DX** | ★★★★★ | Consistent patterns, typed models, dependabot; **large screens decomposed into per-tab modules** (`project/`, `resources/`, ADR-0041) | — |

## 2. Dimension notes

- **Identity & idle-logout (4/9).** MSAL redirect flow, **verified end-to-end on a
  live tenant** (interactive sign-in, bearer-token API calls, token-driven role,
  401 on missing token). The API validates the JWT (audience/issuer) and is
  authoritative for authorization. An idle-logout policy (default 15 min,
  `VITE_AUTH_IDLE_MINUTES`, ADR-0038) signs unattended sessions out client-side;
  it complements—not replaces—token expiry.
- **Integrations (7).** Two connectors are real end-to-end (Jira, Azure DevOps),
  both with **backgrounded** work-item sync (202 + poll, ADR-0030/0039), plus
  Graph directory/mail. Remaining connector cards are structural chrome pending
  backend work; each will mirror the Jira/ADO pattern (ADR-0006/0035/0036).
- **Async (8).** Jira and ADO each have an in-process queue + hosted worker so a
  portfolio-wide pull can't time out; ADR-0030/0039. The process now runs in a
  selectable **role** (`Atlas__Role` = web/worker/all; ADR-0048): the recurring
  timer jobs (scheduled sync, retention, capacity alerts) run in a separate
  worker container so a heavy unattended pass can't starve user requests. The
  monolith is intentionally **not** split into microservices — the read roll-ups
  join across domains in one transaction; the justified split is request-serving
  vs. recurring background work.
- **Observability (11).** Domain metrics (sync duration, queue depth, capacity
  alerts, DB command latency), a tuned operations dashboard and Prometheus alert
  rules on top of the reference stack; ADR-0040.
- **Accessibility (10).** As of ADR-0037 the design greys meet WCAG AA and the
  browser axe sweep gates colour-contrast alongside structural rules, so
  regressions fail CI.
- **Maintainability (18).** The two outsized screens are decomposed into per-tab
  modules (`project/`, `resources/`) with shared/util helpers; ADR-0041.
- **Testing (12).** Correctness (394 xUnit, 64 vitest), accessibility + full user
  journeys (Playwright), and now **performance**: a k6 suite (`perf/`) drives the
  hot roll-up endpoints — `smoke` (CI-ready gate), `load` (recorded baseline),
  `stress` (find-the-knee) — with an API-driven volume seeder and Prometheus
  remote-write into the reference stack; ADR-0047.

## 3. Top risks & recommended next steps

| Priority | Item | Why |
|----------|------|-----|
| Low | Commission a human pen-test + automate secret rotation | SAST/SCA gate, DAST on demand, CodeQL note, and a pen-test scope + remediation register now exist (`docs/pentest-scope.md`, ADR-0051/0053); the external engagement itself and automated secret rotation remain |
| Low | Kubernetes / multi-node HA (only if scale grows) | On-prem single-node Docker is the chosen target (ADR-0054); the 12-factor GHCR images already suit k8s if a future multi-node/HA need appears — parked deliberately, not a gap |
| Low | Broaden connector coverage | Only Jira + Azure DevOps are real end-to-end; others are cosmetic chrome |

## 4. Overall

**Verdict: production-ready.** The core PPM product is complete, data-wired,
tested (≈589 automated tests across stacks — 465 backend xUnit, 124 frontend
vitest — plus a growing Playwright e2e suite (axe sweep, full-journey, drag,
dependency-arrow, resources-window, programme-date specs) and a k6 load/perf
suite), accessible (AA-gated), observable, and documented to a professional
standard (ABB/SBB traceability, 71 ADRs, HLD/LLD). Entra SSO is verified
end-to-end on a live tenant. Remaining items are enhancements, not blockers:
broadening connector coverage beyond Jira/Azure DevOps, the outstanding human
pen-test engagement, and multi-node HA if portfolio scale ever demands it.
_(Running amendments below supersede these headline figures; latest:
**4.9/5 — 16 of 18 dimensions at ★★★★★**.)_

_Update 2026-07-07: SSO verified (Identity ★★★★★); then the four post-review
follow-ups closed — lint clean (Frontend ★★★★★), ADO background sync (Async
★★★★★), tuned dashboards + alerts (Observability ★★★★★), and screen
decomposition (Maintainability ★★★★★). **Overall 4.7/5 — 13 of 18 dimensions at
★★★★★.**_

_Update 2026-07-08: added full user-journey Playwright e2e (navigation, role-nav,
dashboard layouts, mocked demand drill-in) beyond the axe sweep, and finished the
`Project.tsx` per-tab decomposition (Tasks/Backlog/Sprints/Epics + shared task
model, ADR-0041; `Project.tsx` ~1,600). The only remaining Testing gap is
load/perf._

_Update 2026-07-09: added a k6 load/perf suite (`perf/` — smoke·load·stress +
API-driven volume seeder, Prometheus remote-write; ADR-0047), closing the last
Testing gap (★★★★★). **Overall 4.8/5 — 14 of 18 dimensions at ★★★★★.**_

_Update 2026-07-09: web/worker process split (`Atlas__Role`; ADR-0048) — the
recurring timer jobs run in their own container off the request path, with a
`worker` service added to compose; default `all` keeps single-container
behaviour. No rating change (Async/Architecture already ★★★★★); on-demand sync
consumers stay in the web role pending a durable-queue follow-up._

_Update 2026-07-09: compliance framework coverage (ADR-0049) — added NIST CSF 2.0
+ ISO 42001 to the control catalogue (fixing the ISO 42001 inconsistency), a
generic per-framework coverage rule in the deterministic engine (NIST/SOC 2/NIS2/
ISO 42001 now scored from real control data), named MITRE ATT&CK technique classes,
and a documented Zero-Trust posture mapping. No rating change (Governance already
★★★★★). Follow-up ADR-0050 will add AI-Act risk-tiering + first-class NIST/ISO 42001
scoping (schema)._

_Update 2026-07-09: automated AppSec scanning (ADR-0051) — a `security-scan.yml`
workflow adds SAST (Semgrep OWASP Top 10 + secrets), SCA/secret/IaC (Trivy) and a
dispatch-driven OWASP ZAP baseline (DAST against a test env). Report-only during
rollout; the automated half of a pen-test now runs continuously. No rating change
(Security stays ★★★★☆ until scanners gate + a human pen-test is commissioned)._

_Update 2026-07-09: release pipeline (ADR-0052) — a tag-triggered `release.yml`
builds and publishes versioned api/web images to GHCR (Buildx + GHA cache + Trivy
image scan), using the built-in token (no external secrets). CI/CD → ★★★★★ (the
deploy-to-host step stays host-dependent, parked with k8s). **Overall 4.8/5 —
15 of 18 dimensions at ★★★★★.**_

_Update 2026-07-09: AppSec scanners flipped to gating (ADR-0053) — baseline
triaged: fixed the non-root API image + Dependabot cooldown; scoped/documented
exceptions for the nginx edge and CI-policy findings; `design/` excluded as
prototype reference. Semgrep (`--error`) + Trivy (`--exit-code 1`) now fail the
build on new HIGH/CRITICAL findings. No rating change (Security ★★★★☆ — human
pen-test + automated secret rotation remain)._

_Update 2026-07-09: EU AI Act risk-tiering + ISO 42001 AI-management (ADR-0050) —
`SecurityProfile` gains a risk tier (minimal/limited/high/prohibited), Annex-III
flag, human-oversight + transparency measures and an AI-system name (one additive
migration); the deterministic engine derives obligations per tier (Art 5/9/10/14/50)
and the Security tab gains an AI-classification card. No rating change (Governance
already ★★★★★)._

_Update 2026-07-09: perf-smoke wired into CI + CodeQL enablement note + pen-test
scope & remediation register (`docs/pentest-scope.md`). Testing/CI evidence
refreshed; no rating change (Security ★★★★☆ — the human engagement itself +
automated secret rotation remain)._

_Update 2026-07-09: need-to-know internal-labour rate card (ADR-0055) — each
discipline's rate (Dev/Infra/Architect/PM/PO) is visible and editable only by its
owners + CTO/CIO, filtered server-side; and per-profile dark mode (ADR-0056) via
CSS variables with a top-bar toggle persisted per identity, no global stylesheet
and the light palette (gated contrast) unchanged. No rating change (Frontend/UX
already ★★★★★)._

_Update 2026-07-09: on-prem single-node Docker fixed as the delivery target
(ADR-0054) — build (CI) → publish (GHCR, ADR-0052) → run (compose: web/worker/db/
nginx edge, off the public internet, pull-and-recreate upgrades). Kubernetes is
parked deliberately (no scale/HA need at portfolio scale), reframing the old
"no k8s manifests" gap as a matched decision rather than a shortfall. Delivery &
runtime → ★★★★★. **Overall 4.9/5 — 16 of 18 dimensions at ★★★★★** (the two
non-max are Integrations ★★★★☆ and Security ★★★★☆)._

_Update 2026-07-13: post-prototype collaboration & governance extensions folded
in (ADR-0060–0066). **Microsoft Teams** channel notifications (webhook + Adaptive
Card) as a third channel (ADR-0060). **Real-time collaboration** on a SignalR
room hub — live presence, peer cursors and off-screen peer indicators across PI
board, demand funnel, task board and the whiteboard, with a server-only op
broadcast so peers render only authorized deltas (ADR-0061). **Freeform
whiteboard** — a per-entity brainstorming canvas (shapes, connectors, freehand,
templates, export) with live co-editing, now persisted as **typed rows**
(`WhiteboardNode`/`WhiteboardEdge`, migration `WhiteboardTables`) so each op is a
single-row write and the earlier blob write-race is closed (ADR-0064). PI board
placement likewise promoted to a typed column (`PiObjective.IterationId`). **Task
-board card move** scoped to the four planner roles via `cap-schedule` (ADR-0065).
**ISO 27001:2022 Statement of Applicability** — full 93-control Annex A coverage
per project with applicability/justification/status + coverage roll-up (ADR-0066).
**Keyboard/AT pass** over the pointer-first canvas and drag boards. Tests grew to
442 backend xUnit + 89 frontend vitest; ADRs to 66; user-stories, requirements
and building-blocks (ABB/SBB) refreshed to match. No rating change (the affected
dimensions were already ★★★★★); **Overall stays 4.9/5**._

_Update 2026-07-13 (rev 2): second review-driven follow-up cycle — closed the
remaining engineering gaps the review itself raised. **SoA automated evidence
linkage** — ~20 Annex A controls the platform satisfies by construction (RBAC,
audit log, backups, OpenTelemetry, CI SAST/SCA/DAST, secret redaction, TLS/CSP,
Entra SSO) now carry a standing evidence note + a "platform-evidenced" coverage
count (ADR-0066). **Whiteboard field-level merge** — co-editing ops send only the
changed properties, so concurrent edits to *different* fields of one node merge
instead of clobbering; a full CRDT/OT was evaluated and **declined** as
disproportionate (ADR-0064). **Large-screen decomposition** continued — Governance
out of `Project.tsx` (1617→1361) and the data-governance sections out of
`Admin.tsx` (1177→897), shared Admin styles factored to `admin/styles.ts`
(ADR-0041). **A11y** — the gated axe sweep now covers the whiteboard canvas + the
demand funnel (fixing two real funnel violations: a non-focusable scroll region
and a below-AA amber label). Tests 444 backend xUnit + 111 frontend vitest (+ the
funnel now in the axe sweep). This closes the review's own follow-up list; the
`docs/application-evaluation.md` scorecard and the published evaluation artifact
were both re-scored. Remaining items are operator/organizational (auth-on,
at-rest encryption, DPIA sign-off, the Azure move) plus one caveat — the new
migrations + backfill are proven in-memory, not yet against a live Postgres. No
rating change here (the dimensions were already ★★★★★)._

_Update 2026-07-13 (rev 3): closed the accessibility follow-up. The gated axe
sweep now also covers the **Tasks Kanban board** and the **PI Program Board** —
both seeded via mocked `/api/v1/*` (`e2e/journeys/board-a11y.spec.ts`), which
surfaced and fixed a real bug: the PI increment picker had no accessible name.
Project tabs are now **deep-linkable** (`?tab=`) so a board is reachable directly.
A **screen-reader test procedure** is documented (`docs/accessibility.md`),
consolidating the automated coverage + a per-surface manual NVDA/VoiceOver
checklist. Playwright grew to 14 specs (10 axe + 4 journey). The one remaining
a11y item is an **external assistive-tech audit** (pre-GA) — analogous to the
outstanding human pen-test on Security. In the broader 18-dimension evaluation
artifact this lifts Accessibility to ★★★★★ (14/18 at the top band; overall 4.7)._

_Update 2026-07-14: screenshot-driven feature batch + hardening (ADR-0067–0069).
**Timeline** — a project's sprints now render on the Schedule (the window
auto-fits the project's real span; sprints carry their true Jira dates), and
**cross-entity dependency arrows** were added across the Portfolio, Project
(sprint-level) and Program timelines from a generic `TimelineDependency`
(manual links + a Jira issue-link ingest deriving sprint→sprint edges).
**Quality** — test tasks gained a full window (details, start/due dates,
assignee, time-to-spend) and a linkable Jira board with issue ingest reusing the
project sync client. **Governance** review checkpoints, **Releases** calendar and
**compliance** multi-requirement descriptions fixed; **My Team skills matrix**
made manager-only + per-team scoped. Hardening: **deterministic native-DnD e2e**
for the Tasks + PI boards (closing the last Testing gap), **OpenBao/Vault KV
secrets provider** (ADR-0067), **AES-GCM field encryption** for the DPIA-gated
personnel notes (ADR-0068), and **passwordless Postgres via TLS client-cert auth**
(ADR-0069) — plus the **full migration chain verified against a live Postgres 16**,
closing the other Testing caveat. Tests 463 backend + 117 frontend; ADRs to 69.
Testing's two open items are now closed; **Security's remaining gap narrows to the
human pen-test** (secret rotation has a path via OpenBao dynamic creds / cert
rotation). No band change: **overall stays 4.9/5 — 16 of 18 dimensions at ★★★★★**,
the two non-max being **Integrations ★★★★☆** (ServiceNow/GitHub/Confluence/Slack/
Power BI still cosmetic — the clearest next build) and **Security ★★★★☆** (human
pen-test). Live-Jira verification of the two ingests, and `design/` regeneration
for the approved extensions, remain operator/organizational follow-ups._

_Update 2026-07-15: post-prototype feature batch + a segregation-of-duties fix.
**Resources** — By-person utilisation is now **period-windowed**: `GET /resources`
takes `from`/`to` and averages each person's per-working-day Ops/Project/Product
load over the window via shared time-phased helpers reused by the snapshot and the
Excel export (ADR-0071), so the day/week/…/year toggle and a new date-range filter
actually change the numbers (they previously only relabelled). **Project timeline**
sprint bars are now per-sprint coloured. **Programmes** can edit start/end dates
from the detail header. **People & roles** gained **delivery roles** — Technical
Lead (always) + Scrum Master (agile-only, server-decided) picked from the onboarded
roster (ADR-0070). **Labour rates**: the **Platform Administrator is now excluded
from rate visibility entirely** — it owns no line and can no longer preview rates by
switching persona (ADR-0057 amendment); enforced server-side and the rate card
hidden for that persona. Tests 465 backend + 124 frontend; ADRs to 71; user
stories, requirements, ABB/SBB and HLD/LLD refreshed. No band change: **overall
stays 4.9/5 — 16 of 18 dimensions at ★★★★★** (Integrations and human pen-test
remain the two non-max)._
