import { test, expect } from "@playwright/test";

// Dashboard layout journey — the dashboard offers four layouts via a segmented
// control (Executive / Operational / Compact / Custom). This clicks through each
// and asserts the view actually switches, using the per-layout hint line as the
// stable, unambiguous signal. Client-side only, so it runs with no backend.

const HINTS: Record<string, string> = {
  Executive: "High-level health, budget & status for leadership.",
  Operational: "Your priorities, tasks & approvals for delivery teams.",
  Compact: "Dense, list-first view for power users.",
  Custom: "Drag widgets from the palette to build your own view.",
};

test("dashboard journey: the four layout tabs switch the active view", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector("nav", { timeout: 15_000 });

  // Executive is the default.
  await expect(page.getByText(HINTS.Executive, { exact: true })).toBeVisible();

  for (const layout of ["Operational", "Compact", "Custom", "Executive"] as const) {
    await page.getByRole("button", { name: layout, exact: true }).click();
    await expect(page.getByText(HINTS[layout], { exact: true })).toBeVisible();
  }
});
