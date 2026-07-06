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

Template: Context · Decision · Consequences · Alternatives considered.
