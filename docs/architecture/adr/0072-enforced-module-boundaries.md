# ADR-0072 — Enforced per-domain module boundaries

**Status:** Accepted
**Date:** 2026-07-20
**Supersedes / relates to:** ADR-0001 (modular monolith), ADR-0041 (screen decomposition)

## Context

The API is a modular monolith (ADR-0001): one process, one assembly, endpoint
groups organised by domain. Until now that organisation was **by file only** —
every server type lived in a single flat `namespace Atlas.Api`. The module
boundaries in the HLD component view were therefore a **convention, not an
enforced constraint**: nothing at compile or test time stopped, say, the Finance
code from reaching directly into the Jira integration's internals. As the surface
grew (83 server files, 92 entities), that softness became a real risk to
long-term maintainability and to any future service extraction.

Two of the largest files also worked against the per-domain story: `Domain.cs`
(1,405 lines, 92 entities — the whole model centralised) and `WriteEndpoints.cs`
(820 lines). See the companion refactor that split those.

## Decision

1. **Per-domain namespaces.** Feature/service files move into
   `Atlas.Api.<Domain>` namespaces — `Comms`, `Delivery`, `Finance`,
   `Governance`, `Integrations`, `Operations`, `People`, `Platform`, `Portfolio`.
   (`Operations`/`Finance` are named to avoid colliding with the `Ops`/`Financials`
   static classes.)

2. **Shared kernel stays in the root `Atlas.Api`.** Entities (`Domain.*.cs`),
   DTOs, `AtlasDbContext`/`Db`, RBAC (`Rbac`/`Permissions`), the composition root
   (`Program`/`Endpoints`/`WriteEndpoints`) and cross-cutting infrastructure
   (logging, telemetry, observability, hardening, secrets) remain in root. Every
   module may depend on the kernel; child namespaces see it via enclosing-namespace
   lookup, so no per-file `using` churn was needed. A `GlobalUsings.cs` imports the
   sibling domain namespaces to keep cross-module references compiling. Keeping the
   **entities in root** deliberately avoids changing their CLR type identity, so the
   EF Core model snapshot — and the 169 existing migrations — are untouched.

3. **Boundaries are enforced by tests, not by usings.**
   `Atlas.Tests/ArchitectureTests.cs` analyses the compiled assembly with
   Mono.Cecil and enforces:
   - **A dependency ratchet** — the actual module→module edge set must stay a
     subset of an approved graph (`Allowed`). Any *new* cross-module edge fails the
     build with a clear message; deliberate ones are added to the map (and here).
   - **Clean modules** — `Finance`, `Integrations`, `Platform`, `Portfolio` must
     depend on **no** other domain module (Integrations especially: driven adapters
     must not reach up into business logic).
   - **No new cycles** — beyond the two known, grandfathered cycles below.
   - An idiomatic NetArchTest cross-check of the Integrations leaf rule.

   The analysis resolves compiler-generated nested types (async state machines,
   closures, iterators) to their declaring type's namespace — without that,
   dependency hidden inside `async` methods is invisible, which is exactly where
   most of this codebase's logic lives. The Cecil ratchet is therefore the
   authoritative guard; NetArchTest's own scan does not descend into those.

### Approved module dependency graph (as of this ADR)

```
Comms        -> People
Delivery     -> Comms, Integrations, People, Platform
Finance      -> (none)
Governance   -> Comms, Integrations, People
Integrations -> (none)
Operations   -> People
People       -> Comms, Operations
Platform     -> (none)
Portfolio    -> (none)
```

**Known cycles (accepted tech debt, to decouple later):**
- `People ↔ Comms` — capacity logic raises notifications.
- `People ↔ Operations` — ops load feeds the resource roster.

Both are candidates for inversion via the shared kernel (an event/interface in
root) rather than a direct module→module reference. Tracked here; not blocking.

## Consequences

**Positive**
- Module boundaries are now **real and regression-proof**: new coupling or a new
  cycle fails CI, forcing a conscious decision instead of silent drift.
- The dependency graph is now **documented and measured** (the ratchet is
  generated from reality, not aspiration), surfacing the two genuine cycles that
  the flat namespace had hidden.
- A future service extraction becomes mechanical: a module's kernel dependencies
  and its (few, explicit) sibling dependencies are enumerated.

**Negative / trade-offs**
- `GlobalUsings.cs` means cross-module references still *compile* freely; the stop
  is the test, not the compiler. This is the standard arch-test model and keeps the
  diff mechanical, but it does mean the boundary lives in `ArchitectureTests`, which
  must be kept honest.
- The `Allowed` map and known-cycle set are hand-maintained; extending a boundary is
  a deliberate two-line edit here (by design).
- Two cycles remain as tech debt (documented above).

## Verification

`dotnet build` clean; `dotnet test` green (470 tests, incl. 4 architecture tests).
The ratchet was mutation-tested (removing an approved edge makes it fail, naming the
exact `source -> target`), confirming it is not a hollow pass.
