import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Full-page WCAG sweep in a real browser. Complements the jsdom primitive sweep
// (ADR-0026) by exercising computed styles and the composed page. As of the
// token contrast pass (ADR-0037) the design greys meet WCAG AA, so ALL WCAG 2
// A/AA violations — structural (roles, names, labels, aria) AND colour-contrast
// — now GATE the build.
// `/demands` sweeps the drag funnel board (empty columns) so the collaborative
// board chrome is covered alongside the static screens.
const ROUTES = ["/", "/portfolio", "/gantt", "/roadmap", "/resources", "/admin", "/demands"];

// The Zeus brand themes (ADR-0074) re-skin the whole app through the same
// var()-driven palette mechanism. A dense representative subset of routes is
// enough — contrast is token-global, not per-route. The theme is a per-profile
// preference keyed by the active role (default `pmo`, RoleContext).
const ZEUS_ROUTES = ["/", "/portfolio", "/admin"];
// All three Zeus themes are fully colour-contrast gated. The primary token was
// split into `primary` (foreground/accent, readable on each ground) and
// `primaryFill` (white-text button background, dark enough for white), so the
// dark themes (Command/Carbon) now clear AA too (ADR-0075, superseding the
// ADR-0074 follow-up note).
const ZEUS_CONTRAST_GATED = ["zeus-command", "zeus-daylight", "zeus-carbon"];
const ZEUS_STRUCTURAL_ONLY: string[] = [];

async function sweep(
  page: import("@playwright/test").Page,
  route: string,
  opts: { gateContrast: boolean } = { gateContrast: true },
) {
  await page.goto(route);
  // Wait for the app shell to be interactive (sidebar nav present).
  await page.waitForSelector("nav", { timeout: 15_000 });

  let builder = new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]);
  if (!opts.gateContrast) builder = builder.disableRules(["color-contrast"]);
  const results = await builder.analyze();

  // Return violation ids + offending node counts for a readable failure summary.
  return results.violations.map((v) => `${v.id} (${v.nodes.length})`);
}

// Default theme (Atlas Light) — every route, full contrast gate.
for (const route of ROUTES) {
  test(`a11y: ${route}`, async ({ page }) => {
    const violations = await sweep(page, route);
    expect(violations, `WCAG 2 A/AA violations on ${route}`).toEqual([]);
  });
}

function withTheme(page: import("@playwright/test").Page, theme: string) {
  return page.addInitScript((t) => {
    try {
      localStorage.setItem("atlas.role", "pmo");
      localStorage.setItem("atlas.theme.pmo", t);
    } catch { /* storage unavailable — sweep default theme */ }
  }, theme);
}

// Zeus light theme — full WCAG A/AA incl. colour-contrast.
for (const theme of ZEUS_CONTRAST_GATED) {
  for (const route of ZEUS_ROUTES) {
    test(`a11y: ${route} [${theme}]`, async ({ page }) => {
      await withTheme(page, theme);
      const violations = await sweep(page, route, { gateContrast: true });
      expect(violations, `WCAG 2 A/AA violations on ${route} [${theme}]`).toEqual([]);
    });
  }
}

// Zeus dark themes — structural WCAG A/AA (colour-contrast follow-up, ADR-0074).
for (const theme of ZEUS_STRUCTURAL_ONLY) {
  for (const route of ZEUS_ROUTES) {
    test(`a11y (structural): ${route} [${theme}]`, async ({ page }) => {
      await withTheme(page, theme);
      const violations = await sweep(page, route, { gateContrast: false });
      expect(violations, `WCAG 2 A/AA (structural) violations on ${route} [${theme}]`).toEqual([]);
    });
  }
}
