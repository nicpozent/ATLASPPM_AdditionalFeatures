# ADR-0032 — Reference observability stack (Grafana/Tempo/Prometheus/Loki)

**Status:** Accepted — extends [ADR-0010](./0010-observability-otel.md) (OpenTelemetry).

## Context
ADR-0010 made Atlas emit OTLP traces/metrics/logs, and the docs described a
minimal collector — but **no visualisation shipped**. Operators had to stand up
and wire a backend themselves before they could see anything, which made the
telemetry effectively invisible out of the box (the ABB-08 "dashboards not
shipped" gap).

## Decision
Ship a **runnable reference stack** as an overlay compose file
(`deploy/observability/docker-compose.observability.yml`) that runs alongside the
main stack:

```
docker compose -f docker-compose.yml \
  -f deploy/observability/docker-compose.observability.yml up --build
```

- **OTel Collector** receives OTLP from the API and fans out: traces → **Tempo**,
  metrics → a Prometheus scrape endpoint (`:8889`) → **Prometheus**, logs →
  **Loki** (native OTLP). Configs live in `deploy/observability/`.
- **Grafana** comes with datasources (Prometheus/Tempo/Loki, trace↔log
  correlation both ways) and an **Atlas API — Overview** dashboard
  pre-provisioned: request rate, 5xx ratio, latency p50/p95/p99, audited domain
  writes/min (`atlas_audit_events_total`), and live logs.
- The overlay also enables the API's exporter
  (`OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317`), so it's zero-config
  to try.

## Consequences
- **+** One command gives a full traces+metrics+logs view; the telemetry from
  ADR-0010 is finally visible without bespoke wiring.
- **+** Purely additive — an overlay file + config; the base stack, CI and the
  managed-backend paths (Azure Monitor, Grafana Cloud) are untouched.
- **−** Single-binary Tempo/Loki/Prometheus with local volumes — a **dev/demo**
  reference, not an HA production deployment. Production should point OTLP at a
  managed backend (documented) rather than self-host this.
- **−** Dashboard PromQL assumes current OTel semantic-convention metric names;
  a different exporter/version may need query tweaks (noted in the doc).
- **−** Not exercised by CI (no containers in CI); YAML/JSON are syntax-validated
  and the stack is verified by running it locally.

## Alternatives considered
- **Keep docs-only guidance** — leaves the gap; operators still do all the wiring.
- **Jaeger + Prometheus only** (no logs/Grafana) — lighter, but no single pane of
  glass and no log↔trace correlation; Grafana+LGTM is the common, portable choice.
- **Bake the backends into the main compose** — imposes the stack (and its
  resource cost) on everyone; an opt-in overlay keeps the default lean.
