import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Accessibility sweep of the pointer-first whiteboard canvas — the one surface
// the route-level sweep can't reach because it lives behind a view toggle. Uses
// the portfolio roadmap whiteboard (no entity selection, so it renders with no
// backend), switches to the Whiteboard view, waits for the lazy canvas, and runs
// axe over the composed page. Complements the keyboard/AT wiring (focusable
// labelled nodes, arrow-move) which is unit-tested at the scene layer.
test("a11y: roadmap whiteboard canvas", async ({ page }) => {
  await page.goto("/roadmap");
  await page.waitForSelector("nav", { timeout: 15_000 });

  // Switch to the Whiteboard view and wait for the lazily-loaded canvas.
  await page.getByRole("button", { name: "Whiteboard" }).click();
  const canvas = page.getByRole("application", { name: /whiteboard canvas/i });
  await expect(canvas).toBeVisible({ timeout: 15_000 });

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();

  expect(
    results.violations.map((v) => `${v.id} (${v.nodes.length})`),
    "WCAG 2 A/AA violations on the roadmap whiteboard",
  ).toEqual([]);
});
