import { defineConfig, devices } from "@playwright/test";

/**
 * ShopSure QA — Playwright configuration.
 *
 * Two projects:
 *  - `api`       : API tests that only need the HTTP server (no browser).
 *  - `chromium`  : UI tests that need the built web app served by the same Express server.
 *
 * The web app must be built once (`npm run build`) before UI tests run; the API server itself
 * serves the compiled SPA from app/web/dist.
 *
 * The server is started by scripts/serve.mjs which:
 *   - resets the E2E database to a known seeded state,
 *   - boots Express on E2E_PORT with DB_PATH=.data/shopsure.e2e.db.
 */
const PORT = Number(process.env.E2E_PORT || 4180);
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "tests",
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  reporter: [
    ["list"],
    ["json", { outputFile: process.env.PW_JSON_OUTPUT || "test-reports/playwright/results.json" }],
    ["html", { outputFolder: process.env.PW_HTML_OUTPUT || "test-reports/playwright/html", open: "never" }],
  ],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    actionTimeout: 10_000,
  },
  webServer: {
    command: "node scripts/serve.mjs --reset",
    url: `${BASE_URL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      PORT: String(PORT),
      DB_PATH: ".data/shopsure.e2e.db",
      NODE_ENV: "test",
      APP_SECRET: "e2e-test-secret-not-a-real-secret",
      SEED_DEFECTS: process.env.SEED_DEFECTS || "0",
    },
  },
  projects: [
    {
      name: "api",
      testDir: "tests/api",
      use: { baseURL: BASE_URL },
    },
    {
      name: "chromium",
      testDir: "tests/ui",
      use: { ...devices["Desktop Chrome"], baseURL: BASE_URL, viewport: { width: 1440, height: 900 } },
    },
  ],
});
