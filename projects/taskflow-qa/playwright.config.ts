import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PORT || 4300);
const BASE_URL = `http://127.0.0.1:${PORT}`;

/**
 * Playwright configuration for both suites:
 *  - `api` : APIRequestContext tests in tests/api
 *  - `ui`  : browser tests in tests/ui (data-testid driven)
 *
 * The webServer command resets `.data/taskflow.test.db` to the deterministic
 * seeded state and boots the API. When scripts/run-tests.mjs already started a
 * server on the same port, Playwright reuses it (no second reset mid-run).
 *
 * NOTE: stop `npm run dev` before running suites - the dev server uses the demo
 * database on the same port and would be reused.
 */
export default defineConfig({
  testDir: 'tests',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: [
    ['list'],
    // scripts/run-tests.mjs sets TF_JSON_REPORT per suite (api.json / ui.json);
    // standalone runs write the shared results.json.
    ['json', { outputFile: process.env.TF_JSON_REPORT ?? 'test-reports/playwright/results.json' }],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  webServer: {
    command: 'node scripts/start-test-server.mjs',
    url: `${BASE_URL}/api/v1/health`,
    reuseExistingServer: true,
    timeout: 60_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
  projects: [
    {
      name: 'api',
      testDir: 'tests/api',
      use: { baseURL: BASE_URL },
    },
    {
      name: 'ui',
      testDir: 'tests/ui',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: BASE_URL,
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
});
