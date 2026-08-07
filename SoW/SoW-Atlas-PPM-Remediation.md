# Statement of Work — Atlas PPM Code-Review Remediation

| Field | Value |
|---|---|
| **Project** | Atlas PPM — Code-Review Remediation (Epic #106) |
| **System** | Atlas — Portfolio & Project Management web app (React/TS + .NET 10 minimal API, PostgreSQL 16) |
| **Client** | Birgma / Biltema Group |
| **Repository** | `nicpozent/ATLASPPM_AdditionalFeatures` |
| **Prepared for** | nicolas.pozza@birgma.com |
| **Date** | 2026-08-07 |
| **Status** | In progress — the majority of scope delivered; remainder tracked below |

---

## 1. Background & objectives

A structured code review of the Atlas PPM codebase produced a remediation
backlog (findings **R1–R19**, organised into six waves in Epic #106). The
objective of this engagement is to resolve those findings — closing security
gaps, removing structural drift, and recording the architectural decisions —
**without changing product behaviour or the approved visual prototype**, and
while keeping the build continuously green.

Guiding principles applied throughout:

- **One finding → one pull request**, each rebased to a single clean commit.
- **Server-authoritative decisions recorded as ADRs** (Architecture Decision
  Records) before or alongside the code.
- **Test-gated**: every change verified by the full automated suite before merge.
- **No behaviour or visual regression**; inline-styled theme tokens only.

---

## 2. Scope of work

### 2.1 In scope — by wave

| Wave | Findings | Theme |
|---|---|---|
| 1 | R1–R5 | Security gate hoist & connector logging; frontend error-surface hardening; docs/config accuracy |
| 2–3 | R6–R10 | Coverage measurement + floors; ESLint ratchets; server module-folder materialisation; single `Auth:Enabled` reader; entity-hue palette unification |
| 4 | R11–R13 | Generated API type contract; whiteboard shape registry; tab/layout registries |
| 5 | R14–R16 | Dates-as-real-types ADR; one connector abstraction; i18n-scope ADR |
| 6 | R17–R18 | Comment cleanup (why-not-what); god-object file splits |
| — | R19 | Watch-only (no action) |

### 2.2 Out of scope

- New product features or screens beyond the approved prototype (except
  product-owner-approved extensions already recorded in `CLAUDE.md §2`).
- Redesign or restyling of any existing screen.
- Jira **bidirectional write-back** — captured as a *Proposed* decision
  (ADR-0080) awaiting product-owner sign-off; **not** implemented.
- Full screen-body internationalisation (deliberately deferred — see ADR-0084).
- Data migrations for legacy display-string date columns — planned per-module
  under ADR-0082 but not executed in this engagement.
- Any change to the client as a security control (authorization stays
  server-authoritative).

---

## 3. Deliverables & status

### 3.1 Security hardening
| Deliverable | Status |
|---|---|
| Authorization gaps closed (H1/H2/M1/M2/M3 + follow-up sweep of ~10 further read/write endpoints) | ✅ Delivered |
| CSP (M4) + all LOW findings + by-id ownership authorization | ✅ Delivered |
| nginx CSP + cipher hardening; Jira attachment SSRF guard; backup-webhook validation | ✅ Delivered |
| GitHub Actions pinned to commit SHAs; Dependabot for actions | ✅ Delivered |

### 3.2 Engineering quality & CI gates
| Deliverable | Status |
|---|---|
| Backend coverage measurement (coverlet) + CI floor (65% line) | ✅ Delivered |
| Frontend coverage measurement (v8) + CI floor (6% line) | ✅ Delivered |
| ESLint ratchets: `max-lines`, `max-lines-per-function`, literal-hex-colour ban | ✅ Delivered |
| Module-boundary ratchet (ADR-0072, NetArchTest) enforced in CI | ✅ Delivered (pre-existing, respected) |
| **Generated API type contract** (OpenAPI → `src/api/generated.ts`) + CI drift job (R11) | ✅ Delivered — ADR-0081 |

### 3.3 Structural refactors
| Deliverable | Status |
|---|---|
| Whiteboard shape registry + client/server drift guard (R12) | ✅ Delivered (metadata half; render unification tracked in #98) |
| Server module-folder layout + `Auth:Enabled` single reader (R8/R9) | ✅ Delivered |
| Entity-hue palette unification (R10 stage A) | ✅ Delivered |
| Project/Dashboard tab & layout registries (R13) | ✅ Delivered |
| **One work-item connector abstraction** (Jira + Azure DevOps → `IWorkItemConnector` + generic queue/worker) (R15) | ✅ Delivered — ADR-0083 |
| Comment cleanup — delete restatement, keep rationale (R17) | ✅ Delivered |
| God-object split: `WriteEndpoints.cs` (805 → 83-line composer + 7 files) (R18 pt 1) | ✅ Delivered |

### 3.4 Architecture Decision Records
| ADR | Subject | Status |
|---|---|---|
| ADR-0080 | Jira bidirectional write-back | **Proposed** (awaiting PO decision) |
| ADR-0081 | Generated API type contract | Accepted |
| ADR-0082 | Persist dates as real `date`/`timestamptz` | Proposed (ADR only; migration staged) |
| ADR-0083 | One work-item connector abstraction | Accepted |
| ADR-0084 | i18n scope: localised chrome, English content | Accepted |
| — | Consolidated `ALL-ADRS.md` (84 ADRs) + generator, CI staleness check | ✅ Delivered |

### 3.5 Verification assets
- Backend: **507** xUnit tests (incl. fixture-based connector sync tests + a
  client/server drift guard). ✅
- Frontend: **145** Vitest tests. ✅
- Playwright + axe accessibility sweep; Semgrep (SAST), Trivy (deps/secrets/IaC)
  security jobs — all green in CI. ✅

---

## 4. Remaining scope (tracked, open)

| Item | Description | Why not in this pass |
|---|---|---|
| #98 | Whiteboard render/glyph/SVG unification | Interaction-coupled; needs in-app visual verification |
| #104 (frontend) | Split `Gantt.tsx`, `Admin.tsx`, `Pip.tsx`, and folder-less screens | Needs in-app visual-regression checking; one PR each |
| #104 (backend) | Split `Dtos.cs` (per-module — surfaces hidden coupling to the boundary ratchet) and `Teams.cs` | Sequenced after the frontend splits |
| #90 (R4 tail) | Adopt shared `QueryState` in ~34 more screens | Incremental, one batch per screen group |
| #96 (R10 tail) | Sweep remaining ~442 literal hex colours; flip lint rule to error | Incremental |
| ADR-0082 migrations | Per-module date-column migrations (`Demand.Date` first) | Deliberately staged; needs a migration window |

---

## 5. Approach & methodology

1. **Analyse first** — measure the finding against current code (facts, not the
   original ticket text, which may predate other merges).
2. **Decide & record** — where architectural, an ADR precedes or accompanies the
   code; the developer-facing rule goes into `CLAUDE.md`.
3. **Implement** on the designated feature branch, behaviour-preserving.
4. **Verify** — full backend + frontend suites, build, lint, coverage floors,
   contract-drift and boundary ratchets — locally and in CI.
5. **One issue → one PR**, squash-merged after all required CI checks pass.

---

## 6. Acceptance criteria

- All required CI checks green on each PR: frontend (lint/test/build), backend
  (build/test), API-type-contract drift, accessibility (axe), SAST/Trivy,
  coverage floors.
- No regression in the 507 backend / 145 frontend tests.
- Each finding's issue closed with a summary comment, or explicitly left open
  with the remaining scope documented.
- Architectural changes recorded as an Accepted ADR (or Proposed where PO
  sign-off is required).

> Note: the `github-advanced-security` (Copilot Autofix) check is an external
> service that intermittently errors independently of the code; it is **not** a
> gating check for this engagement, per client direction.

---

## 7. Assumptions & constraints

- **On-prem, air-gapped deployment**: no internet egress at runtime; all fonts
  and assets self-hosted/bundled (ADR-0078). Build-time dev tooling
  (e.g. `openapi-typescript`) runs in CI only, never ships.
- **Deployment model**: the client deploys by downloading built files to a
  Windows server; there is no git on the target. Changes therefore must be
  self-contained and reproducible from the repo.
- The approved prototype (`design/Atlas PPM.dc.html`) is the visual source of
  truth and is not edited; product-owner-approved deviations are recorded in
  `CLAUDE.md §2` + an ADR.
- Six canonical backend roles enforce authorization; the 9-identity header
  switcher is cosmetic.

---

## 8. Roles & responsibilities

| Party | Responsibility |
|---|---|
| Engineering (delivery) | Analysis, implementation, tests, ADRs, PRs, CI verification |
| Product Owner (Birgma) | Sign-off on *Proposed* ADRs (0080 Jira write-back; 0082 date migrations); prioritisation of remaining #104/#90/#96 work |
| Design team | Regenerate `design/` to reflect approved extensions (tracked, external to this engagement) |
| Platform/Ops | Provide a migration window for the ADR-0082 date-column migrations when scheduled |

---

## 9. Risks & dependencies

- **Visual-regression risk** on the remaining frontend god-object splits (#104)
  — mitigated by requiring in-app verification before those PRs merge.
- **Data-migration risk** (ADR-0082) — `Demand.Date` back-fill must infer a
  missing year; requires a migration window and is called out per-PR.
- **Dependency**: R18 backend `Dtos.cs` split may *surface* (not create) latent
  cross-module coupling once DTOs move into module namespaces — expected and
  desirable, but may require follow-up boundary fixes.
- Jira write-back (ADR-0080) reverses a foundational pull-only decision and must
  not be implemented until it graduates to *Accepted*.

---

*This SoW describes the Atlas PPM code-review remediation engagement (Epic
#106). If a Statement of Work for the broader Atlas PPM product build (all
screens, integrations, and governance modules) is what's needed instead, that
can be produced as a separate document.*
