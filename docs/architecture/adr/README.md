# Architecture Decision Records

Each ADR captures one significant decision: its **context**, the **options**
considered, the **decision**, and its **consequences** (including trade-offs).
ADRs are immutable once *Accepted*; to change a decision, add a new ADR that
*supersedes* the old one.

| ADR | Title | Status |
|-----|-------|--------|
| [0001](./0001-modular-monolith-minimal-api.md) | Modular monolith with ASP.NET minimal APIs | Accepted |
| [0002](./0002-postgresql-ef-core.md) | PostgreSQL with EF Core | Accepted |
| [0003](./0003-inline-styled-frontend.md) | Inline-styled, token-driven frontend (no CSS framework) | Accepted |
| [0004](./0004-rbac-capability-matrix.md) | Server-authoritative RBAC capability matrix | Accepted |
| [0005](./0005-entra-sso.md) | Microsoft Entra ID SSO, fail-fast on misconfiguration | Accepted |
| [0006](./0006-jira-pull-only-board-optional.md) | Jira integration: pull-only, board-optional | Accepted |
| [0007](./0007-in-process-background-workers.md) | In-process background workers (hosted services) | Accepted |
| [0008](./0008-same-origin-edge.md) | Same-origin nginx edge with security headers | Accepted |
| [0009](./0009-secrets-management.md) | Secrets via environment / Docker secrets, never in VCS | Accepted |
| [0010](./0010-observability-otel.md) | Observability via OpenTelemetry (OTLP) | Accepted |
| [0011](./0011-docs-as-code.md) | Documentation as code (Markdown + Mermaid + ADRs) | Accepted |
| [0012](./0012-empty-states-derive-on-read.md) | Empty-by-default data with derive-on-read roll-ups | Accepted |
| [0013](./0013-time-phased-allocation.md) | Time-phased resource allocation (dates, hours↔%, extensions) | Accepted |
| [0014](./0014-ops-work-type.md) | Ops as a distinct work type with project-impact tagging | Accepted |
| [0015](./0015-server-side-excel-exports.md) | Server-side colour-graded Excel exports (ClosedXML) | Accepted |
| [0016](./0016-skills-matrix.md) | Customizable skills matrix, name-keyed ratings | Accepted |
| [0017](./0017-gdpr-admin-surface.md) | GDPR data-subject actions surfaced in Administration | Accepted |
| [0018](./0018-jira-full-field-import.md) | Jira full-field, comment & attachment import (extends 0006) | Accepted |
| [0019](./0019-roadmap-lane-and-timeline.md) | Strategic roadmap: dual lane (Now/Next/Later) + timeline model | Accepted |
| [0020](./0020-task-estimate-allocation.md) | Task estimate hours count toward allocation (max vs planned) | Accepted |
| [0021](./0021-jira-delta-and-per-entity-sync.md) | Jira delta sync + per-entity (project/program/product) sync | Accepted |
| [0022](./0022-json-backup-merge-restore.md) | JSON backup is a logical export; restore is a merge (pg_dump authoritative) | Accepted |
| [0023](./0023-close-allocation-gaps.md) | Time-phased Ops, hours/dates in Resources editing, server-side custom dashboard | Accepted |
| [0024](./0024-capacity-intelligence.md) | Capacity intelligence (insight + staffing) over the shared roster | Accepted |
| [0025](./0025-accessibility-baseline.md) | Accessibility baseline in shared primitives (focus, dialogs, menus) | Accepted |
| [0026](./0026-axe-automation-and-mobile-drawer.md) | Automated axe a11y sweep in CI + mobile navigation drawer | Accepted |
| [0027](./0027-frontend-code-splitting.md) | Frontend route-level code-splitting + vendor chunking | Accepted |
| [0028](./0028-over-allocation-alerts.md) | Over-allocation alerts (delivered, deduplicated via snapshot) | Accepted |
| [0029](./0029-timeline-derived-windows.md) | Timelines derive windows from phases, sprints & tasks | Accepted |
| [0030](./0030-background-jira-sync.md) | Background Jira sync (no 504 on large pulls) | Accepted |
| [0031](./0031-internal-labour-costing.md) | Internal-labour costing: PM/PO cost lines + rate card & calculator | Accepted |
| [0032](./0032-observability-reference-stack.md) | Reference observability stack (Grafana/Tempo/Prometheus/Loki) | Accepted |
| [0033](./0033-browser-a11y-sweep-and-logic-tests.md) | Browser-based full-page axe sweep (structural-gated) + extracted screen-logic tests | Accepted |
| [0034](./0034-ops-jira-sync-and-task-links.md) | Ops: Jira board/space re-sync + linked project tasks | Accepted |
| [0035](./0035-azure-devops-connector.md) | Azure DevOps connector (scaffold: connect · discover · map) | Accepted |
| [0036](./0036-azure-devops-work-item-sync.md) | Azure DevOps work-item sync (iterations → sprints, work items → epics/tasks) | Accepted |
| [0037](./0037-contrast-tokens-and-gate.md) | WCAG AA contrast tokens + gated colour-contrast in the axe sweep | Accepted |
| [0038](./0038-idle-logout-policy.md) | Idle-logout policy (15-min inactivity sign-out, configurable) | Accepted |
| [0039](./0039-ado-background-sync.md) | Background Azure DevOps sync (queue + worker + poll; cap raised) | Accepted |
| [0040](./0040-tuned-dashboards-and-alerts.md) | Domain metrics, tuned Grafana dashboards & Prometheus alert rules | Accepted |
| [0041](./0041-screen-decomposition.md) | Decompose large screen files into per-tab modules (project/, resources/) | Accepted |
| [0042](./0042-ops-full-jira-import-and-bulk-ops.md) | Ops: full-fidelity Jira import (epics + rich fields + comments/attachments), work-item-status filter, bulk delete | Accepted |
| [0043](./0043-cto-cio-roles-and-demand-role-notifications.md) | CTO & CIO roles (header persona + Executive RBAC) + role-addressed demand notifications | Accepted |
| [0044](./0044-ado-delta-sync.md) | Azure DevOps delta (changed-since) work-item sync | Accepted |
| [0045](./0045-per-role-demand-email.md) | Per-role email for demand notifications (in-app mapping + per-person opt-out) | Accepted |
| [0046](./0046-data-driven-role-switcher.md) | Data-driven header role switcher (created roles selectable + enforced) | Accepted |
| [0047](./0047-performance-load-testing.md) | k6 performance/load-testing suite (smoke·load·stress + API volume seeder) | Accepted |
| [0048](./0048-web-worker-process-split.md) | Web / worker process split (role-selectable container) | Accepted |
| [0049](./0049-compliance-coverage-and-zero-trust.md) | Deterministic compliance coverage (multi-framework) + Zero-Trust posture mapping | Accepted |
| [0050](./0050-ai-act-risk-tiering-iso-42001.md) | EU AI Act risk-tiering + ISO 42001 AI-management obligations | Accepted |
| [0051](./0051-automated-appsec-scanning.md) | Automated AppSec scanning (SAST · SCA/secrets/IaC · DAST) | Accepted |
| [0052](./0052-release-pipeline-ghcr.md) | Tag-triggered release pipeline publishing versioned images to GHCR | Accepted |
| [0053](./0053-appsec-baseline-triage-gating.md) | AppSec baseline triage → gating SAST + Trivy with scoped exceptions | Accepted |
| [0054](./0054-on-prem-single-node-docker.md) | On-prem single-node Docker as the delivery target (k8s parked) | Accepted |
| [0055](./0055-need-to-know-labour-rates.md) | Need-to-know internal-labour rate card (per-discipline view+edit, +Architect/PM/PO) | Accepted |
| [0056](./0056-per-profile-dark-mode.md) | Per-profile dark mode via CSS variables (no global stylesheet) | Accepted |
| [0057](./0057-region-scoped-labour-rates.md) | Region-scoped labour rate lines + regional manager roles (APAC/BLOG) | Accepted |
| [0058](./0058-five-year-calendar-timeline-window.md) | Calendar timeline window (up to 5 years) on an absolute-month model | Accepted |
| [0059](./0059-task-lifecycle-timeline.md) | Task lifecycle timeline + Jira changelog-derived started/resolved timestamps | Accepted |
| [0060](./0060-teams-notification-channel.md) | Microsoft Teams as a third notification channel (channel webhook + Adaptive Card) | Accepted |
| [0061](./0061-realtime-pi-program-board.md) | Real-time PI Program Board (SignalR presence/cursors + notify-and-refetch) | Accepted |
| [0062](./0062-individual-development-plans.md) | Individual development plans (manager-scoped, development-framed, redacted) | Accepted |
| [0063](./0063-personnel-data-processing-gate.md) | Personnel-data processing gate (SWOT/dev-plans off until DPIA + MBL sign-off) + Sweden compliance map | Accepted |
| [0064](./0064-freeform-whiteboard.md) | Freeform whiteboard (typed rows, live co-edit, templates) | Accepted |
| [0065](./0065-open-task-board-moves.md) | Task-board card moves scoped to planner roles (cap-schedule) | Accepted |
| [0066](./0066-statement-of-applicability.md) | ISO 27001 Annex A Statement of Applicability (per-project) | Accepted |
| [0067](./0067-openbao-secrets-provider.md) | OpenBao / Vault secrets provider (on-prem, KV v2, opt-in) | Accepted |
| [0068](./0068-personnel-notes-field-encryption.md) | Field encryption (AES-GCM) for DPIA-gated personnel notes | Accepted |

Template: Context · Decision · Consequences · Alternatives considered.
