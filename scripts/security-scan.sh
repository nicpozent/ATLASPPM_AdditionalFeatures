#!/usr/bin/env bash
# ============================================================================
#  Atlas PPM — application-security scan (SAST · SCA/secrets/IaC · optional DAST)
#
#  Fires the SAME automated checks the CI pipeline runs, but from ANY machine or
#  CI runner — a developer laptop or an on-prem build agent. It does NOT touch
#  GitHub, and the running Atlas app is never
#  involved: SAST/SCA read the source tree on disk; DAST (optional) probes a URL
#  you pass. This is how you run the "automated pen-test" in an environment that
#  is not connected to GitHub / not exposed to the internet.
#
#  Usage (run from the repo root or anywhere — it cd's to the repo root):
#    scripts/security-scan.sh                       # SAST + SCA, gating (non-zero exit on findings)
#    scripts/security-scan.sh --report              # report-only (never exits non-zero)
#    scripts/security-scan.sh --dast https://atlas-test.internal   # + DAST against a target you own
#
#  Requires: semgrep (`pip install semgrep`), trivy (aquasecurity/trivy), and —
#  for --dast — docker. It auto-honours .semgrepignore and .trivyignore, so the
#  same documented exceptions as CI apply (see docs/security-hardening.md §6).
#  Air-gapped: pre-mirror the Semgrep rulesets and the Trivy DB, then point the
#  tools at the mirror (SEMGREP_RULES / TRIVY_DB_REPOSITORY).
# ============================================================================
set -euo pipefail

GATE=1            # 1 = gating (fail on findings); --report sets 0
DAST_TARGET=""
while [ $# -gt 0 ]; do
  case "$1" in
    --report) GATE=0 ;;
    --dast)   DAST_TARGET="${2:-}"; shift ;;
    -h|--help) sed -n '2,26p' "$0"; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
  shift
done

cd "$(cd "$(dirname "$0")/.." && pwd)"
status=0
SEMGREP_ERR=""; [ "$GATE" = "1" ] && SEMGREP_ERR="--error"

echo "==> SAST (Semgrep — OWASP Top 10 + security-audit + secrets)"
if command -v semgrep >/dev/null 2>&1; then
  semgrep scan \
    --config p/security-audit --config p/owasp-top-ten --config p/secrets \
    --exclude-rule yaml.github-actions.security.github-actions-mutable-action-tag.github-actions-mutable-action-tag \
    --exclude-rule yaml.github-actions.security.gha-curl-pipe-shell.gha-curl-pipe-shell \
    --exclude-rule generic.nginx.security.request-host-used.request-host-used \
    --exclude-rule generic.nginx.security.dynamic-proxy-host.dynamic-proxy-host \
    --exclude-rule generic.nginx.security.missing-internal.missing-internal \
    --exclude-rule dockerfile.security.missing-user.missing-user \
    --metrics off --oss-only --disable-version-check $SEMGREP_ERR || status=1
else
  echo "    semgrep not installed — 'pip install semgrep' (skipped)" >&2
fi

echo "==> SCA · secrets · IaC (Trivy filesystem)"
if command -v trivy >/dev/null 2>&1; then
  trivy fs --scanners vuln,secret,misconfig --severity HIGH,CRITICAL \
    --exit-code "$GATE" --no-progress . || status=1
else
  echo "    trivy not installed — see aquasecurity/trivy (skipped)" >&2
fi

if [ -n "$DAST_TARGET" ]; then
  echo "==> DAST (OWASP ZAP baseline) → $DAST_TARGET  [report-only; scan only targets you own]"
  if command -v docker >/dev/null 2>&1; then
    docker run --rm -t ghcr.io/zaproxy/zaproxy:stable zap-baseline.py -t "$DAST_TARGET" -I || true
  else
    echo "    docker not available — run the ZAP baseline where docker is (skipped)" >&2
  fi
fi

[ "$status" = "0" ] && echo "==> Clean." || echo "==> Findings above." >&2
exit $status
