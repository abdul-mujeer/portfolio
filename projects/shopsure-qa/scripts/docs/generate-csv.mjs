#!/usr/bin/env node
/**
 * Generates the CSV deliverables from the single source of truth in test-data/tests/.
 *
 * Outputs (RFC-4180 quoting, Excel-safe, no BOM):
 *   test-documentation/test-cases.csv
 *   test-documentation/traceability-matrix.csv
 *   test-documentation/test-scenarios.md   (scenario inventory + decision tables)
 *
 * Usage: npm run docs:csv
 */
import fs from "node:fs";
import path from "node:path";
import { PROJECT_ROOT } from "../lib/server-control.mjs";
import { requirements } from "../../test-data/tests/requirements.mjs";
import { testCases } from "../../test-data/tests/test-cases.mjs";
import { defects } from "../../test-data/tests/defects.mjs";

const outDir = path.join(PROJECT_ROOT, "test-documentation");
fs.mkdirSync(outDir, { recursive: true });

/** Quotes a CSV field exactly when required (commas, quotes, newlines). */
function csvField(value) {
  const text = value === undefined || value === null ? "" : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function toCsv(header, rows) {
  const lines = [header.map(csvField).join(",")];
  for (const row of rows) lines.push(row.map(csvField).join(","));
  return `${lines.join("\n")}\n`;
}

// ------------------------------------------------------------------ test-cases.csv
const caseHeader = [
  "TestCaseID",
  "RequirementID",
  "Module",
  "Scenario",
  "Preconditions",
  "TestData",
  "Steps",
  "ExpectedResult",
  "ActualResult",
  "Status",
  "Priority",
  "TestType",
  "Environment",
  "DefectID",
  "EvidenceLink",
  "Notes",
];

const caseRows = testCases.map((testCase) => [
  testCase.id,
  testCase.requirementId,
  testCase.module,
  testCase.scenario,
  testCase.preconditions,
  testCase.testData,
  testCase.steps.map((step, index) => `${index + 1}. ${step}`).join("\n"),
  testCase.expected,
  testCase.actual,
  testCase.status,
  testCase.priority,
  testCase.type,
  "ShopSure demo app (Node 24, Express, SQLite) on Windows 11; API port 4180, Chromium 156",
  testCase.defectId,
  testCase.evidence,
  testCase.notes,
]);

fs.writeFileSync(path.join(outDir, "test-cases.csv"), toCsv(caseHeader, caseRows));

// ------------------------------------------------------------------ traceability-matrix.csv
const matrixHeader = [
  "RequirementID",
  "RequirementSummary",
  "AcceptanceCriteriaIDs",
  "TestCases",
  "CoverageStatus",
  "Notes",
];

const matrixRows = requirements.map((requirement) => {
  const linked = testCases.filter((testCase) => testCase.requirementId === requirement.id);
  const passed = linked.filter((testCase) => testCase.status === "Pass").length;
  const notExecuted = linked.filter((testCase) => testCase.status === "Not Executed").length;
  const failed = linked.filter((testCase) => testCase.status === "Fail").length;

  let coverage = "Not covered";
  if (linked.length > 0 && failed === 0 && notExecuted === 0) coverage = `Covered (${passed}/${linked.length} passed)`;
  else if (linked.length > 0 && failed === 0) coverage = `Partially covered (${passed} passed, ${notExecuted} not executed)`;
  else if (linked.length > 0) coverage = `Covered with failures (${failed} failing)`;

  return [
    requirement.id,
    requirement.title,
    requirement.acceptance.map((criterion) => criterion.split(":")[0]).join("; "),
    linked.map((testCase) => testCase.id).join("; "),
    coverage,
    `${requirement.priority} priority · ${requirement.module}`,
  ];
});

fs.writeFileSync(path.join(outDir, "traceability-matrix.csv"), toCsv(matrixHeader, matrixRows));

// ------------------------------------------------------------------ test-scenarios.md
const byModule = new Map();
for (const testCase of testCases) {
  if (!byModule.has(testCase.module)) byModule.set(testCase.module, []);
  byModule.get(testCase.module).push(testCase);
}

const statusCounts = testCases.reduce((accumulator, testCase) => {
  accumulator[testCase.status] = (accumulator[testCase.status] ?? 0) + 1;
  return accumulator;
}, {});

const scenarios = [
  "# ShopSure — test scenarios, coverage groups and decision tables",
  "",
  `> Generated from \`test-data/tests/test-cases.mjs\` by \`npm run docs:csv\` — do not edit by hand.`,
  "",
  `**Test cases:** ${testCases.length} across ${requirements.length} requirements.`,
  "",
  `**Execution status:** ${Object.entries(statusCounts)
    .map(([status, count]) => `${status}: ${count}`)
    .join(" · ")}`,
  "",
  "## 1. Coverage groups by module",
  "",
  ...[...byModule.entries()].flatMap(([module, cases]) => [
    `### ${module} (${cases.length} cases)`,
    "",
    "| Case | Type | Priority | Scenario | Status |",
    "|------|------|----------|----------|--------|",
    ...cases.map((testCase) => `| ${testCase.id} | ${testCase.type} | ${testCase.priority} | ${testCase.scenario} | ${testCase.status} |`),
    "",
  ]),
  "## 2. Decision table — order pricing",
  "",
  "| # | Subtotal condition | Discount (10%) | Shipping (flat 5.00) | Rule verified by |",
  "|---|--------------------|----------------|----------------------|------------------|",
  "| 1 | subtotal < 50 | no | yes | SHOP-TC-050 (49.99) |",
  "| 2 | 50 <= subtotal < 100 | no | free | SHOP-TC-050 (50.00) |",
  "| 3 | subtotal = 99.99 | no | free | SHOP-TC-051 |",
  "| 4 | subtotal >= 100 | yes (10%) | free | SHOP-TC-051 (100.00), SHOP-TC-052 |",
  "",
  "## 3. Decision table — order status transitions",
  "",
  "| Current status | PAID | SHIPPED | DELIVERED | CANCELED |",
  "|----------------|------|---------|-----------|----------|",
  "| PENDING | allowed | rejected (422) | rejected (422) | allowed |",
  "| PAID | no-op | allowed | rejected (422) | allowed |",
  "| SHIPPED | rejected (422) | no-op | allowed | rejected (422) |",
  "| DELIVERED | rejected (422) | rejected (422) | no-op (changed=false) | rejected (422) |",
  "| CANCELED | rejected (422) | rejected (422) | rejected (422) | no-op |",
  "",
  "Verified by SHOP-TC-069, SHOP-TC-070, SHOP-TC-071, SHOP-TC-066, SHOP-TC-067.",
  "",
  "## 4. Decision table — cart quantity validation",
  "",
  "| Input | Existing line qty | Stock | Result | Rule verified by |",
  "|-------|-------------------|-------|--------|------------------|",
  "| quantity 1..10, first add | 0 | >= qty | accepted (201) | SHOP-TC-038 |",
  "| quantity 11 | any | any | 400 validation | SHOP-TC-038 |",
  "| quantity 0 / 1.5 | any | any | 400 validation | SHOP-TC-038, SHOP-TC-043 |",
  "| quantity 4 | 0 | 3 | 422 INSUFFICIENT_STOCK | SHOP-TC-039 |",
  "| quantity 5 | 6 | 25 | 422 QUANTITY_LIMIT_EXCEEDED | SHOP-TC-040 |",
  "| quantity 1 | 0 | 0 | 422 OUT_OF_STOCK | SHOP-TC-041 |",
  "",
  "## 5. Equivalence partitioning — search terms",
  "",
  "| Partition | Example | Expectation | Case |",
  "|-----------|---------|-------------|------|",
  "| Exact match | 'Ember Ceramic Mug Set' | 1 result | SHOP-TC-014 |",
  "| Partial, different case | 'WIRELESS' | only matching items | SHOP-TC-014 |",
  "| Wildcard characters | '%', '_' | literal handling only | SHOP-TC-015 |",
  "| No match | 'zzzz-no-such-product' | empty page, 200 | SHOP-TC-016 |",
  "| Whitespace only | '  ' | treated as no filter | MAN-EDGE-08 |",
  "| Very long | 500 characters | empty page, 200 | MAN-EDGE-02 |",
  "",
  "## 6. Exploratory charters",
  "",
  "1. **Hostile input charter** — attack the catalog and cart with injections, oversized payloads and malformed",
  "   JSON; look for 5xx responses, data damage or information leaks (executed: MAN-SEC-01..13).",
  "2. **Boundary sweep charter** — walk every numeric boundary in the API (quantities, limits, prices, pages)",
  "   and confirm the documented rule at the exact edge (executed: MAN-EDGE-01..09).",
  "3. **Workflow charter** — drive an order through every status by both customer and admin paths, including",
  "   illegal jumps, and confirm stock and history stay consistent (executed: API suites + MAN-DATA-01/02).",
  "",
].join("\n");

fs.writeFileSync(path.join(outDir, "test-scenarios.md"), scenarios);

// ------------------------------------------------------------------ requirements.md + acceptance-criteria.md
const requirementsDoc = [
  "# ShopSure — product requirements",
  "",
  "> Generated from `test-data/tests/requirements.mjs` by `npm run docs:csv` — do not edit by hand.",
  "",
  `ShopSure is a fictional demo storefront built specifically as a test target for this QA portfolio project.`,
  `It is not a commercial product and contains no real customer data.`,
  "",
  `**${requirements.length} requirements** drive **${testCases.length} test cases**.`,
  "",
  "| ID | Module | Requirement | Priority |",
  "|----|--------|-------------|----------|",
  ...requirements.map((requirement) => `| ${requirement.id} | ${requirement.module} | ${requirement.title} | ${requirement.priority} |`),
  "",
  "## Details",
  "",
  ...[
    ...requirements.flatMap((requirement) => [
      `### ${requirement.id} — ${requirement.title}`,
      "",
      `- **Module:** ${requirement.module}`,
      `- **Priority:** ${requirement.priority}`,
      `- **Description:** ${requirement.description}`,
      `- **Test cases:** ${testCases
        .filter((testCase) => testCase.requirementId === requirement.id)
        .map((testCase) => testCase.id)
        .join(", ")}`,
      "",
    ]),
  ],
].join("\n");

const acceptanceDoc = [
  "# ShopSure — acceptance criteria",
  "",
  "> Generated from `test-data/tests/requirements.mjs` by `npm run docs:csv` — do not edit by hand.",
  "",
  "| Criterion | Requirement | Statement | Verified by |",
  "|-----------|-------------|-----------|-------------|",
  ...requirements.flatMap((requirement) =>
    requirement.acceptance.map((criterion) => {
      const [id, ...rest] = criterion.split(":");
      const linkedCases = testCases
        .filter((testCase) => testCase.requirementId === requirement.id)
        .map((testCase) => testCase.id)
        .join(", ");
      return `| ${id.trim()} | ${requirement.id} | ${rest.join(":").trim()} | ${linkedCases} |`;
    })
  ),
  "",
  "## Definition of done for the ShopSure demo",
  "",
  "- Every acceptance criterion above is linked to at least one executed test case (see the traceability matrix).",
  "- The automated suites (API, UI, SQL, Postman) pass on a freshly seeded database.",
  "- Known limitations and any open defects are documented in `risk-assessment.md` and `defect-log.csv`.",
  "",
].join("\n");

fs.writeFileSync(path.join(outDir, "requirements.md"), requirementsDoc);
fs.writeFileSync(path.join(outDir, "acceptance-criteria.md"), acceptanceDoc);

// ------------------------------------------------------------------ defect-log.csv
const defectHeader = [
  "DefectID",
  "Title",
  "Module",
  "Severity",
  "Priority",
  "Status",
  "Type",
  "Environment",
  "Build",
  "StepsToReproduce",
  "ExpectedResult",
  "ActualResult",
  "DetectedBy",
  "DetectedOn",
  "TestCaseID",
  "Evidence",
  "RootCause",
  "RetestResult",
  "RegressionResult",
  "ClosedOn",
  "Rationale",
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
  defect.steps.map((step, index) => `${index + 1}. ${step}`).join("\n"),
  defect.expected,
  defect.actual,
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

fs.writeFileSync(path.join(outDir, "defect-log.csv"), toCsv(defectHeader, defectRows));

const genuine = defects.filter((defect) => !defect.id.includes("-1"));
const seeded = defects.filter((defect) => defect.id.includes("-1"));
console.log(`defect-log.csv: ${defects.length} defects (${genuine.length} genuinely found, ${seeded.length} seeded demonstration defects)`);

const passed = testCases.filter((testCase) => testCase.status === "Pass").length;
const notExecuted = testCases.filter((testCase) => testCase.status === "Not Executed").length;
console.log(`test-cases.csv: ${testCases.length} cases (${passed} passed, ${notExecuted} not executed)`);
console.log(`traceability-matrix.csv: ${requirements.length} requirements`);
console.log("test-scenarios.md, requirements.md, acceptance-criteria.md: generated");
