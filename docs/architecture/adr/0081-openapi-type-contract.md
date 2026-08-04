# ADR-0081 — Generated API type contract (OpenAPI → TypeScript)

**Status:** Accepted
**Date:** 2026-08-04
**Relates to:** ADR-0041 (shared project-detail query hook), CLAUDE.md §6
(Data & API). Implements remediation item **R11 / #97**.

## Context

The backend defines ~177 DTO records (`server/Kernel/Dtos.cs` and per-module
files). The frontend re-typed those shapes **by hand**: ~173 `interface`
declarations across `src/screens/**/*.tsx`, and **zero** typed helpers in
`src/api.ts` — even though `api.ts` and CLAUDE.md §6 both point developers
there. Consequences:

- A backend DTO rename or type change **breaks nothing at compile time**. It
  produces `undefined` at runtime, in one panel, on one tab.
- The same contract gets typed more than once and drifts. The clearest case:
  `GET /projects/{id}/capacity` was fetched **identically in two places** —
  `Project.tsx` (types `CapacityRow` + `Capacity`) and `Gantt.tsx` (types
  `CapPerson` + `Capacity`) — same URL, same query key, same options, two
  independently hand-written type sets. (A *third*, unrelated `CapPerson` for
  `/capacity/insight` lived in `resources/Capacity.tsx` — a pure name
  collision, now `StaffPerson`.)

## Decision

Generate the frontend's API types from the server's OpenAPI document and check
the result into the repo, guarded by a CI drift check.

1. **Toolchain.** `openapi-typescript` (devDependency) + two npm scripts:
   - `api:openapi` → `server/openapi/dump-openapi.sh` emits
     `server/openapi/atlas-v1.json`.
   - `api:types` → runs `api:openapi`, then `openapi-typescript` →
     `src/api/generated.ts`.
   Both the document and the generated types are committed.

2. **Getting the document without a database.** Swashbuckle's
   `dotnet swagger tofile` does not understand this project's minimal-API
   top-level `Program` (it falls back to scanning for a `Startup` class). So the
   dump script takes the reliable route: it **boots the API briefly and reads
   the document it actually serves** at `/swagger/v1/swagger.json`. To run
   without Postgres, a new **off-by-default** config flag `Atlas:SkipDbInit`
   skips the startup migrate/seed block (endpoints still map, so the document is
   complete). The script also runs in the `Development` environment with auth
   disabled so the "anonymous-in-Production" boot fuse doesn't trip. `SkipDbInit`
   must never be set in a real deployment — the schema must be migrated before
   serving traffic.

3. **CI drift check.** A `contract` job regenerates both files and runs
   `git diff --exit-code`; any difference fails the build with "run
   `npm run api:types` and commit the result." Backend and frontend types can no
   longer silently diverge.

4. **Proof + first typed helpers.** `src/api.ts` now exports
   `Schemas = components["schemas"]` (the generated contract). The `/capacity`
   duplication is resolved: one shared `useCapacity` hook
   (`src/screens/project/useProject.ts`) consumed by both screens, typed from
   `Schemas["CapacityDto"]` / `Schemas["CapacityRowDto"]`. The stale
   commented-out example in `api.ts` is deleted.

## The response-schema limitation (important)

The generated file covers a contract **only where the server publishes a
schema for it**. Two things limit that today:

- **Anonymous responses.** Many handlers return `Results.Ok(new { … })`
  (anonymous objects), which publish no schema at all. (Known going in.)
- **Type-erased responses (the bigger one).** Even handlers that return a
  **named DTO** publish no *response* schema, because they return
  `Results.Ok(dto)` — whose static type is `IResult`, which erases the DTO.
  Swashbuckle only records a 200 body when the endpoint **declares** it, via
  `TypedResults.Ok<T>` or `.Produces<T>()`. At the time of writing **no**
  endpoint did either, so **only 5 of 334 operations publish a 200 response
  schema** (the `/capacity` one this change annotates, plus a handful of
  incidental ones). The 134 named schemas in the document are therefore almost
  all **request** DTOs.

Net: request shapes are well covered; **response shapes — which is what most of
the 173 hand-written interfaces are — are not, until each endpoint declares its
response.** This is a larger, more actionable finding than the "anonymous
objects" caveat in the issue: the fix is per-endpoint `.Produces<T>()` (for
already-named DTOs) applied as each screen is adopted. The `/capacity` endpoint
in this change is the worked example of that pattern.

## Adoption order (no wholesale migration in this change)

Adopt per screen, heaviest first, pairing each screen's interfaces with adding
`.Produces<T>()` to the GET endpoints it consumes (naming the DTO first where a
handler currently returns an anonymous object):

| # | Screen | Hand-written interfaces |
|---|--------|-------------------------|
| 1 | `screens/Project.tsx` | 16 |
| 2 | `screens/Gantt.tsx` | 15 |
| 3 | `screens/Admin.tsx` | 14 |
| 4 | `screens/Reports.tsx` | 9 |
| 5 | `screens/Products.tsx` | 9 |
| 6 | `screens/Ops.tsx` | 9 |
| 7 | `screens/Teams.tsx` | 8 |
| 8 | `screens/resources/Capacity.tsx`, `screens/Resources.tsx`, `screens/Okrs.tsx`, `screens/Methodologies.tsx` | 6 each |
| … | remaining screens | 1–5 each |

Each adoption step: add `.Produces<T>()` server-side → `npm run api:types` →
replace the screen's hand-written interfaces with `Schemas["…"]` → build.

## Consequences

- **Positive.** A backend DTO change now breaks the frontend at **compile
  time** (or fails the CI drift check), not at runtime. New response types are
  free once an endpoint declares its shape. The `/capacity` duplication — and
  the confusing triple `CapPerson`/`CapacityRow` naming — is gone.
- **Cost.** `api:types` boots the API (a few seconds) and needs the .NET SDK; the
  `contract` CI job carries that. `SkipDbInit` is a new startup branch (guarded,
  off by default, documented).
- **Follow-up.** Per-screen adoption (above) is tracked on #97's follow-ups; it
  is deliberately **not** attempted here. openapi-typescript marks every C#
  record field optional/nullable (it can't see C# non-nullability), so consumers
  either tolerate that or normalise at the boundary — `useCapacity` shows the
  normalise pattern (defaults applied once, view type derived from the generated
  one via a mapped `-? NonNullable<…>`).
