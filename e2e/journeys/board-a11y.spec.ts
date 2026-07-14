import { test, expect, type Route, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Accessibility sweep of the two drag boards that need seeded data to render —
// the project Tasks (Kanban) board and the PI Program Board. The route-level
// sweep (a11y.spec.ts) only reaches empty states; here we stub the /api/v1/*
// surface each board reads so real cards render, then run axe over the composed
// page AND assert the cards expose accessible names (so an AT user can reach
// them). Keyboard operation of the cards is unit-covered; this is the structural
// name/role/contrast gate for the populated boards.

async function json(route: Route, body: unknown) {
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
}

async function axeClean(page: Page, where: string) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(results.violations.map((v) => `${v.id} (${v.nodes.length})`), `WCAG 2 A/AA violations on ${where}`).toEqual([]);
}

test("a11y: project Tasks (Kanban) board with cards", async ({ page }) => {
  const PID = "PRJ-A11Y";
  const project = {
    id: PID, name: "Accessibility Fixture", dept: "Dev", owner: "PM", methodology: "Scrum",
    status: "green", health: "On track", progress: 40, phase: "Delivery", budget: 0, spent: 0, due: "TBD",
  };
  const tasks = {
    canEdit: true, canCreate: true, canMove: true,
    tasks: [
      { id: 1, code: "T-1", name: "Draft the API contract", epic: "", assignee: "Sofia", sprint: "S1", baseline: "S1", status: "To Do", priority: "High", points: 3, size: "M" },
      { id: 2, code: "T-2", name: "Wire the funnel endpoint", epic: "", assignee: "Nils", sprint: "S1", baseline: "S1", status: "In Progress", priority: "Medium", points: 5, size: "L" },
      { id: 3, code: "T-3", name: "Review the SoA panel", epic: "", assignee: "Ada", sprint: "S1", baseline: "S1", status: "Done", priority: "Low", points: 2, size: "S" },
    ],
  };
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace(/.*\/api\/v1/, "");
    if (path === "/roles") return json(route, { roles: [] });   // usePermissions matrix (object, not array)
    if (path === `/projects/${PID}`) return json(route, project);
    if (path === `/projects/${PID}/tasks`) return json(route, tasks);
    return json(route, []);   // everything else the shell polls → empty
  });

  await page.goto(`/project?id=${PID}&tab=tasks`);   // deep-link straight to the board
  await page.waitForSelector("nav", { timeout: 15_000 });

  // The seeded cards render as accessible buttons (name = code + title + status).
  const card = page.getByRole("button", { name: /T-1 Draft the API contract/ });
  await expect(card).toBeVisible({ timeout: 15_000 });

  await axeClean(page, "the Tasks Kanban board");
});

test("a11y: PI Program Board with a swimlane + card", async ({ page }) => {
  const increments = { canEdit: true, increments: [
    { id: 1, key: "PI-1", name: "PI 2026.Q3", startDate: "2026-07-01", endDate: "2026-09-30", state: "Active", objectives: 1, iterations: 1, dependencies: 0 },
  ] };
  const detail = {
    id: 1, key: "PI-1", name: "PI 2026.Q3", startDate: "2026-07-01", endDate: "2026-09-30", state: "Active", canEdit: true,
    iterationList: [{ id: 11, name: "Iteration 1", startDate: "2026-07-01", endDate: "2026-07-14", capacity: 100, load: 40 }],
    objectiveList: [{ id: 101, title: "Ship the pipeline", description: "", entityType: "project", entityId: "PRJ-1", entityName: "Alpha", businessValue: 8, actualValue: 0, committed: true, confidence: 4, status: "Planned" }],
    dependencyList: [], targets: [],
  };
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace(/.*\/api\/v1/, "");
    if (path === "/roles") return json(route, { roles: [] });   // usePermissions matrix (object, not array)
    if (path === "/increments") return json(route, increments);
    if (path === "/increments/1") return json(route, detail);
    if (path === "/increments/1/board") return json(route, { canEdit: true, placements: {} });
    return json(route, []);
  });

  await page.goto("/pi-planning");
  await page.waitForSelector("nav", { timeout: 15_000 });
  await page.getByRole("button", { name: "Program Board" }).click();

  // The card's iteration <select> is the keyboard move-path and carries a name.
  const move = page.getByRole("combobox", { name: /Move .*Ship the pipeline.* to iteration/i });
  await expect(move).toBeVisible({ timeout: 15_000 });

  await axeClean(page, "the PI Program Board");
});
