# ADR-0073 — Migrate the backend to .NET 10 (LTS)

**Status:** Accepted
**Date:** 2026-07-20
**Relates to:** ADR-0001 (modular monolith / minimal API), ADR-0002 (PostgreSQL + EF Core), ADR-0054 (on-prem single-node Docker)

## Context

The server (API + tests) targeted **.NET 8** with **EF Core 9** and **ASP.NET Core 8**.
Two forces make a move to **.NET 10** timely:

1. **Support lifecycle.** .NET 8 is LTS but its support ends **~November 2026**.
   .NET 10 is the current LTS. Staying on 8 past EOL means no security servicing.
2. **System.Text.Json version friction.** The test project carried an explicit
   `System.Text.Json` **9.x pin** to force version unification (EF Core 9 references
   STJ 9.0.x; the ASP.NET Core 8 test host pulls 8.0.x) and avoid a `CS1705`
   assembly-version clash. That pin repeatedly blocked dependency updates whose
   transitive graph wanted **STJ 10** (e.g. the Azure SDK bumps in Dependabot #49/#52),
   surfacing as `NU1605` downgrade errors. On net10, **STJ 10 is the framework
   default**, so the mismatch — and the pin — disappear.

## Decision

Migrate the backend from `net8.0` to **`net10.0`** (LTS → LTS, skipping the net9 STS):

- **TFM** `net8.0 → net10.0` for `Atlas.Api` and `Atlas.Tests`.
- **EF Core 9 → 10**: `Npgsql.EntityFrameworkCore.PostgreSQL` 10.x,
  `Microsoft.EntityFrameworkCore.Design`/`.InMemory` 10.x.
- **ASP.NET Core 8 → 10**: `JwtBearer`, `Mvc.Testing` 10.x.
- **Remove the explicit `System.Text.Json` pin** — the framework provides STJ 10.
- **Remove the `Microsoft.Extensions.Configuration.KeyPerFile` package** — it is part
  of the shared framework on net10 (`AddKeyPerFile` resolves from it; `NU1510`).
- **Runtime/CI**: Dockerfile `sdk`/`aspnet` base images 8.0 → 10.0; CI
  `actions/setup-dotnet` 8.0.x → 10.0.x.

Existing EF migrations are **not** regenerated — EF Core 10 applies the EF 9-authored
migration history as-is (verified below).

## Consequences

**Positive**
- On a supported LTS ahead of the .NET 8 EOL.
- The STJ pin and the recurring `NU1605`/`CS1705` friction are gone; STJ-10-dependent
  updates (Azure SDK, etc.) merge normally.
- Fewer explicit package references (KeyPerFile, STJ) — less to maintain.

**Negative / trade-offs**
- **Deployment surface changes**: container base images move to 10.0 (ADR-0054) —
  runtime hosts / image pull must provide .NET 10.
- EF packages are pinned to the Npgsql provider's current aligned patch; keep the EF
  family in lockstep on future bumps.
- Third-party packages must have net10-compatible builds (verified for the current set:
  ClosedXML, OpenTelemetry, Swashbuckle, Azure SDK).

## Alternatives considered

- **Stay on .NET 8, adopt STJ 10 explicitly.** Rejected: running a JSON stack a full
  major ahead of the host framework is unsupported-by-design, adds runtime risk on the
  serialization layer, and still leaves the EOL problem.
- **Migrate to .NET 9 (STS).** Rejected: shorter support window than the net8 it
  replaces; net10 LTS is the durable target.

## Verification

On the .NET 10 SDK: `restore` + `build -c Release` clean; **472/472 tests pass** on
`net10.0`. Against a **real PostgreSQL 16**, the app applied **all existing
(EF 9-authored) migrations under the EF Core 10 runtime with no pending-model-changes
error**, then served `/api/v1/projects`,`/demands`,`/resources`,`/releases`,
`/notifications` (all 200) with STJ 10 serialization.
