import { test, expect, type Page } from "@playwright/test";

// Full navigation journey — drives the real sidebar the way a user does: click
// each Workspace + Configuration link in turn and assert the route changes and
// the header title updates to that screen's title. Runs against the built app
// with no backend (screens render empty states), so this proves routing, the
// app shell, lazy-route loading and per-screen mount — none of which the axe
// sweep or the jsdom unit tests exercise. A page-error listener fails the test
// if any screen throws an uncaught exception while navigating.

// (label, expected path, header title) — mirrors src/nav.ts. Kept inline so the
// spec has no dependency on the app's module-alias resolution.
const MAIN: [string, string, string][] = [
  ["Portfolio", "/portfolio", "Portfolio"],
  ["Programs", "/programs", "Programs"],
  ["Products", "/products", "Products"],
  ["OKRs", "/okrs", "OKRs & Strategic Alignment"],
  ["Roadmap", "/roadmap", "Strategic Roadmap"],
  ["Demand Pipeline", "/demands", "Demand Pipeline"],
  ["Timeline / Gantt", "/timeline", "Timeline / Gantt"],
  ["PI Planning", "/pi-planning", "Program Increment Planning"],
  ["Project Detail", "/project", "Project Detail"],
  ["Resources", "/resources", "Resources & Capacity"],
  ["Financials", "/financials", "Financials"],
  ["Delivery Status", "/delivery", "Delivery Status"],
  ["Releases", "/releases", "Releases"],
  ["Ops", "/ops", "Operational Work"],
  ["Weekly Updates", "/updates", "Weekly Updates"],
];
const CONFIG: [string, string, string][] = [
  ["My Team", "/team", "My Team"],
  ["Methodologies", "/methodologies", "Methodology Library"],
  ["Integrations", "/integrations", "Integrations & Settings"],
  ["Reports", "/reports", "Reports"],
  ["Administration", "/admin", "Administration"],
  ["Help & Support", "/help", "Help & Support"],
];

function watchForCrashes(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

async function visit(page: Page, label: string, path: string, title: string) {
  await page.getByRole("link", { name: label, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${path.replace(/\//g, "\\/")}$`));
  // The header (in <header>) is authoritative for "which screen am I on". It
  // shows the screen's i18n title, falling back to its label when no title key
  // exists — so accept either.
  const header = page.locator("header");
  await expect(
    header.getByText(title, { exact: true }).or(header.getByText(label, { exact: true })),
  ).toBeVisible();
  // The screen mounted without tripping an error boundary.
  await expect(page.getByText("Something went wrong", { exact: false })).toHaveCount(0);
}

test("navigation journey: every Workspace + Configuration screen loads via the sidebar", async ({ page }) => {
  const errors = watchForCrashes(page);
  await page.goto("/");
  await page.waitForSelector("nav", { timeout: 15_000 });
  // Start on the dashboard.
  await expect(page.locator("header").getByText("Dashboard", { exact: true })).toBeVisible();

  for (const [label, path, title] of [...MAIN, ...CONFIG]) {
    await visit(page, label, path, title);
  }

  // Return home to close the loop.
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);

  expect(errors, `uncaught page errors during navigation:\n${errors.join("\n")}`).toEqual([]);
});
