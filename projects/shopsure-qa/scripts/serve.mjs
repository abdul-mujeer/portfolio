#!/usr/bin/env node
/**
 * Test/demo server bootstrap used by Playwright (`webServer`) and by the test orchestrator.
 *
 * Usage:
 *   node scripts/serve.mjs --reset     # reset the DB at DB_PATH (default .data/shopsure.e2e.db), then serve
 *   node scripts/serve.mjs             # serve without touching data
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, "..");

process.chdir(projectRoot);

if (!process.env.DB_PATH) process.env.DB_PATH = ".data/shopsure.e2e.db";
if (!process.env.NODE_ENV) process.env.NODE_ENV = "test";

if (process.argv.includes("--reset")) {
  const result = spawnSync(process.execPath, [path.join(here, "reset-db.mjs"), "--db", process.env.DB_PATH], {
    stdio: "inherit",
    cwd: projectRoot,
    env: process.env,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const { startServer } = await import("../app/server/src/index.js");
startServer();
