import { test, expect } from "@playwright/test";

// Role-switch journey — the header role switcher is cosmetic (the API is
// authoritative) but it drives which navigation a user sees. This walks the
// switch both ways and asserts the sidebar reshapes: a Stakeholder gets the
// reduced nav (My Projects / My Demands + delivery/releases/updates/help) with
// the full Workspace/Configuration items gone, and switching back to Platform
// Administrator restores them. Also asserts the footer identity follows the role.

test("role journey: switching to Stakeholder reduces the nav, switching back restores it", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector("nav", { timeout: 15_000 });

  const nav = page.locator("nav");
  const roleSelect = page.getByLabel("Role");

  // Default (PMO) shows the full Workspace + Configuration nav.
  await expect(nav.getByRole("link", { name: "Portfolio", exact: true })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Administration", exact: true })).toBeVisible();

  // Switch to Stakeholder.
  await roleSelect.selectOption({ label: "Stakeholder" });

  // Reduced nav appears…
  await expect(nav.getByRole("link", { name: "My Projects", exact: true })).toBeVisible();
  await expect(nav.getByRole("link", { name: "My Demands", exact: true })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Help & Support", exact: true })).toBeVisible();
  // …and the privileged items are gone.
  await expect(nav.getByRole("link", { name: "Portfolio", exact: true })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Administration", exact: true })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Demand Pipeline", exact: true })).toHaveCount(0);
  // The footer identity follows the selected role.
  await expect(page.getByText("Sofia Berg")).toBeVisible();

  // Switch back to the Platform Administrator — full nav returns.
  await roleSelect.selectOption({ label: "Platform Administrator" });
  await expect(nav.getByRole("link", { name: "Portfolio", exact: true })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Administration", exact: true })).toBeVisible();
  await expect(nav.getByRole("link", { name: "My Projects", exact: true })).toHaveCount(0);
});
