#!/usr/bin/env node
/**
 * Orchestrator for the whole PeopleCore QA execution.
 *
 *   npm run test:all              # every suite
 *   npm run test:all -- --only api,db
 *
 * Each suite is executed as a child process, its stdout/stderr is streamed to the
 * console *and* stored under test-evidence/logs/<suite>.txt, and its exit code decides
 * the overall result. Afterwards scripts/reports/build-report.mjs turns the raw
 * artefacts into test-reports/summary.json and the Markdown execution report.
 *
 * Database/server lifecycle: the Playwright suites reset the test database and boot the
 * app themselves (playwright.config.ts › webServer), while the SQL, Postman and
 * performance suites each own a private database on a private port. No suite can
 * therefore observe another suite's leftovers, and every server is stopped again inside
 * the very script that started it.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOG_DIR = path.join(PROJECT_ROOT, 'test-evidence', 'logs');
const PLAYWRIGHT_CLI = path.join(PROJECT_ROOT, 'node_modules', '@playwright', 'test', 'cli.js');

const only = (() => {
  const index = process.argv.indexOf('--only');
  const raw = index === -1 ? process.env.PC_ONLY ?? '' : process.argv[index + 1] ?? '';
  return raw ? new Set(raw.split(',').map((value) => value.trim())) : null;
})();

const SUITES = [
  {
    id: 'db',
    title: 'SQL validation (node:sqlite)',
    command: process.execPath,
    args: ['tests/db/run.mjs'],
  },
  {
    id: 'api',
    title: 'Playwright API suite',
    command: process.execPath,
    args: [PLAYWRIGHT_CLI, 'test', '--project=api'],
    env: { PLAYWRIGHT_JSON_OUTPUT_NAME: path.join('test-reports', 'playwright', 'api.json') },
  },
  {
    id: 'ui',
    title: 'Playwright UI suite (Chromium)',
    command: process.execPath,
    args: [PLAYWRIGHT_CLI, 'test', '--project=ui'],
    env: { PLAYWRIGHT_JSON_OUTPUT_NAME: path.join('test-reports', 'playwright', 'ui.json') },
  },
  {
    id: 'postman',
    title: 'Postman collection via newman',
    command: process.execPath,
    args: ['scripts/newman-run.mjs'],
  },
  {
    id: 'perf',
    title: 'Performance baseline (autocannon)',
    command: process.execPath,
    args: ['scripts/perf-baseline.mjs'],
  },
];

async function runSuite(suite) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  const logPath = path.join(LOG_DIR, `${suite.id}.txt`);
  const header = [
    `# suite      : ${suite.title}`,
    `# command    : ${suite.command} ${suite.args.join(' ')}`,
    `# started at : ${new Date().toISOString()}`,
    `# log file   : ${path.relative(PROJECT_ROOT, logPath)}`,
    '',
  ].join('\n');

  fs.writeFileSync(logPath, header, 'utf8');
  const stream = fs.createWriteStream(logPath, { flags: 'a' });
  console.log(`\n=== ${suite.title} ===\n$ ${suite.command} ${suite.args.join(' ')}`);

  const exitCode = await new Promise((resolve) => {
    const child = spawn(suite.command, suite.args, {
      cwd: PROJECT_ROOT,
      env: { ...process.env, ...suite.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', (chunk) => {
      process.stdout.write(chunk);
      stream.write(chunk);
    });
    child.stderr.on('data', (chunk) => {
      process.stderr.write(chunk);
      stream.write(chunk);
    });
    child.on('close', (code) => resolve(code ?? 1));
    child.on('error', (error) => {
      stream.write(`\n[orchestrator] could not start the suite: ${error.message}\n`);
      resolve(1);
    });
  });

  stream.write(`\n# finished at: ${new Date().toISOString()}\n# exit code  : ${exitCode}\n`);
  await new Promise((resolve) => stream.end(resolve));
  console.log(`=== ${suite.title} → exit code ${exitCode} (log: test-evidence/logs/${suite.id}.txt) ===`);
  return { id: suite.id, title: suite.title, exitCode, logFile: path.relative(PROJECT_ROOT, logPath) };
}

const selected = SUITES.filter((suite) => !only || only.has(suite.id));
if (!selected.length) {
  console.error(`[run-tests] no suite matched --only ${[...(only ?? [])].join(',')}`);
  process.exit(1);
}

if (!fs.existsSync(PLAYWRIGHT_CLI)) {
  console.error('[run-tests] @playwright/test is not installed — run npm install first');
  process.exit(1);
}

const startedAt = new Date().toISOString();
const results = [];
for (const suite of selected) {
  results.push(await runSuite(suite));
}

const failures = results.filter((result) => result.exitCode !== 0);
console.log(`\n[run-tests] ${results.length - failures.length}/${results.length} suites exited successfully`);

const buildReport = spawn(process.execPath, ['scripts/reports/build-report.mjs'], {
  cwd: PROJECT_ROOT,
  stdio: 'inherit',
});
const reportExit = await new Promise((resolve) => buildReport.on('close', (code) => resolve(code ?? 1)));

fs.writeFileSync(
  path.join(PROJECT_ROOT, 'test-reports', 'run-tests-summary.json'),
  `${JSON.stringify({ startedAt, finishedAt: new Date().toISOString(), results, reportExit }, null, 2)}\n`,
);

process.exitCode = failures.length || reportExit ? 1 : 0;
