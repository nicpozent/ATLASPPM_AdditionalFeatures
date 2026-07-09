// Shared config + helpers for the Atlas k6 performance suite.
//
// Everything is env-driven so the SAME scripts run unchanged against a local
// dev API or a deployed test server — no hostnames or secrets are baked in.
//
//   BASE_URL   API origin (default http://localhost:5109). The scripts append /api/v1.
//   ATLAS_ROLE Role sent as X-Atlas-Role when auth is OFF (the demo role switcher).
//   TOKEN      Bearer token, used instead of the role header when SSO is ON.
//
// k6 is a separate JS runtime (Goja), not Node — these files are intentionally
// outside the TypeScript/eslint scope (tsconfig includes only src/).
import http from "k6/http";

const BASE = (__ENV.BASE_URL || "http://localhost:5109").replace(/\/+$/, "");
export const API = `${BASE}/api/v1`;

const ROLE = __ENV.ATLAS_ROLE || "PMO";
const TOKEN = __ENV.TOKEN || "";

// Request headers. Prefer a bearer token (SSO on); otherwise fall back to the
// X-Atlas-Role header (auth off). Pass role="" to omit it entirely → the API
// treats a missing header as full access in dev (used by the seeder).
export function headers(role = ROLE) {
  const h = { "Content-Type": "application/json" };
  if (TOKEN) h["Authorization"] = `Bearer ${TOKEN}`;
  else if (role) h["X-Atlas-Role"] = role;
  return h;
}

// The portfolio-wide roll-up endpoints whose latency actually matters: each
// derives its numbers on read across many rows (dashboard health/budget,
// financials forecast, OKR progress from linked projects, capacity, gantt).
// These are the hot paths a real portfolio hammers, so they are what we load.
export const ROLLUPS = [
  "/dashboard",
  "/projects",
  "/financials?scope=portfolio",
  "/demands",
  "/okrs",
  "/delivery",
  "/resources",
  "/capacity/insight",
  "/portfolio/gantt",
];

// Fetch real project ids so per-project detail endpoints hit existing rows
// (empty on an unseeded instance — detail checks then simply no-op).
export function discoverProjectIds() {
  const res = http.get(`${API}/projects`, { headers: headers() });
  try {
    return (res.json() || []).map((p) => p.id).filter(Boolean);
  } catch (_e) {
    return [];
  }
}
