# ADR-0010 — Observability via OpenTelemetry (OTLP)

**Status:** Accepted

## Context
Operators need to diagnose failures and watch health without coupling to one
vendor's agent, and users need a way to reference a specific failure when
contacting support.

## Decision
Instrument the API with **OpenTelemetry** — traces, metrics and logs exported over
**OTLP** (ASP.NET Core, HttpClient and runtime instrumentation). Expose `/health`
(liveness) and `/health/ready` (DB reachable). Stamp a **correlation id** on
unexpected errors and return a coded, friendly message (`SRV-…`, `INT-…`) the UI
surfaces and the Help centre deep-links to.

## Consequences
- **+** Vendor-neutral; point OTLP at Tempo/Jaeger/Grafana/any APM.
- **+** Correlation id ties a user-visible error to server traces/logs.
- **+** Real health probes enable orchestrator liveness/readiness gating.
- **−** Needs an OTLP collector/backend to visualise; absent one, data is dropped
  (no functional impact). Reference dashboards not shipped yet.

## Alternatives considered
- **Vendor SDK (App Insights/Datadog)** — lock-in; OTel can still export to them.
- **Logs only** — insufficient for latency/dependency analysis.
