import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { once } from 'node:events';
import path from 'node:path';
import { openDb, ensureSchema, PROJECT_ROOT } from '../app/server/src/db.js';
import { createApp } from '../app/server/src/app.js';

/**
 * Scripted execution of the manual/exploratory cases (TASK-TC-301..304).
 *
 * Boots an in-process API on a freshly seeded test database, performs exactly
 * the documented steps, records every probe and saves:
 *   - test-evidence/logs/manual-results.json  (machine readable, case statuses)
 *   - test-evidence/logs/manual-cases.txt     (raw human-readable log)
 *
 * The CSV generator reads manual-results.json so Status/EvidenceLink in
 * test-cases.csv always come from this real execution.
 */
const DB_PATH = process.env.DB_PATH || '.data/taskflow.test.db';
const LOG_DIR = path.join(PROJECT_ROOT, 'test-evidence', 'logs');
mkdirSync(LOG_DIR, { recursive: true });

const reset = spawnSync(process.execPath, ['scripts/reset-db.mjs'], {
  cwd: PROJECT_ROOT,
  env: { ...process.env, DB_PATH },
  encoding: 'utf8',
});
if (reset.status !== 0) {
  console.error(reset.stderr);
  process.exit(1);
}

const db = openDb(DB_PATH);
ensureSchema(db);
const app = createApp({ db, secret: 'taskflow-manual-suite-secret', isProduction: false });
const server = app.listen(0);
await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}/api/v1`;

const lines = [];
function log(text) {
  lines.push(text);
  console.log(text);
}

function cookieFrom(headers) {
  const cookies = typeof headers.getSetCookie === 'function' ? headers.getSetCookie() : [];
  return (cookies[0] ?? headers.get('set-cookie') ?? '').split(';')[0];
}

async function req(method, pathname, { body, cookie, headers = {}, raw } = {}) {
  const res = await fetch(`${base}${pathname}`, {
    method,
    headers: {
      ...(body !== undefined || raw !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {}),
      ...headers,
    },
    body: raw !== undefined ? raw : body !== undefined ? JSON.stringify(body) : undefined,
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
  return { status: res.status, json, headers: res.headers, cookie: cookieFrom(res.headers) };
}

async function login(email, password) {
  const res = await req('POST', '/auth/login', { body: { email, password } });
  if (res.status !== 200) throw new Error(`login ${email} -> ${res.status}`);
  return res.cookie;
}

let unique = 0;
function uniqueKey() {
  unique += 1;
  const base36 = `${Date.now().toString(36)}${unique}`
    .toUpperCase()
    .replace(/[0-9]/g, (d) => 'ABCDEFGHIJ'[Number(d)]);
  return base36.slice(-6).padStart(2, 'Q');
}

const results = [];

async function runCase(caseId, name, fn) {
  const probes = [];
  const check = (label, ok, detail) => {
    probes.push({ label, ok: !!ok, detail });
    log(`    ${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? ` - ${detail}` : ''}`);
  };
  log(`\n[${caseId}] ${name}`);
  try {
    await fn(check);
  } catch (error) {
    check('case aborted', false, String(error.message ?? error));
  }
  const failed = probes.filter((probe) => !probe.ok);
  const status = failed.length === 0 ? 'PASS' : 'FAIL';
  results.push({ caseId, name, status, probes });
  log(`  => ${status} (${probes.length - failed.length}/${probes.length} probes)`);
}

// ---------------------------------------------------------------- case 301
await runCase('TASK-TC-301', 'SQL injection, malformed JSON and envelope consistency', async (check) => {
  const owner = await login('owner@example.com', 'Owner#12345');
  const project = await req('POST', '/projects', {
    body: { key: uniqueKey(), name: 'Manual injection project' },
    cookie: owner,
  });
  check('project created for probes', project.status === 201, `status ${project.status}`);

  const payloads = [
    "' OR 1=1 --",
    "%'; DROP TABLE tasks;--",
    "' UNION SELECT email, password_hash FROM users --",
    "1; DELETE FROM comments;--",
  ];
  for (const payload of payloads) {
    const res = await req('GET', `/projects/${project.json.id}/tasks?q=${encodeURIComponent(payload)}`, {
      cookie: owner,
    });
    check(
      `q payload inert: ${payload.slice(0, 30)}`,
      res.status === 200 && res.json?.total === 0,
      `status ${res.status}, total ${res.json?.total}`
    );
  }

  const stored = await req('POST', `/projects/${project.json.id}/tasks`, {
    body: { title: "x'); DROP TABLE tasks;--" },
    cookie: owner,
  });
  check(
    'SQL-looking title stored verbatim',
    stored.status === 201 && stored.json.title === "x'); DROP TABLE tasks;--",
    `status ${stored.status}`
  );

  const badLogin = await req('POST', '/auth/login', { body: { email: "' OR '1'='1", password: 'x' } });
  check('login injection rejected', badLogin.status === 400, `status ${badLogin.status}`);

  const malformed = await req('POST', '/projects', { raw: '{"key": "AB", ', cookie: owner });
  check(
    'malformed JSON -> 400 INVALID_JSON',
    malformed.status === 400 && malformed.json?.error?.code === 'INVALID_JSON',
    `status ${malformed.status}, code ${malformed.json?.error?.code}`
  );

  // envelope consistency across status classes
  const duplicate = await req('POST', '/projects', {
    body: { key: project.json.key, name: 'Duplicate attempt' },
    cookie: owner,
  });
  const task = await req('POST', `/projects/${project.json.id}/tasks`, {
    body: { title: 'Envelope task' },
    cookie: owner,
  });
  const skip = await req('PATCH', `/tasks/${task.json.id}/status`, {
    body: { status: 'DONE' },
    cookie: owner,
  });
  await req('POST', `/projects/${project.json.id}/members`, {
    body: { email: 'member@example.com', role: 'MEMBER' },
    cookie: owner,
  });
  const memberCookie = await login('member@example.com', 'Member#12345');
  const forbidden = await req('DELETE', `/projects/${project.json.id}`, { cookie: memberCookie });
  const missing = await req('GET', '/projects/999999', { cookie: owner });
  const unauth = await req('GET', '/projects');

  const samples = [
    ['401', unauth],
    ['403', forbidden],
    ['404', missing],
    ['409', duplicate],
    ['422', skip],
  ];
  for (const [label, res] of samples) {
    const envelopeOk =
      res.json?.error &&
      typeof res.json.error.code === 'string' &&
      typeof res.json.error.message === 'string' &&
      Array.isArray(res.json.error.details);
    check(
      `${label} envelope shape`,
      envelopeOk,
      `code=${res.json?.error?.code ?? 'n/a'}, message=${(res.json?.error?.message ?? '').slice(0, 40)}`
    );
  }
});

// ---------------------------------------------------------------- case 302
await runCase('TASK-TC-302', 'IDOR sweep across seeded ids for outsider and no-project user', async (check) => {
  const outsider = await login('outsider@example.com', 'Outside#12345');
  const noprojects = await login('noprojects@example.com', 'Solo#12345');

  const outsiderProjects = db
    .prepare('SELECT project_id FROM project_members WHERE user_id = (SELECT id FROM users WHERE email = ?)')
    .all('outsider@example.com')
    .map((row) => row.project_id);
  const tasks = db.prepare('SELECT id, project_id FROM tasks ORDER BY id').all();

  let leaks = 0;
  let forbiddenLeaks = 0;
  for (const projectId of [1, 2, 3]) {
    const res = await req('GET', `/projects/${projectId}`, { cookie: outsider });
    const expected = outsiderProjects.includes(projectId) ? 200 : 404;
    if (res.status !== expected) leaks += 1;
    if (res.status === 403) forbiddenLeaks += 1;
  }
  check(
    'project reads match membership scope',
    leaks === 0 && forbiddenLeaks === 0,
    `mismatches ${leaks}, 403s ${forbiddenLeaks}`
  );

  leaks = 0;
  for (const task of tasks) {
    const res = await req('GET', `/tasks/${task.id}`, { cookie: outsider });
    const expected = outsiderProjects.includes(task.project_id) ? 200 : 404;
    if (res.status !== expected) leaks += 1;
    if (res.status === 403) forbiddenLeaks += 1;
  }
  check(
    'task reads match membership scope (18 ids)',
    leaks === 0,
    `mismatches ${leaks}`
  );

  for (const pathname of [
    '/projects/1/tasks',
    '/projects/1/members',
    '/projects/1/activity',
    '/tasks/1/comments',
    '/tasks/1/activity',
  ]) {
    const res = await req('GET', pathname, { cookie: outsider });
    check(`out-of-scope read hidden: ${pathname}`, res.status === 404, `status ${res.status}`);
  }

  const noprojectsProject = await req('GET', '/projects/2', { cookie: noprojects });
  check('no-project user sees nothing', noprojectsProject.status === 404, `status ${noprojectsProject.status}`);
  const noprojectsReport = await req('GET', '/reports/overdue', { cookie: noprojects });
  check(
    'no-project overdue report is empty',
    noprojectsReport.status === 200 && noprojectsReport.json.count === 0,
    `status ${noprojectsReport.status}, count ${noprojectsReport.json?.count}`
  );
});

// ---------------------------------------------------------------- case 303
await runCase('TASK-TC-303', 'Payload size, content-type, duplicate params and method fallthrough', async (check) => {
  const owner = await login('owner@example.com', 'Owner#12345');

  const oversized = await req('POST', '/projects/1/tasks', {
    body: { title: 'Huge body', description: 'x'.repeat(150000) },
    cookie: owner,
  });
  check('>100KB body -> 413', oversized.status === 413, `status ${oversized.status}`);

  const plainText = await req('POST', '/projects/1/tasks', {
    raw: JSON.stringify({ title: 'Plain text body' }),
    headers: { 'content-type': 'text/plain' },
    cookie: owner,
  });
  check(
    'text/plain body is not parsed and fails validation (400)',
    plainText.status === 400,
    `status ${plainText.status}`
  );

  const duplicateParams = await req('GET', '/projects/1/tasks?status=TODO&status=BOGUS', { cookie: owner });
  check('duplicate query params -> 400', duplicateParams.status === 400, `status ${duplicateParams.status}`);

  const put = await fetch(`${base}/tasks/1`, { method: 'PUT', headers: { cookie: owner } });
  check(
    'unsupported method falls through to 404 (no 405 handler - documented)',
    put.status === 404,
    `status ${put.status}`
  );

  const health = await req('GET', '/health');
  check('server healthy after probes', health.status === 200 && health.json.status === 'ok', `status ${health.status}`);
});

// ---------------------------------------------------------------- case 304
await runCase('TASK-TC-304', 'Unicode round-trip and expired-session cleanup', async (check) => {
  const owner = await login('owner@example.com', 'Owner#12345');
  const unicodeTitle = 'Unicode ✅ テスト — Ünïcode 中文 запуск';
  const created = await req('POST', '/projects/1/tasks', { body: { title: unicodeTitle }, cookie: owner });
  check(
    'unicode title accepted and stored verbatim',
    created.status === 201 && created.json?.title === unicodeTitle,
    `status ${created.status}`
  );
  const readBack = await req('GET', `/tasks/${created.json.id}`, { cookie: owner });
  check('unicode title returned verbatim', readBack.json?.title === unicodeTitle, `title ${readBack.json?.title}`);

  const fresh = await login('admin@example.com', 'Admin#12345');
  const token = fresh.replace('tf_session=', '');
  const before = db.prepare('SELECT COUNT(*) AS c FROM sessions WHERE token = ?').get(token).c;
  db.prepare("UPDATE sessions SET expires_at = '2000-01-01T00:00:00.000Z' WHERE token = ?").run(token);
  const expired = await req('GET', '/auth/me', { cookie: fresh });
  const after = db.prepare('SELECT COUNT(*) AS c FROM sessions WHERE token = ?').get(token).c;
  check(
    'expired session -> 401 and row removed',
    before === 1 && expired.status === 401 && after === 0,
    `before ${before}, status ${expired.status}, after ${after}`
  );
});

server.close();
db.close();

const payload = {
  suite: 'manual',
  executedAt: new Date().toISOString(),
  database: DB_PATH,
  results,
};

writeFileSync(path.join(LOG_DIR, 'manual-results.json'), `${JSON.stringify(payload, null, 2)}\n`);
writeFileSync(
  path.join(LOG_DIR, 'manual-cases.txt'),
  `${lines.join('\n')}\n\nSummary: ${results.map((r) => `${r.caseId} ${r.status}`).join(', ')}\n`
);

const failed = results.filter((result) => result.status === 'FAIL');
console.log(`\n[manual] ${results.length - failed.length}/${results.length} cases passed`);
process.exit(failed.length === 0 ? 0 : 1);
