import { test, expect, type Route, type Page } from "@playwright/test";

// Programs can edit their start & end dates from the program detail header. The
// backend PATCH /programs/{id} already accepts startDate/endDate; this proves the
// UI exposes editable date inputs and PATCHes the change (stored in the program
// display-date format, e.g. "15 Aug 2026"). Mocks the /api/v1 surface.

async function json(route: Route, body: unknown) {
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
}

const PGM = {
  id: "PGM-1", name: "Customer Experience 2027", owner: "Nadia Khan", goal: "Delight customers",
  status: "On track", projects: [], budget: 1000, spent: 200, progress: 40, health: "green",
  startDate: "1 Feb 2026", endDate: "30 Jun 2026", archived: false, dept: "IT & Data",
};

async function mock(page: Page, patches: string[]) {
  await page.route("**/api/v1/**", async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname.replace(/.*\/api\/v1/, "");
    if (req.method() === "PATCH" && path === "/programs/PGM-1") {
      patches.push(req.postData() ?? "");
      return route.fulfill({ status: 204, body: "" });
    }
    if (path === "/roles") return json(route, { roles: [] });
    if (path === "/programs") return json(route, [PGM]);
    if (path === "/projects") return json(route, []);
    return json(route, []);
  });
}

test("programs: start & end dates are editable from the detail header", async ({ page }) => {
  const patches: string[] = [];
  await mock(page, patches);
  await page.goto("/programs");
  await page.waitForSelector("nav", { timeout: 15_000 });

  // Open the program detail.
  await page.getByText("Customer Experience 2027", { exact: true }).click();

  // The date inputs are present and pre-filled from the stored display dates
  // (converted to the yyyy-MM-dd the date input requires).
  const start = page.getByLabel("Program start date");
  const end = page.getByLabel("Program end date");
  await expect(start).toBeVisible();
  await expect(end).toBeVisible();
  await expect(start).toHaveValue("2026-02-01");
  await expect(end).toHaveValue("2026-06-30");

  // Editing the end date PATCHes it back in the program display-date format.
  await end.fill("2026-08-15");
  await expect.poll(() => patches.some((p) => p.includes("15 Aug 2026"))).toBe(true);
});
