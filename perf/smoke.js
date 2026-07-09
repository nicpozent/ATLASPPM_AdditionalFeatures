// Smoke test — one pass over every hot roll-up endpoint with a single VU and
// strict thresholds. Fast (seconds) and deterministic, so it's the one to wire
// into CI or run as a post-deploy gate. Fails if any endpoint errors or if p95
// latency creeps past the budget.
//
//   k6 run perf/smoke.js
//   k6 run -e BASE_URL=https://atlas-test.internal perf/smoke.js
import http from "k6/http";
import { check } from "k6";
import { API, headers, ROLLUPS } from "./lib/common.js";

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: {
    // No endpoint may error.
    http_req_failed: ["rate<0.01"],
    // Roll-ups should answer well under a second even single-threaded.
    "http_req_duration{kind:rollup}": ["p(95)<800", "max<2000"],
  },
};

export default function () {
  for (const path of ROLLUPS) {
    const res = http.get(`${API}${path}`, {
      headers: headers(),
      tags: { kind: "rollup", endpoint: path },
    });
    check(res, { [`200 — ${path}`]: (r) => r.status === 200 });
  }
}
