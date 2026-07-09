# ADR-0053 — AppSec baseline triage & gating

**Status:** Accepted — completes the rollout begun in [ADR-0051](./0051-automated-appsec-scanning.md)
(automated SAST/SCA/DAST, report-only).

## Context
ADR-0051 landed Semgrep (SAST) and Trivy (SCA/secrets/IaC) in **report-only**
mode so they wouldn't red-build on the existing baseline before it was triaged.
The first run flagged **Trivy: 1** (a Dockerfile finding, both images) and
**Semgrep: 28**. This ADR records the triage and flips both scanners to
**gating**.

## Decision
Triage each finding as **fix**, **accept (scoped, documented)**, or
**out-of-scope**, leave a clean baseline, then gate.

**Fixed (real):**
- **API image runs non-root** — `server/Dockerfile` adds `USER 1654` (the .NET 8
  `app` user; literal UID so static scanners confirm non-root). Clears Trivy
  DS-0002 and Semgrep `missing-user-entrypoint` for the API image.
- **Dependabot cooldown** — a 7-day `cooldown` on all three ecosystems so a
  freshly-published (possibly compromised/yanked) version isn't adopted
  immediately. Clears `dependabot-missing-cooldown`.

**Accepted — scoped, documented exceptions:**
- **nginx edge runs as root** (Trivy DS-0002 + Semgrep `missing-user` on the web
  `Dockerfile`) — the master must bind privileged 80/443 and read certs; workers
  drop to the `nginx` user. `AVD-DS-0002` in `.trivyignore` + Semgrep
  `--exclude-rule`; the API image is non-root (USER 1654) so this applies only to
  the nginx edge. Unprivileged-nginx (8080/8443) tracked as a follow-up.
- **`mutable-action-tag`** — actions are pinned to major versions and kept current
  by Dependabot's `github-actions` ecosystem; SHA-pinning is deferred.
- **`gha-curl-pipe-shell`** — the official Trivy installer over TLS from the
  vendor repo.
- **nginx `request-host-used` / `dynamic-proxy-host` / `missing-internal`** —
  standard same-origin reverse proxy; the `proxy_pass` upstream is an internal
  config value (a Docker-DNS resolver workaround), not attacker-controlled input.

**Out of scope:**
- `design/` is excluded via `.semgrepignore` — the approved prototype reference
  (CLAUDE.md §2), never bundled or served, so its demo helpers (e.g. a
  `postMessage` to `"*"`) aren't application AppSec.

Then: Semgrep runs with `--error` (minus the `--exclude-rule` list) and Trivy
with `--exit-code 1`. A new HIGH/CRITICAL finding now **fails the build**.

## Consequences
- **+** SAST + SCA/secret/IaC now **gate** — a regression blocks the PR rather
  than scrolling past in a log.
- **+** Two real hardenings shipped (non-root API image, Dependabot cooldown).
- **+** Every suppression is scoped and documented (security-hardening.md §6), so
  the exceptions are auditable, not blanket-disabled scanners.
- **−** Accepted exceptions mean those specific classes won't re-flag globally
  (e.g. a new unpinned action) — the trade recorded above; revisit if the policy
  changes (e.g. adopt SHA-pinning + unprivileged-nginx).
- **−** DAST (ZAP) stays dispatch-only and non-gating (needs a live target); a
  human pen-test remains a separate engagement.

## Alternatives considered
- **Stay report-only** — leaves the scanners advisory; defeats the point once the
  baseline is clean. Rejected.
- **Fix everything (SHA-pin all actions, unprivileged-nginx)** — higher churn and
  edge-destabilising for marginal gain now; captured as follow-ups instead.
- **Blanket-disable noisy rules** — opaque; scoped per-rule/per-path exceptions
  with rationale keep the gate meaningful.
