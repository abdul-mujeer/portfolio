#!/usr/bin/env node
/**
 * Conservative local performance baseline with autocannon. This is a *baseline*, not a
 * load test: a single process, a local SQLite file and a handful of connections. The
 * numbers are only comparable between runs on the same machine.
 *
 *   npm run test:perf
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import autocannon from 'autocannon';
import { bootstrapDatabase } from '../app/server/src/db.js';
import { seedDatabase } from '../app/server/src/seed.js';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PC_PERF_PORT ?? 4230);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const DB_PATH = path.join(PROJECT_ROOT, '.data', 'peoplecore.perf.db');
const REPORT_PATH = path.join(PROJECT_ROOT, 'test-reports', 'perf-baseline.json');
const DURATION_SECONDS = Number(process.env.PC_PERF_SECONDS ?? 5);
const CONNECTIONS = Number(process.env.PC_PERF_CONNECTIONS ?? 10);

fs.rmSync(DB_PATH, { force: true });
const db = bootstrapDatabase(DB_PATH, { fresh: true });
const seedSummary = seedDatabase(db);
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

function runAutocannon(options) {
  return new Promise((resolve, reject) => {
    autocannon(options, (error, result) => (error ? reject(error) : resolve(result)));
  });
}

function summarize(name, result, target) {
  return {
    name,
    target,
    connections: result.connections,
    durationSeconds: Math.round(result.duration),
    requestsPerSecond: Math.round(result.requests.average),
    latencyMs: {
      min: result.latency.min,
      p50: result.latency.p50,
      p95: result.latency.p97_5 ?? result.latency.p95,
      p99: result.latency.p99,
      max: result.latency.max,
    },
    throughputKbPerSecond: Math.round(result.throughput.average),
    non2xx: result.non2xx,
    errors: result.errors,
    timeouts: result.timeouts,
  };
}

let exitCode = 0;
const report = {
  suite: 'perf',
  note: 'autocannon baseline on a local Windows machine — indicators only, never a capacity claim.',
  startedAt: new Date().toISOString(),
  node: process.version,
  platform: `${process.platform} ${process.arch}`,
  seed: seedSummary,
  targets: [],
};

try {
  await waitForHealth();
  const login = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: 'Admin#12345' }),
  });
  const token = (await login.json()).data.token;

  const targets = [
    { name: 'health', path: '/api/health', headers: {} },
    { name: 'employees-list-20', path: '/api/employees?limit=20', headers: { Authorization: `Bearer ${token}` } },
    { name: 'reports-summary', path: '/api/reports/summary', headers: { Authorization: `Bearer ${token}` } },
  ];

  for (const target of targets) {
    console.log(`[perf] ${target.name}: ${DURATION_SECONDS}s @ ${CONNECTIONS} connections`);
    const result = await runAutocannon({
      url: `${BASE_URL}${target.path}`,
      connections: CONNECTIONS,
      duration: DURATION_SECONDS,
      headers: target.headers,
    });
    const summary = summarize(target.name, result, target.path);
    report.targets.push(summary);
    console.log(
      `[perf]   req/s ${summary.requestsPerSecond} · p50 ${summary.latencyMs.p50}ms · p99 ${summary.latencyMs.p99}ms · non-2xx ${summary.non2xx}`,
    );
    if (summary.non2xx > 0 || summary.errors > 0) exitCode = 1;
  }
} catch (error) {
  console.error('[perf] failed:', error.message);
  exitCode = 1;
} finally {
  report.finishedAt = new Date().toISOString();
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`[perf] report: ${path.relative(PROJECT_ROOT, REPORT_PATH)}`);
  server.kill();
}

process.exitCode = exitCode;
