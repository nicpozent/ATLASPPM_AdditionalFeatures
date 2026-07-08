# Atlas PPM — Architecture & Solution Building Blocks

TOGAF-style catalogue. **Architecture Building Blocks (ABBs)** describe required
*capabilities* in vendor-neutral terms; **Solution Building Blocks (SBBs)** are the
concrete components that realise them in Atlas. This gives a stable capability
model even as specific technologies change, and a traceability path from
requirement → capability → implementation → decision.

## 1. Architecture Building Blocks (ABBs)

| ID | ABB (capability) | Description |
|----|------------------|-------------|
| ABB-01 | Presentation & UX | Role-aware, accessible, i18n web UI with loading/empty/error states |
| ABB-02 | Identity & Access | Authenticate users; authorise actions by role/capability |
| ABB-03 | API & Application Logic | Expose domain operations over a stable, documented contract |
| ABB-04 | Persistence | Durable, transactional, migratable storage of portfolio data |
| ABB-05 | Integration | Connect to external systems (directory, issue trackers, mail) |
| ABB-06 | Asynchronous Processing | Run scheduled/background work off the request path |
| ABB-07 | Notification & Collaboration | Notify subscribers; comments; curated updates |
| ABB-08 | Observability | Traces, metrics, logs, health, correlation of failures |
| ABB-09 | Security & Hardening | Transport security, headers/CSP, rate limiting, secrets, least-privilege |
| ABB-10 | Governance & Compliance | Stage gates, RAID, architecture/security review, decision log, GDPR |
| ABB-11 | Configuration & Secrets | Externalised, environment-specific config and secret injection |
| ABB-12 | Delivery & Runtime | Build, package, deploy and run the system reproducibly |

## 2. Solution Building Blocks (SBBs) and ABB realisation

| ID | SBB (component / technology) | Realises | Notes / ADR |
|----|------------------------------|----------|-------------|
| SBB-01 | React 18 + TypeScript + Vite SPA (inline design tokens, TanStack Query, MSAL) | ABB-01, ABB-02 | ADR-0003 |
| SBB-02 | i18n message catalogue (6 locales) | ABB-01 | completeness test |
| SBB-03 | Microsoft Entra ID (OIDC) + MSAL, with a client-side idle-logout policy (default 15 min, `VITE_AUTH_IDLE_MINUTES`) | ABB-02, ABB-09 | ADR-0005, ADR-0038 |
| SBB-04 | RBAC capability matrix (`Rbac.cs` + `Permissions.cs`); CTO/CIO roles (Executive-enforced); data-driven header switcher (created roles selectable) | ABB-02 | ADR-0004, ADR-0043, ADR-0046 |
| SBB-05 | .NET 8 minimal API (`/api/v1`, modular groups) | ABB-03 | ADR-0001 |
| SBB-06 | OpenAPI / Swagger (Swashbuckle) | ABB-03 | contract docs |
| SBB-07 | EF Core 8 + `AtlasDbContext` + migrations | ABB-04 | ADR-0002 |
| SBB-08 | PostgreSQL 16 | ABB-04 | ADR-0002 |
| SBB-09 | Jira connector (agile + enhanced JQL, board-optional; full-field + comments + attachments) | ABB-05 | ADR-0006, ADR-0018 |
| SBB-10 | Microsoft Graph (directory sync, Mail.Send) | ABB-05, ABB-07 | |
| SBB-11 | Hosted services (`JiraSyncService`, `RetentionHostedService`, `CapacityAlertService`, `JiraSyncWorker`+`JiraSyncQueue`, `AdoSyncWorker`+`AdoSyncQueue`) | ABB-06, ABB-10 | ADR-0007, ADR-0028, ADR-0030, ADR-0039 |
| SBB-12 | Notifications service + subscriptions + comments + over-allocation alerts; role-addressed demand alerts (PMO/Architect/CTO/CIO/PM Lead) with per-role email via the in-app group→role mapping + per-person opt-out | ABB-07 | ADR-0028, ADR-0043, ADR-0045 |
| SBB-13 | OpenTelemetry (OTLP) + health/readiness + correlation IDs + reference Grafana/Tempo/Prometheus/Loki stack; domain metrics (sync duration, queue depth, capacity alerts, DB command duration) with tuned dashboards (overview + operations) & Prometheus alert rules | ABB-08 | ADR-0010, ADR-0032, ADR-0040 |
| SBB-14 | Security headers/CSP, rate limiter, upload limits, least-privilege DB role | ABB-09 | ADR-0008, security-hardening.md |
| SBB-15 | Governance modules (Gates, RAID, Architecture ADM/ARB, Security controls, Decisions, Quality) + GDPR/retention | ABB-10 | |
| SBB-16 | `IConfiguration` env + Docker secrets tooling | ABB-11 | ADR-0009 |
| SBB-17 | Docker + docker-compose + nginx edge; GitHub Actions CI | ABB-12 | ADR-0008 |
| SBB-18 | Time-phased allocation (`TeamAssignmentMember` segments, `AllocMath`) + availability finder (`/resources/availability`) | ABB-06 | ADR-0013 |
| SBB-19 | Ops module (`OpsService`/`OpsItem`, `cap-ops`, project-impact + Ops% roll-up; full-fidelity Jira import — epics as items + rich fields + comments/attachments; work-item-status filter; multi-select bulk delete; linked project tasks `OpsTaskLink`) | ABB-05, ABB-06, ABB-10 | ADR-0014, ADR-0034, ADR-0042 |
| SBB-20 | Skills & competency matrix (`Skill`/`SkillRating`, name-keyed) | ABB-06 | ADR-0016 |
| SBB-21 | Colour-graded Excel exports (ClosedXML: allocation histogram, skills matrix) | ABB-06, ABB-01 | ADR-0015 |
| SBB-22 | GDPR data-subject admin surface (DSAR export, erase, run-retention) | ABB-10 | ADR-0017 |
| SBB-23 | Strategic roadmap (`RoadmapItem` + milestones/links/deps, `cap-roadmap`, Now/Next/Later board + **By-year board** + timeline) | ABB-06 | ADR-0019 |
| SBB-24 | Task-estimate allocation engine (`AllocationEngine`: max(planned, task) per project; shared by Resources + capacity) | ABB-06 | ADR-0020 |
| SBB-25 | Azure DevOps connector (`AzureDevOps.cs`: PAT auth, status/test, discovery + import/map `Project.AdoProject`, **work-item sync** — WIQL work items → epics/tasks, iterations → sprints, idempotent by `AdoId`; **background queue/worker**; **delta/changed-since pulls** via `LastAdoSync` + WIQL `[System.ChangedDate]`) | ABB-05, ABB-06 | ADR-0035, ADR-0036, ADR-0039, ADR-0044 |

## 3. Traceability (ABB → SBB)

```mermaid
flowchart LR
  ABB01["ABB-01 UX"] --> SBB01 & SBB02
  ABB02["ABB-02 IAM"] --> SBB03 & SBB04 & SBB01
  ABB03["ABB-03 API"] --> SBB05 & SBB06
  ABB04["ABB-04 Data"] --> SBB07 & SBB08
  ABB05["ABB-05 Integration"] --> SBB09 & SBB10
  ABB06["ABB-06 Async"] --> SBB11
  ABB07["ABB-07 Notify"] --> SBB12 & SBB10
  ABB08["ABB-08 Observability"] --> SBB13
  ABB09["ABB-09 Security"] --> SBB14
  ABB10["ABB-10 Governance"] --> SBB15 & SBB11
  ABB11["ABB-11 Config/Secrets"] --> SBB16
  ABB12["ABB-12 Delivery"] --> SBB17
```

## 4. Gaps & roadmap building blocks

| ABB | Gap | Planned SBB |
|-----|-----|-------------|
| ABB-05 Integration | Jira + Graph + **Azure DevOps** (discovery · import · work-item sync, ADR-0035/0036) implemented | ServiceNow / ManageEngine SDP / GitHub / Confluence / Teams / Slack / Power BI (each mirrors the Jira/ADO pattern) |
| ABB-01 UX | a11y baseline (ADR-0025) + jsdom axe over primitives + mobile drawer (ADR-0026) + **browser-based full-page axe sweep** (Playwright) & extracted per-screen logic tests (ADR-0033); token greys lifted to WCAG AA and **colour-contrast now gated** alongside structural rules (ADR-0037) | Extend swept routes as new high-traffic views land |

These map to the roadmap tracked with the product team; each will get an ADR when
a concrete technology is chosen.
