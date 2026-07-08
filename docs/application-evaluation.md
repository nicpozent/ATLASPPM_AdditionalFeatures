# Atlas PPM — Application Evaluation

A structured assessment of the Atlas PPM solution against engineering and product
quality dimensions. Ratings are evidence-based (code, tests, CI, ADRs). Scale:

- **★★★★★ Excellent** — implemented, tested, documented, production-grade.
- **★★★★☆ Strong** — implemented and tested; minor gaps noted.
- **★★★☆☆ Adequate** — implemented; partial tests/docs or known limitations.
- **★★☆☆☆ Partial** — scaffolded / in progress.
- **★☆☆☆☆ Absent** — not started.

_Last reviewed: 2026-07-07 · main @ idle-logout._

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
| 8 | **Async / background work** | ★★★★★ | Hosted services: Jira + **ADO** background queues/workers (202 + poll), scheduled Jira, retention, capacity alerts | — |
| 9 | **Security & hardening** | ★★★★☆ | Security headers/CSP, rate limiting, upload limits, least-privilege DB role, secrets via env/Docker secrets, dependency audit gate, idle-logout | Pen-test not performed; secrets rotation manual |
| 10 | **Accessibility (WCAG 2 AA)** | ★★★★★ | jsdom axe on primitives + **browser axe sweep gated incl. colour-contrast**; mobile drawer; focus/dialog/menu semantics | Sweep covers 6 representative routes; extend as views grow |
| 11 | **Observability** | ★★★★★ | OpenTelemetry (traces/metrics/logs), health/readiness, correlation IDs, reference stack; **domain metrics (sync/queue/capacity/DB) + tuned dashboards + Prometheus alert rules** | — |
| 12 | **Testing** | ★★★★☆ | Backend 383 xUnit; frontend 64 vitest + per-screen logic; Playwright/axe e2e; CI-gated | No load/perf tests; e2e is a11y-focused, not full journeys |
| 13 | **CI/CD** | ★★★★☆ | GitHub Actions: frontend lint/test/build, API build/test, a11y sweep, NuGet + npm audit gates; current action versions | No automated deploy/release pipeline |
| 14 | **Delivery & runtime** | ★★★★☆ | Docker + compose + nginx edge; migrations on start; health-gated; secrets overlay | Single-node compose; no k8s manifests yet |
| 15 | **Governance & compliance** | ★★★★★ | Stage gates, RAID, ARB sign-off, decision log, security controls, GDPR DSAR + retention | — |
| 16 | **i18n** | ★★★★★ | 6 locales; completeness test gates missing keys | — |
| 17 | **Documentation** | ★★★★★ | HLD, LLD, building-blocks (ABB/SBB), 41 ADRs, in-app Help, setup guides, this evaluation, user stories | — |
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
  portfolio-wide pull can't time out; ADR-0030/0039.
- **Observability (11).** Domain metrics (sync duration, queue depth, capacity
  alerts, DB command latency), a tuned operations dashboard and Prometheus alert
  rules on top of the reference stack; ADR-0040.
- **Accessibility (10).** As of ADR-0037 the design greys meet WCAG AA and the
  browser axe sweep gates colour-contrast alongside structural rules, so
  regressions fail CI.
- **Maintainability (18).** The two outsized screens are decomposed into per-tab
  modules (`project/`, `resources/`) with shared/util helpers; ADR-0041.

## 3. Top risks & recommended next steps

| Priority | Item | Why |
|----------|------|-----|
| Medium | Add full user-journey e2e (beyond a11y) | e2e currently proves a11y, not flows |
| Low | k8s manifests + release pipeline | Compose is single-node; no automated deploy |
| Low | Extend per-tab decomposition if screens regrow | `Project.tsx` down to ~1,600 (agile Tasks/Backlog/Sprints/Epics + shared task model extracted, ADR-0041); remaining inline tabs can follow the same pattern |

## 4. Overall

**Verdict: production-ready.** The core PPM product is complete, data-wired,
tested (447 automated tests across stacks), accessible (AA-gated), observable,
and documented to a professional standard (ABB/SBB traceability, 41 ADRs,
HLD/LLD). Entra SSO is verified end-to-end on a live tenant. Remaining items are
enhancements, not blockers: broadening connector coverage beyond Jira/Azure
DevOps, ADO delta sync, and full user-journey e2e.

_Update 2026-07-07: SSO verified (Identity ★★★★★); then the four post-review
follow-ups closed — lint clean (Frontend ★★★★★), ADO background sync (Async
★★★★★), tuned dashboards + alerts (Observability ★★★★★), and screen
decomposition (Maintainability ★★★★★). **Overall 4.7/5 — 13 of 18 dimensions at
★★★★★.**_
