/**
 * Shared normaliser for the three QA projects' report artefacts.
 *
 * The projects are independent packages, so their `summary.json` files have slightly different
 * shapes. This module converts all of them into one structure and falls back to the CSV deliverables
 * when a project reports a number in a different place. It never estimates: a missing value is null.
 */
import fs from "node:fs";
import path from "node:path";

export function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

/** RFC-4180-tolerant CSV reader (handles quoted commas, quotes and newlines). */
export function parseCsv(file) {
  if (!fs.existsSync(file)) return [];
  const text = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  if (rows.length === 0) return [];
  const [header, ...body] = rows;
  return body
    .filter((values) => values.some((value) => value.trim() !== ""))
    .map((values) => Object.fromEntries(header.map((key, index) => [key.trim(), (values[index] ?? "").trim()])));
}

/**
 * A defect is "deliberately seeded" only when its identifier or explicit Type says so.
 * The title is NOT inspected: a genuine defect about seed data (for example "Seeded DELIVERED order
 * had an incomplete event history") is still a real finding, not an injected one.
 */
export function isSeededDefect(row) {
  const id = row.DefectID ?? "";
  const type = row.Type ?? "";
  return /^SEEDED/i.test(id) || /-1\d\d$/.test(id) || /\bseeded\b/i.test(type);
}

function suiteFromObject(key, suite) {
  const total = suite.total ?? suite.executed ?? 0;
  const passed = suite.passed ?? 0;
  const failed = suite.failed ?? 0;
  const labels = { api: "API tests", ui: "UI tests", db: "SQL checks", database: "SQL checks", postman: "Postman assertions", manual: "Manual probes", perf: "Performance targets" };
  return { id: key, name: suite.title ?? labels[key] ?? key, total, passed, failed };
}

/**
 * Reads everything known about a project.
 * @param {string} projectDir absolute path to `projects/<slug>`
 */
export function collectProjectMetrics(projectDir) {
  const summary = readJson(path.join(projectDir, "test-reports/summary.json"));
  const testCases = parseCsv(path.join(projectDir, "test-documentation/test-cases.csv"));
  const defects = parseCsv(path.join(projectDir, "test-documentation/defect-log.csv"));
  const traceability = parseCsv(path.join(projectDir, "test-documentation/traceability-matrix.csv"));
  const screenshotDir = path.join(projectDir, "test-evidence/screenshots");
  const screenshots = fs.existsSync(screenshotDir)
    ? fs.readdirSync(screenshotDir).filter((file) => /\.(jpe?g|png)$/i.test(file)).length
    : 0;

  // ---------------------------------------------------------------- suites (three shapes)
  const suites = [];
  if (summary?.automation) {
    // Shape A (ShopSure): automation.api / ui / database / postman
    for (const key of ["api", "ui", "database", "postman"]) {
      const entry = summary.automation[key];
      if (!entry) continue;
      suites.push({
        id: key,
        name: key === "database" ? "SQL checks" : key === "postman" ? "Postman assertions" : `${key.toUpperCase()} tests`,
        total: entry.total ?? entry.assertions ?? 0,
        passed: entry.passed ?? entry.assertions ?? 0,
        failed: entry.failed ?? 0,
      });
    }
  } else if (Array.isArray(summary?.suites)) {
    // Shape B (PeopleCore): suites: [{ id, title, executed, passed, failed }]
    for (const suite of summary.suites) suites.push(suiteFromObject(suite.id, suite));
  } else if (summary?.suites && typeof summary.suites === "object") {
    // Shape C (TaskFlow): suites: { api: { total, passed, failed } }
    for (const [key, suite] of Object.entries(summary.suites)) suites.push(suiteFromObject(key, suite));
  }

  const automatedPassed = suites.reduce((sum, suite) => sum + suite.passed, 0);
  const automatedFailed = suites.reduce((sum, suite) => sum + suite.failed, 0);

  const pick = (ids) => suites.find((suite) => ids.includes(suite.id));

  // ---------------------------------------------------------------- manual cases
  const manualTotal = summary?.manualTestCases?.total ?? (testCases.length > 0 ? testCases.length : null);
  const manualPassed =
    summary?.manualTestCases?.byStatus?.Pass ??
    (testCases.length > 0 ? testCases.filter((row) => row.Status === "Pass").length : null);
  const manualNotExecuted =
    summary?.manualTestCases?.byStatus?.["Not Executed"] ??
    (testCases.length > 0 ? testCases.filter((row) => row.Status === "Not Executed").length : null);

  // ---------------------------------------------------------------- requirements coverage
  const requirements = summary?.requirementCoverage?.requirements ?? (traceability.length > 0 ? traceability.length : null);
  const requirementsCovered =
    summary?.requirementCoverage?.fullyCovered ??
    (traceability.length > 0 ? traceability.filter((row) => /covered|verified/i.test(row.CoverageStatus ?? "")).length : null);

  // ---------------------------------------------------------------- defects
  const genuineDefects = defects.filter((row) => !isSeededDefect(row)).length;
  const seededDefects = defects.filter(isSeededDefect).length;

  return {
    projectDir,
    hasSummary: Boolean(summary),
    generatedAt: summary?.generatedAt ?? null,
    commit: summary?.gitCommit ?? summary?.git?.commit ?? null,
    suites,
    automatedPassed,
    automatedFailed,
    apiTests: pick(["api"])?.total ?? null,
    uiTests: pick(["ui"])?.total ?? null,
    sqlChecks: pick(["db", "database"])?.total ?? null,
    postmanAssertions: pick(["postman"])?.assertions ?? pick(["postman"])?.total ?? null,
    manualTotal,
    manualPassed,
    manualNotExecuted,
    requirements,
    requirementsCovered,
    genuineDefects,
    seededDefects,
    screenshots,
  };
}
