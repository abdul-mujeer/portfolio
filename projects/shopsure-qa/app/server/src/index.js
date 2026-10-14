/**
 * ShopSure API + web server entry point.
 *
 * Run directly:      node app/server/src/index.js
 * Embedded by tests: import { startServer } from "./index.js"   (see scripts/serve.mjs)
 *
 * Environment:
 *   PORT        (default 4100)
 *   DB_PATH     (default app/server/data/shopsure.db)
 *   NODE_ENV    development | test | production
 *   APP_SECRET  required in production (>= 32 chars)
 *   SEED_DEFECTS "1" enables the deliberately injected defects documented in
 *                test-documentation/seeded-defects.md  (default: disabled)
 */
import path from "node:path";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { openDb, closeDb, resolveDbPath } from "./db.js";
import { createApp } from "./app.js";

const isMain = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;

export function startServer({ port = Number(process.env.PORT || 4100), dbPath = process.env.DB_PATH, nodeEnv = process.env.NODE_ENV || "development" } = {}) {
  if (nodeEnv === "production") {
    const secret = process.env.APP_SECRET || "";
    if (secret.length < 32) {
      throw new Error("[shopsure] Refusing to start: NODE_ENV=production requires APP_SECRET with at least 32 characters.");
    }
  }
  if (process.env.SEED_DEFECTS === "1") {
    console.warn("[shopsure] SEED_DEFECTS=1 — deliberately injected defects are ACTIVE (see seeded-defects.md).");
  }

  const file = resolveDbPath(dbPath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = openDb(file);
  const app = createApp(db);
  const server = app.listen(port, () => {
    console.log(`[shopsure] listening on http://127.0.0.1:${port} (env=${nodeEnv}, db=${file})`);
  });

  const shutdown = (signal) => {
    console.log(`[shopsure] ${signal} received, shutting down.`);
    server.close(() => {
      closeDb(db);
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 3000).unref();
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  return { server, db, port };
}

if (isMain) {
  try {
    startServer();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
