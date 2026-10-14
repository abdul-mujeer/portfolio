#!/usr/bin/env node
/**
 * Resets a ShopSure database: deletes the file, recreates the schema and seeds deterministic data.
 *
 * Usage:
 *   node scripts/reset-db.mjs                 # default DB (env DB_PATH or app/server/data/shopsure.db)
 *   node scripts/reset-db.mjs --db .data/x.db # explicit database file
 *   node scripts/reset-db.mjs --keep          # seed only when the database is empty
 */
import fs from "node:fs";
import path from "node:path";
import { openDb, closeDb, resolveDbPath } from "../app/server/src/db.js";
import { seed } from "../app/server/src/seed.js";

const args = process.argv.slice(2);
const dbFlagIndex = args.indexOf("--db");
const dbArg = dbFlagIndex !== -1 ? args[dbFlagIndex + 1] : process.env.DB_PATH || "app/server/data/shopsure.db";
const keep = args.includes("--keep");

const file = resolveDbPath(dbArg);
if (fs.existsSync(file)) {
  fs.rmSync(file, { force: true });
  for (const suffix of ["-journal", "-wal", "-shm"]) {
    fs.rmSync(`${file}${suffix}`, { force: true });
  }
}

fs.mkdirSync(path.dirname(file), { recursive: true });
const db = openDb(file);
const result = seed(db);
const counts = {
  users: db.prepare("SELECT COUNT(*) AS c FROM users").get().c,
  categories: db.prepare("SELECT COUNT(*) AS c FROM categories").get().c,
  products: db.prepare("SELECT COUNT(*) AS c FROM products").get().c,
  orders: db.prepare("SELECT COUNT(*) AS c FROM orders").get().c,
  orderItems: db.prepare("SELECT COUNT(*) AS c FROM order_items").get().c,
};
closeDb(db);

console.log(JSON.stringify({ database: file, keptExistingData: keep && result.skipped, ...counts }, null, 2));
