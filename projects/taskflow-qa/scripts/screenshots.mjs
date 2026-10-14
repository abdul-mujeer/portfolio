import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { PROJECT_ROOT } from '../app/server/src/db.js';

/**
 * Captures real console screenshots (never mockups) into
 * test-evidence/screenshots/ as JPEG quality 70:
 *   - desktop viewport 1440x900
 *   - mobile viewport 390x844
 *
 * Runs against its own seeded database on port 4310 so evidence is stable and
 * the demo/test databases are not polluted.
 */
const PORT = 4310;
const DB_PATH = '.data/taskflow.screenshots.db';
const BASE_URL = `http://127.0.0.1:${PORT}`;
const OUT_DIR = path.join(PROJECT_ROOT, 'test-evidence', 'screenshots');

mkdirSync(OUT_DIR, { recursive: true });

// 1) fresh seeded database
const reset = spawnSync(process.execPath, ['scripts/reset-db.mjs'], {
  cwd: PROJECT_ROOT,
  env: { ...process.env, DB_PATH },
  encoding: 'utf8',
});
if (reset.status !== 0) {
  console.error(reset.stderr);
  process.exit(1);
}

// 2) server
const server = spawn(process.execPath, ['app/server/src/index.js'], {
  cwd: PROJECT_ROOT,
  env: { ...process.env, PORT: String(PORT), DB_PATH, NODE_ENV: 'test' },
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
});
server.stderr.on('data', (chunk) => process.stderr.write(`[screenshots-server] ${chunk}`));

async function waitForHealth(timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE_URL}/api/v1/health`, { signal: AbortSignal.timeout(1500) });
      if (res.ok) return true;
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  return false;
}

if (!(await waitForHealth())) {
  console.error('[screenshots] server not healthy');
  server.kill();
  process.exit(1);
}

const browser = await chromium.launch();
const captured = [];

async function shot(page, name) {
  const file = path.join(OUT_DIR, name);
  await page.screenshot({ path: file, type: 'jpeg', quality: 70 });
  captured.push(path.relative(PROJECT_ROOT, file).replaceAll('\\', '/'));
  console.log(`[screenshots] ${name}`);
}

try {
  // ---------------------------------------------------------- desktop 1440x900
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await desktop.newPage();

  await page.goto(BASE_URL);
  await page.getByTestId('login-email').waitFor();
  await shot(page, 'login-1440x900.jpg');

  await page.getByTestId('login-email').fill('owner@example.com');
  await page.getByTestId('login-password').fill('Owner#12345');
  await page.getByTestId('login-submit').click();
  await page.getByTestId('board').waitFor();
  await page.getByTestId('board-status').waitFor();
  await shot(page, 'board-1440x900.jpg');

  // task modal with comments
  await page
    .getByTestId('task-card')
    .filter({ hasText: 'Set up CI pipeline' })
    .first()
    .click();
  await page.getByTestId('task-modal').waitFor();
  await page.getByTestId('comment-list').waitFor();
  await shot(page, 'task-modal-1440x900.jpg');
  await page.locator('#comments-section').scrollIntoViewIfNeeded();
  await shot(page, 'comments-1440x900.jpg');
  await page.getByTestId('modal-close').click();
  await page.getByTestId('task-modal').waitFor({ state: 'hidden' });

  // overdue filter
  await page.getByTestId('filter-overdue').check();
  await page.getByTestId('filter-apply').click();
  await page.getByTestId('board-status').waitFor();
  await shot(page, 'overdue-filter-1440x900.jpg');
  await page.getByTestId('filter-reset').click();

  // validation error banner
  await page.getByTestId('task-create-button').click();
  await page.getByTestId('task-title').fill('ab');
  await page.getByTestId('task-save').click();
  await page.getByTestId('error-banner').waitFor();
  await shot(page, 'validation-error-1440x900.jpg');

  await desktop.close();

  // ----------------------------------------------------------- mobile 390x844
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const mobilePage = await mobile.newPage();
  await mobilePage.goto(BASE_URL);
  await mobilePage.getByTestId('login-email').waitFor();
  await shot(mobilePage, 'login-390x844.jpg');
  await mobilePage.getByTestId('login-email').fill('owner@example.com');
  await mobilePage.getByTestId('login-password').fill('Owner#12345');
  await mobilePage.getByTestId('login-submit').click();
  await mobilePage.getByTestId('board').waitFor();
  await mobilePage.getByTestId('board-status').waitFor();
  await shot(mobilePage, 'board-390x844.jpg');
  await mobilePage
    .getByTestId('task-card')
    .filter({ hasText: 'Set up CI pipeline' })
    .first()
    .click();
  await mobilePage.getByTestId('task-modal').waitFor();
  await shot(mobilePage, 'task-modal-390x844.jpg');
  await mobile.close();
} finally {
  await browser.close();
  server.kill();
}

console.log(`[screenshots] captured ${captured.length} files into test-evidence/screenshots/`);
