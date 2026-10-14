#!/usr/bin/env node
/**
 * SQL validation suite.
 *
 * Every check module exports `checks: [{ id, title, run({ db, dbPath }) }]`. Each check
 * runs against its own copy of a freshly seeded database so constraint probes cannot
 * influence each other. Results (including real pass/fail counts) are written to
 * test-reports/db-results.json and the process exits non-zero when a check fails.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { bootstrapDatabase, removeDatabase } from '../../app/server/src/db.js';
import { seedDatabase } from '../../app/server/src/seed.js';
import { PROJECT_ROOT } from './server-helper.mjs';

const CHECKS_DIR = path.dirname(fileURLToPath(import.meta.url));
const WORK_DIR = path.join(PROJECT_ROOT, '.data', 'db-checks');
const RESULTS_PATH = path.join(PROJECT_ROOT, 'test-reports', 'db-results.json');

async function loadChecks() {
  const files = fs
    .readdirSync(CHECKS_DIR)
    .filter((file) => file.endsWith('.mjs') && file !== 'run.mjs' && file !== 'server-helper.mjs')
    .sort();

  const checks = [];
  for (const file of files) {
    const module = await import(pathToFileURL(path.join(CHECKS_DIR, file)).href);
    for (const check of module.checks ?? []) checks.push({ ...check, file });
  }
  return checks;
}

function prepareTemplate() {
  fs.mkdirSync(WORK_DIR, { recursive: true });
  const templatePath = path.join(WORK_DIR, 'template.db');
  removeDatabase(templatePath);
  const db = bootstrapDatabase(templatePath, { fresh: true });
  const summary = seedDatabase(db);
  db.close();
  return { templatePath, summary };
}

async function main() {
  const startedAt = new Date().toISOString();
  const { templatePath, summary } = prepareTemplate();
  const checks = await loadChecks();
  const results = [];

  for (const [index, check] of checks.entries()) {
    const dbPath = path.join(WORK_DIR, `check-${String(index + 1).padStart(2, '0')}.db`);
    removeDatabase(dbPath);
    fs.copyFileSync(templatePath, dbPath);
    const db = bootstrapDatabase(dbPath, { fresh: false });
    const start = Date.now();
    try {
      const detail = await check.run({ db, dbPath, projectRoot: PROJECT_ROOT });
      results.push({
        id: check.id,
        title: check.title,
        status: 'passed',
        detail: detail ?? '',
        durationMs: Date.now() - start,
      });
      console.log(`PASS  ${check.id}  ${check.title}`);
      if (detail) console.log(`      ↳ ${detail}`);
    } catch (error) {
      results.push({
        id: check.id,
        title: check.title,
        status: 'failed',
        detail: String(error?.message ?? error),
        durationMs: Date.now() - start,
      });
      console.log(`FAIL  ${check.id}  ${check.title}`);
      console.log(`      ↳ ${String(error?.message ?? error).split('\n').join('\n        ')}`);
    } finally {
      db.close();
      removeDatabase(dbPath);
    }
  }

  const passed = results.filter((result) => result.status === 'passed').length;
  const failed = results.length - passed;
  const report = {
    suite: 'db',
    startedAt,
    finishedAt: new Date().toISOString(),
    seedSummary: summary,
    executed: results.length,
    passed,
    failed,
    results,
  };
  fs.mkdirSync(path.dirname(RESULTS_PATH), { recursive: true });
  fs.writeFileSync(RESULTS_PATH, `${JSON.stringify(report, null, 2)}\n`);

  console.log(`\nSQL validation: ${passed}/${results.length} checks passed (${failed} failed)`);
  console.log(`Report: ${path.relative(PROJECT_ROOT, RESULTS_PATH)}`);
  if (failed > 0) process.exitCode = 1;
}

await main();
