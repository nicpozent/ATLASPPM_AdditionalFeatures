# ADR-0051 — Automated application-security scanning (SAST / SCA / DAST)

**Status:** Accepted — hardening axis (ABB-09 Security, ABB-12 Delivery). Extends
the CI supply-chain gates (ADR-0008, `npm audit` + `dotnet list --vulnerable`).

## Context
The evaluation flagged "no pen-test performed" as the standing Security gap. A
full penetration test is an authorised external engagement we can't run in-repo —
but the **automated** portion of it (the bulk of the OWASP Top 10) can be, and
should gate on every change rather than be a point-in-time exercise. We already
had SCA (dependency CVEs) but no SAST (source analysis) or DAST (probing a running
app).

## Decision
Add a `security-scan.yml` workflow with three scanners, split by how they see the
system:

- **SAST — Semgrep** (`p/security-audit`, `p/owasp-top-ten`, `p/secrets`; OSS
  rules): reads the C#/TypeScript source for injection, authz, crypto and
  hardcoded-secret patterns. "Inside" view.
- **SCA · secrets · IaC — Trivy** (`fs` scan): dependency CVEs (complements the
  existing audit gates), committed secrets, and Dockerfile/compose misconfig.
- **DAST — OWASP ZAP baseline**: probes a *running* deployment from the outside
  (passive + safe-active). "Outside" view.

**Rollout mode.** SAST + Trivy run **report-only** (findings printed, build not
failed) so the scanners land without blocking on the current baseline; the knobs
to gate are in place (`exit-code`, drop the `|| true`) and flipped once the
baseline is triaged. **ZAP is dispatch-only** with a `zap_target` input: DAST
needs a live target, so it's pointed at a running **test environment** (never
production) — the same "run against a test server" model as the k6 perf suite
(ADR-0047), avoiding brittle in-CI stack orchestration.

**CodeQL.** GitHub-native CodeQL (also SAST) is complementary and enabled via the
repo's *Code scanning → Default setup* toggle (a settings action, not code) to
avoid the default-vs-advanced-workflow conflict; Semgrep here is the
code-defined, portable SAST.

## Consequences
- **+** The automated half of a pen-test now runs on every push/PR + weekly, and
  on demand against a test deployment — catching most OWASP-Top-10 classes
  continuously instead of once.
- **+** Report-only introduction means no sudden red build on existing debt; the
  team triages, then flips to gating.
- **+** No new infrastructure; portable (Semgrep/Trivy CLIs, ZAP action).
- **−** Report-only until flipped, so findings are advisory for now — tracked as
  the "flip to gating after triage" follow-up.
- **−** A human penetration test / red-team is still out of scope for CI; this
  reduces, not removes, the need for an external engagement (a scoping doc +
  remediation register is the remaining Security follow-up).

## Alternatives considered
- **CodeQL as the primary SAST in this workflow** — best GitHub integration, but
  an advanced CodeQL workflow conflicts with the one-click default setup and
  needs GHAS config; kept as the settings-toggle option, Semgrep as the portable
  code-defined scanner.
- **Stand the full stack up in CI for ZAP** — real API DAST, but fiddly container
  networking and flaky; the dispatch-against-test-env model is reliable and how
  DAST is run in practice.
- **Gate immediately** — would red-build on the existing baseline; report-first
  is the standard, lower-friction rollout.
