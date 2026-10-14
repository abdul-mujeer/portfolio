#!/usr/bin/env node
/**
 * Runs every SQL/database validation module in tests/db/ against a ShopSure database.
 *
 * Usage:
 *   node scripts/run-db-checks.mjs                       # reset + seed .data/shopsure.db, then check
 *   node scripts/run-db-checks.mjs --db .data/x.db
 *   node scripts/run-db-checks.mjs --no-reset            # check the current state (used after API/UI suites)
 *   node scripts/run-db-checks.mjs --json test-reports/db-checks.json
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { openDb, closeDb, resolveDbPath } from "../app/server/src/db.js";

const args = process.argv.slice(2);
const dbFlag = args.indexOf("--db");
const dbPath = dbFlag !== -1 ? args[dbFlag + 1] : process.env.DB_PATH || ".data/shopsure.db";
const noReset = args.includes("--no-reset");
const jsonFlag = args.indexOf("--json");
const jsonOut = jsonFlag !== -1 ? args[jsonFlag + 1] : "test-reports/db-checks.json";

const projectRoot = path.resolve(import.meta.dirname, "..");

if (!noReset) {
  const reset = spawnSync(process.execPath, [path.join(projectRoot, "scripts/reset-db.mjs"), "--db", dbPath], {
    stdio: "inherit",
    cwd: projectRoot,
  });
  if (reset.status !== 0) process.exit(reset.status ?? 1);
} else if (!fs.existsSync(resolveDbPath(dbPath))) {
  console.error(`[db-checks] database not found: ${resolveDbPath(dbPath)} (run without --no-reset, or run the API suite first)`);
  process.exit(1);
}

const db = openDb(dbPath);
const files = fs
  .readdirSync(path.join(projectRoot, "tests/db"))
  .filter((file) => file.endsWith(".mjs"))
  .sort();

const all = [];
for (const file of files) {
  const module = await import(pathToFileURL(path.join(projectRoot, "tests/db", file)).href);
  const results = await module.default({ db, dbPath });
  for (const result of results) all.push({ ...result, module: file });
}
closeDb(db);

const passed = all.filter((result) => result.passed).length;
const failed = all.length - passed;

console.log("\nDatabase validation checks");
console.log("==========================");
for (const result of all) {
  console.log(`${result.passed ? "PASS" : "FAIL"}  ${result.id}  ${result.title}`);
  if (!result.passed) {
    console.log(`      expected: ${result.expected}`);
    console.log(`      actual:   ${result.actual}`);
  }
}
console.log(`\n${passed}/${all.length} database checks passed${failed ? ` (${failed} failed)` : ""}.`);

const report = {
  checkedAt: new Date().toISOString(),
  database: resolveDbPath(dbPath),
  modules: files,
  total: all.length,
  passed,
  failed,
  results: all,
};
fs.mkdirSync(path.dirname(path.resolve(projectRoot, jsonOut)), { recursive: true });
fs.writeFileSync(path.resolve(projectRoot, jsonOut), JSON.stringify(report, null, 2));
console.log(`Report written to ${jsonOut}`);

process.exit(failed === 0 ? 0 : 1);
