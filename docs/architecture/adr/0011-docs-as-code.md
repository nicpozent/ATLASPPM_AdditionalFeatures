# ADR-0011 — Documentation as code (Markdown + Mermaid + ADRs)

**Status:** Accepted

## Context
Architecture and operations docs must stay accurate as the code changes, be
reviewable alongside code, and render without proprietary tooling.

## Decision
Keep documentation **in the repo as Markdown**, with **Mermaid** fenced blocks for
diagrams (context/container/sequence/ER) so they render on GitHub and in IDEs.
Record significant decisions as **ADRs** under `docs/architecture/adr/`. Update the
relevant docs in the **same PR** as any change to a container, trust boundary, data
model shape, or recorded decision.

## Consequences
- **+** Docs are versioned, diffable, and reviewed with the code they describe.
- **+** No diagram binaries or licensed modelling tools; low barrier to update.
- **+** ADRs preserve the "why", not just the "what".
- **−** Mermaid is less expressive than a dedicated modelling tool (e.g. no formal
  ArchiMate); acceptable for communication-grade diagrams.
- **−** Requires discipline to keep docs in step; the "same-PR" rule is the control.

## Alternatives considered
- **Wiki / Confluence** — drifts from code, not diffable in PRs.
- **Dedicated modelling tool (Enterprise Architect, ArchiMate)** — heavyweight;
  reserved for formal enterprise-architecture artefacts if ever required.
