import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { once } from 'node:events';
import path from 'node:path';
import { openDb, ensureSchema, PROJECT_ROOT } from '../app/server/src/db.js';
import { createApp } from '../app/server/src/app.js';

/**
 * Reproducible detection run for the two SEEDED defects (SEED_DEFECTS=1),
 * documented in test-documentation/seeded-defects.md.
 *
 * The demo boots a clean seeded database ONCE and runs the same probes twice:
 *   run A: SEED_DEFECTS=0  -> correct behaviour (baseline)
 *   run B: SEED_DEFECTS=1  -> the seeded defects are active and detected
 *
 * Evidence is saved to test-evidence/seeded-defects/:
 *   detection-run.json + detection-run.txt
 */
const DB_PATH = '.data/taskflow.seeded.db';
const OUT_DIR = path.join(PROJECT_ROOT, 'test-evidence', 'seeded-defects');
mkdirSync(OUT_DIR, { recursive: true });

const reset = spawnSync(process.execPath, ['scripts/reset-db.mjs'], {
  cwd: PROJECT_ROOT,
  env: { ...process.env, DB_PATH, SEED_DEFECTS: '0' },
  encoding: 'utf8',
});
if (reset.status !== 0) {
  console.error(reset.stderr);
  process.exit(1);
}

const db = openDb(DB_PATH);
ensureSchema(db);
const app = createApp({ db, secret: 'taskflow-seeded-demo-secret', isProduction: false });
const server = app.listen(0);
await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}/api/v1`;

const lines = [];
function log(text) {
  lines.push(text);
  console.log(text);
}

async function req(method, pathname, { body, cookie } = {}) {
  const res = await fetch(`${base}${pathname}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null;
  const text = await res.text();
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }
  return { status: res.status, json };
}

// login helper that keeps the session cookie
async function cookieFor(email, password) {
  const res = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const cookies = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  return (cookies[0] ?? res.headers.get('set-cookie') ?? '').split(';')[0];
}

async function probes() {
  const owner = await cookieFor('owner@example.com', 'Owner#12345');

  // Probe 1: overdue report must contain exactly the 3 seeded overdue tasks
  // (task due TODAY must not be counted - business rule 7).
  const overdue = await req('GET', '/reports/overdue', { cookie: owner });

  // Probe 2: DONE must be terminal (DONE -> IN_PROGRESS must be 422).
  // Drive a fresh task to DONE through the legal chain first.
  const project = await req('POST', '/projects', {
    body: { key: `SD${Date.now().toString(36).toUpperCase().replace(/[0-9]/g, 'X').slice(-4)}`, name: 'Seeded defect probe' },
    cookie: owner,
  });
  const task = await req('POST', `/projects/${project.json.id}/tasks`, {
    body: { title: 'Terminal-state probe' },
    cookie: owner,
  });
  let chain = [];
  for (const status of ['IN_PROGRESS', 'IN_REVIEW', 'DONE']) {
    const res = await req('PATCH', `/tasks/${task.json.id}/status`, { body: { status }, cookie: owner });
    chain.push(`${status}:${res.status}`);
  }
  const backFromDone = await req('PATCH', `/tasks/${task.json.id}/status`, {
    body: { status: 'IN_PROGRESS' },
    cookie: owner,
  });

  return {
    overdueCount: overdue.json?.count,
    overdueIds: overdue.json?.data?.map((t) => t.id),
    doneChain: chain.join(' -> '),
    transitionAfterDone: backFromDone.status,
  };
}

log('=== SEEDED DEFECT DETECTION RUN ===');
log('Database: ' + DB_PATH + ' (freshly seeded, SEED_DEFECTS=0 at seed time)');

// Expected values computed straight from SQL for the owner scope so the demo
// stays correct even if the run crosses UTC midnight after seeding.
const todayIso = new Date().toISOString().slice(0, 10);
const sqlOverdue = (operator) =>
  db
    .prepare(
      `SELECT COUNT(*) AS c FROM tasks t
       JOIN projects p ON p.id = t.project_id
       JOIN project_members m ON m.project_id = p.id AND m.user_id = 1
       WHERE p.archived = 0 AND t.due_date IS NOT NULL AND t.due_date ${operator} ?
         AND t.status NOT IN ('DONE', 'CANCELED')`
    )
    .get(todayIso).c;
const expectedCleanOverdue = sqlOverdue('<');
const expectedSeededOverdue = sqlOverdue('<=');

process.env.SEED_DEFECTS = '0';
log('\n--- Baseline (SEED_DEFECTS=0): correct behaviour expected ---');
const clean = await probes();
log(`overdue count = ${clean.overdueCount} (SQL strict "<" expectation: ${expectedCleanOverdue})`);
log(`overdue ids = ${clean.overdueIds}`);
log(`DONE chain: ${clean.doneChain}`);
log(`DONE -> IN_PROGRESS = ${clean.transitionAfterDone} (expected 422)`);

process.env.SEED_DEFECTS = '1';
log('\n--- Defect run (SEED_DEFECTS=1): the same probes now expose the seeded bugs ---');
const seeded = await probes();
log(`overdue count = ${seeded.overdueCount} (SQL "<=" expectation with the defect: ${expectedSeededOverdue})`);
log(`overdue ids = ${seeded.overdueIds}`);
log(`DONE chain: ${seeded.doneChain}`);
log(`DONE -> IN_PROGRESS = ${seeded.transitionAfterDone} (expected 200 with the defect: DONE is not terminal)`);

const detections = [
  {
    defect: 'SEEDED-001',
    name: 'Overdue rule uses <= (due-today tasks are reported overdue)',
    baseline: { overdueCount: clean.overdueCount, sqlStrictExpectation: expectedCleanOverdue },
    seeded: { overdueCount: seeded.overdueCount, sqlInclusiveExpectation: expectedSeededOverdue },
    detected:
      clean.overdueCount === expectedCleanOverdue &&
      seeded.overdueCount === expectedSeededOverdue &&
      expectedSeededOverdue > expectedCleanOverdue,
    detectingCase: 'TASK-TC-042 / TASK-TC-205 (assert counts match the strict "<" rule)',
  },
  {
    defect: 'SEEDED-002',
    name: 'DONE is not terminal (DONE -> IN_PROGRESS allowed)',
    baseline: { transitionAfterDone: clean.transitionAfterDone, expected: 422 },
    seeded: { transitionAfterDone: seeded.transitionAfterDone, expected: 200 },
    detected: clean.transitionAfterDone === 422 && seeded.transitionAfterDone === 200,
    detectingCase: 'TASK-TC-028 (assert 422 from DONE)',
  },
];

const evidence = {
  suite: 'seeded-defects',
  executedAt: new Date().toISOString(),
  database: DB_PATH,
  baseline: clean,
  seededRun: seeded,
  detections,
  allDetected: detections.every((detection) => detection.detected),
};

writeFileSync(path.join(OUT_DIR, 'detection-run.json'), `${JSON.stringify(evidence, null, 2)}\n`);
writeFileSync(
  path.join(OUT_DIR, 'detection-run.txt'),
  `${lines.join('\n')}\n\nDetection summary: ${detections
    .map((detection) => `${detection.defect} ${detection.detected ? 'DETECTED' : 'NOT DETECTED'}`)
    .join(', ')}\n`
);

server.close();
db.close();

log(`\nDetection summary: ${detections.map((d) => `${d.defect} ${d.detected ? 'DETECTED' : 'NOT DETECTED'}`).join(', ')}`);
process.exit(evidence.allDetected ? 0 : 1);
