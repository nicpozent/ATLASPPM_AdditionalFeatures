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
| 3 | **Frontend engineering** | ★★★★☆ | React 18 + TS strict + Vite 8; inline design tokens; route code-splitting + vendor chunks | 12 lint warnings (non-blocking `any`/fast-refresh) |
| 4 | **Identity & access** | ★★★★★ | Entra SSO (MSAL, PKCE) **verified end-to-end on a live tenant**; server-authoritative RBAC capability matrix; **15-min idle-logout** | — |
| 5 | **Authorization model** | ★★★★★ | 6 canonical server roles; UI checks cosmetic; capability matrix; authz integration tests | — |
| 6 | **Data & persistence** | ★★★★★ | PostgreSQL 16 + EF Core 9; migrations auto-applied; empty-by-default, derive-on-read roll-ups | — |
| 7 | **Integrations** | ★★★★☆ | Jira (full sync + attachments), Microsoft Graph, **Azure DevOps (discovery + work-item sync)** | ServiceNow/GitHub/Confluence/Teams/Slack/Power BI cosmetic; ADO delta/background pending |
| 8 | **Async / background work** | ★★★★☆ | Hosted services: Jira scheduled + background queue, retention, capacity alerts | ADO sync synchronous (bounded 4000) — background is a follow-up |
| 9 | **Security & hardening** | ★★★★☆ | Security headers/CSP, rate limiting, upload limits, least-privilege DB role, secrets via env/Docker secrets, dependency audit gate, idle-logout | Pen-test not performed; secrets rotation manual |
| 10 | **Accessibility (WCAG 2 AA)** | ★★★★★ | jsdom axe on primitives + **browser axe sweep gated incl. colour-contrast**; mobile drawer; focus/dialog/menu semantics | Sweep covers 6 representative routes; extend as views grow |
| 11 | **Observability** | ★★★★☆ | OpenTelemetry (traces/metrics/logs), health/readiness, correlation IDs, reference Grafana/Tempo/Prometheus/Loki stack | Dashboards are reference, not tenant-tuned |
| 12 | **Testing** | ★★★★☆ | Backend 379 xUnit; frontend 64 vitest + per-screen logic; Playwright/axe e2e; CI-gated | No load/perf tests; e2e is a11y-focused, not full journeys |
| 13 | **CI/CD** | ★★★★☆ | GitHub Actions: frontend lint/test/build, API build/test, a11y sweep, NuGet + npm audit gates; current action versions | No automated deploy/release pipeline |
| 14 | **Delivery & runtime** | ★★★★☆ | Docker + compose + nginx edge; migrations on start; health-gated; secrets overlay | Single-node compose; no k8s manifests yet |
| 15 | **Governance & compliance** | ★★★★★ | Stage gates, RAID, ARB sign-off, decision log, security controls, GDPR DSAR + retention | — |
| 16 | **i18n** | ★★★★★ | 6 locales; completeness test gates missing keys | — |
| 17 | **Documentation** | ★★★★★ | HLD, LLD, building-blocks (ABB/SBB), 38 ADRs, in-app Help, setup guides, this evaluation, user stories | — |
| 18 | **Maintainability / DX** | ★★★★☆ | Consistent patterns, typed models, small modules, dependabot | Some large screen files (Project, Resources) |

## 2. Dimension notes

- **Identity & idle-logout (4/9).** MSAL redirect flow, **verified end-to-end on a
  live tenant** (interactive sign-in, bearer-token API calls, token-driven role,
  401 on missing token). The API validates the JWT (audience/issuer) and is
  authoritative for authorization. An idle-logout policy (default 15 min,
  `VITE_AUTH_IDLE_MINUTES`, ADR-0038) signs unattended sessions out client-side;
  it complements—not replaces—token expiry.
- **Integrations (7).** Two connectors are real end-to-end (Jira, Azure DevOps)
  plus Graph directory/mail. The remaining connector cards are structural chrome
  pending backend work; each will mirror the Jira/ADO pattern (ADR-0006/0035/0036).
- **Accessibility (10).** As of ADR-0037 the design greys meet WCAG AA and the
  browser axe sweep gates colour-contrast alongside structural rules, so
  regressions fail CI.

## 3. Top risks & recommended next steps

| Priority | Item | Why |
|----------|------|-----|
| Medium | ADO delta + background sync | Bounded/synchronous today; large orgs need it |
| Medium | Add full user-journey e2e (beyond a11y) | e2e currently proves a11y, not flows |
| Low | Split the largest screen files | Maintainability of Project/Resources |
| Low | k8s manifests + release pipeline | Compose is single-node; no automated deploy |

## 4. Overall

**Verdict: production-ready.** The core PPM product is complete, data-wired,
tested (443 automated tests across stacks), accessible (AA-gated), observable,
and documented to a professional standard (ABB/SBB traceability, 38 ADRs,
HLD/LLD). **Entra SSO is now verified end-to-end on a live tenant**, closing the
last high-priority gap. Remaining items are enhancements, not blockers:
broadening connector coverage beyond Jira/Azure DevOps, ADO delta/background
sync, and full user-journey e2e.

_Update 2026-07-07: SSO verified on the customer tenant — Identity & access
raised to ★★★★★; overall 4.5/5._
