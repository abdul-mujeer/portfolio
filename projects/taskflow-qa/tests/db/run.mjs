import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { once } from 'node:events';
import path from 'node:path';
import { resolveDbPath, openDb, ensureSchema, PROJECT_ROOT } from '../../app/server/src/db.js';
import { createApp } from '../../app/server/src/app.js';
import { constraintChecks } from './constraints.mjs';
import { integrityChecks } from './integrity.mjs';

/**
 * SQL validation suite.
 *
 * Uses DB_PATH (default `.data/taskflow.test.db`). If the file does not exist it
 * is created and seeded via scripts/reset-db.mjs; an existing test database is
 * used as-is so the suite can validate the state produced by other suites.
 *
 * An in-process API server (ephemeral port, same connection) is used for the
 * API-vs-SQL parity checks. Exits non-zero when any check fails.
 */
const DB_PATH = process.env.DB_PATH || '.data/taskflow.test.db';
const resolved = resolveDbPath(DB_PATH);

if (!existsSync(resolved)) {
  console.log(`[db-suite] ${DB_PATH} missing - seeding a fresh test database`);
  const result = spawnSync(process.execPath, ['scripts/reset-db.mjs'], {
    cwd: PROJECT_ROOT,
    env: { ...process.env, DB_PATH },
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    console.error('[db-suite] failed to seed the test database');
    process.exit(1);
  }
}

const db = openDb(DB_PATH);
ensureSchema(db);

const app = createApp({ db, secret: 'taskflow-db-suite-secret', isProduction: false });
const server = app.listen(0);
await once(server, 'listening');
const { port } = server.address();
const base = `http://127.0.0.1:${port}`;

async function login() {
  const res = await fetch(`${base}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'owner@example.com', password: 'Owner#12345' }),
  });
  if (res.status !== 200) throw new Error(`db-suite login failed with ${res.status}`);
  const cookies = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  const setCookie = cookies[0] ?? res.headers.get('set-cookie') ?? '';
  return setCookie.split(';')[0];
}

const cookie = await login();

const ctx = {
  db,
  base,
  cookie,
  openDbAgain: () => openDb(DB_PATH),
  api: {
    async get(pathname, options = {}) {
      const res = await fetch(`${base}${pathname}`, {
        headers: options.cookie ? { cookie: options.cookie } : {},
      });
      let body = null;
      const text = await res.text();
      if (text) {
        try {
          body = JSON.parse(text);
        } catch {
          body = text;
        }
      }
      return { status: res.status, headers: res.headers, body };
    },
  },
};

const checks = [...constraintChecks(), ...integrityChecks()];
const results = [];

for (const check of checks) {
  try {
    const details = await check.run(ctx);
    results.push({ id: check.id, caseId: check.caseId, name: check.name, status: 'PASS', details });
    console.log(`[PASS] ${check.caseId} ${check.id} - ${check.name} (${details})`);
  } catch (error) {
    results.push({
      id: check.id,
      caseId: check.caseId,
      name: check.name,
      status: 'FAIL',
      details: String(error.message ?? error),
    });
    console.error(`[FAIL] ${check.caseId} ${check.id} - ${check.name}: ${error.message ?? error}`);
  }
}

server.close();
db.close();

const passed = results.filter((r) => r.status === 'PASS').length;
const failed = results.length - passed;
const report = {
  suite: 'db',
  executedAt: new Date().toISOString(),
  database: resolved,
  checks: results,
  totals: { executed: results.length, passed, failed },
};

mkdirSync(path.join(PROJECT_ROOT, 'test-reports'), { recursive: true });
writeFileSync(
  path.join(PROJECT_ROOT, 'test-reports', 'db-results.json'),
  `${JSON.stringify(report, null, 2)}\n`
);

console.log(`[db-suite] ${passed}/${results.length} checks passed (${failed} failed)`);
process.exit(failed === 0 ? 0 : 1);
