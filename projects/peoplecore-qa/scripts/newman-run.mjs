#!/usr/bin/env node
/**
 * Boots the application on a private port with its own freshly seeded database, waits
 * for /api/health, runs the committed Postman collection with newman and stores the
 * raw newman JSON report under test-reports/newman/.
 *
 *   npm run test:postman
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import newman from 'newman';
import { bootstrapDatabase } from '../app/server/src/db.js';
import { seedDatabase } from '../app/server/src/seed.js';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COLLECTION = path.join(PROJECT_ROOT, 'postman', 'PeopleCore-API.postman_collection.json');
const ENVIRONMENT = path.join(PROJECT_ROOT, 'postman', 'PeopleCore-Env.postman_environment.template.json');
const REPORT_DIR = path.join(PROJECT_ROOT, 'test-reports', 'newman');
const REPORT_PATH = path.join(REPORT_DIR, 'newman-report.json');
const PORT = Number(process.env.PC_NEWMAN_PORT ?? 4210);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const DB_PATH = process.env.PC_NEWMAN_DB ?? path.join(PROJECT_ROOT, '.data', 'peoplecore.newman.db');

function seedFreshDatabase() {
  fs.rmSync(DB_PATH, { force: true });
  const db = bootstrapDatabase(DB_PATH, { fresh: true });
  const summary = seedDatabase(db);
  db.close();
  return summary;
}

async function waitForHealth(timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE_URL}/api/health`);
      if (response.ok) return (await response.json()).employees;
    } catch {
      /* server not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`PeopleCore did not answer /api/health on ${BASE_URL} within ${timeoutMs}ms`);
}

function startServer() {
  const child = spawn(process.execPath, ['app/server/src/index.js'], {
    cwd: PROJECT_ROOT,
    env: {
      ...process.env,
      PORT: String(PORT),
      HOST: '127.0.0.1',
      NODE_ENV: 'test',
      DB_PATH,
      SEED_DEFECTS: '0',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (chunk) => process.stdout.write(`[server] ${chunk}`));
  child.stderr.on('data', (chunk) => process.stderr.write(`[server] ${chunk}`));
  return child;
}

function runNewman() {
  return new Promise((resolve) => {
    newman.run(
      {
        collection: COLLECTION,
        environment: ENVIRONMENT,
        envVar: [{ key: 'baseUrl', value: BASE_URL }],
        reporters: ['cli', 'json'],
        reporter: { json: { export: REPORT_PATH } },
        timeoutRequest: 15_000,
        bail: false,
      },
      (error, summary) => resolve({ error, summary }),
    );
  });
}

const summary = seedFreshDatabase();
console.log(`[newman] seeded ${DB_PATH} (${JSON.stringify(summary)})`);
const server = startServer();
let exitCode = 0;

try {
  const employees = await waitForHealth();
  console.log(`[newman] server healthy on ${BASE_URL} with ${employees} employees — running the collection`);
  const { error, summary: runSummary } = await runNewman();
  if (error) throw error;

  const stats = runSummary.run.stats;
  const assertions = stats.assertions;
  const requests = stats.requests;
  console.log(
    `[newman] requests ${requests.total} (failed ${requests.failed}) · assertions ${assertions.total} (failed ${assertions.failed})`,
  );
  if (assertions.failed > 0) {
    const failures = runSummary.run.failures ?? [];
    for (const failure of failures.slice(0, 10)) {
      console.log(`[newman] FAILED: ${failure.source?.name ?? 'request'} → ${failure.error?.test ?? failure.error?.message}`);
    }
  }
  console.log(`[newman] JSON report: ${path.relative(PROJECT_ROOT, REPORT_PATH)}`);
  exitCode = assertions.failed > 0 || requests.failed > 0 ? 1 : 0;
} catch (error) {
  console.error('[newman] run failed:', error.message);
  exitCode = 1;
} finally {
  server.kill();
}

process.exitCode = exitCode;
