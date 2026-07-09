// Load test — a sustained, realistic mix against the hot roll-up endpoints
// plus project drill-in, with a ramping VU profile. This is the baseline: run
// it against a SEEDED test server (see perf/seed.js) and record the p95/p99 so
// regressions have something to compare against.
//
//   k6 run perf/load.js                        # default: ramp to 20 VUs
//   k6 run -e VUS=50 -e BASE_URL=... perf/load.js
//
// Push results to the reference observability stack (deploy/observability) via
// k6's Prometheus remote-write output:
//   K6_PROMETHEUS_RW_SERVER_URL=http://localhost:9090/api/v1/write \
//     k6 run -o experimental-prometheus-rw perf/load.js
import http from "k6/http";
import { check, sleep } from "k6";
import { API, headers, ROLLUPS, discoverProjectIds } from "./lib/common.js";

const VUS = Number(__ENV.VUS || 20);

export const options = {
  scenarios: {
    portfolio: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: VUS }, // ramp up
        { duration: "1m", target: VUS }, // sustained load
        { duration: "15s", target: 0 }, // ramp down
      ],
      gracefulRampDown: "10s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.02"],
    "http_req_duration{kind:rollup}": ["p(95)<1500", "p(99)<3000"],
    "http_req_duration{kind:detail}": ["p(95)<1000"],
  },
};

export function setup() {
  return { ids: discoverProjectIds() };
}

export default function (data) {
  // Weighted toward roll-ups (what the dashboard/portfolio pages fire), with a
  // project drill-in on top — mirroring how a PMO actually uses Atlas.
  const path = ROLLUPS[Math.floor(Math.random() * ROLLUPS.length)];
  const r1 = http.get(`${API}${path}`, {
    headers: headers(),
    tags: { kind: "rollup" },
  });
  check(r1, { "rollup 200": (r) => r.status === 200 });

  const ids = data.ids || [];
  if (ids.length) {
    const id = ids[Math.floor(Math.random() * ids.length)];
    const r2 = http.get(`${API}/projects/${id}`, {
      headers: headers(),
      tags: { kind: "detail" },
    });
    check(r2, { "detail 200": (r) => r.status === 200 });
  }

  sleep(1);
}
