# ADR-0052 — Release pipeline: versioned images to GHCR

**Status:** Accepted — delivery axis (ABB-12). Complements CI (ADR-0008) and the
image scanning of ADR-0051.

## Context
CI validated every change (lint/test/build, API build/test, a11y, audit + AppSec
scans) but there was **no release step**: images were only ever built ad-hoc via
`docker compose build`, with no versioned, published artifact to promote to an
environment. The evaluation flagged "no automated deploy/release pipeline".

## Decision
Add a tag-triggered `release.yml` workflow that builds and publishes the two
runtime images to the **GitHub Container Registry (GHCR)**:

- Triggers on a semver tag (`v*.*.*`) — or `workflow_dispatch` with a test tag.
- Matrix builds **`api`** (`server/Dockerfile`) and **`web`** (root `Dockerfile`,
  with the public `VITE_*` build args) via Buildx, with GHA layer caching.
- `docker/metadata-action` derives tags: full version, `major.minor`, and
  `latest` (on a real tag push). Image names are
  `ghcr.io/<owner>/atlasppm-{api,web}` (lower-cased by the action).
- Authenticates with the built-in `GITHUB_TOKEN` (`packages: write`) — **no
  external secrets**, works out of the box.
- Runs a **Trivy image scan** (report-only, ADR-0051) on the built image before
  it's relied on.

**Deploy is intentionally out of scope.** Actually rolling the image onto a host
(k8s/Helm, App Service, etc.) is deferred until a target is chosen — the parked
k8s work. This ADR covers the **build-and-publish** half; the images it produces
are what a future deploy step (or a manual `docker pull` / compose `image:`
override) consumes.

## Consequences
- **+** Every tagged release yields immutable, versioned, scanned images ready to
  promote — reproducible and traceable to a commit.
- **+** Zero new infrastructure or secrets (GHCR + `GITHUB_TOKEN`); GHA cache
  keeps rebuilds fast.
- **+** The web image bakes only public `VITE_*` config; an SSO-enabled image is
  a build-arg override, not a code change.
- **−** No automated deploy yet (host-dependent) — the remaining CD gap, parked by
  design.
- **−** The workflow can only be verified end-to-end by pushing a tag /
  dispatching it (it doesn't run on PRs); the build itself is the same multi-stage
  Dockerfile CI already exercises via compose.

## Alternatives considered
- **Docker Hub / another registry** — GHCR needs no extra account or secret and
  is co-located with the repo; chosen.
- **Publish on every push to main** — noisy and unversioned; semver tags give
  deliberate, named releases.
- **Bundle deploy here** — premature without a chosen host; separated so this
  lands cleanly now.
