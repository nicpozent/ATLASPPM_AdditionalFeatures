# Observability (OpenTelemetry)

Atlas emits **distributed traces, metrics and logs** through
[OpenTelemetry](https://opentelemetry.io/) using the **OTLP** protocol. The
instrumentation ships in the app; the only thing you configure is **where to
send the data** (an OTLP endpoint). With nothing configured the whole stack
stays off and the API behaves exactly as before — so you can turn it on per
environment without any code change.

---

## 1. What is instrumented

| Signal | Source |
| ------ | ------ |
| **Traces** | Incoming HTTP requests (ASP.NET Core), outbound `HttpClient` calls (e.g. Microsoft Graph), EF Core database queries. Exceptions are recorded on the request span. |
| **Metrics** | ASP.NET Core server metrics, `HttpClient` metrics, .NET runtime metrics (GC, heap, thread-pool, exceptions), **plus the Atlas domain meter `Atlas.Api`** — e.g. `atlas.audit.events` (a counter of audited domain writes, tagged by `area`/`action`) for activity dashboards. |
| **Logs** | The application's structured logs, including the `SRV-…` / `INT-…` correlation codes attached to 5xx responses, exported alongside the matching trace. |

> A custom `ActivitySource` named `Atlas.Api` is also registered for manual
> domain spans (ready to wrap any operation via `AtlasTelemetry.Source`).

> EF Core spans do **not** capture SQL statement text by default
> (`SetDbStatementForText = false`) to avoid leaking data values into your
> tracing backend.

---

## 2. Turn it on

Enable it by setting **either** of the following. The first is the OpenTelemetry
standard and is usually all you need:

### Option A — the standard OTLP env var (recommended)

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317
```

The exporter reads the standard `OTEL_*` variables directly, so you can also set:

| Variable | Purpose | Example |
| -------- | ------- | ------- |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Collector endpoint | `http://otel-collector:4317` |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | `grpc` (default) or `http/protobuf` | `grpc` |
| `OTEL_EXPORTER_OTLP_HEADERS` | Auth headers (comma-separated) | `x-api-key=abc123` |
| `OTEL_SERVICE_NAME` | Service name shown in the backend | `atlas-api` |

Presence of `OTEL_EXPORTER_OTLP_ENDPOINT` alone switches Atlas's telemetry on.

### Option B — application configuration

If you'd rather drive it from config (`appsettings.json` or `OpenTelemetry__*`
env vars):

```jsonc
{
  "OpenTelemetry": {
    "Enabled": true,          // force the stack on
    "ServiceName": "atlas-api"
  }
}
```

You still point the exporter at a collector with `OTEL_EXPORTER_OTLP_ENDPOINT`.

> **Ports:** OTLP/gRPC is `4317`, OTLP/HTTP is `4318`. Match the port to the
> protocol.

---

## 3. Where to send it

You need something that speaks OTLP. Pick one.

### 3a. Self-hosted collector (Docker / Windows Docker — today)

Run the [OpenTelemetry Collector](https://opentelemetry.io/docs/collector/)
next to Atlas and let it fan out to Jaeger (traces), Prometheus (metrics), etc.

`docker-compose.yml` (add alongside the existing `api` + `db` services):

```yaml
  otel-collector:
    image: otel/opentelemetry-collector-contrib:latest
    command: ["--config=/etc/otelcol/config.yaml"]
    volumes:
      - ./otel-collector-config.yaml:/etc/otelcol/config.yaml:ro
    ports:
      - "4317:4317"   # OTLP gRPC
      - "4318:4318"   # OTLP HTTP
```

`otel-collector-config.yaml` (minimal — receive OTLP, log it, and forward):

```yaml
receivers:
  otlp:
    protocols:
      grpc:
      http:
exporters:
  debug:
    verbosity: detailed
  # add your real backends here (e.g. otlp/jaeger, prometheus, azuremonitor)
service:
  pipelines:
    traces:  { receivers: [otlp], exporters: [debug] }
    metrics: { receivers: [otlp], exporters: [debug] }
    logs:    { receivers: [otlp], exporters: [debug] }
```

Then set on the Atlas `api` service:

```yaml
    environment:
      OTEL_EXPORTER_OTLP_ENDPOINT: "http://otel-collector:4317"
      OTEL_SERVICE_NAME: "atlas-api"
```

### 3a′. One-command reference stack (Grafana + Tempo + Prometheus + Loki)

For a self-hosted, batteries-included view, an **overlay compose** ships the
collector *and* the backends *and* a pre-provisioned Grafana — no manual wiring:

```bash
docker compose -f docker-compose.yml \
  -f deploy/observability/docker-compose.observability.yml up --build
```

- **Grafana** → http://localhost:3000 (default `admin`/`admin`; override with
  `GRAFANA_USER`/`GRAFANA_PASSWORD`). The **Atlas API — Overview** dashboard
  (folder *Atlas*) is provisioned automatically: request rate, 5xx ratio,
  latency p50/p95/p99, audited-domain-writes/min, and live API logs.
- Datasources (Prometheus, Tempo, Loki) are pre-wired, including trace↔log
  correlation both ways.
- Pipeline: `api → otel-collector → Tempo (traces) / Prometheus (metrics,
  scraped off the collector's :8889) / Loki (logs via OTLP)`.
- The overlay also flips the API's telemetry on for you (`OTEL_EXPORTER_OTLP_
  ENDPOINT=http://otel-collector:4317`), so there's nothing else to set.

Files live under `deploy/observability/` (collector, Tempo, Prometheus, Loki
configs + Grafana provisioning) — treat them as a starting point and swap in a
managed backend (below) for production. Metric names in the dashboard follow
OTel semantic conventions (`http_server_request_duration_seconds_*`,
`atlas_audit_events_total`); adjust if your exporter version differs.

### 3b. Azure Monitor / Application Insights (after the Azure move)

Two options once Atlas runs on Azure:

1. **Collector → Azure Monitor.** Keep the collector from 3a and add the
   `azuremonitor` exporter with your Application Insights connection string —
   Atlas keeps pointing at the collector; nothing in Atlas changes.

   ```yaml
   exporters:
     azuremonitor:
       connection_string: "${APPLICATIONINSIGHTS_CONNECTION_STRING}"
   service:
     pipelines:
       traces:  { receivers: [otlp], exporters: [azuremonitor] }
       metrics: { receivers: [otlp], exporters: [azuremonitor] }
       logs:    { receivers: [otlp], exporters: [azuremonitor] }
   ```

2. **Direct.** Azure Monitor also accepts OTLP in many regions; point
   `OTEL_EXPORTER_OTLP_ENDPOINT` at the Azure Monitor OTLP ingestion endpoint
   and supply the key via `OTEL_EXPORTER_OTLP_HEADERS`. The collector path
   (option 1) is generally the more portable choice.

Other OTLP backends (Grafana Tempo/Loki/Mimir, Honeycomb, Datadog, New Relic,
Grafana Cloud) work the same way — set the endpoint and headers, or route
through the collector.

---

## 4. Verify it's working

1. Start Atlas with `OTEL_EXPORTER_OTLP_ENDPOINT` set.
2. On startup there is **no** special log line — telemetry is silent by design;
   confirm instead by generating traffic: hit a few endpoints (e.g. open the
   app, load `/api/v1/projects`).
3. With the collector's `debug` exporter (3a), you'll see spans/metrics/logs
   printed in the collector's container logs within a few seconds.
4. In a real backend, look for the service **`atlas-api`** and a trace for
   `GET /api/v1/projects` with a child EF Core span.

### Troubleshooting

| Symptom | Likely cause |
| ------- | ------------ |
| No data at all | `OTEL_EXPORTER_OTLP_ENDPOINT` not set, or unreachable from the container. Check DNS/network between Atlas and the collector. |
| Connection refused | Protocol/port mismatch — gRPC is `4317`, HTTP is `4318`. Set `OTEL_EXPORTER_OTLP_PROTOCOL` to match. |
| Auth errors at the backend | Missing/incorrect `OTEL_EXPORTER_OTLP_HEADERS`. |
| Traces but no logs | Log export is part of the same switch; ensure the collector's `logs` pipeline exists. |

---

## 5. Domain metrics, dashboards & alerts (ADR-0040)

Beyond the auto-instrumented HTTP/runtime metrics, Atlas emits application-level
metrics on the `Atlas.Api` meter (Prometheus names shown):

| Metric | Prometheus | What it tells you |
| ------ | ---------- | ----------------- |
| `atlas.audit.events` | `atlas_audit_events_total` | Domain write activity by area/action |
| `atlas.sync.duration` | `atlas_sync_duration_seconds_*` | Connector sync time per project, by `connector`/`outcome` |
| `atlas.sync.queue.depth` | `atlas_sync_queue_depth` | Pending background sync jobs, by `connector` |
| `atlas.capacity.alerts` | `atlas_capacity_alerts_total` | Over-allocation alerts delivered |
| `atlas.teams.notifications` | `atlas_teams_notifications_total` | Teams channel posts, by `outcome` (ok/error) — drives a delivery-failure alert |
| `atlas.board.broadcasts` | `atlas_board_broadcasts_total` | Real-time room change-pings broadcast to viewers (PI boards, demand funnel, …) |
| `atlas.board.connections` | `atlas_board_connections` | Live real-time hub connections across all rooms (gauge) |
| `atlas.board.active` | `atlas_board_active` | Real-time rooms with at least one viewer (gauge) |
| `atlas.db.command.duration` | `atlas_db_command_duration_seconds_*` | EF Core command latency (via an interceptor) |

**Dashboards** (`deploy/observability/grafana/dashboards/`, auto-provisioned):
- **Atlas API — Overview** — HTTP RED (rate/errors/latency), audited writes, logs.
- **Atlas API — Integrations & Operations** — sync duration p95 & outcomes by
  connector, background-queue depth, capacity alerts/day, DB latency & rate.

**Alerts** (`deploy/observability/alerts.yml`, loaded via `rule_files`):
target-down, 5xx ratio > 5%, HTTP p95 > 2s, DB p95 > 1s, connector sync failures,
sync-queue backlog. They evaluate in Prometheus (see the **Alerts** tab); attach
an Alertmanager receiver to route notifications.

## 6. Turn it off

Unset `OTEL_EXPORTER_OTLP_ENDPOINT` and leave `OpenTelemetry:Enabled` unset (or
`false`). Atlas then creates no exporters and adds no overhead.
