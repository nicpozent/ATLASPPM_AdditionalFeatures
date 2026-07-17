import { test, expect, type Route, type Page } from "@playwright/test";

// Verifies the timeline dependency arrows render as an SVG overlay: a sprint→
// sprint arrow on the Project timeline (measured overlay) and that sprint bars
// carry their data-dep-key anchors. Mocks the /api/v1 surface the Gantt reads so
// real bars render with no backend.

async function json(route: Route, body: unknown) {
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
}

const PID = "PRJ-1";
const gantt = {
  canEdit: true, phases: [], milestones: [],
  projectStart: 1, projectEnd: 5, startDate: "2026-02-01", endDate: "2026-06-30",
  sprints: [
    { id: 1, name: "Sprint 1", status: "Completed", startMonth: 1, endMonth: 2, undated: false, startDate: "2026-02-03", endDate: "2026-03-13" },
    { id: 2, name: "Sprint 2", status: "Started", startMonth: 3, endMonth: 4, undated: false, startDate: "2026-04-01", endDate: "2026-05-15" },
  ],
};
const deps = { canEdit: true, edges: [
  // Sprint 2 depends on Sprint 1 → arrow points S1 → S2.
  { id: 1, fromType: "sprint", fromId: "2", toType: "sprint", toId: "1", source: "manual" },
] };

async function mock(page: Page) {
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace(/.*\/api\/v1/, "");
    if (path === "/roles") return json(route, { roles: [] });
    if (path === "/projects") return json(route, [{ id: PID, name: "Alpha" }]);
    if (path === "/programs") return json(route, []);
    if (path === `/projects/${PID}/gantt`) return json(route, gantt);
    if (path === `/projects/${PID}/sprints`) return json(route, { canEdit: true, canCreate: true, sprints: gantt.sprints });
    if (path === `/projects/${PID}/tasks`) return json(route, { tasks: [] });
    if (path === "/portfolio/dependencies") return json(route, deps);
    return json(route, []);
  });
}

test("timeline: sprint dependency arrow renders on the Project timeline", async ({ page }) => {
  await mock(page);
  await page.goto("/timeline");
  await page.waitForSelector("nav", { timeout: 15_000 });

  // Both sprint bars render with their dependency anchors.
  await expect(page.locator('[data-dep-key="sprint-1"]')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('[data-dep-key="sprint-2"]')).toBeVisible();

  // The measured overlay draws an arrow path with the arrowhead marker
  // (source-specific: dep-ahm-manual / dep-ahm-derived).
  const arrow = page.locator('path[marker-end^="url(#dep-ahm-"]');
  await expect(arrow.first()).toBeVisible({ timeout: 15_000 });
  expect(await arrow.count()).toBeGreaterThanOrEqual(1);

  // The manual link shows as a removable chip in the legend row.
  await expect(page.getByText(/Sprint 2/).first()).toBeVisible();
});
