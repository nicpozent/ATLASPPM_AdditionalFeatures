# Atlas PPM — Review Index (for the Enterprise Application team)

This is the entry point for reviewing the **Atlas PPM** solution — a Portfolio &
Project Management platform for Birgma / Biltema Group. Atlas is a **modular
monolith**: a React 18 + TypeScript SPA (`src/`, inline-styled, token-driven) in
front of a **.NET 8 minimal API** (`server/`) backed by **PostgreSQL 16 / EF
Core 9**, served same-origin behind nginx.

Start with the **architecture set** (§1), then read by the concern you own (§2).
Everything is docs-as-code (Markdown + Mermaid + ADRs) and lives in the repo, so
it versions with the code it describes.

---

## 1. Start here — the architecture set

Read these four, in order. They are written to be read together and cross-link.

| # | Document | What's in it | Best for |
|---|----------|--------------|----------|
| 1 | [`docs/architecture/README.md`](./docs/architecture/README.md) | Map of the architecture docs and how HLD / LLD / building-blocks / ADRs relate | **Everyone — read first** |
| 2 | [`docs/architecture/hld.md`](./docs/architecture/hld.md) | High-Level Design: system context, C4 container view, quality attributes, integrations, deployment & security overview | Architects, tech leads, security |
| 3 | [`docs/architecture/lld.md`](./docs/architecture/lld.md) | Low-Level Design: data model, module/endpoint map, RBAC internals, request lifecycle, background jobs, sync algorithms, trade-offs | Engineers |
| 4 | [`docs/architecture/building-blocks.md`](./docs/architecture/building-blocks.md) | TOGAF-style ABB (capability) → SBB (implementation) catalogue with a traceability matrix | Architects, procurement, assurance |

Plus the two cross-cutting references that everything traces back to:

| Document | What's in it |
|----------|--------------|
| [`docs/architecture/adr/`](./docs/architecture/adr/) | **72 Architecture Decision Records** — the "why" behind each significant decision (context → options → decision → consequences). Index at [`adr/README.md`](./docs/architecture/adr/README.md). |
| [`docs/requirements.md`](./docs/requirements.md) | Consolidated **functional / non-functional / candidate** requirements (SHALL/SHOULD/MAY), each traced to a building block and ADR |

> **Recent modularity hardening (this review's focus).**
> [`ADR-0072`](./docs/architecture/adr/0072-enforced-module-boundaries.md) is the
> best starting point for assessing how the modular monolith holds together:
> per-domain namespaces (`Atlas.Api.<Domain>`) with boundaries **enforced** by an
> IL-level dependency ratchet (`server/Atlas.Tests/ArchitectureTests.cs`) — new
> cross-module coupling or cycles fail the build.

---

## 2. Read by concern

### Product & functional scope
| Document | What's in it |
|----------|--------------|
| [`CLAUDE.md`](./CLAUDE.md) | The build brief: what Atlas is, the screen catalogue, roles, the "match-the-prototype" rule, and the **log of product-owner-approved extensions** (§2) |
| [`docs/user-stories.md`](./docs/user-stories.md) | Every feature as a role-tagged user story with acceptance criteria (also browsable in-app under Admin → User Stories) |
| [`docs/application-evaluation.md`](./docs/application-evaluation.md) | Evidence-based **quality scorecard** — functional coverage, architecture, security, etc., with gaps stated honestly |
| [`docs/requirements.md`](./docs/requirements.md) | Normative requirements spec (companion to the user stories) |

### Security, privacy & compliance
| Document | What's in it |
|----------|--------------|
| [`docs/threat-model.md`](./docs/threat-model.md) | STRIDE + LINDDUN + OWASP Risk Rating + MITRE ATT&CK, grounded in the architecture with implemented controls cited |
| [`docs/security-hardening.md`](./docs/security-hardening.md) | Database/deployment hardening: TLS, headers/CSP, rate limiting, least-privilege |
| [`docs/pentest-scope.md`](./docs/pentest-scope.md) | Pen-test scope, rules of engagement, remediation register |
| [`docs/compliance-sweden.md`](./docs/compliance-sweden.md) | Swedish legal/regulatory map beyond baseline GDPR (personnel data, MBL) |
| [`docs/dpia-personnel-data.md`](./docs/dpia-personnel-data.md) | DPIA (GDPR Art. 35) for the personnel-assessment features |
| [`docs/retention.md`](./docs/retention.md) | Data retention & erasure (anonymise-not-delete to preserve audit integrity) |

### Integrations & identity
| Document | What's in it |
|----------|--------------|
| [`docs/sso-setup.md`](./docs/sso-setup.md) | Microsoft Entra SSO + directory sync setup |
| [`docs/jira-setup.md`](./docs/jira-setup.md) | Jira Cloud integration (pull-only) |
| [`docs/azure-devops-setup.md`](./docs/azure-devops-setup.md) | Azure DevOps connector |
| [`docs/email-graph-setup.md`](./docs/email-graph-setup.md) | Notification email via Microsoft Graph (app-only `Mail.Send`) |
| [`docs/teams-setup.md`](./docs/teams-setup.md) | Microsoft Teams notification channel (Adaptive Cards) |

### Operations, deployment & runtime
| Document | What's in it |
|----------|--------------|
| [`docs/SETUP.md`](./docs/SETUP.md) | Production setup — Entra registrations, environment values, secrets (config only) |
| [`docs/DOCKER.md`](./docs/DOCKER.md) | Running the whole solution (SPA + API + Postgres) with Docker Compose |
| [`docs/secrets.md`](./docs/secrets.md) | Secrets management (env / Docker secrets / OpenBao; never in VCS) |
| [`docs/postgres-cert-auth.md`](./docs/postgres-cert-auth.md) | Passwordless Postgres via mutual-TLS client certificates |
| [`docs/observability.md`](./docs/observability.md) | OpenTelemetry traces/metrics/logs (OTLP) + reference Grafana/Prometheus stack |
| [`docs/accessibility.md`](./docs/accessibility.md) | WCAG 2.1 AA coverage + the manual screen-reader release procedure |
| [`docs/pi-board-followups.md`](./docs/pi-board-followups.md) | Hand-off checklist for two deferred PI-board items |

---

## 3. What's in each source folder

| Folder | Contents |
|--------|----------|
| `src/` | **React SPA (frontend).** `screens/` — one file per screen (32); `components/` — AppShell, Sidebar, Topbar, UI primitives, RoleContext; `api.ts` — typed fetch client (`/api/v1`); `auth.ts` — MSAL/Entra; `nav.ts` + `theme.ts` — screen catalogue + design tokens; `i18n/` — 6-locale catalogue; `realtime/` + `whiteboard/` — collaboration features; `data/` — in-app admin docs source |
| `server/` | **.NET 8 minimal API.** One C# file per domain area (Tasks, Sprints, Jira, Financials, Gates, …); `Program.cs` host/middleware; `Endpoints.cs` route map; `Domain.cs`/`Dtos.cs` entities & DTOs; `AtlasDbContext.cs`; `Permissions.cs`/`Rbac.cs` authorization; `Migrations/`; `Atlas.Tests/` |
| `design/` | **Visual source of truth** — `Atlas PPM.dc.html`, the approved prototype every screen is built to match 1:1 (reference only, not hand-edited) |
| `docs/` | All documentation, including `docs/architecture/` (HLD, LLD, building blocks, 71 ADRs) |
| `deploy/` | nginx config, cert generation, Postgres least-privilege SQL, and the `observability/` reference stack (Grafana dashboards, Prometheus, Loki, Tempo, OTel collector, alerts) |
| `e2e/` · `perf/` | Playwright end-to-end tests and performance/load tests |
| `.github/` | CI workflows (build, type-check, lint, AppSec scanning) |
| root | `docker-compose*.yml` (base + OpenBao / personnel / pg-cert / secrets variants), `Dockerfile`, `README.md`, `CLAUDE.md`, Vite/TS/ESLint config |

---

## 4. Suggested review path

1. **Orientation** — `docs/architecture/README.md` → `hld.md`.
2. **Deep dive by role** — engineers → `lld.md` + the relevant `server/` domain files; architects → `building-blocks.md` + skim the ADR log; security → `threat-model.md` + `security-hardening.md`.
3. **Scope & quality check** — `docs/application-evaluation.md` (scorecard + honest gaps), cross-referenced with `requirements.md`.
4. **Operational readiness** — `docs/SETUP.md`, `docs/DOCKER.md`, `docs/observability.md`.

> **Note on the prototype vs. build.** `design/Atlas PPM.dc.html` is frozen. A set
> of capabilities were approved *after* the freeze and built in the existing design
> language; they are catalogued in `CLAUDE.md` §2 ("Approved extensions") with their
> ADRs, pending a `design/` regeneration by the design team. Reviewers should treat
> that list as the record of sanctioned deviations from the prototype.
