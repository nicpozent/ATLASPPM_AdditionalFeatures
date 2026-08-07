# Statement of Work — Atlas PPM

> **How to use this document.** The scope, deliverables, acceptance criteria and
> security/compliance commitments below are grounded in the delivered system.
> Fields in **[brackets]** — parties, dates, effort and commercials — are for the
> contracting parties to complete; they are intentionally not pre-filled.

| | |
|---|---|
| **Project** | Atlas — Portfolio & Project Management (PPM) platform |
| **Client / Sponsor** | [Birgma / Biltema — sponsor name] |
| **Supplier / Delivery** | [Delivery team / vendor] |
| **SoW version** | 1.0 · [date] |
| **Effective period** | [start] – [end] |
| **Document owner** | [name, role] |

---

## 1. Purpose

This Statement of Work defines the scope, deliverables, approach, acceptance
criteria and responsibilities for the design, build and hand-over of **Atlas** —
a Portfolio & Project Management web application that runs the Biltema Group
portfolio end to end: demand intake and scoring, projects with stage-gate
governance, programs and products, OKRs, timeline/Gantt planning, resource and
financial management, delivery reporting, and a security/compliance module —
with identity federated to **Microsoft Entra ID** and authorization enforced
server-side. The frontend is reproduced **pixel-faithful to the approved
prototype** (`design/Atlas PPM.dc.html`) and wired to the **.NET 10 minimal API**.

## 2. Background

Portfolio governance today is spread across spreadsheets and disconnected
trackers, so demand, delivery, resourcing and financials cannot be seen or
governed in one place, and stage-gate/architecture decisions are not auditable.
Atlas replaces that with a single, role-aware platform: a controlled object
model (demands → projects → programs/products/OKRs), server-authoritative RBAC,
real-time collaboration, connector-fed work-item sync, and an ISO 27001 /
GDPR-aware governance module — deployable **on-premise and air-gapped**.

## 3. Objectives

1. Federated single sign-on and least-privilege authorisation (Entra ID; 6
   canonical roles enforced server-side via a capability matrix).
2. A faithful reproduction of every approved screen, **data-driven** with
   first-class loading / empty / error states (empty by default — no seed data).
3. A controlled **demand → project → gate** lifecycle with stage gates (G0–G5)
   and architecture/security gate reviews.
4. **Planning & resourcing**: timeline/Gantt with cross-entity dependencies;
   time-phased resource utilisation; financials (budget vs actual, FaC, ROI).
5. **Integration**: idempotent work-item sync from Jira and Azure DevOps behind
   one connector abstraction; Teams notifications.
6. **Real-time collaboration**: presence, cursors and live change-sync; PI board,
   task board, demand funnel and a freeform whiteboard.
7. **Governance & compliance by design**: decision log (ADR), TOGAF ADM, ISO
   27001 Statement of Applicability, and GDPR handling of personnel data.
8. **Portability & assurance**: container-first, same-origin behind nginx, an
   air-gapped build, observability, backups and a continuously green CI gate.

## 4. Scope of work

### 4.1 In scope (work packages)

| WP | Work package | Summary |
|----|--------------|---------|
| WP1 | Identity & access | Entra SSO (MSAL); RS256 token validation (issuer/audience/tenant); server-authoritative RBAC capability matrix (6 canonical roles; 9 cosmetic header identities); idle logout; anonymous-in-production boot fuses |
| WP2 | Portfolio & demand intake | Portfolio (projects + blockers); Demand Pipeline value-vs-effort scored funnel; Programs (stakeholder power/interest matrix); Products; OKRs linked to projects/programs/products |
| WP3 | Project delivery | Project Detail — Overview, Tasks (board + list, drag), Epics, RAID, Artifacts (+versions), Costs (labor/license/PaaS/IaaS/SaaS), Gates (G0–G5), Security (ISO 27001 SoA); People & roles incl. delivery roles (Tech Lead / Scrum Master) |
| WP4 | Planning & timeline | Timeline / Gantt (project & program scope); phases, bars, milestones; cross-entity dependency arrows (`manual` / `jira` / `project`) |
| WP5 | Resources & financials | Resource roster (Entra-synced); period-windowed utilisation with a shared time-phased engine + date-range filter; Financials — budget vs actual, CapEx/OpEx, forecast-at-completion, savings/benefit, portfolio ROI |
| WP6 | Reporting & assurance | Dashboard (Executive / Operational / Compact / drag-and-drop Custom); Delivery status by period; Releases calendar; Weekly Updates (news wall); branded Reports with PDF / Excel / PPTX export; audit log |
| WP7 | Integrations | Jira & Azure DevOps work-item sync behind one `IWorkItemConnector` (shared background queue/worker, 202 + poll, delta watermark); Microsoft Teams notifications; connector catalogue (ServiceNow, ManageEngine SDP, GitHub, Confluence, Slack, Power BI) |
| WP8 | Real-time collaboration | Single SignalR "room" hub — presence, shared cursors, live change-sync, off-screen peer indicators; PI Program Board, demand funnel, task board; Freeform Whiteboard with granular authorized co-editing |
| WP9 | Governance & compliance | Stage gates + gate reviews (architecture/security); decision log (ADR); TOGAF ADM phases, architecture domains/waivers/ARB; ISO 27001 SoA; security/compliance module (GDPR, PCI-DSS, ISO 27001, EU AI Act, SOC 2, NIS2) with control mappings |
| WP10 | People, teams & methodology | My Team — members & skills matrix, Team SWOT, individual development plans (manager-scoped, governance-gated); Methodologies library + create-project wizard |
| WP11 | Platform quality & CI | Generated API type contract (OpenAPI → TypeScript) with drift check; module-boundary ratchet (ADR-0072); tests (xUnit · Vitest · Playwright + axe · k6) with coverage floors; SAST (Semgrep) + Trivy; SHA-pinned GitHub Actions |
| WP12 | Air-gapped operations & docs | Self-hosted fonts/assets; nginx same-origin (`/api/v1`, `/hubs`); OpenTelemetry observability; backups/restore; audit trail; secret rotation; architecture (HLD/LLD/ADRs/ABB-SBB), requirements, install/integration guides |

### 4.2 Out of scope

- Hosting, network and identity-tenant administration beyond configuration
  guidance (Entra tenant, Windows/VMware host, corporate network, firewalls, TLS).
- Organisation-side security controls (MFA / Conditional Access enablement,
  at-rest disk encryption, SIEM ingestion) — the application supports them;
  enabling them is an operator/IT action.
- Data migration from legacy PPM tools (unless added by change request).
- Editing the design reference (`design/`) — regenerated by the design team.
- **Jira bidirectional write-back** (Proposed, ADR-0080 — pending sign-off).
- **Full screen-body internationalisation** — the product is English content with
  localised chrome (ADR-0084) until a product decision widens it.
- Personnel-data features (Team SWOT / development plans) remain **gated off**
  until DPIA + MBL §11 sign-off (ADR-0063).

## 5. Deliverables

| # | Deliverable | Form | Acceptance evidence |
|---|-------------|------|---------------------|
| D1 | Web application (SPA + API + database) | Running same-origin stack | Builds & serves behind nginx; frontend `npm run build` green; API `/health`·`/readyz` healthy |
| D2 | Source code + CI pipelines | Git repository | CI green: frontend (lint/test/build + coverage floor), API (build/test + coverage floor), API type-contract drift, accessibility (axe), SAST (Semgrep) + Trivy |
| D3 | Automated test suite | Code | Backend xUnit (incl. fixtures + architecture-boundary tests) + frontend Vitest + Playwright/axe + k6; coverage floors gated in CI (backend line ≥ 65 %, frontend line ≥ 6 %, raised as screens gain tests) |
| D4 | Architecture & design docs | Markdown | `architecture/hld.md`, `architecture/lld.md`, `architecture/adr/` (+ `ALL-ADRS.md`), `architecture/building-blocks.md` (ABB/SBB) |
| D5 | Requirements & user stories | Markdown | `requirements.md` (FR/NFR/TR), `user-stories.md` |
| D6 | Security & compliance pack | Markdown + code | `threat-model.md`, `security-hardening.md`, `pentest-scope.md`, per-project ISO 27001 SoA (ADR-0066), control mappings |
| D7 | GDPR / personnel-data pack | Markdown | `dpia-personnel-data.md`, `compliance-sweden.md`, `retention.md` (DSAR export, evidence-preserving erasure, retention purge) |
| D8 | Operations runbooks | Markdown | `SETUP.md`, `DOCKER.md`, `sso-setup.md`, `secrets.md`, `observability.md`, `postgres-cert-auth.md`, connector setup guides |
| D9 | User & functional documentation | Markdown + HTML | `user-stories.md`, `accessibility.md`, and the flow package — `SoW/flows.md` + gallery (39 diagrams: system · per-role journeys · development) |

## 6. Approach & delivery phases

Iterative delivery; each phase is independently shippable and CI-gated. (Phases
reflect the documented delivery state and forward plan; see the ADRs.)

| Phase | Focus | Status |
|-------|-------|--------|
| P0 — Shell & SSO | App shell, routing, theme tokens, Entra SSO, RBAC capability matrix | Delivered |
| P1 — Core objects | Dashboard, Portfolio (+ Blockers), Project Detail, Demands funnel | Delivered |
| P2 — Planning & portfolio breadth | Gantt/timeline, Programs, Products, OKRs, Resources, Financials | Delivered |
| P3 — Reporting | Delivery status, Releases, Weekly Updates (news), branded Reports | Delivered |
| P4 — Integrations & real-time | Jira/ADO connector abstraction, Teams notifications, SignalR rooms | Delivered |
| P5 — Governance & compliance | Stage gates, gate reviews, ADR log, TOGAF ADM, ISO 27001 SoA, compliance module | Delivered |
| P6 — Approved extensions | Whiteboard, Team SWOT & dev plans, timeline dependencies, brand themes, quality/Jira ingest | Delivered (CLAUDE.md §2 + ADRs) |
| P7 — Engineering-quality remediation | Security hardening, generated API types, connector abstraction, comment/god-object cleanup (Epic #106; ADRs 0080–0084) | Delivered |
| P8 — Azure-native / production migration | Managed identity, Key Vault, managed Postgres (PITR), private networking, WAF | Planned (separate SoW) |

## 7. Milestones & acceptance criteria

| Milestone | Acceptance criteria |
|-----------|---------------------|
| M1 Functional acceptance | All in-scope screens demonstrable against `requirements.md` (FR-*) and `user-stories.md`; each view shows real data with loading/empty/error; integration tests green |
| M2 Security acceptance | Threat model reviewed; server-authoritative RBAC verified by tests; no High findings in `npm audit --omit=dev` / Trivy; Semgrep + secrets scan clean; nginx CSP/TLS hardening in place |
| M3 Operational acceptance | Same-origin deployment per `SETUP.md` / `DOCKER.md`; `/health`·`/readyz` pass; **backup + restore rehearsed**; air-gapped build verified (no runtime egress) |
| M4 Compliance acceptance | Per-project ISO 27001 SoA populated; GDPR / personnel-data pack reviewed by [DPO]; DPIA + MBL §11 sign-off for personnel features; audit trail verified |
| M5 Documentation & hand-over | D4–D9 delivered; knowledge-transfer session held |
| M6 Live sign-off | A real Entra interactive sign-in verified in [staging/production]; go-live approved by [sponsor] |

**Definition of Done (per work package):** code merged to `main` behind green CI
(one issue → one PR); tests for the behaviour; docs/ADR updated; no High/Critical
security findings; module-boundary ratchet and API type-contract drift both green.

## 8. Roles & responsibilities (RACI)

| Activity | Delivery team | Client / IT | Sponsor | DPO |
|---|---|---|---|---|
| Build & test the application | R/A | C | I | I |
| Entra tenant + app registrations, MFA/CA | C | R/A | I | I |
| Host / network / TLS certificates | C | R/A | I | — |
| Connector setup + consent (Jira/ADO/Teams/Graph) | C | R/A | I | — |
| Security & compliance artefacts | R/A | C | I | C |
| Personnel-data sign-off (DPIA / MBL §11) | C | C | I | R/A |
| Acceptance & go-live approval | C | C | R/A | C |

_R = Responsible · A = Accountable · C = Consulted · I = Informed. Names: [to complete]._

## 9. Assumptions & dependencies

- An **Entra ID tenant** is available with rights to create app registrations and
  grant admin consent; **MFA / Conditional Access** is enabled organisation-side.
- A **Windows / VMware host** (or the agreed target) is provisioned with the
  runtime; **TLS certificates** are supplied; the site is served same-origin
  behind nginx.
- **PostgreSQL 16** is provisioned; off-host, access-controlled **backup storage**
  is available.
- Directory data is provided via **Entra**; the client nominates admins, approvers
  and connector credentials (Jira / Azure DevOps / Teams / Graph).
- The environment is **air-gapped** at runtime — all assets are self-hosted; build
  tooling runs in CI, not on the target.

## 10. Constraints

- Single-instance, same-origin on-premise deployment; the value is auditability
  and durability of portfolio evidence, not high availability.
- **No runtime internet egress** — no CDNs; fonts/assets bundled (ADR-0078).
- Deployment is by **downloading built artefacts to a Windows server** (no git on
  the target); artefacts must be self-contained.
- Authorization is **server-authoritative**; the client is never a security
  boundary. UI role checks are cosmetic.
- Stack: React 18 / TypeScript / Vite · .NET 10 minimal API / EF Core 10 ·
  PostgreSQL 16 · modern evergreen browsers.

## 11. Environment & technical requirements

Technical requirements are specified in `requirements.md` (TR-*): platform,
frontend, identity, API/data, storage, messaging, security, observability, i18n,
CI and compatibility. Setup steps are in `SETUP.md` / `DOCKER.md`; identity in
`sso-setup.md`; connectors in `jira-setup.md`, `azure-devops-setup.md`,
`teams-setup.md`, `email-graph-setup.md`.

## 12. Security & compliance obligations

The supplier will deliver and maintain: a **threat model** (`threat-model.md`) and
security-hardening record (`security-hardening.md`); **server-authoritative RBAC**
(capability matrix, ADR-0004); a per-project **ISO 27001:2022 Statement of
Applicability** (ADR-0066); a security/compliance module mapping controls across
GDPR / PCI-DSS / ISO 27001 / EU AI Act / SOC 2 / NIS2; and a **GDPR / personnel-data
pack** (`dpia-personnel-data.md`, `compliance-sweden.md`, `retention.md`) — DSAR
export, evidence-preserving erasure and retention purge. CI enforces SAST
(Semgrep), dependency/secret/IaC scanning (Trivy), an accessibility (axe) sweep,
coverage floors, an API type-contract drift check and the ADR-0072 module-boundary
ratchet; GitHub Actions are pinned to commit SHAs. Personnel-data features stay
gated off until DPIA + MBL §11 sign-off (ADR-0063).

## 13. Change control & governance

Changes to scope, deliverables or acceptance criteria are handled by written
**change request**: description, rationale, impact on schedule/effort, and sign-off
by [sponsor] and [delivery lead]. Day-to-day delivery is tracked on `main` with
green-CI gating, **one issue → one PR**, and an ADR for every significant
decision (see `architecture/adr/` and `ALL-ADRS.md`). Product-owner-approved
deviations from the frozen prototype are recorded in `CLAUDE.md §2` and an ADR.

## 14. Risks

Key delivery/operational risks and mitigations are catalogued in `threat-model.md`
and the ADRs. Highest residual items are organisation-side: enabling MFA /
Conditional Access, at-rest encryption and SIEM forwarding. Delivery-side watch
items: prototype-fidelity acceptance (mitigated by side-by-side review), the
air-gapped no-CDN constraint (self-hosted assets, offline build verified), and the
staged migration of legacy display-string date columns (ADR-0082, per-module).

## 15. Commercials

[To be completed by the parties — pricing model (fixed-price / capped T&M / T&M),
total or not-to-exceed, rate card, effort estimate, payment schedule (tied to the
milestones in §7), expenses, warranty and any support/maintenance terms. Not
pre-filled.]

## 16. Acceptance & sign-off

Acceptance is granted per milestone (§7). Final acceptance follows M6 (live
sign-off). This Statement of Work is agreed and authorised by:

| Party | Name | Signature | Date |
|---|---|---|---|
| Client / Sponsor | [ ] | | |
| Delivery lead | [ ] | | |
| DPO (compliance) | [ ] | | |

_Effective date: [on last signature] · SoW version: 1.0 · Supersedes: [none / prior]._

## 17. References

`requirements.md` · `user-stories.md` · `architecture/hld.md` ·
`architecture/lld.md` · `architecture/adr/` (+ `ALL-ADRS.md`) ·
`architecture/building-blocks.md` · `threat-model.md` · `security-hardening.md` ·
`pentest-scope.md` · `compliance-sweden.md` · `dpia-personnel-data.md` ·
`retention.md` · `accessibility.md` · `observability.md` · `SETUP.md` ·
`DOCKER.md` · `sso-setup.md` · `secrets.md` · connector guides (`jira-setup.md`,
`azure-devops-setup.md`, `teams-setup.md`, `email-graph-setup.md`) ·
`SoW/flows.md` (functional flows). Companion SoWs: `SoW-Atlas-PPM-Product-Build.md`
(detailed build) and `SoW-Atlas-PPM-Remediation.md` (Epic #106 remediation).
