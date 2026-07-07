import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Full-page WCAG sweep in a real browser. Complements the jsdom primitive sweep
// (ADR-0026) by exercising computed styles and the composed page. As of the
// token contrast pass (ADR-0037) the design greys meet WCAG AA, so ALL WCAG 2
// A/AA violations — structural (roles, names, labels, aria) AND colour-contrast
// — now GATE the build.
const ROUTES = ["/", "/portfolio", "/gantt", "/roadmap", "/resources", "/admin"];

for (const route of ROUTES) {
  test(`a11y: ${route}`, async ({ page }) => {
    await page.goto(route);
    // Wait for the app shell to be interactive (sidebar nav present).
    await page.waitForSelector("nav", { timeout: 15_000 });

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();

    // Gate on every WCAG 2 A/AA violation (contrast included) with a readable
    // summary of the rule ids and offending node counts.
    expect(
      results.violations.map((v) => `${v.id} (${v.nodes.length})`),
      `WCAG 2 A/AA violations on ${route}`,
    ).toEqual([]);
  });
}
