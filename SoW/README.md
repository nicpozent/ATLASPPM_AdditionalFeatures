# SoW — Atlas PPM

Statement-of-Work deliverables for the Atlas PPM engagement.

## Contents

| File | What |
|---|---|
| `SoW-Atlas-PPM-Product-Build.md` | SoW for the full product build (Markdown, Confluence-ready) |
| `SoW-Atlas-PPM-Remediation.md` | SoW for the code-review remediation engagement (Epic #106) |
| `sow-atlas-ppm-product-build.html` | Product-build SoW as a styled, printable HTML page |
| `flows.md` | Index of all functional flow diagrams (live Mermaid + image links) |
| `flows-gallery.html` | Self-contained HTML gallery of every rendered flow image |
| `flows/*.mmd` | Mermaid source, one per functional area (20 flows) |
| `images/*.png` | Static rendered images of each flow |

## Regenerating the images

Mermaid is rendered with `@mermaid-js/mermaid-cli` against the repo's Chromium.

```bash
for f in flows/*.mmd; do
  b=$(basename "$f" .mmd)
  npx mmdc -i "$f" -o "images/$b.png" -p .puppeteer.json -c .mermaid.json -b white -s 2
done
```

`.mermaid.json` carries the Atlas theme (navy accent, soft-blue fills);
`.puppeteer.json` points at the pre-installed Chromium with `--no-sandbox`.

## Flows

0. **Application map & navigation** — `flows/00-app-sitemap.mmd` → `images/00-app-sitemap.png`
1. **Authentication & RBAC gate** — `flows/01-auth-rbac.mmd` → `images/01-auth-rbac.png`
2. **Dashboard — layout switching & data** — `flows/02-dashboard.mmd` → `images/02-dashboard.png`
3. **Demand intake → scoring → approval funnel** — `flows/03-demands.mmd` → `images/03-demands.png`
4. **Portfolio → Project drill-in** — `flows/04-portfolio-project.mmd` → `images/04-portfolio-project.png`
5. **Project stage gates (G0–G5) & reviews** — `flows/05-project-gates.mmd` → `images/05-project-gates.png`
6. **Task board move — realtime, cap-schedule** — `flows/06-tasks-board.mmd` → `images/06-tasks-board.png`
7. **Timeline / Gantt & cross-entity dependencies** — `flows/07-gantt.mmd` → `images/07-gantt.png`
8. **Resource utilisation & capacity** — `flows/08-resources.mmd` → `images/08-resources.png`
9. **Financials roll-up → portfolio ROI** — `flows/09-financials.mmd` → `images/09-financials.png`
10. **Program detail — stakeholder matrix** — `flows/10-programs.mmd` → `images/10-programs.png`
11. **Products → Releases → deployment** — `flows/11-products-releases.mmd` → `images/11-products-releases.png`
12. **OKRs — objectives, key results, linkage** — `flows/12-okrs.mmd` → `images/12-okrs.png`
13. **Delivery status reporting by period** — `flows/13-delivery.mmd` → `images/13-delivery.png`
14. **Weekly news wall (edit / view)** — `flows/14-news.mmd` → `images/14-news.png`
15. **Connector sync (Jira / Azure DevOps)** — `flows/15-integrations-sync.mmd` → `images/15-integrations-sync.png`
16. **Whiteboard live co-editing** — `flows/16-whiteboard.mmd` → `images/16-whiteboard.png`
17. **Reports & export** — `flows/17-reports.mmd` → `images/17-reports.png`
18. **Administration** — `flows/18-admin.mmd` → `images/18-admin.png`
19. **Governance & compliance** — `flows/19-governance-compliance.mmd` → `images/19-governance-compliance.png`
