import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";

// A pre-installed Chromium (this dev sandbox) — used when present so the sweep
// runs without downloading a browser. In CI the file won't exist, so Playwright
// falls back to its own installed browser (`npx playwright install chromium`).
const SANDBOX_CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const executablePath = existsSync(SANDBOX_CHROME) ? SANDBOX_CHROME : undefined;

// Full-page accessibility sweep (axe) against the built app served by
// `vite preview`. Runs with no backend, so screens render their empty states —
// enough to exercise real DOM + computed styles that jsdom can't (ADR-0026 → 0033).
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // A single full-page axe run alone takes ~24s, so the 30s default is too tight
  // once several heavy tabs share one preview server. 60s gives headroom without
  // masking real hangs.
  timeout: 60_000,
  reporter: "list",
  use: {
    baseURL: "http://localhost:4173",
    ...devices["Desktop Chrome"],
    launchOptions: { executablePath },
  },
  webServer: {
    command: "npm run preview -- --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
