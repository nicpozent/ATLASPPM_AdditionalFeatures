#!/usr/bin/env bash
# Compile every ADR (0001-…) into a single document, ALL-ADRS.md, for export to
# Confluence / a review board. Deterministic: index table (from README.md) up
# top, then each ADR in numeric order separated by a rule. Re-run after adding
# an ADR so the combined doc never drifts.
#
#   ./build-all.sh            # writes ALL-ADRS.md next to this script
#   ./build-all.sh --check    # exit 1 if ALL-ADRS.md is stale (for CI)
set -euo pipefail
cd "$(dirname "$0")"

OUT="ALL-ADRS.md"
N=$(ls | grep -cE '^[0-9]{4}-.*\.md$')

gen() {
  echo "# Atlas PPM — Architecture Decision Records (complete set)"
  echo
  echo "_${N} ADRs, in numeric order. Each ADR records one significant decision:"
  echo "context, options considered, the decision, and its consequences. ADRs are"
  echo "immutable once Accepted; a decision is changed by adding a new ADR that"
  echo "supersedes it. **Generated from the individual ADR files by build-all.sh —"
  echo "do not edit by hand; edit the source ADRs and re-run.**_"
  echo
  echo "---"
  echo
  echo "## Index"
  echo
  echo "| ADR | Title | Status |"
  echo "|-----|-------|--------|"
  # Strip the markdown link, keep the bare 4-digit number, from each README row.
  grep -E '^\| \[[0-9]{4}\]' README.md | sed -E 's/\[([0-9]{4})\]\([^)]*\)/\1/'
  echo
  echo "---"
  for f in $(ls | grep -E '^[0-9]{4}-.*\.md$' | sort); do
    echo
    cat "$f"
    echo
    echo
    echo "---"
  done
}

if [[ "${1:-}" == "--check" ]]; then
  if ! diff -q <(gen) "$OUT" >/dev/null 2>&1; then
    echo "ALL-ADRS.md is stale — run docs/architecture/adr/build-all.sh" >&2
    exit 1
  fi
  echo "ALL-ADRS.md is up to date."
else
  gen > "$OUT"
  echo "Wrote $OUT ($(grep -cE '^# ADR-[0-9]{4}' "$OUT") ADRs, $(wc -l < "$OUT") lines)."
fi
