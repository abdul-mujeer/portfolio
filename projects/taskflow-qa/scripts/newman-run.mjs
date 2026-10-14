import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { PROJECT_ROOT } from '../app/server/src/db.js';

/**
 * Runs the committed Postman collection with newman.
 *
 * - Reuses a healthy server on PORT when one is already running (orchestrator),
 *   otherwise boots `app/server/src/index.js` on the test DB and stops it again.
 * - Writes the full newman JSON report + a compact summary to test-reports/newman/.
 */
const PORT = Number(process.env.PORT || 4300);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const DB_PATH = process.env.DB_PATH || '.data/taskflow.test.db';
const REPORT_DIR = path.join(PROJECT_ROOT, 'test-reports', 'newman');

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

let serverChild = null;
if (await isHealthy()) {
  console.log(`[newman] reusing the server already listening on ${BASE_URL}`);
} else {
  console.log(`[newman] no server on ${BASE_URL} - booting one on ${DB_PATH}`);
  serverChild = spawn(process.execPath, ['app/server/src/index.js'], {
    cwd: PROJECT_ROOT,
    env: { ...process.env, PORT: String(PORT), DB_PATH, NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  serverChild.stdout.on('data', (chunk) => process.stdout.write(`[server] ${chunk}`));
  serverChild.stderr.on('data', (chunk) => process.stderr.write(`[server] ${chunk}`));
  if (!(await waitForHealth())) {
    console.error('[newman] server did not become healthy in time');
    serverChild.kill();
    process.exit(1);
  }
}

mkdirSync(REPORT_DIR, { recursive: true });

const { default: newman } = await import('newman');
const collectionPath = path.join(PROJECT_ROOT, 'postman', 'TaskFlow-API.postman_collection.json');
const environmentPath = path.join(
  PROJECT_ROOT,
  'postman',
  'TaskFlow-Env.postman_environment.template.json'
);
const environment = JSON.parse(readFileSync(environmentPath, 'utf8'));
environment.values = environment.values.map((entry) =>
  entry.key === 'baseUrl' ? { ...entry, value: BASE_URL } : entry
);

const reportPath = path.join(REPORT_DIR, 'newman-report.json');

const run = await new Promise((resolve, reject) => {
  newman.run(
    {
      collection: collectionPath,
      environment,
      reporters: ['cli', 'json'],
      reporter: { json: { export: reportPath } },
      workingDir: PROJECT_ROOT,
      timeoutRequest: 15000,
    },
    (error, summary) => {
      if (error) reject(error);
      else resolve(summary);
    }
  );
});

const requests = run.run.stats?.requests ?? { total: 0, failed: 0 };
const assertions = run.run.stats?.assertions ?? { total: 0, failed: 0 };
const failures = (run.run.failures ?? []).map((failure) => ({
  source: failure.source?.name ?? failure.error?.test ?? 'unknown',
  message: failure.error?.message ?? failure.error?.name ?? 'unknown failure',
}));

const compact = {
  suite: 'postman',
  executedAt: new Date().toISOString(),
  baseUrl: BASE_URL,
  database: DB_PATH,
  collectionFile: path.relative(PROJECT_ROOT, collectionPath),
  requests: { total: requests.total, failed: requests.failed },
  assertions: { total: assertions.total, failed: assertions.failed },
  durationMs: run.run.timings?.completed ? run.run.timings.completed - run.run.timings.started : null,
  failures,
};

writeFileSync(path.join(REPORT_DIR, 'newman-summary.json'), `${JSON.stringify(compact, null, 2)}\n`);

if (serverChild) {
  serverChild.kill();
}

const failed = assertions.failed + requests.failed;
console.log(
  `[newman] requests ${requests.total} (failed ${requests.failed}) - assertions ${assertions.total} (failed ${assertions.failed})`
);
process.exit(failed === 0 ? 0 : 1);
