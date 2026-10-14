import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PC_TEST_PORT ?? 4200);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const DB_PATH = process.env.PC_TEST_DB ?? '.data/peoplecore.test.db';
/**
 * The orchestrator (scripts/run-tests.mjs) points this at one file per suite so that the
 * report can tell the API run and the UI run apart.
 */
const JSON_REPORT = process.env.PLAYWRIGHT_JSON_OUTPUT_NAME ?? 'test-reports/playwright/results.json';

/**
 * One runner for both suites. The webServer block boots the real Express app on the
 * test database (never the development one) so `playwright test` is self-contained;
 * `scripts/run-tests.mjs` reuses exactly the same configuration.
 */
export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ['list'],
    ['json', { outputFile: JSON_REPORT }],
    ['html', { outputFolder: 'test-reports/playwright/html', open: 'never' }],
  ],
  use: {
    baseURL: BASE_URL,
    testIdAttribute: 'data-testid',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    extraHTTPHeaders: { Accept: 'application/json, text/html;q=0.9' },
  },
  webServer: {
    // Resets + seeds the test database first so `npx playwright test` is always
    // self-contained; the application never touches the development database.
    command: `node scripts/reset-db.mjs --db "${DB_PATH}" --quiet && node app/server/src/index.js`,
    url: `${BASE_URL}/api/health`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      PORT: String(PORT),
      HOST: '127.0.0.1',
      NODE_ENV: 'test',
      DB_PATH,
      SEED_DEFECTS: '0',
    },
  },
  projects: [
    {
      name: 'api',
      testDir: './tests/api',
      use: { baseURL: BASE_URL },
    },
    {
      name: 'ui',
      testDir: './tests/ui',
      use: { ...devices['Desktop Chrome'], baseURL: BASE_URL },
    },
  ],
});
