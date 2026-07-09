// Volume seeder — creates a realistic portfolio (projects, each with sprints +
// tasks, plus a batch of demands) through the REAL public API, so the roll-up
// endpoints have enough rows to make a load test meaningful.
//
// This is a load-testing FIXTURE, not application seed data: run it ONCE against
// a THROWAWAY test database (never production). It writes through the same
// endpoints the UI uses, so no backend changes are needed.
//
//   k6 run perf/seed.js                                  # 100 projects × 40 tasks
//   k6 run -e PROJECTS=250 -e TASKS_PER=60 perf/seed.js
//   k6 run -e BASE_URL=https://atlas-test.internal perf/seed.js
//
// Volume knobs (env): PROJECTS, TASKS_PER, SPRINTS_PER, DEMANDS.
import http from "k6/http";
import { check } from "k6";
import { API } from "./lib/common.js";

const PROJECTS = Number(__ENV.PROJECTS || 100);
const TASKS_PER = Number(__ENV.TASKS_PER || 40);
const SPRINTS_PER = Number(__ENV.SPRINTS_PER || 4);
const DEMANDS = Number(__ENV.DEMANDS || 60);

const METHODS = ["Scrum", "Kanban", "SAFe", "Waterfall", "Scrumban", "V-Model"];
const DEPTS = ["Digital Commerce", "Supply Chain", "Retail Ops", "IT & Data", "Marketing", "Procurement"];
const TASK_STATUS = ["To Do", "In Progress", "In Review", "Done"];
const PRIORITY = ["Critical", "High", "Medium", "Low"];

export const options = {
  vus: 1,
  iterations: 1,
  // Seeding writes; any failure should surface loudly rather than silently
  // producing a thin dataset.
  thresholds: { http_req_failed: ["rate<0.02"] },
  // A big seed is a lot of sequential POSTs — give it room.
  setupTimeout: "10m",
};

// Seeding omits X-Atlas-Role → full access when auth is off (single-user dev).
const H = { "Content-Type": "application/json" };

function post(path, body) {
  return http.post(`${API}${path}`, JSON.stringify(body), { headers: H });
}

export default function () {
  let projects = 0, sprints = 0, tasks = 0, demands = 0;

  for (let i = 0; i < PROJECTS; i++) {
    const res = post("/projects", {
      name: `Perf Project ${i + 1}`,
      dept: DEPTS[i % DEPTS.length],
      owner: `Owner ${i % 12}`,
      methodology: METHODS[i % METHODS.length],
      applyTemplate: false,
      startDate: "2026-01-15",
      target: "2026-12-15",
    });
    if (!check(res, { "project created": (r) => r.status === 200 || r.status === 201 })) continue;

    let id;
    try { id = res.json("id"); } catch (_e) { id = null; }
    if (!id) continue;
    projects++;

    for (let s = 0; s < SPRINTS_PER; s++) {
      const sr = post(`/projects/${id}/sprints`, {
        name: `Sprint ${s + 1}`,
        status: s === 0 ? "Started" : "Planned",
        committedPoints: 20,
      });
      if (sr.status < 300) sprints++;
    }

    for (let t = 0; t < TASKS_PER; t++) {
      const tr = post(`/projects/${id}/tasks`, {
        name: `Task ${t + 1}`,
        status: TASK_STATUS[t % TASK_STATUS.length],
        priority: PRIORITY[t % PRIORITY.length],
        sprint: `Sprint ${(t % SPRINTS_PER) + 1}`,
        points: (t % 8) + 1,
        estimateHours: ((t % 8) + 1) * 4,
      });
      if (tr.status < 300) tasks++;
    }
  }

  for (let d = 0; d < DEMANDS; d++) {
    const dr = post("/demands", {
      title: `Perf Demand ${d + 1}`,
      dept: DEPTS[d % DEPTS.length],
      priority: PRIORITY[(d % 3) + 1],
      value: (d % 5) + 1,
      effort: (d % 5) + 1,
    });
    if (dr.status < 300) demands++;
  }

  console.log(`Seeded ${projects} projects · ${sprints} sprints · ${tasks} tasks · ${demands} demands`);
}
