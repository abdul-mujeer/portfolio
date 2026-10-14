import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { PROJECT_ROOT } from '../../app/server/src/db.js';

/**
 * Builds test-reports/summary.json + test-reports/execution-report-<date>.md
 * and a copy at test-documentation/execution-report.md from the raw results of
 * every suite. All counts come from real report files; missing files are
 * reported as NOT EXECUTED.
 */
const REPORTS = path.join(PROJECT_ROOT, 'test-reports');
const DOCS = path.join(PROJECT_ROOT, 'test-documentation');

function readJson(relativePath) {
  const full = path.join(PROJECT_ROOT, relativePath);
  if (!existsSync(full)) return null;
  try {
    return JSON.parse(readFileSync(full, 'utf8'));
  } catch {
    return null;
  }
}

function walkSpecs(suite, collector = []) {
  for (const spec of suite.specs ?? []) collector.push(spec);
  for (const child of suite.suites ?? []) walkSpecs(child, collector);
  return collector;
}

function playwrightSummary(relativePath) {
  const report = readJson(relativePath);
  if (!report) return null;
  const stats = report.stats ?? {};
  const specs = (report.suites ?? []).flatMap((suite) => walkSpecs(suite));
  const caseIds = new Set();
  for (const spec of specs) {
    for (const match of (spec.title ?? '').matchAll(/TASK-TC-(\d{3})/g)) {
      caseIds.add(`TASK-TC-${match[1]}`);
    }
  }
  return {
    total: (stats.expected ?? 0) + (stats.unexpected ?? 0) + (stats.flaky ?? 0) + (stats.skipped ?? 0),
    passed: stats.expected ?? 0,
    failed: stats.unexpected ?? 0,
    flaky: stats.flaky ?? 0,
    skipped: stats.skipped ?? 0,
    durationMs: stats.duration ?? null,
    cases: caseIds.size,
    reportFile: relativePath,
  };
}

function dbSummary() {
  const report = readJson('test-reports/db-results.json');
  if (!report) return null;
  return {
    total: report.totals.executed,
    passed: report.totals.passed,
    failed: report.totals.failed,
    skipped: 0,
    durationMs: null,
    cases: new Set(report.checks.map((c) => c.caseId)).size,
    reportFile: 'test-reports/db-results.json',
    failedChecks: report.checks.filter((c) => c.status === 'FAIL').map((c) => c.id),
  };
}

function postmanSummary() {
  const report = readJson('test-reports/newman/newman-summary.json');
  if (!report) return null;
  return {
    total: report.assertions.total,
    passed: report.assertions.total - report.assertions.failed,
    failed: report.assertions.failed,
    skipped: 0,
    requests: report.requests.total,
    failedRequests: report.requests.failed,
    durationMs: report.durationMs,
    reportFile: 'test-reports/newman/newman-summary.json',
    failures: report.failures,
  };
}

function manualSummary() {
  const report = readJson('test-evidence/logs/manual-results.json');
  if (!report) return null;
  return {
    total: report.results.length,
    passed: report.results.filter((r) => r.status === 'PASS').length,
    failed: report.results.filter((r) => r.status === 'FAIL').length,
    skipped: 0,
    durationMs: null,
    reportFile: 'test-evidence/logs/manual-results.json',
  };
}

function perfSummary() {
  const report = readJson('test-reports/performance-baseline.json');
  if (!report) return null;
  return report;
}

function parseCsvLine(line) {
  const cells = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      cells.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

/** Reads a CSV written by generate-csv / hand-authored docs (RFC-4180). */
function readCsv(relativePath) {
  const full = path.join(PROJECT_ROOT, relativePath);
  if (!existsSync(full)) return null;
  const text = readFileSync(full, 'utf8').replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '');
  if (lines.length < 2) return null;
  const header = parseCsvLine(lines[0]);
  const rows = [];
  let buffer = '';
  let inQuotes = false;
  const records = [];
  for (const line of lines.slice(1)) {
    buffer = buffer ? `${buffer}\n${line}` : line;
    inQuotes = (buffer.match(/"/g) ?? []).length % 2 === 1;
    if (!inQuotes) {
      records.push(buffer);
      buffer = '';
    }
  }
  for (const record of records) {
    const cells = parseCsvLine(record);
    const row = {};
    header.forEach((key, index) => {
      row[key] = cells[index] ?? '';
    });
    rows.push(row);
  }
  return rows;
}

function gitCommit() {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: PROJECT_ROOT, encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

const suiteCommand = {
  api: 'npm run test:api',
  ui: 'npm run test:ui',
  db: 'npm run test:db',
  postman: 'npm run test:postman',
};

const runners = {
  api: () => playwrightSummary('test-reports/playwright/api.json') ?? playwrightSummary('test-reports/playwright/results.json'),
  ui: () => playwrightSummary('test-reports/playwright/ui.json') ?? playwrightSummary('test-reports/playwright/results.json'),
  db: dbSummary,
  postman: postmanSummary,
  manual: manualSummary,
};

const suites = {};
for (const [name, runner] of Object.entries(runners)) {
  suites[name] = runner();
}

// merge orchestrator exit codes/durations when invoked from scripts/run-tests.mjs
if (process.env.SUITE_RESULTS) {
  try {
    for (const entry of JSON.parse(process.env.SUITE_RESULTS)) {
      if (suites[entry.name]) {
        suites[entry.name].exitCode = entry.code;
        suites[entry.name].orchestratorDurationMs = entry.durationMs ?? null;
      }
    }
  } catch {
    // ignore malformed orchestrator hand-off
  }
}

const perf = perfSummary();
const caseRows = readCsv('test-documentation/test-cases.csv');
const traceRows = readCsv('test-documentation/traceability-matrix.csv');
const defectRows = readCsv('test-documentation/defect-log.csv');

const totals = { total: 0, passed: 0, failed: 0, skipped: 0 };
for (const suite of Object.values(suites)) {
  if (!suite) continue;
  totals.total += suite.total;
  totals.passed += suite.passed;
  totals.failed += suite.failed;
  totals.skipped += suite.skipped;
}

const now = new Date();
const dateStamp = now.toISOString().slice(0, 10);
const summary = {
  project: 'TaskFlow API QA',
  generatedAt: now.toISOString(),
  gitCommit: gitCommit(),
  node: process.version,
  platform: `${os.platform()} ${os.release()}`,
  suites: suites,
  totals,
  performanceBaseline: perf ? path.posix.join('test-reports', 'performance-baseline.json') : null,
  defects: defectRows
    ? {
        total: defectRows.length,
        open: defectRows.filter((row) => row.Status !== 'Closed').length,
        seeded: defectRows.filter((row) => String(row.Type ?? '').includes('SEEDED')).length,
      }
    : null,
  testCases: caseRows
    ? {
        total: caseRows.length,
        pass: caseRows.filter((row) => row.Status === 'Pass').length,
        fail: caseRows.filter((row) => row.Status === 'Fail').length,
        notExecuted: caseRows.filter((row) => row.Status === 'Not Executed').length,
      }
    : null,
  requirementCoverage: traceRows
    ? {
        total: traceRows.length,
        verified: traceRows.filter((row) => row.CoverageStatus === 'Verified').length,
        partial: traceRows.filter((row) => row.CoverageStatus === 'Partial').length,
      }
    : null,
};

mkdirSync(REPORTS, { recursive: true });
writeFileSync(path.join(REPORTS, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);

// ------------------------------------------------------------------ markdown
const statusLine = (suite) => {
  if (!suite) return 'NOT EXECUTED';
  if (suite.failed > 0) return `FAIL (${suite.failed} failing)`;
  return 'PASS';
};

const md = [];
md.push(`# TaskFlow API QA — Execution Report (${dateStamp})`);
md.push('');
md.push(`> Generated by \`npm run docs:report\` from raw suite outputs. The orchestrator \`npm run test:all\` produces the same report automatically.`);
md.push('');
md.push('## 1. Environment');
md.push('');
md.push('| Item | Value |');
md.push('|------|-------|');
md.push(`| Date/time (UTC) | ${summary.generatedAt} |`);
md.push(`| Git commit | \`${summary.gitCommit}\` |`);
md.push(`| Node.js | ${summary.node} |`);
md.push(`| Platform | ${summary.platform} |`);
md.push(`| App DB (default) | \`app/server/data/taskflow.db\` |`);
md.push(`| Test DB | \`.data/taskflow.test.db\` |`);
md.push(`| API port | 4300 |`);
md.push('');
md.push('## 2. Suite results (real counts from report files)');
md.push('');
md.push('| Suite | Command | Tests | Passed | Failed | Skipped | Status | Raw report |');
md.push('|-------|---------|------:|-------:|-------:|--------:|--------|------------|');
for (const name of ['api', 'ui', 'db', 'postman', 'manual']) {
  const suite = suites[name];
  md.push(
    `| ${name} | \`${suiteCommand[name] ?? 'node scripts/manual-cases.mjs'}\` | ${suite?.total ?? 0} | ${
      suite?.passed ?? 0
    } | ${suite?.failed ?? 0} | ${suite?.skipped ?? 0} | ${statusLine(suite)} | ${
      suite?.reportFile ?? 'n/a'
    } |`
  );
}
md.push('');
md.push(`**Totals from automated + manual suites:** ${totals.total} checks, ${totals.passed} passed, ${totals.failed} failed, ${totals.skipped} skipped.`);
md.push('');
if (perf) {
  md.push('## 3. Performance baseline (autocannon, local)');
  md.push('');
  md.push('| Target | Req/s (avg) | p50 | p99 | Errors | 2xx |');
  md.push('|--------|------------:|----:|----:|-------:|----:|');
  for (const target of perf.targets) {
    md.push(
      `| ${target.label} | ${Math.round(target.requests.average)} | ${target.latency.p50} ms | ${target.latency.p99} ms | ${target.errors} | ${target.status2xx} |`
    );
  }
  md.push('');
  md.push(`Run details: ${perf.connections} connections, ${perf.durationSeconds}s per target, pipelining ${perf.pipelining}, ${perf.executedAt}. See \`test-reports/performance-baseline.md\`.`);
  md.push('');
  md.push('> Local loopback demo baseline on a single Node process with file-backed SQLite — NOT production capacity. See the caveats file for details.');
  md.push('');
} else {
  md.push('## 3. Performance baseline');
  md.push('');
  md.push('Not executed in this report run (`npm run test:perf` adds `test-reports/performance-baseline.json`).');
  md.push('');
}

md.push('## 4. Manual test case tracking');
md.push('');
if (summary.testCases) {
  md.push(
    `\`test-documentation/test-cases.csv\` contains **${summary.testCases.total} test cases**: ${summary.testCases.pass} Pass, ${summary.testCases.fail} Fail, ${summary.testCases.notExecuted} Not Executed.`
  );
} else {
  md.push('`test-documentation/test-cases.csv` not found — run `npm run docs:csv` first.');
}
md.push('');
if (summary.requirementCoverage) {
  md.push(
    `Requirement coverage (\`test-documentation/traceability-matrix.csv\`): **${summary.requirementCoverage.verified}/${summary.requirementCoverage.total}** requirements fully verified, ${summary.requirementCoverage.partial} partial.`
  );
  md.push('');
}
md.push('## 5. Defects');
md.push('');
if (summary.defects) {
  md.push(
    `\`test-documentation/defect-log.csv\`: **${summary.defects.total} defects recorded**, ${summary.defects.open} still open, ${summary.defects.seeded} labelled SEEDED (injected for the detection exercise).`
  );
  if (defectRows) {
    md.push('');
    md.push('| Defect | Title | Severity | Status | Retest |');
    md.push('|--------|-------|----------|--------|--------|');
    for (const row of defectRows) {
      md.push(
        `| ${row.DefectID} | ${row.Title} | ${row.Severity} | ${row.Status} | ${row.RetestResult || '-'} |`
      );
    }
  }
} else {
  md.push('No defect log found.');
}
md.push('');
md.push('## 6. Risk assessment (derived from this run)');
md.push('');
const failable = totals.failed;
md.push(`- Functional risk: **${failable === 0 ? 'low' : 'elevated'}** — automated + manual suites report ${failable} failing check(s).`);
md.push('- Security risk: medium overall for real deployments - authentication, session handling and object-level authorization are covered by tests, but there is no rate limiting, CSRF token, MFA or external identity provider.');
md.push('- Performance risk: unknown at production scale — the baseline is a local loopback run against file-backed SQLite with a single Node process; there is no soak, spike or multi-user test.');
md.push('- Data risk: low for the demo — deterministic resets, FK/CHECK constraints validated by SQL checks and count parity verified between API and SQL.');
md.push('');
md.push('## 7. Release recommendation');
md.push('');
if (failable === 0) {
  md.push('**Ready for the documented demo scope.** All executed suites pass on the seeded test database. This is a portfolio-quality reference implementation, not a production release: see limitations below.');
} else {
  md.push(`**Not green.** ${failable} check(s) are failing in this run. Investigate the failing suites in the raw report files before any demo or handover.`);
}
md.push('');
md.push('## 8. Known limitations');
md.push('');
md.push('- No rate limiting / brute-force protection on the auth endpoints (documented, not a seeded bug).');
md.push('- No 405 handler: unsupported methods on existing paths fall through to the 404 handler (observed in exploratory testing TASK-TC-303).');
md.push('- Session expiry is 8h and not sliding; no refresh-token or remember-me flow.');
md.push('- SQLite file database: single-writer; not evaluated for concurrent multi-instance use.');
md.push('- `npm run lint` covers JavaScript/mjs sources; TypeScript spec files are transpiled by Playwright and not linted (no TypeScript ESLint parser in the dependency allow-list).');
md.push('- Seeded defects are OFF by default; run `npm run seeded:demo` to see the labelled detection exercise.');
md.push('');
md.push('## 9. Artifacts');
md.push('');
md.push('- Raw Playwright API report: `test-reports/playwright/api.json`, HTML: `playwright-report/`');
md.push('- Raw Playwright UI report: `test-reports/playwright/ui.json`');
md.push('- SQL validation report: `test-reports/db-results.json`');
md.push('- Postman/newman report + summary: `test-reports/newman/`');
md.push('- Performance baseline: `test-reports/performance-baseline.json` / `.md`');
md.push('- Manual test case export: `test-documentation/test-cases.csv`');
md.push('- Traceability: `test-documentation/traceability-matrix.csv`');
md.push('- Defects: `test-documentation/defect-log.csv`');
md.push('- Screenshots: `test-evidence/screenshots/`');
md.push('- Raw command logs: `test-evidence/logs/`');
md.push('');

const reportPath = path.join(REPORTS, `execution-report-${dateStamp}.md`);
writeFileSync(reportPath, md.join('\n'));
mkdirSync(DOCS, { recursive: true });
writeFileSync(path.join(DOCS, 'execution-report.md'), md.join('\n'));

console.log(`[report] wrote test-reports/summary.json and ${path.relative(PROJECT_ROOT, reportPath)}`);
console.log(
  `[report] totals: ${totals.total} checks, ${totals.passed} passed, ${totals.failed} failed, ${totals.skipped} skipped`
);
process.exit(totals.failed > 0 ? 1 : 0);
