# SoW — Atlas PPM

Statement-of-Work deliverables for the Atlas PPM engagement.

## Contents

| File | What |
|---|---|
| `STATEMENT-OF-WORK.md` / `.html` | **Canonical SoW** in the Birgma house format (17 sections; mirrors `GovernancePortal_Latest/docs/STATEMENT-OF-WORK.md`) |
| `SoW-Atlas-PPM-Product-Build.md` | Detailed build SoW (Markdown, Confluence-ready) |
| `SoW-Atlas-PPM-Remediation.md` | SoW for the code-review remediation engagement (Epic #106) |
| `sow-atlas-ppm-product-build.html` | Product-build SoW as a styled, printable HTML page |
| `flows.md` | Index of all flow diagrams (live Mermaid + image links) |
| `flows-gallery.html` | Self-contained HTML gallery of every rendered flow |
| `flows/*.mmd` | Mermaid source (20 system + 8 user + 9 dev = 37 flows) |
| `images/*.png` | Static rendered images of each flow |

## Three views of the flows

- **System & data flows** (`NN-*.mmd`) — how the platform moves data and enforces rules.
- **User journeys** (`user-*.mmd`) — persona → goal, step by step.
- **Software-development interaction** (`dev-*.mmd`) — SDLC + how the pieces interact at build/run/deploy.

## Regenerating the images

Rendered with `@mermaid-js/mermaid-cli` against the repo's Chromium (not an app dependency — install on demand):

```bash
for f in flows/*.mmd; do
  b=$(basename "$f" .mmd)
  npx @mermaid-js/mermaid-cli -i "$f" -o "images/$b.png" -p .puppeteer.json -c .mermaid.json -b white -s 2
done
```

`.mermaid.json` carries the Atlas theme; `.puppeteer.json` points at the pre-installed Chromium with `--no-sandbox`.
