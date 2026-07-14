import { test, expect, type Route, type Page, type Locator } from "@playwright/test";

// End-to-end drag coverage for the two native-HTML5 drag boards — the project
// Tasks (Kanban) board and the PI Program Board. Playwright's mouse-based dragTo
// doesn't reliably fire native DnD, so we dispatch the real dragstart/dragover/
// drop events with a shared DataTransfer (the recipe the React handlers expect),
// then assert BOTH the persisted mutation (PATCH/PUT) fires with the right body
// AND the card lands in its new column/cell after the board refetches. The mocks
// are stateful so the refetch reflects the move.

async function json(route: Route, body: unknown) {
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
}

// Fire a native drag from `source` onto `target` with one shared DataTransfer,
// so a handler that stashes the id on dragstart can read it back on drop.
async function drag(page: Page, source: Locator, target: Locator) {
  const dt = await page.evaluateHandle(() => new DataTransfer());
  await source.dispatchEvent("dragstart", { dataTransfer: dt });
  await target.dispatchEvent("dragover", { dataTransfer: dt });
  await target.dispatchEvent("drop", { dataTransfer: dt });
}

test("drag: Tasks Kanban card moves column and persists the status", async ({ page }) => {
  const PID = "PRJ-DRAG";
  const project = {
    id: PID, name: "Drag Fixture", dept: "Dev", owner: "PM", methodology: "Scrum",
    status: "green", health: "On track", progress: 40, phase: "Delivery", budget: 0, spent: 0, due: "TBD",
  };
  // Stateful single task so the post-move refetch reflects its new column.
  const tasks = [{ id: 1, code: "T-1", name: "Draft the API contract", epic: "", assignee: "Sofia", sprint: "S1", baseline: "S1", status: "To Do", priority: "High", points: 3, size: "M" }];
  let patched: { id: string; body: unknown } | null = null;

  await page.route("**/api/v1/**", async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname.replace(/.*\/api\/v1/, "");
    if (path === "/roles") return json(route, { roles: [] });
    if (path === `/projects/${PID}`) return json(route, project);
    if (path === `/projects/${PID}/tasks`) return json(route, { canEdit: true, canCreate: true, canMove: true, tasks });
    const m = path.match(/^\/tasks\/(\d+)$/);
    if (m && req.method() === "PATCH") {
      const body = JSON.parse(req.postData() || "{}");
      patched = { id: m[1], body };
      const t = tasks.find((x) => x.id === Number(m[1]));
      if (t && typeof body.status === "string") t.status = body.status;   // stateful move
      return json(route, t ?? {});
    }
    return json(route, []);
  });

  await page.goto(`/project?id=${PID}&tab=tasks`);
  await page.waitForSelector("nav", { timeout: 15_000 });

  const todo = page.locator('[data-col="To Do"]');
  const inProgress = page.locator('[data-col="In Progress"]');
  const card = page.getByRole("button", { name: /T-1 Draft the API contract/ });
  await expect(card).toBeVisible({ timeout: 15_000 });
  await expect(todo.getByText("Draft the API contract")).toBeVisible();

  await drag(page, card, inProgress);

  // The status-change PATCH fired with the target column…
  await expect.poll(() => patched, { timeout: 10_000 }).not.toBeNull();
  expect(patched!.id).toBe("1");
  expect(patched!.body).toMatchObject({ status: "In Progress" });
  // …and after the refetch the card now lives under In Progress, not To Do.
  await expect(inProgress.getByText("Draft the API contract")).toBeVisible({ timeout: 10_000 });
  await expect(todo.getByText("Draft the API contract")).toHaveCount(0);
});

test("drag: PI Program Board card drops into an iteration and persists the placement", async ({ page }) => {
  const increments = { canEdit: true, increments: [
    { id: 1, key: "PI-1", name: "PI 2026.Q3", startDate: "2026-07-01", endDate: "2026-09-30", state: "Active", objectives: 1, iterations: 1, dependencies: 0 },
  ] };
  const detail = {
    id: 1, key: "PI-1", name: "PI 2026.Q3", startDate: "2026-07-01", endDate: "2026-09-30", state: "Active", canEdit: true,
    iterationList: [{ id: 11, name: "Iteration 1", startDate: "2026-07-01", endDate: "2026-07-14", capacity: 100, load: 40 }],
    objectiveList: [{ id: 101, title: "Ship the pipeline", description: "", entityType: "project", entityId: "PRJ-1", entityName: "Alpha", businessValue: 8, actualValue: 0, committed: true, confidence: 4, status: "Planned" }],
    dependencyList: [], targets: [],
  };
  const placements: Record<string, number> = {};   // starts unplaced (Unscheduled)
  let put: unknown = null;

  await page.route("**/api/v1/**", async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname.replace(/.*\/api\/v1/, "");
    if (path === "/roles") return json(route, { roles: [] });
    if (path === "/increments") return json(route, increments);
    if (path === "/increments/1") return json(route, detail);
    if (path === "/increments/1/board") return json(route, { canEdit: true, placements });
    if (path === "/increments/1/board/placement" && req.method() === "PUT") {
      const body = JSON.parse(req.postData() || "{}");
      put = body;
      if (typeof body.objectiveId === "number") placements[String(body.objectiveId)] = body.iterationId;   // stateful
      return json(route, { ok: true });
    }
    return json(route, []);
  });

  await page.goto("/pi-planning");
  await page.waitForSelector("nav", { timeout: 15_000 });
  await page.getByRole("button", { name: "Program Board" }).click();

  const card = page.locator('[data-obj="101"]');
  await expect(card).toBeVisible({ timeout: 15_000 });
  // Initially in the Unscheduled tray for its lane.
  await expect(page.locator('[data-cell="project:PRJ-1:nil"] [data-obj="101"]')).toBeVisible();

  await drag(page, card, page.locator('[data-cell="project:PRJ-1:11"]'));

  await expect.poll(() => put, { timeout: 10_000 }).not.toBeNull();
  expect(put).toMatchObject({ objectiveId: 101, iterationId: 11 });
  // After the refetch the card sits in Iteration 1's cell, not Unscheduled.
  await expect(page.locator('[data-cell="project:PRJ-1:11"] [data-obj="101"]')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('[data-cell="project:PRJ-1:nil"] [data-obj="101"]')).toHaveCount(0);
});
