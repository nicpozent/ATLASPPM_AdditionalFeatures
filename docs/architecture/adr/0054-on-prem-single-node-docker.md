# ADR-0054 — On-prem single-node Docker as the delivery target

**Status:** Accepted — fixes the delivery target for ABB-12 (Delivery & Runtime),
building on [ADR-0008](./0008-docker-compose-nginx-edge.md) (Docker + compose +
nginx edge), [ADR-0048](./0048-web-worker-process-split.md) (web/worker split) and
[ADR-0052](./0052-release-pipeline-ghcr.md) (GHCR release pipeline). Supersedes the
open "no k8s manifests yet / deploy-to-host parked" gap in the evaluation.

## Context
The build-and-publish half of delivery is done: `release.yml` publishes versioned
`api` + `web` images to GHCR on a semver tag (ADR-0052), and `docker-compose.yml`
runs the whole stack (`db` + `api`[role=web] + `worker`[role=worker] + `web` nginx
edge). What was left open was the **deploy-to-host** target: the evaluation carried
a standing gap "single-node compose; no k8s manifests yet," treating the absence of
Kubernetes as a shortfall.

That framing was wrong for Birgma/Biltema's context. Atlas serves a portfolio-
management workload — an internal user population, read-heavy roll-ups derived in a
single process, not an internet-scale multi-tenant service. The operational reality
is an on-prem **Linux VM or Windows Server with Docker** (the two hosts the in-app
Help centre already documents), kept **off the public internet** (the same
constraint that keeps the app from ever calling GitHub). Kubernetes would add a
control plane, an ingress controller, cluster upgrades and a team's worth of
operational surface to run a handful of containers on one node — cost with no
matching scale or availability requirement.

## Decision
Adopt **on-prem single-node Docker (`docker compose`)** as the **supported
delivery target**, not a placeholder for a future orchestrator:

- **One host, four services.** `db` (Postgres 16 + named volume `atlas_db`), `api`
  (role=web, owns migrations/seed, serves `/api/v1` via `expose:8080`), `worker`
  (role=worker, recurring jobs, no HTTP surface), `web` (nginx edge terminating
  TLS on 443/80, same-origin `/api` → api). The single-container fallback (`api`
  role=`all`, drop `worker`) stays supported for the smallest installs.
- **Images from GHCR.** Production hosts pull the tagged `api`/`web` images built
  by `release.yml` rather than building on the host; compose `build:` stays for
  dev. The image is promoted, not rebuilt per environment.
- **Config & secrets by injection.** Environment / Docker secrets
  (`docker-compose.secrets.yml`), never in VCS — DB creds, Entra, Jira/ADO, OTLP.
- **No GitHub↔app path at runtime.** CI (scanners, release build) runs in GitHub;
  the deployed app pulls images and talks only to its DB, the directory/issue
  trackers it's configured for, and its OTLP collector.
- **Upgrades** are a pull-and-recreate: `docker compose pull && docker compose up -d`
  (api applies EF migrations on startup, health-gated by `/readyz`).

## Consequences
- **+** The delivery story is now *complete and matched to the infrastructure* —
  build (CI) → publish (GHCR, ADR-0052) → run (this ADR) — rather than carrying a
  perpetual "k8s TODO." The Delivery dimension moves to fully-realised.
- **+** Minimal operational surface: one host, `docker compose`, named-volume
  backups (BitLocker/at-rest per `security-hardening.md §3`), the unpublished DB
  port keeping Postgres host-internal (§5). Operators already have the Help guides.
- **+** No cloud lock-in; runs air-gapped. The web/worker split still gives
  independent restart/resource limits within the node.
- **−** Single node = no built-in HA/rolling-deploy; an upgrade has a brief
  recreate window. Acceptable for an internal PPM tool with a maintenance window;
  documented rather than engineered around.
- **−** Vertical scaling only. Fine at portfolio scale (read roll-ups are single-
  process joins by design, ADR-0001/0048); revisit only if the user population or
  data volume outgrows one host.

## Alternatives considered
- **Kubernetes + Helm** — rejected *for now*: a control plane, ingress, and cluster
  ops to run ~4 containers on one node; no scale/HA requirement justifies it. If a
  future multi-node/HA need appears, the images and 12-factor config already suit
  k8s — the manifests become a thin add-on, not a rewrite. Parked deliberately, not
  by omission.
- **Managed PaaS (Azure App Service / Container Apps)** — rejected: the deployment
  must stay on-prem and off the public internet; a managed cloud runtime conflicts
  with that constraint. (Azure Database for PostgreSQL remains a documented option
  if they ever move the DB, per `security-hardening.md`.)
- **Bare-metal / systemd (no containers)** — rejected: loses the reproducible image,
  the web/worker isolation, and the promote-the-artifact model already in place.
