# Atlas PPM — Performance & Load Tests (k6)

Automated load/perf scripts for the API's hot paths. They run with
[**k6**](https://k6.io) (a standalone Go-based load tester — *not* Node) against
any running Atlas API: a local dev instance or a deployed **test server**.

> These scripts are a load-testing harness. The seeder (`seed.js`) is a
> **throwaway-DB fixture**, not application seed data — run it against a test
> environment you can wipe, never production. See [ADR-0047](../docs/architecture/adr/0047-performance-load-testing.md).

## What's here

| Script | Purpose | Gates |
|--------|---------|-------|
| `smoke.js` | One single-VU pass over every hot roll-up endpoint. Fast + deterministic — the one to wire into CI / run post-deploy. | errors `<1%`, roll-up p95 `<800ms` |
| `load.js` | Sustained realistic mix (roll-ups + project drill-in), ramping VUs. **The baseline** — record its p95/p99. | errors `<2%`, roll-up p95 `<1.5s` / p99 `<3s` |
| `stress.js` | Ramps VUs to 200 to find the knee. Latency is *observed*, not gated. | errors `<5%` only |
| `seed.js` | Generates a realistic portfolio via the public API so roll-ups have volume. | writes `<2%` fail |
| `lib/common.js` | Shared config (env-driven URL/auth) + the hot-endpoint list. | — |

**Hot endpoints under test** (each derives numbers on read across many rows):
`/dashboard`, `/projects`, `/financials`, `/demands`, `/okrs`, `/delivery`,
`/resources`, `/capacity/insight`, `/portfolio/gantt`, and `/projects/{id}`.

## Install k6

```bash
# macOS
brew install k6
# Debian/Ubuntu
sudo gpg -k && sudo apt-get install k6      # via the k6 apt repo, see k6.io/docs
# Docker (no install)
docker run --rm -i grafana/k6 run - < perf/smoke.js
```

## Configure the target (env vars)

| Var | Default | Meaning |
|-----|---------|---------|
| `BASE_URL` | `http://localhost:5109` | API origin; scripts append `/api/v1` |
| `ATLAS_ROLE` | `PMO` | Sent as `X-Atlas-Role` when **auth is off** |
| `TOKEN` | — | Bearer token, used instead of the role header when **SSO is on** |
| `VUS` | `20` | Peak virtual users for `load.js` |
| `PROJECTS` / `TASKS_PER` / `SPRINTS_PER` / `DEMANDS` | `100 / 40 / 4 / 60` | `seed.js` volume |

## Typical run (against a test server)

```bash
# 1. Stand up a disposable API + Postgres (compose brings up both).
docker compose up -d            # API on :5109 by default

# 2. Seed volume through the public API (a few minutes for the default 100×40).
k6 run -e BASE_URL=http://localhost:5109 perf/seed.js

# 3. Baseline load — record the p95/p99 it prints.
k6 run -e BASE_URL=http://localhost:5109 -e VUS=50 perf/load.js

# 4. Find the ceiling.
k6 run -e BASE_URL=http://localhost:5109 perf/stress.js
```

Against a deployed test host with SSO on, pass a token instead of a role:

```bash
k6 run -e BASE_URL=https://atlas-test.internal -e TOKEN="$ACCESS_TOKEN" perf/load.js
```

## Feed results into the observability stack

The reference Grafana/Prometheus stack (`deploy/observability`) can ingest k6
metrics live via Prometheus remote-write:

```bash
K6_PROMETHEUS_RW_SERVER_URL=http://localhost:9090/api/v1/write \
  k6 run -o experimental-prometheus-rw -e VUS=50 perf/load.js
```

Then chart `http_req_duration` by the `kind` / `endpoint` tags alongside the
API's own OpenTelemetry metrics (request duration, DB command latency) to see
*where* time goes under load.

## Interpreting a run

- **`http_req_failed`** — any sustained non-zero rate on read endpoints is a
  real defect (usually a query throwing under concurrency), not load noise.
- **`http_req_duration` p95/p99** — compare against the recorded baseline. A
  jump after a change flags a roll-up that got more expensive (an N+1, a missing
  index, a heavier derive-on-read).
- **`{kind:rollup}` vs `{kind:detail}`** — isolates portfolio-wide aggregation
  cost from single-project cost.

## Scope / not covered

- **Sync endpoints** (`/projects/{id}/jira/sync`, `/ado/sync`) are excluded:
  their latency is dominated by the external Jira/ADO API, so they're a
  connector concern, not an Atlas load concern. Load-test them only with a
  mocked upstream.
- **Writes** are exercised by the seeder, not the steady-state load profile
  (Atlas is overwhelmingly read-heavy in normal use).
