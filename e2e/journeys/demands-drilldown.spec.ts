import { test, expect, type Route } from "@playwright/test";

// Demand drill-in journey (mocked API) — the only backend-dependent flow, so the
// `/api/v1/*` surface it touches is stubbed with page.route(). This proves a real
// data → render → interact → outcome path that the empty-state runs can't:
//   land on the Demand Pipeline → the seeded demand renders in its funnel column
//   → click the card → the detail modal opens with the full intake record
//   → close it. Deterministic, no drag-and-drop, no live backend.

const DEMAND = {
  id: "D-4021",
  title: "Self-service returns portal",
  stage: "backlog",
  priority: "High",
  value: 4,
  effort: 2,
  requester: "Sofia Berg",
  dept: "Retail Ops",
  date: "2026-07-01",
};

const DETAIL = {
  ...DEMAND,
  description: "Let customers initiate returns online without contacting support.",
  source: "business",
  geoImpact: ["Sweden", "Norway"],
  hasDeadline: false,
  businessProblem: "Support is overwhelmed by manual return requests.",
  improvementExisting: true,
  criticality: 4,
  risk: 3,
  expectedBenefits: "Cut support load and speed up refunds.",
  benefitValue: 4,
  stakeholders: ["Sofia Berg"],
  allStakeholders: true,
  attachments: [],
  canDelete: false,
};

async function json(route: Route, body: unknown) {
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
}

test("demand journey: a demand renders in the funnel and opens its detail", async ({ page }) => {
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/.*\/api\/v1/, "");
    if (path === "/demands") return json(route, [DEMAND]);
    if (path === `/demands/${DEMAND.id}`) return json(route, DETAIL);
    if (path === `/demands/${DEMAND.id}/comments`) return json(route, { canComment: false, comments: [] });
    if (path === "/roles") return json(route, { roles: [] });
    // Sensible default for anything else the shell polls (notifications, etc.).
    return json(route, []);
  });

  await page.goto("/demands");
  await page.waitForSelector("nav", { timeout: 15_000 });

  // The seeded demand renders as a card in the funnel.
  const card = page.getByText(DEMAND.title, { exact: true });
  await expect(card).toBeVisible();
  // Its code and requester are shown on the card.
  await expect(page.getByText(DEMAND.id, { exact: true }).first()).toBeVisible();

  // Drill in — the detail modal opens with the full intake record.
  await card.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(DEMAND.title, { exact: true })).toBeVisible();
  await expect(dialog.getByText("Support is overwhelmed by manual return requests.")).toBeVisible();
  await expect(dialog.getByText("Sweden, Norway")).toBeVisible();

  // Close it.
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
