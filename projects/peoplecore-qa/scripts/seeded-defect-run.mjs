#!/usr/bin/env node
/**
 * Demonstrates the two documented SEEDED defects reproducibly.
 *
 *   npm run seeded:evidence
 *
 * The script boots the app twice with a private database on a private port:
 *   1. SEED_DEFECTS=1 → both probes must FAIL (the defects are detected)
 *   2. SEED_DEFECTS=0 → the same probes must PASS (the clean build refuses them)
 *
 * Evidence is written to test-evidence/seeded-defects/seed-defects-evidence.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { bootstrapDatabase } from '../app/server/src/db.js';
import { seedDatabase } from '../app/server/src/seed.js';
import { addDays, todayIso } from '../app/server/src/lib/dates.js';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(PROJECT_ROOT, 'test-evidence', 'seeded-defects');
const OUT_FILE = path.join(OUT_DIR, 'seed-defects-evidence.json');
const PORT = Number(process.env.PC_SEEDED_PORT ?? 4240);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const DB_PATH = path.join(PROJECT_ROOT, '.data', 'peoplecore.seeded.db');

function resetDatabase() {
  fs.rmSync(DB_PATH, { force: true });
  const db = bootstrapDatabase(DB_PATH, { fresh: true });
  seedDatabase(db);
  db.close();
}

function startServer(seedDefects) {
  return spawn(process.execPath, ['app/server/src/index.js'], {
    cwd: PROJECT_ROOT,
    env: {
      ...process.env,
      PORT: String(PORT),
      HOST: '127.0.0.1',
      NODE_ENV: 'test',
      DB_PATH,
      SEED_DEFECTS: seedDefects ? '1' : '0',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

async function waitForHealth(timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE_URL}/api/health`);
      if (response.ok) return await response.json();
    } catch {
      /* not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('PeopleCore did not become healthy in time');
}

async function login(email, password) {
  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw new Error(`login failed for ${email}: ${response.status}`);
  return (await response.json()).data.token;
}

function api(token, requestPath, options = {}) {
  return fetch(`${BASE_URL}${requestPath}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
}

/**
 * Probe 1 — the manager list must only contain the manager and the seven direct reports.
 */
async function probeManagerListScope() {
  const token = await login('manager@example.com', 'Manager#12345');
  const response = await api(token, '/api/employees?limit=100');
  const body = await response.json();
  const outOfScope = body.data.filter((row) => row.id !== 3 && row.managerId !== 3);
  return {
    probe: 'SEEDED-01',
    title: 'Manager employee list stays inside the team',
    request: 'GET /api/employees?limit=100 as manager@example.com',
    rowsReturned: body.data.length,
    outOfScopeRows: outOfScope.map((row) => row.employeeCode),
    passed: response.status === 200 && outOfScope.length === 0,
  };
}

/**
 * Probe 2 — a request that starts exactly on the seeded PENDING window must be refused.
 */
async function probeLeaveOverlapOnSameStartDate() {
  const token = await login('employee6@example.com', 'Employee#1234');
  const seeded = await (await api(token, '/api/leave-requests?status=PENDING&limit=100')).json();
  const target = seeded.data[0];
  const response = await api(token, '/api/leave-requests', {
    method: 'POST',
    body: JSON.stringify({
      leaveType: 'SICK',
      startDate: target.startDate,
      endDate: addDays(target.endDate, 1),
      reason: 'Seeded-defect probe: starts on the same day as an existing request.',
    }),
  });
  const body = await response.json().catch(() => ({}));
  return {
    probe: 'SEEDED-02',
    title: 'Same-start-date leave overlap is refused',
    request: `POST /api/leave-requests {{ startDate: ${target.startDate}, endDate: ${addDays(target.endDate, 1)} }} as employee6@example.com`,
    seededRequest: { id: target.id, startDate: target.startDate, endDate: target.endDate, status: target.status },
    status: response.status,
    errorCode: body.error?.code ?? null,
    passed: response.status === 409 && body.error?.code === 'LEAVE_OVERLAP',
  };
}

async function runProbes(label) {
  const health = await waitForHealth();
  const results = [await probeManagerListScope(), await probeLeaveOverlapOnSameStartDate()];
  return { label, seedDefects: health.seedDefects, generatedAt: new Date().toISOString(), baseUrl: BASE_URL, results };
}

const evidence = {
  note: 'Both seeded defects are OFF by default. With SEED_DEFECTS=1 the probes must fail; without it they must pass.',
  detectedOn: todayIso(),
  runs: [],
};

let exitCode = 0;
try {
  resetDatabase();
  for (const seedDefects of [true, false]) {
    const server = startServer(seedDefects);
    try {
      const run = await runProbes(seedDefects ? 'SEED_DEFECTS=1 (defects enabled)' : 'SEED_DEFECTS=0 (clean build)');
      evidence.runs.push(run);
      for (const result of run.results) {
        console.log(`[seeded] ${run.label} · ${result.probe}: ${result.passed ? 'PASS' : 'FAIL'} (${result.title})`);
      }
      const shouldFail = seedDefects;
      const anyPassed = run.results.some((result) => result.passed);
      if (shouldFail && anyPassed) exitCode = 1;
      if (!shouldFail && run.results.some((result) => !result.passed)) exitCode = 1;
    } finally {
      server.kill();
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
  }
} catch (error) {
  console.error('[seeded] failed:', error.message);
  exitCode = 1;
} finally {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  evidence.summary = {
    detectedWithDefectsEnabled: evidence.runs[0]?.results.filter((result) => !result.passed).length ?? 0,
    cleanRunFailures: evidence.runs[1]?.results.filter((result) => !result.passed).length ?? 0,
    reproducible: exitCode === 0,
  };
  fs.writeFileSync(OUT_FILE, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(`[seeded] evidence: ${path.relative(PROJECT_ROOT, OUT_FILE)}`);
}

process.exitCode = exitCode;
