// Stress test — push VUs well past the expected working load to find the knee:
// where latency degrades and errors start. Unlike load.js this does NOT hard-gate
// latency (you WANT to see it bend); it only asserts the service stays mostly up.
// Read the output to size infrastructure and set autoscaling thresholds.
//
//   k6 run perf/stress.js
//   k6 run -e BASE_URL=https://atlas-test.internal perf/stress.js
import http from "k6/http";
import { check } from "k6";
import { API, headers, ROLLUPS } from "./lib/common.js";

export const options = {
  scenarios: {
    stress: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 25 },
        { duration: "30s", target: 50 },
        { duration: "30s", target: 100 },
        { duration: "30s", target: 200 },
        { duration: "30s", target: 0 },
      ],
      gracefulRampDown: "15s",
    },
  },
  thresholds: {
    // Observe the degradation curve; only fail if the service falls over.
    http_req_failed: ["rate<0.05"],
  },
};

export default function () {
  const path = ROLLUPS[Math.floor(Math.random() * ROLLUPS.length)];
  const res = http.get(`${API}${path}`, {
    headers: headers(),
    tags: { kind: "rollup" },
  });
  check(res, { "status 200": (r) => r.status === 200 });
}
