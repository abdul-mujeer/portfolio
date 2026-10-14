#!/usr/bin/env node
/**
 * ShopSure QA — full test orchestrator.
 *
 * Runs every automated suite against a freshly seeded local stack, captures raw logs, then builds
 * test-reports/summary.json + test-reports/execution-report-<date>.md from the REAL results.
 *
 * Usage: npm run test:all            (all suites, fail-fast disabled)
 *        npm run test:all -- --skip-postman
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { PROJECT_ROOT } from "./lib/server-control.mjs";

const args = process.argv.slice(2);
const skip = (name) => args.includes(`--skip-${name}`);

const logsDir = path.join(PROJECT_ROOT, "test-evidence/logs");
const reportsDir = path.join(PROJECT_ROOT, "test-reports");
fs.mkdirSync(logsDir, { recursive: true });
fs.mkdirSync(path.join(reportsDir, "playwright"), { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const results = [];

function runSuite(id, title, command, commandArgs, env = {}) {
  if (skip(id)) {
    results.push({ id, title, status: "skipped", code: null, log: null, seconds: 0 });
    console.log(`\n=== ${title} — SKIPPED ===`);
    return;
  }

  console.log(`\n=== ${title} ===`);
  const started = Date.now();
  const outcome = spawnSync(command, commandArgs, {
    cwd: PROJECT_ROOT,
    env: { ...process.env, ...env },
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  const seconds = Math.round((Date.now() - started) / 1000);
  const output = `${outcome.stdout ?? ""}\n${outcome.stderr ?? ""}`;
  const logFile = path.join(logsDir, `${stamp}-${id}.log`);
  fs.writeFileSync(logFile, output);

  const status = outcome.status === 0 ? "passed" : "failed";
  results.push({ id, title, status, code: outcome.status, log: path.relative(PROJECT_ROOT, logFile), seconds });
  console.log(output.split("\n").slice(-25).join("\n"));
  console.log(`--- ${title}: ${status.toUpperCase()} (${seconds}s, exit code ${outcome.status}) ---`);
}

// Ensure the SPA build exists before UI tests (Express serves app/web/dist).
if (!fs.existsSync(path.join(PROJECT_ROOT, "app/web/dist/index.html"))) {
  console.log("app/web/dist is missing — building the SPA first…");
  const build = spawnSync("npm", ["run", "build"], { cwd: PROJECT_ROOT, stdio: "inherit", shell: process.platform === "win32" });
  if (build.status !== 0) {
    console.error("Web build failed; UI tests will not run.");
    process.exit(1);
  }
}

runSuite(
  "api",
  "Playwright API suite",
  "npx",
  ["playwright", "test", "tests/api", "--project=api"],
  { PW_JSON_OUTPUT: "test-reports/playwright/api-results.json" }
);

runSuite(
  "ui",
  "Playwright UI suite",
  "npx",
  ["playwright", "test", "tests/ui", "--project=chromium"],
  { PW_JSON_OUTPUT: "test-reports/playwright/ui-results.json" }
);

runSuite("db", "Database validation checks (SQL)", "node", [
  "scripts/run-db-checks.mjs",
  "--no-reset",
  "--db",
  ".data/shopsure.e2e.db",
  "--json",
  "test-reports/db-checks.json",
]);

runSuite("postman", "Postman collection via Newman", "node", ["scripts/newman-run.mjs"]);

// Report generation always runs so partial results are still documented honestly.
const report = spawnSync("node", ["scripts/reports/build-report.mjs"], { cwd: PROJECT_ROOT, stdio: "inherit", shell: process.platform === "win32" });

console.log("\n================= Summary =================");
for (const result of results) {
  console.log(`${result.status === "passed" ? "PASS" : result.status === "skipped" ? "SKIP" : "FAIL"}  ${result.id.padEnd(8)} ${result.title} (${result.seconds}s)`);
}

const failed = results.filter((result) => result.status === "failed");
if (failed.length > 0) {
  console.error(`\n${failed.length} suite(s) failed: ${failed.map((result) => result.id).join(", ")}`);
  process.exit(1);
}
console.log("\nAll executed suites passed.");
process.exit(report.status === 0 ? 0 : 1);
