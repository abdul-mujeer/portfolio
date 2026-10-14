#!/usr/bin/env node
/**
 * Captures evidence screenshots from the RUNNING application (never mockups).
 * The app is booted on a private port with its own freshly seeded database.
 *
 *   npm run screenshots
 *
 * Desktop shots: 1440x900 · mobile shots: 390x844 · JPEG quality 70.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { bootstrapDatabase } from '../app/server/src/db.js';
import { seedDatabase } from '../app/server/src/seed.js';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(PROJECT_ROOT, 'test-evidence', 'screenshots');
const PORT = Number(process.env.PC_SHOTS_PORT ?? 4220);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const DB_PATH = path.join(PROJECT_ROOT, '.data', 'peoplecore.screenshots.db');

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };
const JPEG = { type: 'jpeg', quality: 70 };

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.rmSync(DB_PATH, { force: true });
const db = bootstrapDatabase(DB_PATH, { fresh: true });
const summary = seedDatabase(db);
db.close();

const server = spawn(process.execPath, ['app/server/src/index.js'], {
  cwd: PROJECT_ROOT,
  env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', NODE_ENV: 'test', DB_PATH, SEED_DEFECTS: '0' },
  stdio: ['ignore', 'pipe', 'pipe'],
});

async function waitForHealth(timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE_URL}/api/health`);
      if (response.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('PeopleCore did not become healthy in time');
}

async function login(page, email, password) {
  await page.goto(`${BASE_URL}/login`);
  await page.getByTestId('login-email').fill(email);
  await page.getByTestId('login-password').fill(password);
  await page.getByTestId('login-submit').click();
  await page.waitForURL(/\/dashboard$/);
}

const captured = [];

async function shoot(page, name, options = {}) {
  const file = path.join(OUT_DIR, `${name}.jpg`);
  await page.screenshot({ path: file, ...JPEG, fullPage: false, ...options });
  const stats = fs.statSync(file);
  captured.push({ file: path.relative(PROJECT_ROOT, file), bytes: stats.size });
  console.log(`[shots] ${path.relative(PROJECT_ROOT, file)} (${Math.round(stats.size / 1024)} kB)`);
}

let exitCode = 0;
let browser;

try {
  await waitForHealth();
  browser = await chromium.launch();

  /* ---------------------------------------------------------------- desktop */
  const desktop = await browser.newContext({ viewport: DESKTOP, deviceScaleFactor: 1 });
  const page = await desktop.newPage();

  await page.goto(`${BASE_URL}/login`);
  await shoot(page, '01-login');

  await login(page, 'admin@example.com', 'Admin#12345');
  await shoot(page, '02-dashboard-admin');

  await page.goto(`${BASE_URL}/employees`);
  await shoot(page, '03-employees-list');

  await page.goto(`${BASE_URL}/employees/4`);
  await shoot(page, '04-employee-detail-attendance');

  await page.goto(`${BASE_URL}/employees/4?tab=leave`);
  await shoot(page, '05-employee-detail-leave');

  await page.goto(`${BASE_URL}/audit`);
  await shoot(page, '06-audit-log');

  await desktop.close();

  // Employee submits a leave request, then the manager reviews it: a real workflow.
  const employeeContext = await browser.newContext({ viewport: DESKTOP, deviceScaleFactor: 1 });
  const employeePage = await employeeContext.newPage();
  await login(employeePage, 'employee1@example.com', 'Employee#1234');
  await employeePage.goto(`${BASE_URL}/leave`);
  const start = new Date();
  start.setDate(start.getDate() + 200);
  const end = new Date(start);
  end.setDate(end.getDate() + 2);
  const iso = (date) => date.toISOString().slice(0, 10);
  await employeePage.getByTestId('leave-form-type').selectOption('ANNUAL');
  await employeePage.getByTestId('leave-form-start').fill(iso(start));
  await employeePage.getByTestId('leave-form-end').fill(iso(end));
  await employeePage.getByTestId('leave-form-reason').fill('Screenshot evidence run: annual leave request.');
  await employeePage.getByTestId('leave-form-submit').click();
  await employeePage.waitForURL(/submitted=1/);
  await shoot(employeePage, '07-leave-submitted-employee');

  // 403 page for the employee role.
  await employeePage.goto(`${BASE_URL}/audit`);
  await shoot(employeePage, '08-forbidden-403-employee');
  await employeeContext.close();

  const managerContext = await browser.newContext({ viewport: DESKTOP, deviceScaleFactor: 1 });
  const managerPage = await managerContext.newPage();
  await login(managerPage, 'manager@example.com', 'Manager#12345');
  await managerPage.goto(`${BASE_URL}/leave`);
  await managerPage.getByTestId('review-queue').waitFor();
  await shoot(managerPage, '09-leave-review-queue-manager');
  await managerContext.close();

  /* ----------------------------------------------------------------- mobile */
  const mobile = await browser.newContext({ viewport: MOBILE, deviceScaleFactor: 2 });
  const mobilePage = await mobile.newPage();
  await mobilePage.goto(`${BASE_URL}/login`);
  await shoot(mobilePage, '10-mobile-login');
  await login(mobilePage, 'admin@example.com', 'Admin#12345');
  await shoot(mobilePage, '11-mobile-dashboard');
  await mobilePage.goto(`${BASE_URL}/employees`);
  await shoot(mobilePage, '12-mobile-employees-list');
  await mobile.close();
} catch (error) {
  console.error('[shots] failed:', error.message);
  exitCode = 1;
} finally {
  if (browser) await browser.close();
  server.kill();
  fs.writeFileSync(
    path.join(OUT_DIR, 'screenshots.json'),
    `${JSON.stringify({ capturedAt: new Date().toISOString(), baseUrl: BASE_URL, seed: summary, captured }, null, 2)}\n`,
  );
}

process.exitCode = exitCode;
