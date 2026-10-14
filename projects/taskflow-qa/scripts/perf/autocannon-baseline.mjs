import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import autocannon from 'autocannon';
import { PROJECT_ROOT } from '../../app/server/src/db.js';

/**
 * Conservative LOCAL performance baseline with autocannon.
 *
 * Targets (against the seeded test database):
 *   1. GET /api/v1/health            (unauthenticated, routing overhead)
 *   2. GET /api/v1/projects/1/tasks  (authenticated, SQLite-backed list with sort)
 *
 * Load profile: 10 connections, 5 seconds per target, pipelining 1.
 * NOT a production capacity test - see the caveat in the generated markdown.
 */
const PORT = 4315;
const DB_PATH = '.data/taskflow.perf.db';
const BASE_URL = `http://127.0.0.1:${PORT}`;
const CONNECTIONS = 10;
const DURATION = Number(process.env.PERF_DURATION || 5);
const PIPELINING = 1;

// fresh seeded database so the numbers are reproducible
const reset = spawnSync(process.execPath, ['scripts/reset-db.mjs'], {
  cwd: PROJECT_ROOT,
  env: { ...process.env, DB_PATH },
  encoding: 'utf8',
});
if (reset.status !== 0) {
  console.error(reset.stderr);
  process.exit(1);
}

const server = spawn(process.execPath, ['app/server/src/index.js'], {
  cwd: PROJECT_ROOT,
  env: { ...process.env, PORT: String(PORT), DB_PATH, NODE_ENV: 'test' },
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
});
server.stderr.on('data', (chunk) => process.stderr.write(`[perf-server] ${chunk}`));

async function waitForHealth(timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE_URL}/api/v1/health`, { signal: AbortSignal.timeout(1500) });
      if (res.ok) return true;
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  return false;
}

async function api(pathname, options = {}) {
  const res = await fetch(`${BASE_URL}${pathname}`, {
    method: options.method ?? 'GET',
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.cookie ? { cookie: options.cookie } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  return res;
}

if (!(await waitForHealth())) {
  console.error('[perf] server not healthy');
  server.kill();
  process.exit(1);
}

// authenticate once; autocannon reuses the session cookie
const login = await api('/api/v1/auth/login', {
  method: 'POST',
  body: { email: 'owner@example.com', password: 'Owner#12345' },
});
if (login.status !== 200) {
  console.error(`[perf] login failed with ${login.status}`);
  server.kill();
  process.exit(1);
}
const cookies = typeof login.headers.getSetCookie === 'function' ? login.headers.getSetCookie() : [];
const cookie = (cookies[0] ?? login.headers.get('set-cookie') ?? '').split(';')[0];

const targets = [
  { label: 'GET /api/v1/health', url: `${BASE_URL}/api/v1/health`, headers: {} },
  {
    label: 'GET /api/v1/projects/1/tasks (authenticated, 12 tasks)',
    url: `${BASE_URL}/api/v1/projects/1/tasks?limit=20&sort=id&order=asc`,
    headers: { cookie },
  },
];

const results = [];
for (const target of targets) {
  console.log(`[perf] running ${target.label} (${CONNECTIONS} connections, ${DURATION}s)`);
  const result = await autocannon({
    url: target.url,
    connections: CONNECTIONS,
    duration: DURATION,
    pipelining: PIPELINING,
    headers: target.headers,
  });
  results.push({
    label: target.label,
    url: target.url.replace(BASE_URL, ''),
    requests: {
      total: result.requests.total,
      average: result.requests.average,
    },
    latency: {
      average: result.latency.average,
      p50: result.latency.p50,
      p97_5: result.latency.p97_5,
      p99: result.latency.p99,
      max: result.latency.max,
    },
    throughputBytesPerSecond: result.throughput.average,
    errors: result.errors,
    timeouts: result.timeouts,
    non2xx: result.non2xx,
    status2xx: result['2xx'],
  });
}

server.kill();

const baseline = {
  suite: 'performance',
  executedAt: new Date().toISOString(),
  database: DB_PATH,
  tool: `autocannon ${autocannon.version ?? ''}`.trim(),
  connections: CONNECTIONS,
  durationSeconds: DURATION,
  pipelining: PIPELINING,
  environment:
    'Local Windows machine, single Node.js process, file-backed SQLite (node:sqlite), loopback network.',
  caveat:
    'LOCAL DEMO BASELINE ONLY. Single process and local loopback inflate throughput and deflate latency versus any real deployment. There is no connection pooling, reverse proxy, TLS, multi-instance or production-size data set involved. Do not quote these numbers as production capacity.',
  targets: results,
};

mkdirSync(path.join(PROJECT_ROOT, 'test-reports'), { recursive: true });
writeFileSync(
  path.join(PROJECT_ROOT, 'test-reports', 'performance-baseline.json'),
  `${JSON.stringify(baseline, null, 2)}\n`
);

const md = [];
md.push('# TaskFlow API - Performance Baseline (autocannon)');
md.push('');
md.push(`Executed: ${baseline.executedAt}  `);
md.push(`Environment: ${baseline.environment}  `);
md.push(`Profile: ${CONNECTIONS} connections, ${DURATION}s per target, pipelining ${PIPELINING}.`);
md.push('');
md.push('| Target | Req/s (avg) | Total requests | p50 | p97.5 | p99 | Max | Errors | Timeouts | Non-2xx |');
md.push('|--------|------------:|---------------:|----:|------:|----:|----:|-------:|---------:|--------:|');
for (const target of results) {
  md.push(
    `| ${target.label} | ${Math.round(target.requests.average)} | ${target.requests.total} | ${target.latency.p50} ms | ${target.latency.p97_5} ms | ${target.latency.p99} ms | ${target.latency.max} ms | ${target.errors} | ${target.timeouts} | ${target.non2xx} |`
  );
}
md.push('');
md.push(`Raw machine-readable data: \`test-reports/performance-baseline.json\`.`);
md.push('');
md.push('> **Caveat:** this is a local demo baseline on a single Node.js process with file-backed SQLite over loopback. It is useful to detect regressions between commits on the same machine - it is NOT production capacity, and no claim about production performance is made.');
md.push('');
writeFileSync(path.join(PROJECT_ROOT, 'test-reports', 'performance-baseline.md'), md.join('\n'));

console.log('[perf] baseline written to test-reports/performance-baseline.json + .md');
for (const target of results) {
  console.log(
    `[perf] ${target.label}: ${Math.round(target.requests.average)} req/s avg, p50 ${target.latency.p50} ms, p99 ${target.latency.p99} ms, errors ${target.errors}`
  );
}
