# ADR-0002 — PostgreSQL with EF Core

**Status:** Accepted

## Context
Atlas needs durable, transactional, relational storage for ~80 interrelated
entities, with a managed schema-evolution path and portability across cloud and
on-prem (Nordic data-residency requirements).

## Decision
Use **PostgreSQL 16** as the store and **EF Core 8** (Npgsql provider) as the ORM.
Schema changes ship as **EF migrations applied automatically at API startup**.
Use Postgres-native features where they help (e.g. `text[]` columns with safe
defaults). The InMemory provider backs integration tests.

## Consequences
- **+** Mature, free, widely-hostable (managed or self-hosted); strong SQL + JSON/array support.
- **+** Migrations give a reproducible, reviewable schema history; auto-apply keeps
  environments in step.
- **+** EF gives typed queries and a test-friendly abstraction.
- **−** ORM abstraction can hide query cost; mitigated by projecting to DTOs,
  indexing hot lookups, and deriving roll-ups at read time on bounded sets.
- **−** Auto-migrate on boot assumes a single writer/rolling deploy; acceptable
  for the compose topology.

## Alternatives considered
- **SQL Server** — fine technically, but Postgres avoids licensing and eases
  cross-platform/managed hosting. (The in-app Help still references generic "SQL
  DB" for operators coming from SQL Server; the Postgres specifics are documented.)
- **Dapper / raw SQL** — more control, more boilerplate; EF's migrations and
  change-tracking win for this CRUD-heavy domain.
