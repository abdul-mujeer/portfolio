#!/usr/bin/env node
/**
 * Seeded-defect detection exercise.
 *
 * Runs the same regression assertions twice:
 *   1. with SEED_DEFECTS=1  -> the suite MUST fail (proves it really detects the injected defects)
 *   2. with SEED_DEFECTS=0  -> the suite MUST pass (proves the failures came from the defects)
 *
 * Raw output of both runs is saved under test-evidence/seeded-defects/.
 *
 * Usage: npm run test:seeded-defects
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { PROJECT_ROOT } from "./lib/server-control.mjs";

const outDir = path.join(PROJECT_ROOT, "test-evidence/seeded-defects");
fs.mkdirSync(outDir, { recursive: true });

const target = ["playwright", "test", "tests/api/seeded-defects.spec.ts", "--project=api", "--reporter=list"];
const date = new Date().toISOString().slice(0, 10);

function run(label, seedDefects) {
  console.log(`\n=== ${label}: SEED_DEFECTS=${seedDefects} ===`);
  const started = Date.now();
  const outcome = spawnSync("npx", target, {
    cwd: PROJECT_ROOT,
    env: { ...process.env, SEED_DEFECTS: seedDefects },
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  const output = `${outcome.stdout ?? ""}\n${outcome.stderr ?? ""}`;
  fs.writeFileSync(path.join(outDir, `${date}-seed-defects-${seedDefects}.log`), output);
  // Playwright's list reporter marks failures as "  1) [api] › <title>" and passes as "  ok 1 [api] › <title>".
  const failedTitles = [...output.matchAll(/^\s+\d+\)\s+\[api\]\s+›\s+(.+?)\s*$/gm)].map((match) => match[1].trim());
  const passedTitles = [...output.matchAll(/^\s+ok\s+\d+\s+\[api\]\s+›\s+(.+?)\s+\(\d/gm)].map((match) => match[1].trim());
  console.log(output.split("\n").slice(-12).join("\n"));
  return {
    label,
    seedDefects,
    exitCode: outcome.status,
    seconds: Math.round((Date.now() - started) / 1000),
    failed: failedTitles,
    passed: passedTitles,
  };
}

const broken = run("Detection run (defects active)", "1");
const clean = run("Control run (defects disabled)", "0");

const detectionWorked = broken.exitCode !== 0 && broken.failed.length > 0;
const controlWorked = clean.exitCode === 0;

const report = [
  "# ShopSure — seeded defect detection evidence",
  "",
  `- Executed: ${new Date().toISOString()}`,
  `- Command: \`npm run test:seeded-defects\` (runs \`tests/api/seeded-defects.spec.ts\` twice)`,
  "",
  "## Detection run — `SEED_DEFECTS=1`",
  "",
  `- Exit code: **${broken.exitCode}** (expected: non-zero)`,
  `- Duration: ${broken.seconds}s`,
  `- Failing tests (${broken.failed.length}):`,
  ...(broken.failed.length ? broken.failed.map((title) => `  - ${title}`) : ["  - (none — this would mean the suite cannot detect the defects!)"]),
  "",
  "## Control run — `SEED_DEFECTS=0`",
  "",
  `- Exit code: **${clean.exitCode}** (expected: 0)`,
  `- Duration: ${clean.seconds}s`,
  `- Passing tests (${clean.passed.length}):`,
  ...clean.passed.map((title) => `  - ${title}`),
  "",
  "## Verdict",
  "",
  detectionWorked && controlWorked
    ? "**Detection capability verified.** The regression assertions fail exactly when the seeded defects are active and pass when they are disabled."
    : "**Detection capability NOT verified.** Review the logs in this folder: the suite behaved unexpectedly in one of the runs.",
  "",
  "Raw logs: `" + `${date}-seed-defects-1.log` + "` and `" + `${date}-seed-defects-0.log` + "` in this folder.",
  "",
].join("\n");

fs.writeFileSync(path.join(outDir, `detection-${date}.md`), report);
fs.writeFileSync(path.join(outDir, "detection-latest.md"), report);

console.log(`\nDetection run exit code: ${broken.exitCode} (expected non-zero)`);
console.log(`Control run exit code:   ${clean.exitCode} (expected 0)`);
console.log(`Evidence written to test-evidence/seeded-defects/`);

process.exit(detectionWorked && controlWorked ? 0 : 1);
