import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Full-page WCAG sweep in a real browser. Complements the jsdom primitive sweep
// (ADR-0026) by exercising computed styles and the composed page. Structural
// rules (roles, names, labels, aria) are GATED; colour-contrast is reported but
// not yet gated (design tokens carry some pre-existing low-contrast greys — see
// ADR-0033), so it surfaces without blocking the build.
const ROUTES = ["/", "/portfolio", "/gantt", "/roadmap", "/resources", "/admin"];

for (const route of ROUTES) {
  test(`a11y: ${route}`, async ({ page }) => {
    await page.goto(route);
    // Wait for the app shell to be interactive (sidebar nav present).
    await page.waitForSelector("nav", { timeout: 15_000 });

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();

    const contrast = results.violations.filter((v) => v.id === "color-contrast");
    const structural = results.violations.filter((v) => v.id !== "color-contrast");

    if (contrast.length) {
      const nodes = contrast.reduce((n, v) => n + v.nodes.length, 0);
      console.warn(`[a11y] ${route}: ${nodes} colour-contrast node(s) to review (not gated)`);
    }

    // Gate on structural violations — fail with a readable summary.
    expect(structural.map((v) => `${v.id} (${v.nodes.length})`), `Structural a11y violations on ${route}`).toEqual([]);
  });
}
