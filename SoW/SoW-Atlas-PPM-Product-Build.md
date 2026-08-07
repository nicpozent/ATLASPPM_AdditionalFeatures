# Statement of Work — Atlas PPM Product Build

| Field | Value |
|---|---|
| **Project** | Atlas — Portfolio & Project Management platform |
| **Client** | Birgma / Biltema Group (Nordic retail) |
| **Repository** | `nicpozent/ATLASPPM_AdditionalFeatures` |
| **Prepared for** | nicolas.pozza@birgma.com |
| **Date** | 2026-08-07 |
| **Document type** | Baseline SoW (living — updated as scope is confirmed) |

---

## 1. Background & objectives

Atlas is a Portfolio & Project Management web application for Birgma / Biltema
Group. This engagement delivers the **full application** — every screen and all
functionality — **pixel-faithful to the approved prototype**
(`design/Atlas PPM.dc.html`), wired to the **.NET 10 minimal API** backend, and
hardened for an **on-premise, air-gapped** deployment.

Primary objectives:

1. Reproduce every prototype screen 1:1 (layout, typography, colour, components,
   states, copy) with no redesign or additions beyond approved extensions.
2. Data-drive every screen from the `/api/v1/*` API via TanStack Query, with
   first-class **loading / empty / error** states (empty by default — no
   fabricated seed data).
3. Enforce **server-authoritative** role-based access control; the client is
   never a security boundary.
4. Meet the non-functional bar: accessibility (WCAG AA), localised chrome,
   security/compliance modules, and a continuously green automated build.

---

## 2. Scope of work

### 2.1 Workspace screens
- **Dashboard** — four layouts via a segmented control: Executive
  (portfolio-health donut, budget-burn, KPI cards w/ sparklines,
  active-projects table, needs-attention, demand pipeline, recent activity),
  Operational, Compact, and a drag-and-drop **Custom** builder.
- **Portfolio** — Projects (filter chips + cards/table) and Blockers (list +
  side panel); drill-through to Project Detail.
- **Programs** — list + detail (stakeholder power/interest matrix, linked
  projects, status); create-program modal.
- **Products** — product portfolio; Jira/ADO tasks mapped to releases.
- **OKRs** — objectives with key results linked to projects/programs/products.
- **Demands** — value-vs-effort scored intake **funnel**; drag across stages;
  create/approve modals.
- **Timeline / Gantt** — Project / Program scope; phases, bars, milestones,
  dependency arrows, month grid, export.
- **Project Detail** — tabs: Overview, Tasks (board + list, drag), Epics, RAID,
  Artifacts (+ versions), Costs (labor/license/PaaS/IaaS/SaaS), Gates (G0–G5),
  Security (ISO 27001 SoA), plus people, linked products, change requests.
- **Resources** — people synced from Entra ID; allocation vs availability;
  period-windowed utilisation with a date-range filter.
- **Financials** — budget vs actual, CapEx/OpEx, forecast-at-completion,
  savings/benefit, portfolio ROI, source toggle.
- **Delivery Status** — stakeholder report by period; velocity, on-time %,
  blockers, budget burn.
- **Releases** — release calendar & deployment tracking.
- **Weekly Updates (News)** — editable news wall (masonry, themes, edit mode).

### 2.2 Configuration screens
- **My Team** — members & skills, per-team SWOT, individual development plans
  (manager-scoped; governance-gated).
- **Methodologies** — methodology library + create-project wizard.
- **Integrations** — connectors (Jira, Azure DevOps, ServiceNow, ManageEngine
  SDP, GitHub, Confluence, Teams, Slack, Power BI), SSO, email, directory sync.
- **Reports** — branded portfolio/demand/blocker/audit reports; export formats.
- **Administration** — roles & permissions matrix, backups/restore, audit log,
  AD sync, install/integration guides, deletion requests.
- **Help** — role-based guides, articles, contact.

### 2.3 Stakeholder experience
- Reduced navigation: **My Projects**, **My Demands** + Delivery, Releases,
  News, Help.

### 2.4 Governance modules
- Stage gates G0–G5, gate reviews (architecture/security), decision log (ADR),
  TOGAF ADM phases, architecture domains/waivers/ARB, and a security/compliance
  module (GDPR, PCI-DSS, ISO 27001, EU AI Act, SOC 2, NIS2) with control
  mappings, reproduced where the prototype places them.

### 2.5 Approved extensions (beyond the frozen prototype)
Built in the existing design language and recorded per `CLAUDE.md §2` + an ADR:
Microsoft Teams notifications; real-time collaboration (SignalR rooms — PI
Program Board, demand funnel, task board, live presence/cursors/off-screen
peers); Freeform Whiteboard (co-editing, templates, export); Team SWOT and
individual development plans; ISO 27001 Statement of Applicability; cross-entity
timeline dependencies; period-windowed resource utilisation; quality test tasks
+ Jira board ingest; project delivery roles (Tech Lead / Scrum Master); and the
three Atlas brand themes (Command / Daylight / Carbon).

### 2.6 Platform & cross-cutting
- Entra ID (MSAL) SSO with route guards; server-authoritative RBAC (6 canonical
  roles; 9 cosmetic header identities).
- Generated API type contract (OpenAPI → TypeScript) with CI drift protection.
- Self-hosted fonts/assets for air-gapped operation; nginx same-origin serving.
- Observability (OpenTelemetry), backups/restore, audit trail, secret rotation.

### 2.7 Out of scope
- Any redesign, restyling, or screens/sections not in the prototype (except the
  §2.5 approved extensions).
- New CSS frameworks or global stylesheets (inline theme tokens only).
- Client-side authorization as a security control.
- Full screen-body internationalisation (chrome-only per ADR-0084 until a
  product decision widens it).
- Jira bidirectional write-back (Proposed, ADR-0080 — pending sign-off).
- Editing the design reference (`design/`) — regenerated by the design team.

### 2.8 User roles & journeys

Authorization is enforced server-side on **6 canonical roles**; the header's
**9 identities** are cosmetic (they change the visible nav, not access). Each
role's primary journey is captured as a flow diagram in the flow package
(`SoW/flows/user-*`, rendered in `SoW/images/` and the gallery).

| Role (enforced) | Header identity(ies) | Primary journeys | Flow |
|---|---|---|---|
| **Platform Admin** | Platform Admin | Administration — RBAC matrix, backups/restore, audit log, AD sync, deletion requests | `user-09` |
| **PMO** | PMO | Triage & approve demands; portfolio oversight | `user-02` (+ `user-01`) |
| **Project Manager** | PM (· PM Lead / delivery leads) | Create project (wizard); manage tasks & Jira sync; request a stage-gate review | `user-03`, `user-04`, `user-05` |
| **Team Member** | Engineering / Service / Dev / Infra Manager (& members) | Update my work; My Team — skills, SWOT, development plans | `user-06`, `user-08` |
| **Executive** | (leadership) | Portfolio review | `user-01` |
| **Stakeholder** | Stakeholder | Check my projects / demands / delivery (reduced nav) | `user-07` |
| **Architecture** | Chief Architect | Governance — ADR log, architecture gate reviews, TOGAF ADM, ISO 27001 SoA | `user-10` |

The four **Manager** identities (Engineering / Service / Dev / Infra) differ only
cosmetically and share the Team Member / *My Team* journeys. Beyond these
role journeys, the flow package also documents **system & data flows** (20) and
**software-development interaction flows** (9) — see `SoW/flows.md` and the
gallery.

---

## 3. Deliverables

1. The complete, prototype-faithful Atlas PPM **frontend** (React 18 + TS +
   Vite), one screen component per route, split into local sub-components.
2. The supporting **.NET 10 minimal API** endpoints each screen consumes
   (extended where a screen needs an endpoint not yet present), EF Core 10 /
   PostgreSQL 16.
3. **Entra SSO** wiring (login/redirect handling, route guards) and the RBAC
   capability matrix.
4. **Generated API types** + `api.ts` client; TanStack Query hooks with
   loading/empty/error states.
5. **Automated test suites** — backend (xUnit, incl. fixtures + architecture
   boundary tests), frontend (Vitest), accessibility (Playwright + axe),
   performance (k6) — all gated in CI with coverage floors.
6. **Flow diagrams** (`SoW/flows`) — 39 diagrams in three views: system & data
   flows (20), per-role user journeys (10), and software-development interaction
   flows (9), with rendered images and an index/gallery.
7. **Architecture Decision Records** for every architectural choice, plus a
   consolidated `ALL-ADRS.md`.
8. **Deployment artefacts** for the air-gapped Windows on-prem target
   (self-contained build output, nginx config, setup/integration guides).

---

## 4. Approach & methodology

- **Prototype is the source of truth.** Inline styles lifted from the prototype;
  `theme.ts` tokens and the three fonts only; computed visuals (charts, donuts,
  sparklines, gantt geometry) ported faithfully.
- **Empty by default.** Real layout with tasteful empty states until the API
  returns data; never fabricated seed data.
- **Server-authoritative security.** The API is the authority for authorization;
  UI role checks are cosmetic affordances only.
- **Typed, tested, accessible.** TypeScript strict; generated API types;
  ≥44px hit targets, real controls, focus styles, `aria-*`; every data view has
  loading/empty/error.
- **Build one screen fully** (visually faithful + data-wired + empty state)
  before the next; compare side-by-side with the prototype.
- **ADR-driven + one-change-one-PR**, each verified green in CI before merge.

---

## 5. Technical architecture

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript (strict), Vite, react-router v6, TanStack Query, @azure/msal-browser, SignalR client |
| Styling | Inline styles + `theme.ts` tokens (CSS-variable themes; 5 palettes); self-hosted fonts |
| Backend | .NET 10 minimal API, modular monolith (per-domain `Atlas.Api.<Domain>`), EF Core 10 |
| Data | PostgreSQL 16 (`date`/`timestamptz` typed dates per ADR-0082) |
| Realtime | SignalR "room" hub (presence, cursors, live sync) |
| Serving | nginx, same-origin, `/api/v1/*`; on-prem air-gapped |
| Quality gates | Module-boundary ratchet (NetArchTest), coverage floors, OpenAPI type-contract drift, axe a11y, Semgrep/Trivy |

---

## 6. Milestones (build order)

| # | Phase | Contents |
|---|---|---|
| M1 | Dashboard | Executive layout first (tokens, cards, charts, tables), then Operational/Compact/Custom |
| M2 | Core object | Portfolio (+ Blockers) and Project Detail drill-in |
| M3 | Flow & time | Demands funnel, Gantt timeline |
| M4 | Portfolio breadth | Programs, Products, OKRs, Resources, Financials |
| M5 | Reporting | Delivery Status, Releases, News |
| M6 | Configuration | Methodologies (+ wizard), Integrations, Reports, Admin, Help |
| M7 | Stakeholder | My Projects / My Demands + role-based nav & affordances |
| M8 | Governance | Gates, decisions, TOGAF ADM, security/compliance |
| M9 | Platform hardening | Entra SSO, real API wiring, loading/empty/error finalisation, air-gapped packaging |

*Milestones are delivery groupings, not a fixed calendar; sequencing may be
reprioritised with the product owner.*

---

## 7. Acceptance criteria

- **Visual fidelity**: each screen matches the prototype 1:1 on side-by-side
  review (layout, spacing, type, colour, components, states, copy).
- **Data-wired**: every view reads real data via TanStack Query with
  loading/empty/error states; empty by default.
- **Security**: authorization enforced server-side; verified by backend tests.
- **Accessibility**: axe sweep passes (structural); WCAG AA colour contrast on
  all themes.
- **Quality gates green**: frontend + backend suites, coverage floors, OpenAPI
  contract-drift, module-boundary ratchet, SAST/Trivy.
- **Deployable**: a clean build runs on the air-gapped Windows target from the
  provided artefacts.

---

## 8. Assumptions & constraints

- **On-prem, air-gapped**: no runtime internet egress; all fonts/assets
  self-hosted (ADR-0078); dev-only tooling runs in CI, never ships.
- **Deployment**: client downloads built files to a Windows server; no git on
  target — artefacts must be self-contained.
- **Identity**: Entra ID (Azure AD) tenant available for SSO; directory sync for
  Resources.
- **Prototype freeze**: `design/Atlas PPM.dc.html` is authoritative and not
  edited; approved deviations recorded in `CLAUDE.md §2` + an ADR, and flagged
  for the design team to regenerate `design/`.
- **Roles**: six canonical backend roles enforce access; the nine-identity
  header switcher is cosmetic.

---

## 9. Roles & responsibilities

| Party | Responsibility |
|---|---|
| Engineering (delivery) | Frontend + API implementation, tests, ADRs, CI, deployment artefacts |
| Product Owner (Birgma) | Prototype sign-off, approval of extensions & Proposed ADRs, milestone prioritisation |
| Design team | Own `design/`; regenerate to reflect approved extensions |
| Platform / IT (Birgma) | Entra tenant, on-prem/nginx environment, DB provisioning, deploy windows |
| Security / Compliance | DPIA / MBL §11 sign-off for personnel-data features; governance module review |

---

## 10. Non-functional requirements

- **Accessibility** — WCAG AA; keyboard + AT support; axe-gated in CI.
- **Internationalisation** — six-locale chrome catalogue (en/sv/fi/da/no/fr) +
  completeness test; English screen content (ADR-0084).
- **Security & compliance** — RBAC capability matrix; GDPR/ISO 27001/PCI-DSS/EU
  AI Act/SOC 2/NIS2 modules; audit trail; secret rotation; CSP + TLS hardening.
- **Performance** — k6 performance budget; time-phased resource engine shared
  across roster/report/export to prevent drift.
- **Observability** — OpenTelemetry traces/metrics/logs (OTLP, opt-in).
- **Data integrity** — typed dates (`date`/`timestamptz`); no display-string
  date columns (ADR-0082).

---

## 11. Risks & dependencies

| Risk / dependency | Mitigation |
|---|---|
| Prototype fidelity disputes | Side-by-side review as an explicit acceptance gate |
| Air-gapped runtime (no CDNs) | Self-host all assets; verify offline build |
| Entra tenant / directory access | Confirm tenant + app registration early (M9 depends on it) |
| Personnel-data features (SWOT / dev plans) | Gated off until DPIA + MBL §11 sign-off (ADR-0063) |
| External connector availability (Jira/ADO/etc.) | Empty/degraded states; connectors dormant until configured |
| Compliance-module accuracy | Review with Security/Compliance before acceptance |

---

*Companion document: a separate SoW covers the **code-review remediation
engagement** (Epic #106) — security hardening, structural refactors, and the
ADRs 0080–0084 — with per-item delivery status.*
