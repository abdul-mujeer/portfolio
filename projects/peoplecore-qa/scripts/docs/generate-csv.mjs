#!/usr/bin/env node
/**
 * Generates the documentation artefacts that must never drift from the test data:
 *
 *   test-documentation/test-cases.csv
 *   test-documentation/traceability-matrix.csv
 *   test-documentation/defect-log.csv
 *   test-documentation/role-permission-matrix.md
 *   test-documentation/requirements.md
 *   test-documentation/acceptance-criteria.md
 *   test-documentation/exploratory-testing.md
 *
 *   npm run docs:csv
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { acceptanceCriteria, requirements } from '../../test-data/tests/requirements.mjs';
import { testCases } from '../../test-data/tests/test-cases.mjs';
import { defects, seededDefects } from '../../test-data/tests/defects.mjs';
import { capabilityMatrix, roles } from '../../test-data/tests/permissions.mjs';
import { charters, sessionNotes } from '../../test-data/tests/exploratory.mjs';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT_DIR = path.join(PROJECT_ROOT, 'test-documentation');

/* ------------------------------------------------------------------ CSV tools */

/** RFC 4180: quote when the value contains a comma, quote or line break. */
function csvValue(value) {
  const text = value === null || value === undefined ? '' : String(value);
  if (/[",\r\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function toCsv(header, rows) {
  const lines = [header.map(csvValue).join(',')];
  for (const row of rows) lines.push(row.map(csvValue).join(','));
  return `${lines.join('\r\n')}\r\n`;
}

function writeFile(name, content) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, name), content, 'utf8');
  const bytes = fs.statSync(path.join(OUT_DIR, name)).size;
  console.log(`[docs] ${name} (${bytes} bytes)`);
}

/* --------------------------------------------------------------- environment */

function environmentFor(testCase) {
  const automation = testCase.automation ?? '';
  if (automation.includes('tests/db') || testCase.testType === 'Database') {
    return 'Windows 11 · Node v24 · node:sqlite · .data/db-checks (fresh seeded copies)';
  }
  if (automation.includes('newman')) {
    return 'Windows 11 · Node v24 · newman 6 · port 4210 · .data/peoplecore.newman.db';
  }
  if (automation.includes('screenshots')) {
    return 'Windows 11 · Node v24 · Chromium · port 4220 · .data/peoplecore.screenshots.db';
  }
  if (automation.includes('seeded-defect-run')) {
    return 'Windows 11 · Node v24 · port 4240 · .data/peoplecore.seeded.db (SEED_DEFECTS=1)';
  }
  if ((testCase.testType ?? '').includes('UI')) {
    return 'Windows 11 · Node v24 · Chromium · http://127.0.0.1:4200 · .data/peoplecore.test.db';
  }
  return 'Windows 11 · Node v24 · http://127.0.0.1:4200 (Playwright webServer) · .data/peoplecore.test.db';
}

/* --------------------------------------------------------------- test cases */

const TEST_CASE_HEADER = [
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

const testCaseRows = testCases.map((testCase) => [
  testCase.id,
  testCase.requirementId,
  testCase.module,
  testCase.scenario,
  testCase.preconditions,
  testCase.testData,
  testCase.steps,
  testCase.expectedResult,
  testCase.actualResult,
  testCase.status,
  testCase.priority,
  testCase.testType,
  environmentFor(testCase),
  testCase.defectId,
  testCase.evidence,
  testCase.notes,
]);

writeFile('test-cases.csv', toCsv(TEST_CASE_HEADER, testCaseRows));

/* ------------------------------------------------------- traceability matrix */

const TRACE_HEADER = ['RequirementID', 'RequirementSummary', 'AcceptanceCriteriaIDs', 'TestCases', 'CoverageStatus', 'Notes'];

const traceRows = requirements.map((requirement) => {
  const cases = testCases.filter((testCase) => testCase.requirementId === requirement.id);
  const notExecuted = cases.filter((testCase) => testCase.status === 'Not Executed');
  const coverage = cases.length === 0 ? 'Not covered' : notExecuted.length === cases.length ? 'Not covered' : 'Covered';
  const notes = [
    `${cases.length} test case(s)`,
    notExecuted.length ? `${notExecuted.length} not executed (${notExecuted.map((testCase) => testCase.id).join(', ')})` : null,
    requirement.status,
  ]
    .filter(Boolean)
    .join(' · ');
  return [
    requirement.id,
    requirement.title,
    requirement.acceptanceCriteria.map((criterion) => criterion.id).join(' '),
    cases.map((testCase) => testCase.id).join(' '),
    coverage,
    notes,
  ];
});

writeFile('traceability-matrix.csv', toCsv(TRACE_HEADER, traceRows));

/* ----------------------------------------------------------------- defect log */

const DEFECT_HEADER = [
  'DefectID',
  'Title',
  'Module',
  'Severity',
  'Priority',
  'Status',
  'Type',
  'Environment',
  'Build',
  'StepsToReproduce',
  'ExpectedResult',
  'ActualResult',
  'DetectedBy',
  'DetectedOn',
  'TestCaseID',
  'Evidence',
  'RootCause',
  'RetestResult',
  'RegressionResult',
  'ClosedOn',
  'Rationale',
];

const defectRows = defects.map((defect) => [
  defect.id,
  defect.title,
  defect.module,
  defect.severity,
  defect.priority,
  defect.status,
  defect.type,
  defect.environment,
  defect.build,
  defect.stepsToReproduce,
  defect.expectedResult,
  defect.actualResult,
  defect.detectedBy,
  defect.detectedOn,
  defect.testCaseId,
  defect.evidence,
  defect.rootCause,
  defect.retestResult,
  defect.regressionResult,
  defect.closedOn,
  defect.rationale,
]);

writeFile('defect-log.csv', toCsv(DEFECT_HEADER, defectRows));

/* ------------------------------------------------------- role permission matrix */

const linkedCases = {
  'Sign in, read own session': 'HR-TC-001, HR-TC-002',
  'Read own employee profile': 'HR-TC-039, HR-TC-061',
  'Read another employee profile': 'HR-TC-059, HR-TC-061',
  'Read own salary': 'HR-TC-002, HR-TC-030',
  'Read the salary of another employee': 'HR-TC-059',
  'List employees': 'HR-TC-016, HR-TC-059',
  'Create employee': 'HR-TC-025, HR-TC-064',
  'Update employee record': 'HR-TC-024, HR-TC-065',
  'Change an employee role': 'HR-TC-065',
  'Delete employee': 'HR-TC-022, HR-TC-023, HR-TC-065',
  'List departments': 'HR-TC-032',
  'Create or rename department': 'HR-TC-031, HR-TC-032',
  'Read attendance': 'HR-TC-034, HR-TC-039',
  'Write attendance': 'HR-TC-064',
  'Read leave requests': 'HR-TC-053',
  'Submit leave for themself': 'HR-TC-041, HR-TC-053',
  'Approve or reject leave': 'HR-TC-046, HR-TC-049, HR-TC-064',
  'Cancel leave': 'HR-TC-048, HR-TC-051',
  'Read audit logs': 'HR-TC-054, HR-TC-059, HR-TC-061',
  'Read reports summary': 'HR-TC-056',
  'Record attendance for a terminated employee': 'HR-TC-038, HR-TC-064',
  'Submit leave while terminated': 'HR-TC-050',
  'Sign in while terminated': 'HR-TC-050',
  'Delete own account': 'HR-TC-023',
};

const matrixLines = [
  '# PeopleCore — role permission matrix',
  '',
  '> Generated from `test-data/tests/permissions.mjs` by `npm run docs:csv`. Do not edit by hand.',
  '',
  'Legend: **ALLOW** implemented and verified · **ALL** unrestricted scope · **TEAM** self + direct reports · **SELF** own record only ·',
  '**CONDITIONAL** allowed with an extra rule (noted) · **OWN PENDING** only the caller\'s pending record · **DENY** refused with a 4xx status code.',
  '',
  `| Capability | ${roles.join(' | ')} | Notes | Verified by |`,
  `|---|${roles.map(() => '---').join('|')}|---| ---|`,
];

for (const row of capabilityMatrix) {
  const cells = roles.map((role) => `**${row[role]}**`);
  matrixLines.push(`| ${row.capability} | ${cells.join(' | ')} | ${row.notes} | ${linkedCases[row.capability] ?? '—'} |`);
}

matrixLines.push(
  '',
  '## How the matrix is enforced',
  '',
  'All authorization lives in `app/server/src/lib/scope.js` and is applied inside the service layer, so the JSON API and the EJS pages',
  'share exactly the same rules. The UI only *hides* controls; every hidden control is also refused by the server (see HR-TC-059, HR-TC-064, HR-TC-065).',
  '',
  '## Seeded defect toggle',
  '',
  'With `SEED_DEFECTS=1` the manager list scope is deliberately dropped (HR-SEEDED-01). Clean runs (`SEED_DEFECTS=0`, the default) enforce',
  'the matrix above; `npm run seeded:evidence` demonstrates the difference.',
);

writeFile('role-permission-matrix.md', `${matrixLines.join('\n')}\n`);

/* ------------------------------------------------------------- requirements.md */

const requirementLines = [
  '# PeopleCore — requirements',
  '',
  '> Generated from `test-data/tests/requirements.mjs` by `npm run docs:csv`.',
  '',
  `Total requirements: **${requirements.length}** · acceptance criteria: **${acceptanceCriteria.length}** · manual test cases: **${testCases.length}**.`,
  '',
];

for (const requirement of requirements) {
  const cases = testCases.filter((testCase) => testCase.requirementId === requirement.id).map((testCase) => testCase.id);
  requirementLines.push(
    `## ${requirement.id} — ${requirement.title}`,
    '',
    `- **Module:** ${requirement.module}`,
    `- **Priority:** ${requirement.priority}`,
    `- **Status:** ${requirement.status}`,
    `- **Test cases:** ${cases.join(', ') || 'none'}`,
    '',
    requirement.description,
    '',
    '### Acceptance criteria',
    '',
  );
  for (const criterion of requirement.acceptanceCriteria) {
    requirementLines.push(`- **${criterion.id}** — ${criterion.text}`);
  }
  requirementLines.push('');
}

writeFile('requirements.md', `${requirementLines.join('\n')}\n`);

/* -------------------------------------------------------- acceptance-criteria.md */

const criteriaLines = [
  '# PeopleCore — acceptance criteria',
  '',
  '> Generated from `test-data/tests/requirements.mjs` by `npm run docs:csv`.',
  '',
  '| Criterion | Requirement | Module | Acceptance criterion | Test cases | Status |',
  '|---|---|---|---|---|---|',
];

for (const criterion of acceptanceCriteria) {
  const cases = testCases.filter((testCase) => testCase.requirementId === criterion.requirementId);
  const notExecuted = cases.filter((testCase) => testCase.status === 'Not Executed');
  const status = cases.length === 0 ? 'Not covered' : notExecuted.length ? 'Covered (partial evidence)' : 'Covered';
  criteriaLines.push(
    `| ${criterion.id} | ${criterion.requirementId} | ${criterion.module} | ${criterion.text} | ${cases.map((testCase) => testCase.id).join(', ')} | ${status} |`,
  );
}

writeFile('acceptance-criteria.md', `${criteriaLines.join('\n')}\n`);

/* ----------------------------------------------------- exploratory-testing.md */

const exploratoryLines = [
  '# PeopleCore — exploratory testing',
  '',
  '> Generated from `test-data/tests/exploratory.mjs` by `npm run docs:csv`.',
  '',
  'Exploratory sessions are timeboxed charters, not scripts. Findings are promoted to the defect log when they are actionable,',
  'or recorded as RISK when they are accepted behaviour that must stay documented.',
  '',
  `Charters: **${charters.length}** · executed: **${charters.filter((charter) => charter.status === 'Executed').length}**.`,
  '',
  '## Session notes',
  '',
];

for (const note of sessionNotes) {
  exploratoryLines.push(
    `- **${note.date}** (${note.durationMinutes} min) — ${note.focus}`,
    `  - Outcome: ${note.outcome}`,
    `  - Next steps: ${note.nextSteps.join(' ')}`,
    '',
  );
}

for (const charter of charters) {
  exploratoryLines.push(
    `## ${charter.id} — ${charter.title}`,
    '',
    `- **Area:** ${charter.area}`,
    `- **Timebox:** ${charter.timebox} minutes · **Status:** ${charter.status}${charter.executedOn ? ` · **Executed:** ${charter.executedOn}` : ''}`,
    `- **Setup:** ${charter.setup}`,
    '',
    `**Mission:** ${charter.mission}`,
    '',
    '| Finding | Type |',
    '|---|---|',
  );
  for (const finding of charter.findings) {
    exploratoryLines.push(`| ${finding.text} | ${finding.type} |`);
  }
  exploratoryLines.push('', `**Notes:** ${charter.notes}`, '');
}

exploratoryLines.push(
  '## Seeded-defect evidence',
  '',
  'Both seeded defects below are reproducible on demand and are **off by default**:',
  '',
  `- ${seededDefects.map((defect) => `${defect.id} (${defect.module})`).join('\n- ')}`,
  '',
  '`npm run seeded:evidence` boots the app with `SEED_DEFECTS=1` on a private port, runs the two detection probes and stores the',
  'result in `test-evidence/seeded-defects/seed-defects-evidence.json`. The default suites run with `SEED_DEFECTS=0` and must stay green.',
);

writeFile('exploratory-testing.md', `${exploratoryLines.join('\n')}\n`);

/* ------------------------------------------------------------------- summary */

const statusCounts = testCases.reduce((accumulator, testCase) => {
  accumulator[testCase.status] = (accumulator[testCase.status] ?? 0) + 1;
  return accumulator;
}, {});

console.log(
  `[docs] ${testCases.length} test cases (${Object.entries(statusCounts)
    .map(([status, count]) => `${status}: ${count}`)
    .join(', ')}) across ${requirements.length} requirements and ${defects.length} defects`,
);
