import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { PROJECT_ROOT } from '../app/server/src/db.js';

/**
 * Orchestrator: the only entry point CI needs.
 *
 *   1. reset + seed the test database (DB_PATH=.data/taskflow.test.db)
 *   2. start the API on PORT (default 4300) and wait for /api/v1/health
 *   3. run the API, UI, DB and Postman suites (raw logs captured)
 *   4. stop the server reliably (also on failure)
 *   5. write test-reports/summary.json + test-reports/execution-report-<date>.md
 *      via scripts/reports/build-report.mjs
 *
 * Usage: `npm run test:all` (add `--only=api,db` to run a subset).
 */
const PORT = Number(process.env.PORT || 4300);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const DB_PATH = process.env.DB_PATH || '.data/taskflow.test.db';
const LOG_DIR = path.join(PROJECT_ROOT, 'test-evidence', 'logs');
const PLAYWRIGHT_CLI = path.join(PROJECT_ROOT, 'node_modules', '@playwright', 'test', 'cli.js');

mkdirSync(LOG_DIR, { recursive: true });

const onlyArg = process.argv.find((arg) => arg.startsWith('--only='));
const only = onlyArg ? new Set(onlyArg.slice('--only='.length).split(',')) : null;
const shouldRun = (name) => !only || only.has(name);

function run(command, args, { env = {}, logFile } = {}) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(command, args, {
      cwd: PROJECT_ROOT,
      env: { ...process.env, ...env },
      windowsHide: true,
    });
    let output = '';
    child.stdout.on('data', (chunk) => {
      output += chunk;
      process.stdout.write(chunk);
    });
    child.stderr.on('data', (chunk) => {
      output += chunk;
      process.stderr.write(chunk);
    });
    child.on('close', (code) => {
      if (logFile) writeFileSync(path.join(LOG_DIR, logFile), output);
      resolve({ code: code ?? 1, output, durationMs: Date.now() - started });
    });
  });
}

async function isHealthy() {
  try {
    const res = await fetch(`${BASE_URL}/api/v1/health`, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

async function waitForHealth(timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isHealthy()) return true;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  return false;
}

const suites = [];

// 1) reset + seed the test database -------------------------------------------
console.log(`[run-tests] resetting ${DB_PATH}`);
const reset = spawnSync(process.execPath, ['scripts/reset-db.mjs'], {
  cwd: PROJECT_ROOT,
  env: { ...process.env, DB_PATH },
  encoding: 'utf8',
});
console.log(reset.stdout?.trim() ?? '');
if (reset.status !== 0) {
  console.error(reset.stderr);
  process.exit(1);
}

// 2) start the server ---------------------------------------------------------
console.log(`[run-tests] starting API on ${BASE_URL}`);
const serverChild = spawn(process.execPath, ['app/server/src/index.js'], {
  cwd: PROJECT_ROOT,
  env: { ...process.env, PORT: String(PORT), DB_PATH, NODE_ENV: 'test' },
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
});
let serverLog = '';
serverChild.stdout.on('data', (chunk) => {
  serverLog += chunk;
});
serverChild.stderr.on('data', (chunk) => {
  serverLog += chunk;
});

let exitCode = 0;
try {
  if (!(await waitForHealth())) {
    console.error('[run-tests] server did not become healthy - aborting');
    process.exit(1);
  }

  // 3) suites -----------------------------------------------------------------
  if (shouldRun('api')) {
    console.log('\n[run-tests] === API suite ===');
    const result = await run(
      process.execPath,
      [PLAYWRIGHT_CLI, 'test', '--project=api'],
      {
        env: { TF_JSON_REPORT: 'test-reports/playwright/api.json', CI: '' },
        logFile: 'api-suite.txt',
      }
    );
    suites.push({ name: 'api', command: 'npm run test:api', ...result, code: result.code });
    if (result.code !== 0) exitCode = 1;
  }

  if (shouldRun('ui')) {
    console.log('\n[run-tests] === UI suite ===');
    const result = await run(
      process.execPath,
      [PLAYWRIGHT_CLI, 'test', '--project=ui'],
      {
        env: { TF_JSON_REPORT: 'test-reports/playwright/ui.json', CI: '' },
        logFile: 'ui-suite.txt',
      }
    );
    suites.push({ name: 'ui', command: 'npm run test:ui', ...result });
    if (result.code !== 0) exitCode = 1;
  }

  if (shouldRun('db')) {
    console.log('\n[run-tests] === DB validation suite ===');
    const result = await run(process.execPath, ['tests/db/run.mjs'], {
      env: { DB_PATH },
      logFile: 'db-suite.txt',
    });
    suites.push({ name: 'db', command: 'npm run test:db', ...result });
    if (result.code !== 0) exitCode = 1;
  }

  if (shouldRun('postman')) {
    console.log('\n[run-tests] === Postman / newman suite ===');
    const result = await run(process.execPath, ['scripts/newman-run.mjs'], {
      env: { DB_PATH, PORT: String(PORT) },
      logFile: 'postman-suite.txt',
    });
    suites.push({ name: 'postman', command: 'npm run test:postman', ...result });
    if (result.code !== 0) exitCode = 1;
  }
} finally {
  // 4) stop the server --------------------------------------------------------
  console.log('\n[run-tests] stopping the API server');
  serverChild.kill();
  writeFileSync(path.join(LOG_DIR, 'server-under-test.txt'), serverLog);
}

// 5) report -------------------------------------------------------------------
console.log('\n[run-tests] building the execution report');
const report = await run(process.execPath, ['scripts/reports/build-report.mjs'], {
  env: { SUITE_RESULTS: JSON.stringify(suites.map(({ name, code, durationMs }) => ({ name, code, durationMs }))) },
  logFile: 'build-report.txt',
});
if (report.code !== 0) exitCode = 1;

console.log('\n[run-tests] done - results in test-reports/');
for (const suite of suites) {
  console.log(`  - ${suite.name}: exit ${suite.code} (${(suite.durationMs / 1000).toFixed(1)}s)`);
}
process.exit(exitCode);
