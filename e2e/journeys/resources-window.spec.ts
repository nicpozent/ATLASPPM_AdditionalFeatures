import { test, expect, type Route, type Page } from "@playwright/test";

// The Resources "By person" utilisation is averaged over a period window, and the
// day/week/month/quarter/half/year toggle + the date-to-date filter drive that
// window. This spec proves the period toggle actually REFETCHES /resources with a
// from/to query (the previous behaviour only relabelled the header) and that the
// date inputs are present and change the window. Mocks the /api/v1 surface so the
// roster renders with no backend, and records the query string of each call.

async function json(route: Route, body: unknown) {
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
}

const roster = [
  { name: "Ada Lovelace", role: "Engineer", dept: "Platform", initials: "AL", color: "#0F6CBD", opsPct: 0, projectPct: 60, productPct: 0, over: false },
];

async function mock(page: Page, calls: string[]) {
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/.*\/api\/v1/, "");
    if (path === "/roles") return json(route, { roles: [] });
    if (path === "/resources") { calls.push(url.search); return json(route, roster); }
    return json(route, []);
  });
}

test("resources: the period toggle and date filter refetch with a window", async ({ page }) => {
  const calls: string[] = [];
  await mock(page, calls);
  await page.goto("/resources");
  await page.waitForSelector("nav", { timeout: 15_000 });

  // The person renders from the mocked roster (role · dept is unique to the row).
  await expect(page.getByText("Engineer · Platform", { exact: true })).toBeVisible();

  // First load sends a from/to window (default = current month), not a bare call.
  await expect.poll(() => calls.some((s) => s.includes("from=") && s.includes("to="))).toBe(true);

  // Switching to Year refetches with a Jan 1 → Dec 31 window.
  calls.length = 0;
  await page.getByRole("button", { name: "Year", exact: true }).click();
  await expect.poll(() => calls.some((s) => /from=\d{4}-01-01/.test(s) && /to=\d{4}-12-31/.test(s))).toBe(true);

  // The date-to-date filter inputs exist and drive a custom window.
  const start = page.getByLabel("Allocation window start");
  const end = page.getByLabel("Allocation window end");
  await expect(start).toBeVisible();
  await expect(end).toBeVisible();

  calls.length = 0;
  await start.fill("2026-03-01");
  await end.fill("2026-03-31");
  await expect.poll(() => calls.some((s) => s.includes("from=2026-03-01") && s.includes("to=2026-03-31"))).toBe(true);
});
