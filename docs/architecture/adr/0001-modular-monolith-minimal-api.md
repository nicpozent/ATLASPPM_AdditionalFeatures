# ADR-0001 — Modular monolith with ASP.NET minimal APIs

**Status:** Accepted

## Context
Atlas spans many domains (portfolio, delivery, governance, finance, people). We
need clear internal boundaries and fast iteration, but the team and deployment
footprint are small and there is no independent-scaling requirement per domain.

## Decision
Build the backend as a **single .NET 8 process** exposing **ASP.NET Core minimal
APIs** under `/api/v1`, organised into cohesive endpoint groups (one file per
domain area, composed in `Endpoints.cs`). Each group interacts only through
`AtlasDbContext` and typed DTOs.

## Consequences
- **+** One thing to build, deploy, run, trace and reason about; transactions span
  domains without distributed-transaction machinery.
- **+** Minimal APIs keep the surface terse and testable (`WebApplicationFactory`).
- **+** Clean module seams leave a low-cost path to extract a service later.
- **−** No per-domain isolation or independent scaling; a bad deploy affects all
  domains. Accepted at current scale; revisit if a domain needs separate scaling
  or ownership.

## Alternatives considered
- **Microservices** — rejected: operational overhead and distributed-data
  complexity unjustified at this size.
- **Controllers/MVC** — viable, but minimal APIs are lighter and sufficient.
