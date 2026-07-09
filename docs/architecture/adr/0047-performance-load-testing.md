# ADR-0047 — Performance & load testing with k6

**Status:** Accepted — extends the testing strategy ([ADR-0033](./0033-browser-a11y-sweep-and-logic-tests.md)
covered a11y/e2e) on the non-functional axis (ABB-08 Observability, ABB-12 Delivery).

## Context
The application evaluation flagged the last testing gap: the automated suite
proved correctness (xUnit, vitest), accessibility and full user journeys
(Playwright), but **nothing measured performance under load**. Atlas is
read-heavy and its most-used endpoints (`/dashboard`, `/financials`, `/okrs`,
`/portfolio/gantt`, …) *derive numbers on read* across many rows, so their cost
grows with portfolio size and concurrency — exactly the kind of regression that
slips through functional tests. We wanted a repeatable baseline, not a one-off.

## Decision
Add a **k6** load-test suite under `perf/`, env-driven so the same scripts run
against a local dev API or a deployed test server:

- **`smoke.js`** — single-VU pass over every hot roll-up; strict thresholds
  (errors <1%, p95 <800ms). Deterministic, seconds-long — the CI/post-deploy gate.
- **`load.js`** — ramping-VUs realistic mix (roll-ups + project drill-in). The
  **baseline**; p95<1.5s / p99<3s. Record its numbers so regressions compare.
- **`stress.js`** — ramps to 200 VUs to find the knee; observes latency rather
  than gating it, to size infra and autoscaling.
- **`seed.js`** — generates a realistic portfolio (projects × sprints × tasks +
  demands) **through the real public API**, so roll-ups have volume without any
  backend change.
- **`lib/common.js`** — shared URL/auth config and the hot-endpoint list.

Auth: with auth off the scripts send `X-Atlas-Role` (the demo switcher); with
SSO on they send a bearer `TOKEN`. Results can stream to the reference
observability stack (`deploy/observability`) via k6's Prometheus remote-write,
charted next to the API's own OpenTelemetry metrics (ADR-0032/0040).

**Seeder ≠ seed data.** `seed.js` is a throwaway-DB load fixture, run against a
test environment; it does not violate the "empty by default / never fabricate
persistent seed data" rule (CLAUDE.md §2), which governs *application* behaviour.

## Consequences
- **+** A recorded p95/p99 baseline; latency regressions on the hot paths become
  visible and diffable instead of surfacing in production.
- **+** No backend change — the seeder and tests use the shipping API surface.
- **+** k6 lives outside the TS/eslint/build scope (it's a separate runtime), so
  it adds no weight to the frontend toolchain.
- **−** Meaningful numbers need a seeded, API-running environment, so the full
  load/stress runs are **operated against a test server**, not per-PR CI. The
  fast `smoke.js` is the CI-friendly subset; wiring it into a `workflow_dispatch`
  job (compose up → seed small → smoke) is a low-risk follow-up.
- **−** Sync endpoints are out of scope (external-API-bound); they need a mocked
  upstream to load-test.

## Alternatives considered
- **NBomber (in-process C#)** — lives beside xUnit and devs know C#, but weaker
  dashboarding and it couples perf runs to the test project. k6 aligns with the
  existing Grafana/Prometheus stack (Prometheus remote-write) — chosen.
- **A backend bulk-seed endpoint** — faster to seed, but adds a data-generating
  write endpoint (extra surface to gate off in prod). Seeding via the public API
  keeps the backend untouched — chosen.
- **Artillery** — simplest YAML authoring, but least aligned with the stack and
  weakest reporting — rejected.
