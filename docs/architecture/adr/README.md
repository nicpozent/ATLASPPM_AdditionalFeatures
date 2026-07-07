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

Template: Context · Decision · Consequences · Alternatives considered.
