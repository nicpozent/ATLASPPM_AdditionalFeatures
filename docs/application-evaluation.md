# Atlas PPM — Application Evaluation

A structured assessment of the Atlas PPM solution against engineering and product
quality dimensions. Ratings are evidence-based (code, tests, CI, ADRs). Scale:

- **★★★★★ Excellent** — implemented, tested, documented, production-grade.
- **★★★★☆ Strong** — implemented and tested; minor gaps noted.
- **★★★☆☆ Adequate** — implemented; partial tests/docs or known limitations.
- **★★☆☆☆ Partial** — scaffolded / in progress.
- **★☆☆☆☆ Absent** — not started.

_Last reviewed: 2026-07-09 · main @ perf-smoke-pentest-scope._

## 1. Scorecard

| # | Dimension | Rating | Evidence | Gaps / next |
|---|-----------|--------|----------|-------------|
| 1 | **Functional coverage** (screens vs prototype) | ★★★★★ | All Workspace + Configuration screens built and data-wired; 128 tracked features complete | Ongoing prototype-fidelity spot-checks |
| 2 | **Architecture & modularity** | ★★★★★ | Modular monolith, minimal API grouped `/api/v1`; one C# file per domain; HLD + LLD + 38 ADRs | — |
| 3 | **Frontend engineering** | ★★★★★ | React 18 + TS strict + Vite 8; inline design tokens; route code-splitting + vendor chunks; **lint clean (0 warnings)** | — |
| 4 | **Identity & access** | ★★★★★ | Entra SSO (MSAL, PKCE) **verified end-to-end on a live tenant**; server-authoritative RBAC capability matrix; **15-min idle-logout** | — |
| 5 | **Authorization model** | ★★★★★ | 6 canonical server roles; UI checks cosmetic; capability matrix; authz integration tests | — |
| 6 | **Data & persistence** | ★★★★★ | PostgreSQL 16 + EF Core 9; migrations auto-applied; empty-by-default, derive-on-read roll-ups | — |
| 7 | **Integrations** | ★★★★☆ | Jira (full sync + attachments), Microsoft Graph, **Azure DevOps (discovery + work-item sync, backgrounded, delta/changed-since pulls)** | ServiceNow/GitHub/Confluence/Teams/Slack/Power BI cosmetic |
| 8 | **Async / background work** | ★★★★★ | Hosted services: Jira + **ADO** background queues/workers (202 + poll), scheduled Jira, retention, capacity alerts; **web/worker process split (`Atlas__Role`) runs recurring jobs in their own container off the request path (ADR-0048)** | — |
| 9 | **Security & hardening** | ★★★★☆ | Security headers/CSP, rate limiting, upload limits, least-privilege DB role + **non-root API image**, secrets via env/Docker secrets + **Dependabot cooldown**, dependency audit gate, idle-logout; **gating** AppSec scanning — SAST (Semgrep) · SCA/secrets/IaC (Trivy), triaged baseline (ADR-0051/0053) + on-demand DAST (ZAP); portable `scripts/security-scan.sh` (runs off GitHub) + in-app **Admin → Security Posture**; CodeQL enablement note + **pen-test scope & remediation register (`docs/pentest-scope.md`)** | Human pen-test engagement + automated secret rotation outstanding |
| 10 | **Accessibility (WCAG 2 AA)** | ★★★★★ | jsdom axe on primitives + **browser axe sweep gated incl. colour-contrast**; mobile drawer; focus/dialog/menu semantics | Sweep covers 6 representative routes; extend as views grow |
| 11 | **Observability** | ★★★★★ | OpenTelemetry (traces/metrics/logs), health/readiness, correlation IDs, reference stack; **domain metrics (sync/queue/capacity/DB) + tuned dashboards + Prometheus alert rules** | — |
| 12 | **Testing** | ★★★★★ | Backend 394 xUnit; frontend 64 vitest + per-screen logic; Playwright e2e — axe sweep + full user-journey specs (navigation, role-nav, dashboard layouts, mocked demand drill-in); **k6 load/perf suite (smoke·load·stress + API volume seeder, ADR-0047)**; smoke wired into CI (`perf-smoke.yml`, seeded API + k6 vs hot roll-ups) | Full load/stress runs operated against a seeded test env; NBomber not used |
| 13 | **CI/CD** | ★★★★★ | GitHub Actions: frontend lint/test/build, API build/test, a11y sweep, NuGet + npm audit gates, SAST/SCA/DAST, **on-demand perf-smoke gate (seeded API + k6)**; **tag-triggered release pipeline publishing versioned api/web images to GHCR (Buildx + image scan, ADR-0052)** | Deploy-to-host step host-dependent (parked with k8s) |
| 14 | **Delivery & runtime** | ★★★★★ | **On-prem single-node Docker (`docker compose`: web/worker/db/nginx edge) as the chosen, documented target (ADR-0054)**; images promoted from GHCR (ADR-0052); migrations on start; health-gated; secrets overlay; upgrade = pull-and-recreate | k8s parked (no scale/HA need at portfolio scale); HA is a single-node trade-off |
| 15 | **Governance & compliance** | ★★★★★ | Stage gates, RAID, ARB sign-off, decision log, security controls, GDPR DSAR + retention; deterministic risk engine maps findings to GDPR/ISO 27001/ISO 42001/PCI-DSS/SOC 2/NIS2/NIST CSF/MITRE ATT&CK + generic per-framework coverage; **EU AI Act risk-tiering + ISO 42001 AI-management (tier→obligation rules, ADR-0050)**; Zero-Trust posture (ADR-0049) | — |
| 16 | **i18n** | ★★★★★ | 6 locales; completeness test gates missing keys | — |
| 17 | **Documentation** | ★★★★★ | HLD, LLD, building-blocks (ABB/SBB), 54 ADRs, in-app Help + **Security Posture** page, setup guides, this evaluation, user stories | — |
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
tested (468 automated tests across stacks — 394 backend xUnit, 64 frontend
vitest, 10 Playwright e2e: 6 axe + 4 full-journey — plus a k6 load/perf suite),
accessible (AA-gated), observable, and documented to a professional standard
(ABB/SBB traceability, 47 ADRs, HLD/LLD). Entra SSO is verified end-to-end on a
live tenant. Remaining items are enhancements, not blockers: broadening connector
coverage beyond Jira/Azure DevOps, automated security scanning (SAST/DAST), and a
release/k8s pipeline once a target host is chosen.

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

_Update 2026-07-09: on-prem single-node Docker fixed as the delivery target
(ADR-0054) — build (CI) → publish (GHCR, ADR-0052) → run (compose: web/worker/db/
nginx edge, off the public internet, pull-and-recreate upgrades). Kubernetes is
parked deliberately (no scale/HA need at portfolio scale), reframing the old
"no k8s manifests" gap as a matched decision rather than a shortfall. Delivery &
runtime → ★★★★★. **Overall 4.9/5 — 16 of 18 dimensions at ★★★★★** (the two
non-max are Integrations ★★★★☆ and Security ★★★★☆)._
