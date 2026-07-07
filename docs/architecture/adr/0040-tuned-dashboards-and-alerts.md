# ADR-0040 — Domain metrics, tuned dashboards & alert rules

**Status:** Accepted — extends [ADR-0010](./0010-observability-otel.md) (OTel) and
[ADR-0032](./0032-observability-reference-stack.md) (reference stack).

## Context
The reference stack (ADR-0032) shipped an Atlas overview dashboard covering HTTP
RED + the one custom metric (`atlas.audit.events`). Everything else on the
dashboard would come from auto-instrumentation. The application-specific signals
an operator actually watches — connector sync health, background-queue backlog,
capacity alerts, DB latency — weren't emitted as metrics (EF timings live only in
traces), so a "tuned" dashboard had nothing app-specific to show.

## Decision
Emit real domain metrics and ship dashboards + alerts built on them.

- **New instruments** (`AtlasTelemetry`, exported on the `Atlas.Api` meter):
  - `atlas.sync.duration` (histogram, s) — per-project connector sync, tagged
    `connector` (jira|ado) + `outcome`; recorded in both sync cores.
  - `atlas.sync.queue.depth` (observable gauge) — pending background jobs per
    connector, read from the queue singletons' `Pending` count.
  - `atlas.capacity.alerts` (counter) — over-allocation alerts delivered per pass.
  - `atlas.db.command.duration` (histogram, s) — every EF Core command, via a
    `DbCommandInterceptor` (`AtlasDbMetricsInterceptor`), so DB timings exist as a
    Prometheus histogram (traces still go to Tempo).
- **Dashboard** `atlas-operations.json` (Integrations & Operations): sync-duration
  p95 by connector, sync outcomes/min, queue depth, capacity alerts/day, DB
  latency p50/p95/p99, DB rate by outcome. The existing overview keeps HTTP RED.
- **Alert rules** `alerts.yml` (wired via `rule_files`): target-down, 5xx ratio
  >5%, HTTP p95 >2s, DB p95 >1s, connector sync failures, sync-queue backlog.

## Consequences
- **+** The dashboards now reflect what Atlas actually does; regressions in sync
  health / DB latency / error rate surface and can page (attach Alertmanager).
- **+** DB timings become a first-class metric without turning on statement text
  (privacy) — the interceptor times commands only.
- **−** A per-command interceptor adds a tiny overhead on every query (a Stopwatch
  read); negligible, and the metric is a no-op when OTel isn't configured.
- **−** Alerts evaluate in Prometheus but need an Alertmanager receiver to
  actually notify — documented; not bundled to keep the reference stack minimal.

## Alternatives considered
- **Leave DB timings to traces only** — no aggregate latency SLO/alert; rejected.
- **Ship dashboards without new metrics** — panels would be empty; the point of
  "tuned" is app-specific signals, which required the instruments.
