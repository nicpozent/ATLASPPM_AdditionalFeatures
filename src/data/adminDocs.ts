// ============================================================================
//  Admin docs — structured content for the Admin → "Application Evaluation" and
//  "User Stories" tabs. Kept as a typed module (like the install/integration
//  guides) so the Admin screen renders it directly. Mirrors, in structured
//  form, docs/application-evaluation.md and docs/user-stories.md — update both
//  together. Content only; no data fabrication (this IS the documentation).
// ============================================================================

// ---- Application evaluation ------------------------------------------------

export interface EvalDimension {
  n: number;
  name: string;
  stars: 1 | 2 | 3 | 4 | 5;
  evidence: string;
  gaps: string;
}
export interface EvalRisk { priority: "High" | "Medium" | "Low"; item: string; why: string }
export interface Evaluation {
  lastReviewed: string;
  overall: string;
  scorecard: EvalDimension[];
  notes: string[];
  risks: EvalRisk[];
  verdict: string;
}

export const EVALUATION: Evaluation = {
  lastReviewed: "2026-07-09 · main @ perf-smoke-pentest-scope",
  overall: "4.9 / 5 — 16 of 18 dimensions at ★★★★★ (the two non-max: Integrations & Security, both ★★★★☆).",
  scorecard: [
    { n: 1, name: "Functional coverage (screens vs prototype)", stars: 5, evidence: "All Workspace + Configuration screens built and data-wired; tracked features complete.", gaps: "Ongoing prototype-fidelity spot-checks." },
    { n: 2, name: "Architecture & modularity", stars: 5, evidence: "Modular monolith; minimal API grouped /api/v1; one C# file per domain; HLD + LLD + 55 ADRs.", gaps: "—" },
    { n: 3, name: "Frontend engineering", stars: 5, evidence: "React 18 + TS strict + Vite; inline design tokens; route code-splitting + vendor chunks; lint clean (0 warnings).", gaps: "—" },
    { n: 4, name: "Identity & access", stars: 5, evidence: "Entra SSO (MSAL, PKCE) verified end-to-end on a live tenant; server-authoritative RBAC; 15-min idle-logout.", gaps: "—" },
    { n: 5, name: "Authorization model", stars: 5, evidence: "6 canonical server roles; UI checks cosmetic; capability matrix; authz integration tests.", gaps: "—" },
    { n: 6, name: "Data & persistence", stars: 5, evidence: "PostgreSQL 16 + EF Core 9; migrations auto-applied; empty-by-default, derive-on-read roll-ups.", gaps: "—" },
    { n: 7, name: "Integrations", stars: 4, evidence: "Jira (full sync + attachments; Ops import incl. epics), Microsoft Graph, Azure DevOps (discovery + work-item sync, backgrounded, with delta/changed-since pulls).", gaps: "ServiceNow/GitHub/Confluence/Teams/Slack/Power BI cosmetic." },
    { n: 8, name: "Async / background work", stars: 5, evidence: "Hosted services: Jira + ADO background queues/workers (202 + poll), scheduled Jira, retention, capacity alerts; web/worker process split (Atlas__Role) runs the recurring timer jobs in their own container off the request path (ADR-0048).", gaps: "—" },
    { n: 9, name: "Security & hardening", stars: 4, evidence: "Security headers/CSP, rate limiting, upload limits, least-privilege DB role + non-root API image, secrets via env/Docker secrets + Dependabot cooldown, dependency audit gate, idle-logout; gating AppSec scanning — SAST (Semgrep) · SCA/secrets/IaC (Trivy), triaged baseline (ADR-0051/0053) + on-demand DAST (OWASP ZAP); portable scripts/security-scan.sh (runs off GitHub) + in-app Security Posture page; CodeQL enablement note + pen-test scope & remediation register (docs/pentest-scope.md).", gaps: "Human pen-test engagement + automated secret rotation outstanding." },
    { n: 10, name: "Accessibility (WCAG 2 AA)", stars: 5, evidence: "jsdom axe on primitives + browser axe sweep gated incl. colour-contrast; mobile drawer; focus/dialog/menu semantics.", gaps: "Sweep covers representative routes; extend as views grow." },
    { n: 11, name: "Observability", stars: 5, evidence: "OpenTelemetry (traces/metrics/logs), health/readiness, correlation IDs; domain metrics + tuned dashboards + Prometheus alert rules.", gaps: "—" },
    { n: 12, name: "Testing", stars: 5, evidence: "Backend 394 xUnit; frontend 64 vitest + per-screen logic; Playwright e2e — axe sweep + full user-journey specs (navigation, role-nav, dashboard layouts, mocked demand drill-in); k6 load/perf suite (smoke·load·stress + API volume seeder, ADR-0047); smoke wired into CI (perf-smoke.yml, seeded API + k6 vs hot roll-ups).", gaps: "Full load/stress runs operated against a seeded test env; NBomber not used." },
    { n: 13, name: "CI/CD", stars: 5, evidence: "GitHub Actions: frontend lint/test/build, API build/test, a11y sweep, NuGet + npm audit gates, SAST/SCA/DAST, on-demand perf-smoke gate (seeded API + k6); tag-triggered release pipeline publishing versioned api/web images to GHCR (Buildx + image scan, ADR-0052).", gaps: "Deploy-to-host step is host-dependent (parked with k8s)." },
    { n: 14, name: "Delivery & runtime", stars: 5, evidence: "On-prem single-node Docker (docker compose: web/worker/db/nginx edge) as the chosen, documented target (ADR-0054); images promoted from GHCR (ADR-0052); migrations on start; health-gated; secrets overlay; upgrade = pull-and-recreate.", gaps: "k8s parked (no scale/HA need at portfolio scale); HA is a single-node trade-off." },
    { n: 15, name: "Governance & compliance", stars: 5, evidence: "Stage gates, RAID, ARB sign-off, decision log, security controls, GDPR DSAR + retention; deterministic risk engine maps findings to GDPR/ISO 27001/ISO 42001/PCI-DSS/SOC 2/NIS2/NIST CSF/MITRE ATT&CK with a generic per-framework coverage rule; EU AI Act risk-tiering + ISO 42001 AI-management (tier→obligation rules, ADR-0050); Zero-Trust posture mapping (ADR-0049).", gaps: "—" },
    { n: 16, name: "Internationalisation", stars: 5, evidence: "6 locales; completeness test gates missing keys.", gaps: "—" },
    { n: 17, name: "Documentation", stars: 5, evidence: "HLD, LLD, building-blocks (ABB/SBB), 55 ADRs, in-app Help + Security Posture page, setup guides, this evaluation, user stories.", gaps: "—" },
    { n: 18, name: "Maintainability / DX", stars: 5, evidence: "Consistent patterns, typed models, dependabot; large screens decomposed into per-tab modules (Project.tsx down to ~1,600 with Tasks/Backlog/Sprints/Epics extracted).", gaps: "—" },
  ],
  notes: [
    "Identity: MSAL redirect flow verified end-to-end on a live tenant (interactive sign-in, bearer-token API calls, token-driven role, 401 on missing token). The API validates the JWT and is authoritative for authorization; idle-logout (default 15 min) complements token expiry.",
    "Integrations: two connectors are real end-to-end (Jira, Azure DevOps), both with backgrounded work-item sync (202 + poll); the Jira → Ops import is now full-fidelity (epics + rich fields + comments/attachments).",
    "Observability: domain metrics (sync duration, queue depth, capacity alerts, DB command latency), a tuned operations dashboard and Prometheus alert rules on top of the reference stack.",
    "Accessibility: the design greys meet WCAG AA and the browser axe sweep gates colour-contrast alongside structural rules, so regressions fail CI.",
    "Maintainability: the outsized screens are decomposed into per-tab modules (project/, resources/) with shared/util helpers; Project.tsx is down to ~1,600 after extracting the agile Tasks/Backlog/Sprints/Epics tabs and their shared task model.",
    "Testing: Playwright e2e now covers full user journeys (navigation across every screen, role-driven nav, dashboard layouts, a mocked demand data → render → drill-in flow) on top of the axe accessibility sweep; a k6 load/perf suite (perf/ — smoke·load·stress + an API-driven volume seeder, Prometheus remote-write) drives the hot roll-up endpoints against a seeded test env (ADR-0047).",
    "Runtime topology: the backend runs in a selectable process role (Atlas__Role = web/worker/all; ADR-0048). The recurring timer jobs (scheduled Jira sync, retention, capacity alerts) run in a separate worker container so a heavy unattended pass can't starve user requests; a worker service is in docker-compose. Default 'all' keeps single-container behaviour. The monolith is intentionally not split into microservices — read roll-ups join across domains in one transaction — so the split is request-serving vs. recurring background work; on-demand sync consumers stay in the web role pending a durable-queue follow-up.",
    "Compliance coverage (ADR-0049): the deterministic risk engine (Risks.cs, no LLM) evaluates each project's real data and maps findings to GDPR, ISO 27001, ISO 42001, PCI-DSS, SOC 2, NIS2, NIST CSF 2.0 and MITRE ATT&CK. A generic per-framework coverage rule scores any framework a project logs controls under, so new frameworks map without code. MITRE findings name tactic/technique classes by architecture change type. Zero-Trust posture (verify explicitly / least privilege / assume breach / continuous monitoring) is mapped to existing controls; the network-segmentation half is infrastructure, deferred until a hosting target is chosen.",
    "Release pipeline (ADR-0052): a tag-triggered release.yml builds and publishes versioned api + web container images to the GitHub Container Registry (GHCR) via Buildx (with GHA layer cache and a report-only Trivy image scan), authenticating with the built-in token — no external secrets. Push a v*.*.* tag (or dispatch with a test tag) to cut a release. Deploying the image to a host (k8s/Helm, App Service) is deferred until a target is chosen.",
    "Security scanning (ADR-0051/0053): a security-scan.yml workflow runs the automated half of a penetration test — SAST (Semgrep: OWASP Top 10, security-audit, secrets) over the C#/TypeScript source, SCA/secret/IaC scanning (Trivy) over dependencies + Dockerfiles, and a dispatch-driven OWASP ZAP baseline (DAST) against a running test environment. After the baseline triage (ADR-0053) SAST + Trivy are gating: a new HIGH/CRITICAL fails the build. The triage fixed the real issues (non-root API image, Dependabot cooldown) and recorded scoped, documented exceptions (nginx edge root master; CI-policy findings; design/ prototype reference). CodeQL is the GitHub-native complement via the repo's Code-scanning default-setup toggle (enablement steps in security-hardening.md §6). A human pen-test/red-team remains a separate external engagement, scoped with rules-of-engagement and a finding→fix remediation register in docs/pentest-scope.md. The single-VU k6 smoke pass is now wired into CI as an on-demand perf-smoke.yml gate (throwaway Postgres + seeded API + k6 over the hot roll-up endpoints).",
    "EU AI Act & ISO 42001 (ADR-0050): a project's security profile records an EU AI Act risk tier (minimal/limited/high/prohibited), an Annex III flag, human-oversight and transparency measures, and the AI system/model name. The deterministic engine derives obligations from the tier — prohibited → Art 5; high/Annex III → human oversight (Art 14) + risk management & data governance (Art 9/10, ISO 42001); limited → transparency (Art 50); in-scope-but-unclassified is flagged to triage (Art 6). The Security tab shows an AI-classification card when AI is in scope.",
    "Delivery target (ADR-0054): the supported deployment is on-prem single-node Docker (docker compose: db + api[role=web] + worker[role=worker] + web nginx edge), kept off the public internet. Production hosts pull the versioned api/web images published to GHCR by the release pipeline (ADR-0052) rather than building on the host; upgrades are pull-and-recreate, health-gated by /readyz. Kubernetes is parked, not missing — the 12-factor images already suit it if a future multi-node/HA need appears, but a control plane to run four containers on one node isn't justified at portfolio scale. Delivery & runtime → ★★★★★.",
  ],
  risks: [
    { priority: "Low", item: "Commission a human pen-test + automate secret rotation", why: "SAST/SCA gate, DAST on demand, CodeQL note, and a pen-test scope + remediation register now exist (docs/pentest-scope.md, ADR-0051/0053); the external engagement itself and automated secret rotation remain." },
    { priority: "Low", item: "k8s manifests + automated deploy", why: "Release images publish to GHCR on tag (ADR-0052); deploy-to-host + k8s deferred until a target is chosen." },
    { priority: "Low", item: "Broaden connector coverage", why: "Jira + Azure DevOps are real end-to-end; the rest are cosmetic chrome." },
  ],
  verdict:
    "Production-ready. The core PPM product is complete, data-wired, tested across stacks (backend xUnit, frontend vitest, Playwright axe + full-journey e2e, k6 load/perf), accessible (AA-gated), observable, and documented to a professional standard (ABB/SBB traceability, ADRs, HLD/LLD). Entra SSO is verified end-to-end on a live tenant. Remaining items are enhancements, not blockers: broadening connector coverage beyond Jira/Azure DevOps, automated security scanning, and a release/k8s pipeline once a target host is chosen.",
};

// ---- Security posture (automated application-security scanning) -------------
// Static reference, mirroring docs/security-hardening.md §6 + ADR-0051/0053.
// This surfaces the AppSec pipeline in-app WITHOUT any live connection to GitHub
// or the CI system — the app runs no scans and reaches nothing external.

export interface SecurityScanner { name: string; kind: string; covers: string; gating: string; }
export interface SecurityPosture {
  intro: string;
  howToRun: string[];
  scanners: SecurityScanner[];
  exceptions: { item: string; why: string }[];
  manual: string;
}

export const SECURITY_POSTURE: SecurityPosture = {
  intro:
    "Atlas runs the automated half of a penetration test — the bulk of the OWASP Top 10 — on every change. The scanners execute in the delivery pipeline (or on demand via scripts/security-scan.sh); the running application performs no scans and has no connection to GitHub or the internet at runtime. A human penetration test / red-team is a separate, manual engagement this complements but does not replace.",
  howToRun: [
    "CI: security-scan.yml runs SAST + SCA on every push/PR (gating) and weekly; DAST on demand (workflow_dispatch with a target URL).",
    "Anywhere, no GitHub: run scripts/security-scan.sh from the repo on a laptop or an on-prem build agent — SAST + SCA read the source on disk, DAST (--dast <url>) probes a target you own.",
    "Air-gapped: pre-mirror the Semgrep rulesets and the Trivy vulnerability DB, then point the tools at the mirror — no outbound access needed.",
  ],
  scanners: [
    { name: "Semgrep", kind: "SAST — source", covers: "Injection, authz, crypto, hardcoded secrets across C# + TypeScript (OWASP Top 10, security-audit, secrets rulesets).", gating: "Gating — fails the build on a finding" },
    { name: "Trivy", kind: "SCA · secrets · IaC", covers: "Dependency CVEs, committed secrets, and Dockerfile/compose misconfiguration.", gating: "Gating — fails on HIGH/CRITICAL" },
    { name: "OWASP ZAP", kind: "DAST — running app", covers: "Probes a running deployment from the outside (passive + safe-active baseline).", gating: "On demand, against a test environment" },
    { name: "CodeQL (optional)", kind: "SAST — GitHub-native", covers: "Complementary deep SAST, enabled via the repo's Code-scanning default-setup toggle.", gating: "Reports to the Security tab" },
  ],
  exceptions: [
    { item: "nginx edge runs as root (DS-0002)", why: "The TLS-edge master must bind privileged ports 80/443 and read certs; workers drop to the nginx user. The API image is non-root (USER 1654). Unprivileged-nginx migration tracked." },
    { item: "Actions pinned to major-version tags", why: "Kept current by Dependabot's github-actions ecosystem; full SHA-pinning deferred." },
    { item: "Trivy installed via curl | sh", why: "Official installer fetched over TLS from the vendor repository." },
    { item: "nginx reverse-proxy host rules", why: "Standard same-origin reverse proxy; the upstream is an internal config value, not attacker input." },
    { item: "design/ excluded from SAST", why: "The approved prototype reference — never bundled or served, so it isn't application AppSec." },
  ],
  manual:
    "The scope, rules of engagement, and finding→fix remediation register for a human penetration test / red-team are pre-defined in docs/pentest-scope.md — run it against a throwaway test deployment, annually and before any trust-boundary change. Commissioning the external engagement itself and automating secret rotation are the remaining steps; the automated scanners above keep the baseline clean between engagements.",
};

// ---- User stories ----------------------------------------------------------

export interface UserStory {
  id: string;
  role: string;
  want: string;
  benefit: string;
  acceptance?: string;
}
export interface UserStorySection { title: string; stories: UserStory[] }

export const USER_STORY_INTRO =
  "User stories for every feature and capability in Atlas, organised by module and tagged by role. " +
  "Server-authoritative roles (6): PlatformAdmin, PMO, ProjectManager, TeamMember, Executive, Stakeholder — the API enforces these; UI role checks are cosmetic. " +
  "UI identities (9, cosmetic): Platform Admin, PMO, PM (+ PM Lead), Engineering / Service / Dev / Infra Managers, Chief Architect, Stakeholder.";

export const USER_STORY_SECTIONS: UserStorySection[] = [
  { title: "1. Access & Identity", stories: [
    { id: "AUTH-1", role: "User", want: "to sign in with my Microsoft Entra account", benefit: "I use one corporate identity with MFA", acceptance: "MSAL redirect sign-in; MFA honoured via Conditional Access; active account resolved before first render; API roles decoded from the access token." },
    { id: "AUTH-2", role: "PlatformAdmin (security)", want: "unattended sessions to sign out after 15 minutes of inactivity", benefit: "an unlocked workstation can't be misused", acceptance: "idle > VITE_AUTH_IDLE_MINUTES (default 15, clamped 1–480) → MSAL logout; timer resets on pointer/keyboard/scroll/touch/focus; shared across tabs; inert when auth disabled." },
    { id: "AUTH-3", role: "User", want: "my role to decide what I can see and do", benefit: "I'm not shown actions I can't perform", acceptance: "nav + affordances reflect role; every write re-checked server-side; a forbidden call returns 403 with a friendly message." },
    { id: "AUTH-4", role: "PlatformAdmin", want: "to run the whole UI without a backend during evaluation", benefit: "stakeholders can browse the mockup", acceptance: "VITE_AUTH_ENABLED=false → no gate, empty states everywhere." },
    { id: "AUTH-5", role: "User", want: "a clear signed-in identity and a way to switch my UI role view", benefit: "I understand which persona's nav I'm seeing", acceptance: "topbar shows identity + role switcher; switching changes nav only, never server permissions." },
  ]},
  { title: "2. Dashboard", stories: [
    { id: "DASH-1", role: "Executive/PMO", want: "an Executive dashboard (health donut, budget burn, KPI cards with sparklines, active projects, needs-attention, demand pipeline, recent activity)", benefit: "I see portfolio health at a glance", acceptance: "four layouts via segmented control; KPIs zero and tables empty until data loads." },
    { id: "DASH-2", role: "PM/Team member", want: "an Operational dashboard (my tasks/sprint, approvals, KPIs)", benefit: "I can run my day" },
    { id: "DASH-3", role: "Power user", want: "a drag-and-drop Custom dashboard (widget palette, add/remove/reset) persisted server-side", benefit: "I keep my own layout across sessions", acceptance: "layout saved per user; reset restores defaults." },
    { id: "DASH-4", role: "User", want: "a Compact dense layout", benefit: "I can scan many items in little space" },
    { id: "DASH-5", role: "User", want: "the dashboard to auto-refresh and surface errors clearly", benefit: "I trust the numbers", acceptance: "a failed load shows a friendly error, not a blank crash." },
  ]},
  { title: "3. Portfolio & Blockers", stories: [
    { id: "PORT-1", role: "PMO/PM", want: "a Projects sub-tab with filter chips and project cards/table", benefit: "I can scan and drill into any project", acceptance: "clicking a project opens Project Detail; filters by status/department." },
    { id: "PORT-2", role: "PM", want: "a Blockers sub-tab (list + side panel, status, description, filter)", benefit: "I can triage what's stuck", acceptance: "blockers clickable, editable, status lifecycle; also on a project's Blockers tab." },
    { id: "PORT-3", role: "Executive", want: "the portfolio timeline to show items even before rich data exists", benefit: "the view isn't empty", acceptance: "windows derived from phases/tasks/sprints." },
    { id: "PORT-4", role: "PMO", want: "to filter the portfolio by department and owner", benefit: "I focus on my slice" },
  ]},
  { title: "4. Project Detail", stories: [
    { id: "PROJ-1", role: "PM", want: "an Overview tab (summary, communication plan, stakeholder matrix, skills panel, linked products) editable in place", benefit: "the project's context is current" },
    { id: "PROJ-2", role: "PM/Team member", want: "Tasks in board and list views with drag, edit/delete, fields, sprint/epic dropdowns, assignee filter, and a Backlog tab", benefit: "I can manage delivery work", acceptance: "manual create gated on capability; synced tasks read-only where appropriate; completion % auto-derived from task states." },
    { id: "PROJ-3", role: "PM", want: "Epics (clickable, edit/delete, multiple dependencies)", benefit: "scope structure is tracked" },
    { id: "PROJ-4", role: "PM", want: "Requirements (edit/delete, description, attachments, status categories)", benefit: "requirements trace to delivery" },
    { id: "PROJ-5", role: "PM", want: "a RAID log (risks/assumptions/issues/dependencies) with lifecycle", benefit: "governance is auditable" },
    { id: "PROJ-6", role: "PM", want: "Artifacts with an artifact window, versions, upload, and status lifecycle", benefit: "deliverables are versioned" },
    { id: "PROJ-7", role: "PMO/Finance", want: "a Costs tab (labor/license/PaaS/IaaS/SaaS + internal-labor lines)", benefit: "project spend is itemised" },
    { id: "PROJ-8", role: "Chief Architect/PMO", want: "Gates (G0–G5) with gate reviews", benefit: "stage-gate governance is enforced" },
    { id: "PROJ-9", role: "PM", want: "Change Requests (editable fields, status, delete) and threaded Comments", benefit: "change and discussion are recorded" },
    { id: "PROJ-10", role: "PM", want: "to edit project details (dates, owner, methodology, Jira/ADO mapping) from the detail screen", benefit: "I don't need an admin", acceptance: "start/end reflected in Gantt; edits gated on capability." },
    { id: "PROJ-11", role: "PM", want: "the project detail content to match the chosen methodology", benefit: "the screen fits how we work", acceptance: "e.g. Sprints tab only for agile-with-sprints." },
    { id: "PROJ-12", role: "PM", want: "an Ops-impact panel on Overview", benefit: "I see run-the-business load pulling on delivery capacity" },
  ]},
  { title: "5. Demands", stories: [
    { id: "DEM-1", role: "PMO", want: "a value-vs-effort scored intake funnel with drag across stages", benefit: "I can prioritise demand" },
    { id: "DEM-2", role: "Requester", want: "to create a demand with the full scoring form", benefit: "my request is captured and comparable" },
    { id: "DEM-3", role: "Approver", want: "to approve/reject a demand", benefit: "intake is governed", acceptance: "create/approve modals; edits gated on cap-demands." },
    { id: "DEM-4", role: "Stakeholder", want: "to see my own demands", benefit: "I track my requests without full portfolio access" },
    { id: "DEM-5", role: "PMO", want: "to convert an approved demand into a project", benefit: "intake flows into delivery without re-keying" },
  ]},
  { title: "6. Timeline / Gantt", stories: [
    { id: "GANTT-1", role: "PM", want: "a project timeline (phases, bars, milestones with an add-milestone modal, dependency arrows, month grid, export)", benefit: "I can plan and communicate schedule" },
    { id: "GANTT-2", role: "PM", want: "sprints shown below the schedule as collapsible phases", benefit: "iteration cadence is visible" },
    { id: "GANTT-3", role: "PM", want: "synced Jira/ADO sprints to appear in the Schedule view", benefit: "imported cadence shows without manual phases", acceptance: "project gantt returns sprint bars; undated sprints fall back to the project window." },
    { id: "GANTT-4", role: "PMO", want: "a Program-scope timeline derived from its projects, tasks and sprints", benefit: "cross-project schedule is visible" },
    { id: "GANTT-5", role: "PM", want: "Resources and Sprints views on the timeline", benefit: "I see allocation and cadence in context" },
  ]},
  { title: "7. Programs", stories: [
    { id: "PROG-1", role: "PMO", want: "a program list and detail (stakeholder power/interest matrix, linked projects, status, start/end)", benefit: "I manage programs" },
    { id: "PROG-2", role: "PMO", want: "to create programs and link/unlink projects", benefit: "the program portfolio stays accurate" },
    { id: "PROG-3", role: "PMO", want: "to archive/delete a program", benefit: "retired programs don't clutter the view" },
  ]},
  { title: "8. Products", stories: [
    { id: "PROD-1", role: "PMO/Product owner", want: "a product portfolio with Jira/ADO tasks mapped to releases and linked projects", benefit: "product delivery is tracked" },
    { id: "PROD-2", role: "Product owner", want: "product start/end dates and a timeline", benefit: "product horizon is planned" },
    { id: "PROD-3", role: "Product owner", want: "a product team assignment with per-member allocations", benefit: "product capacity is planned" },
  ]},
  { title: "9. OKRs", stories: [
    { id: "OKR-1", role: "Executive/PMO", want: "objectives with key results linked to projects/programs/products", benefit: "strategy connects to delivery" },
    { id: "OKR-2", role: "PMO", want: "KR progress auto-derived from linked entities with a manual RAG override", benefit: "OKR status is trustworthy", acceptance: "edit/delete gated on cap-okrs." },
    { id: "OKR-3", role: "PMO", want: "an OKR timeline with spillover/warning/missed states", benefit: "I see objectives against time" },
  ]},
  { title: "10. Resources & Availability", stories: [
    { id: "RES-1", role: "Resource manager", want: "people synced from Entra with allocation vs availability and per-person input rows by reporting period", benefit: "capacity is planned" },
    { id: "RES-2", role: "Manager", want: "time-phased allocation (per-assignment start/end, %-or-hours)", benefit: "allocation reflects reality over time" },
    { id: "RES-3", role: "Manager", want: "an availability finder (who's free by date/range, stacked allocation)", benefit: "I can staff work" },
    { id: "RES-4", role: "PMO", want: "colour-graded Excel exports (allocation histogram, skills matrix)", benefit: "I can share offline" },
    { id: "RES-5", role: "Manager", want: "allocation to include Ops load and absences", benefit: "capacity numbers are honest" },
  ]},
  { title: "11. Financials & ROI", stories: [
    { id: "FIN-1", role: "Finance/PMO", want: "budget vs actual, CapEx/OpEx split, forecast-at-completion, savings/benefit, and portfolio ROI", benefit: "I steer spend" },
    { id: "FIN-2", role: "PMO/PM Lead", want: "internal-labor cost lines (Dev, Infra, PM, PO) editable by owning roles", benefit: "internal cost is captured" },
    { id: "FIN-3", role: "Executive", want: "financials per project/program/product and overall with a source toggle and forecast", benefit: "I compare across the portfolio" },
    { id: "FIN-4", role: "Executive", want: "ROI per entity (manual + auto) with an explanation", benefit: "I understand the number" },
  ]},
  { title: "12. Delivery Status", stories: [
    { id: "DEL-1", role: "Stakeholder/Executive", want: "a stakeholder report by period (weekly→yearly): completed/in-progress/planned, velocity, on-time %, blockers, budget burn", benefit: "I get a consistent status" },
  ]},
  { title: "13. Releases", stories: [
    { id: "REL-1", role: "Release manager", want: "a release calendar and deployment tracking with per-status tabs and an overall view", benefit: "I plan deployments" },
    { id: "REL-2", role: "Release manager", want: "Cancelled status plus archive/delete and edit", benefit: "the calendar stays clean" },
    { id: "REL-3", role: "Release manager", want: "to link a release to a project/product/program via a dropdown of both connector-mapped and manually-created entities", benefit: "I don't hand-type ids and can't mistype", acceptance: "scope-aware dropdown fed by the list endpoints; legacy free-text kept as a (current) option." },
  ]},
  { title: "14. Weekly Updates (News)", stories: [
    { id: "NEWS-1", role: "PMO", want: "an editable news wall (headline, highlight metric, shout-out, image, milestone, doc blocks) with themes + masonry and an edit mode", benefit: "I broadcast curated updates" },
  ]},
  { title: "15. My Team, Skills & Labor Rates", stories: [
    { id: "TEAM-1", role: "Manager", want: "My Team with members, skills, and a roll-up view", benefit: "I see my org" },
    { id: "TEAM-2", role: "Manager", want: "a customizable skills/competency matrix (name-keyed ratings)", benefit: "I plan by capability" },
    { id: "TEAM-3", role: "Manager", want: "an internal-labour rate card (Junior→Expert) with a day/month/hour calculator", benefit: "I estimate internal cost", acceptance: "each discipline's rate is need-to-know — visible AND editable only by its owners: Dev → Global Eng Mgr, Developers Mgr, CTO, CIO; Infra → Infra Mgr, Global Service Mgr, CTO, CIO; Architect → Chief Architect, CTO, CIO; PM & PO → PMO, PM Lead, CTO, CIO. The API returns only disciplines the caller may see; a persona owning none sees a restricted state (ADR-0055)." },
  ]},
  { title: "16. Methodologies & Create-Project Wizard", stories: [
    { id: "METH-1", role: "PMO/PM", want: "a methodology library (Waterfall, V-Model, Stage-Gate, Scrum, Kanban, SAFe, Scrumban, Spiral, Iterative, RAD, DevOps)", benefit: "projects follow a chosen way of working" },
    { id: "METH-2", role: "PM", want: "a create-project wizard (methodology → name/dept/owner → integration)", benefit: "projects start consistently", acceptance: "methodology drives the project's detail content." },
  ]},
  { title: "17. Integrations", stories: [
    { id: "INT-1", role: "PlatformAdmin", want: "to configure connectors and Test connection", benefit: "I confirm access before syncing", acceptance: "status never calls the remote; test/discovery degrade gracefully; gated on cap-integrations." },
    { id: "INT-2", role: "PM/PMO", want: "to discover and import Jira projects (to a new/existing project, a program, or an Ops service) with an optional board id", benefit: "delivery data flows in" },
    { id: "INT-3", role: "PM/PMO", want: "to discover and import Azure DevOps projects and map them to Atlas projects", benefit: "ADO work is tracked in Atlas" },
    { id: "INT-4", role: "PM", want: "a Sync now that pulls Jira/ADO into tasks/epics/sprints/backlog idempotently", benefit: "Atlas mirrors the tracker without duplicates or clobbering manual rows", acceptance: "ADO iterations→sprints, work items→epics/tasks, no iteration ⇒ backlog; prune-on-full-pull; bounded." },
    { id: "INT-5", role: "PM", want: "large syncs to run in the background", benefit: "a portfolio-wide pull doesn't time out", acceptance: "202 + jobId poll." },
    { id: "INT-6", role: "Service Manager", want: "the Jira → Ops import to carry the full issue (description, people, labels, components, versions, points, time, epics, comments, attachments)", benefit: "an Ops import is as faithful as a project import", acceptance: "epics import as items tagged Epic; children link by epic/parent key; comments/attachments idempotent by Jira id." },
  ]},
  { title: "18. Reports", stories: [
    { id: "REP-1", role: "PMO", want: "branded portfolio/demand/blocker/audit reports with export formats", benefit: "I share governed outputs" },
  ]},
  { title: "19. Administration", stories: [
    { id: "ADM-1", role: "PlatformAdmin", want: "a roles & permissions matrix", benefit: "I assign capabilities to roles" },
    { id: "ADM-2", role: "PlatformAdmin", want: "backups/restore, an audit log, AD sync, and install/integration guides", benefit: "I operate the platform" },
    { id: "ADM-3", role: "Data Protection Officer", want: "a Data Privacy tab: DSAR export, erase, run-retention, and deletion requests", benefit: "I meet GDPR obligations" },
    { id: "ADM-4", role: "PlatformAdmin", want: "to configure the idle-logout timeout and SSO/MFA", benefit: "session policy meets our standard" },
    { id: "ADM-5", role: "PlatformAdmin", want: "an Application Evaluation view and a User Stories catalogue in-app", benefit: "I can review readiness and scope without leaving Atlas" },
    { id: "ADM-6", role: "PlatformAdmin", want: "a database password rotation age panel with 90/180-day nudges", benefit: "credential hygiene is visible" },
    { id: "ADM-7", role: "PlatformAdmin / security lead", want: "an in-app Security Posture view", benefit: "I can see the application-security scanning posture without leaving Atlas", acceptance: "a read-only Admin → Security Posture tab lists the scanners (SAST/SCA/DAST + CodeQL), how to run them (CI, the off-GitHub scripts/security-scan.sh, or air-gapped), the scoped documented exceptions, and the manual-pen-test pointer; the page makes no external calls and the app runs no scans itself (ADR-0051/0053)." },
  ]},
  { title: "20. Help", stories: [
    { id: "HELP-1", role: "User", want: "role-based guides, articles, and contact, plus troubleshooting with support codes", benefit: "I self-serve" },
  ]},
  { title: "21. Governance", stories: [
    { id: "GOV-1", role: "Chief Architect", want: "stage gates (G0–G5) and gate reviews (architecture/security)", benefit: "decisions are gated" },
    { id: "GOV-2", role: "Chief Architect", want: "an ARB sign-off panel, architecture domains/waivers, and TOGAF ADM phases", benefit: "architecture is governed" },
    { id: "GOV-3", role: "Governance lead", want: "a decision log (ADR) with edit/delete", benefit: "decisions are recorded" },
    { id: "GOV-4", role: "Compliance officer", want: "a security/compliance module with control mappings and configurable review gates", benefit: "controls have evidence", acceptance: "a deterministic risk engine (Risks.cs, no LLM) maps findings to GDPR, ISO 27001, ISO 42001, PCI-DSS, SOC 2, NIS2, NIST CSF 2.0 and MITRE ATT&CK with a generic per-framework coverage rule (new frameworks map without code); a Zero-Trust posture is mapped to existing controls (ADR-0049)." },
    { id: "GOV-5", role: "QA lead", want: "a Quality module (plan → stages → tests + defects, tasks/test cases per plan)", benefit: "quality is tracked" },
    { id: "GOV-6", role: "Compliance officer", want: "each project's AI use classified under the EU AI Act and ISO 42001", benefit: "AI obligations are explicit and evidenced", acceptance: "the security profile records a risk tier (minimal/limited/high/prohibited), Annex III flag, human-oversight/transparency measures, and the AI system/model name; the engine derives obligations from the tier — prohibited → Art 5; high/Annex III → Art 14 + Art 9/10 (ISO 42001); limited → Art 50; in-scope-but-unclassified → triage (Art 6). The Security tab shows an AI-classification card when AI is in scope (ADR-0050)." },
  ]},
  { title: "22. Ops (run-the-business)", stories: [
    { id: "OPS-1", role: "Service Manager", want: "Ops services with work items (type/priority/status/assignee/allocation %), archivable", benefit: "BAU work is tracked and counts against capacity" },
    { id: "OPS-2", role: "Service Manager", want: "to import/sync a Jira space as an Ops service and link existing project tasks to a service", benefit: "a service is fed by both Jira and real delivery tasks", acceptance: "linked tasks read-only; allocation stays with their project (no double-counting)." },
    { id: "OPS-3", role: "Service Manager", want: "to filter the board by Jira work-item status and multi-select items for bulk delete", benefit: "I triage the way I think and clear synced noise quickly" },
    { id: "OPS-4", role: "PM", want: "an Ops 'impact project' tag", benefit: "a project's Overview shows operational load pulling on its capacity" },
  ]},
  { title: "23. Roadmap", stories: [
    { id: "ROAD-1", role: "PMO/Exec", want: "a strategic roadmap in Now/Next/Later and by-year boards plus a timeline, with milestones/links/dependencies", benefit: "I plan strategy at the right horizon", acceptance: "create initiatives by year; gated on cap-roadmap." },
  ]},
  { title: "24. PI Planning", stories: [
    { id: "PIP-1", role: "RTE/PMO", want: "a Program Increment Planning module showing team free-time for the PI period", benefit: "I plan increments against real capacity" },
  ]},
  { title: "25. Notifications & Capacity Intelligence", stories: [
    { id: "NOTIF-1", role: "User", want: "a notification center, subscribe buttons, and preferences", benefit: "I follow what matters" },
    { id: "NOTIF-2", role: "Manager", want: "over-allocation alerts (delivered, deduplicated)", benefit: "I catch capacity problems early" },
    { id: "CAP-1", role: "Manager", want: "capacity intelligence (skills-based staffing suggestions, my-allocations, capacity-vs-demand)", benefit: "I staff effectively" },
    { id: "NOTIF-3", role: "PMO / Chief Architect / CTO / CIO / PM Lead", want: "to be notified automatically whenever a demand is created or changes status", benefit: "portfolio leadership sees intake without subscribing to each demand", acceptance: "role-addressed in-app notification on create + status/approval; email to those role members too, resolved via the in-app group→role mapping, default-on with per-person opt-out; the actor isn't self-notified." },
  ]},
  { title: "26. Stakeholder Experience", stories: [
    { id: "STK-1", role: "Stakeholder", want: "a reduced navigation (my projects, my demands, delivery, releases, weekly updates, help)", benefit: "I see only what's relevant", acceptance: "Stakeholder role gets NAV_STAKEHOLDER_*; the API scopes data to the stakeholder." },
  ]},
  { title: "27. Platform & Observability (operator)", stories: [
    { id: "OBS-1", role: "Operator", want: "traces, metrics, logs (OTLP), health/readiness endpoints, and correlation IDs on errors", benefit: "I can diagnose incidents" },
    { id: "OBS-2", role: "Operator", want: "a reference Grafana/Tempo/Prometheus/Loki stack and dashboard with tuned alert rules", benefit: "I stand up observability quickly" },
    { id: "OBS-3", role: "Operator", want: "same-origin nginx edge, security headers/CSP, rate limiting, and secrets via env/Docker secrets", benefit: "the deployment is hardened" },
    { id: "OBS-4", role: "Operator", want: "the recurring background jobs to run in a separate container from the request-serving API", benefit: "a portfolio-wide scheduled sync or retention pass can't starve user requests", acceptance: "a process role (Atlas__Role = web/worker/all) selects behaviour from one image; docker-compose ships api (web) + worker (worker); the default all keeps single-container behaviour (ADR-0048)." },
    { id: "OBS-5", role: "Security lead", want: "automated application-security scanning on every change and runnable off GitHub", benefit: "the OWASP-Top-10 baseline stays clean between manual pen-tests", acceptance: "security-scan.yml runs gating SAST (Semgrep) + SCA/secrets/IaC (Trivy) on push/PR and on-demand DAST (OWASP ZAP) vs a test server; scripts/security-scan.sh runs the same off any machine with no GitHub connection; CodeQL via the repo default-setup toggle; the manual engagement's scope + remediation register live in docs/pentest-scope.md (ADR-0051/0053)." },
    { id: "OBS-6", role: "Operator", want: "a performance-smoke gate and a k6 load/perf suite", benefit: "a latency regression on the hot roll-up endpoints is caught before release", acceptance: "perf-smoke.yml (workflow_dispatch) stands up a throwaway Postgres + a seeded API and runs the single-VU k6 smoke pass over the hot roll-ups, failing on any error or p95 past budget; load/stress stay manual against a real test server; the seeder is a throwaway-DB fixture, never production (ADR-0047)." },
    { id: "OBS-7", role: "Operator", want: "a tag-triggered release pipeline and a documented on-prem Docker deployment", benefit: "I can ship a reproducible build to our own infrastructure", acceptance: "a v*.*.* tag publishes versioned api/web images to GHCR (Buildx + report-only image scan, ADR-0052); the supported target is on-prem single-node Docker (compose: web/worker/db/nginx edge), off the public internet, upgraded by pull-and-recreate — Kubernetes is parked, not required, at portfolio scale (ADR-0054)." },
  ]},
];
