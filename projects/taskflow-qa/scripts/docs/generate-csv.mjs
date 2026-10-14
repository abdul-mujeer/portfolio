import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { PROJECT_ROOT } from '../../app/server/src/db.js';
import { requirements } from '../../test-data/tests/requirements.mjs';
import { testCases } from '../../test-data/tests/test-cases.mjs';

/**
 * Regenerates test-documentation/test-cases.csv + traceability-matrix.csv from
 * test-data/tests/*.mjs (single source of truth).
 *
 * Execution status/actual values are filled ONLY from real results:
 *  - Playwright JSON reports (test titles carry TASK-TC-nnn ids)
 *  - test-reports/db-results.json (SQL validation checks)
 *  - test-evidence/logs/manual-results.json (scripted manual executions)
 * Cases without evidence are exported as `Not Executed` with an empty
 * ActualResult and a note explaining why.
 */
const DOCS_DIR = path.join(PROJECT_ROOT, 'test-documentation');
mkdirSync(DOCS_DIR, { recursive: true });

// ------------------------------------------------------------- execution data

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

const evidence = [];

// Prefer the per-suite reports from the orchestrator; fall back to the shared
// results.json only when neither per-suite file exists (standalone runs).
const perSuiteReports = ['test-reports/playwright/api.json', 'test-reports/playwright/ui.json'];
const hasPerSuite = perSuiteReports.some((file) => readJson(file) !== null);
const reportFiles = hasPerSuite ? perSuiteReports : ['test-reports/playwright/results.json'];

for (const reportFile of reportFiles) {
  const report = readJson(reportFile);
  if (!report) continue;
  const specs = (report.suites ?? []).flatMap((suite) => walkSpecs(suite));
  for (const spec of specs) {
    const ids = [...(spec.title ?? '').matchAll(/TASK-TC-(\d{3})/g)].map((m) => `TASK-TC-${m[1]}`);
    if (!ids.length) continue;
    for (const caseId of ids) {
      evidence.push({
        caseId,
        status: spec.ok === false ? 'Fail' : 'Pass',
        source: `${reportFile} — "${spec.title}"`,
      });
    }
  }
}

const dbResults = readJson('test-reports/db-results.json');
if (dbResults) {
  for (const check of dbResults.checks) {
    evidence.push({
      caseId: check.caseId,
      status: check.status === 'PASS' ? 'Pass' : 'Fail',
      source: `test-reports/db-results.json — ${check.id} (${check.name})`,
    });
  }
}

const manualResults = readJson('test-evidence/logs/manual-results.json');
if (manualResults) {
  for (const result of manualResults.results) {
    evidence.push({
      caseId: result.caseId,
      status: result.status === 'PASS' ? 'Pass' : 'Fail',
      source: `test-evidence/logs/manual-results.json — ${result.name}`,
    });
  }
}

const executionMap = new Map();
for (const item of evidence) {
  const existing = executionMap.get(item.caseId);
  if (!existing) {
    executionMap.set(item.caseId, { status: item.status, sources: [item.source] });
  } else {
    if (item.status === 'Fail') existing.status = 'Fail';
    existing.sources.push(item.source);
  }
}

// ------------------------------------------------------------------ CSV utils

function csv(value) {
  const text = value === null || value === undefined ? '' : String(value);
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function csvRow(cells) {
  return cells.map(csv).join(',');
}

const ENVIRONMENT = 'Local Windows (Node v24, npm scripts) - seeded test DB .data/taskflow.test.db - API http://127.0.0.1:4300';

// ---------------------------------------------------------------- test cases

const header = [
  'TestCaseID',
  'RequirementID',
  'Module',
  'Scenario',
  'Preconditions',
  'TestData',
  'Steps',
  'ExpectedResult',
  'ActualResult',
  'Status',
  'Priority',
  'TestType',
  'Environment',
  'DefectID',
  'EvidenceLink',
  'Notes',
];

const caseRows = [csvRow(header)];
const caseIds = new Set(testCases.map((testCase) => testCase.id));
const unknownEvidence = evidence.filter((item) => !caseIds.has(item.caseId));

for (const testCase of testCases) {
  const execution = executionMap.get(testCase.id);
  const status = execution ? execution.status : 'Not Executed';
  const actual =
    execution === undefined
      ? ''
      : execution.status === 'Pass'
        ? testCase.actualOnPass ?? 'Observed behavior matched the expected result during execution.'
        : 'Divergence observed - see the linked defect and raw evidence.';
  const evidenceLink = execution ? [...new Set(execution.sources)].join(' | ') : '';
  const notes =
    execution === undefined
      ? `${testCase.notes ? `${testCase.notes} ` : ''}Not executed in this build - run the referenced suite and regenerate with npm run docs:csv.`
      : testCase.notes ?? '';
  caseRows.push(
    csvRow([
      testCase.id,
      testCase.requirement,
      testCase.module,
      testCase.scenario,
      testCase.preconditions,
      testCase.testData,
      (testCase.steps ?? []).join('\n'),
      testCase.expected,
      actual,
      status,
      testCase.priority,
      testCase.type,
      testCase.environment ?? ENVIRONMENT,
      testCase.defect ?? '',
      evidenceLink,
      notes,
    ])
  );
}

// UTF-8 BOM so Excel on Windows renders non-ASCII content (arrows, dashes) correctly.
const BOM = '\uFEFF';
writeFileSync(path.join(DOCS_DIR, 'test-cases.csv'), `${BOM}${caseRows.join('\r\n')}\r\n`);

// -------------------------------------------------------------- traceability

const traceHeader = [
  'RequirementID',
  'RequirementSummary',
  'AcceptanceCriteriaIDs',
  'TestCases',
  'CoverageStatus',
  'Notes',
];

const traceRows = [csvRow(traceHeader)];
for (const requirement of requirements) {
  const mapped = testCases.filter((testCase) => testCase.requirement === requirement.id);
  const ids = mapped.map((testCase) => testCase.id).join(' ');
  let coverage = 'Not Covered';
  let notes = '';
  if (mapped.length > 0) {
    const statuses = mapped.map((testCase) => executionMap.get(testCase.id)?.status ?? 'Not Executed');
    if (statuses.every((status) => status === 'Pass')) {
      coverage = 'Verified';
      notes = `${mapped.length} case(s) executed and passed in the current evidence set.`;
    } else if (statuses.some((status) => status === 'Fail')) {
      coverage = 'Failing';
      notes = `${statuses.filter((status) => status === 'Fail').length} failing case(s) - see defect log.`;
    } else {
      coverage = 'Partial';
      notes = `${statuses.filter((status) => status === 'Not Executed').length} case(s) not executed with current evidence.`;
    }
  } else {
    notes = 'No test cases mapped yet.';
  }
  traceRows.push(
    csvRow([
      requirement.id,
      requirement.title,
      (requirement.acceptanceCriteria ?? []).map((ac) => ac.id).join(' '),
      ids,
      coverage,
      notes,
    ])
  );
}
writeFileSync(path.join(DOCS_DIR, 'traceability-matrix.csv'), `${BOM}${traceRows.join('\r\n')}\r\n`);

const executed = testCases.filter((testCase) => executionMap.has(testCase.id));
const passed = testCases.filter((testCase) => executionMap.get(testCase.id)?.status === 'Pass');
const failed = testCases.filter((testCase) => executionMap.get(testCase.id)?.status === 'Fail');
console.log(`[docs:csv] wrote ${testCases.length} test cases (${passed.length} Pass, ${failed.length} Fail, ${testCases.length - executed.length} Not Executed)`);
console.log(`[docs:csv] wrote traceability for ${requirements.length} requirements`);
if (unknownEvidence.length) {
  console.warn(
    `[docs:csv] ${unknownEvidence.length} evidence entry(ies) reference unknown case ids: ` +
      [...new Set(unknownEvidence.map((item) => item.caseId))].join(', ')
  );
}
