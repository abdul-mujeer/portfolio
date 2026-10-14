#!/usr/bin/env node
/**
 * Runs the committed Postman collection with Newman against a freshly seeded local server.
 *
 * Steps: reset DB -> boot server -> wait for health -> newman run -> stop server -> save report.
 * Usage: npm run test:postman
 */
import fs from "node:fs";
import path from "node:path";
import { startServer, stopServer, waitForHealth, PROJECT_ROOT } from "./lib/server-control.mjs";

const port = Number(process.env.POSTMAN_PORT || 4181);
const baseUrl = `http://127.0.0.1:${port}`;
const collectionPath = path.join(PROJECT_ROOT, "postman/ShopSure-API.postman_collection.json");
const { default: newman } = await import("newman");

if (!fs.existsSync(collectionPath)) {
  console.error(`[postman] collection not found: ${collectionPath}`);
  process.exit(1);
}

const { child, logs } = startServer({ port, dbPath: ".data/shopsure.postman.db", reset: true });
let exitCode = 0;

try {
  await waitForHealth(baseUrl);

  const summary = await new Promise((resolve, reject) => {
    newman.run(
      {
        collection: collectionPath,
        envVar: [
          { key: "baseUrl", value: baseUrl },
          { key: "runId", value: `${Date.now()}` },
        ],
        reporters: ["cli", "json"],
        reporter: { json: { export: path.join(PROJECT_ROOT, "test-reports/newman/shopsure-newman.json") } },
        timeoutRequest: 15000,
      },
      (error, run) => (error ? reject(error) : resolve(run))
    );
  });

  const stats = summary.run.stats;
  console.log("\nNewman summary");
  console.log("==============");
  console.log(`Requests:  ${stats.requests.total} (failed: ${stats.requests.failed})`);
  console.log(`Assertions:${stats.assertions.total} (failed: ${stats.assertions.failed})`);
  console.log(`Duration:  ${summary.run.timings.completed - summary.run.timings.started} ms`);
  exitCode = stats.assertions.failed > 0 || stats.requests.failed > 0 ? 1 : 0;
} catch (error) {
  console.error("[postman] run failed:", error);
  console.error(logs.join("").split("\n").slice(-40).join("\n"));
  exitCode = 1;
} finally {
  await stopServer(child);
}

process.exit(exitCode);
