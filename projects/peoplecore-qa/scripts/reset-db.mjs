#!/usr/bin/env node
/**
 * Deletes the target database, recreates the schema and (by default) seeds the
 * deterministic fixture data.
 *
 *   node scripts/reset-db.mjs                 # development DB  (app/server/data/peoplecore.db)
 *   node scripts/reset-db.mjs --test          # test DB         (.data/peoplecore.test.db)
 *   node scripts/reset-db.mjs --seed-only     # keep the file, wipe + reseed rows
 *   node scripts/reset-db.mjs --db .data/x.db --quiet
 *   node scripts/reset-db.mjs --as-of 2026-01-15   # reproducible relative dates
 */
import { loadConfig, TEST_DB_PATH } from '../app/server/src/config.js';
import { bootstrapDatabase } from '../app/server/src/db.js';
import { seedDatabase } from '../app/server/src/seed.js';

function parseArgs(argv) {
  const options = { test: false, seedOnly: false, quiet: false, dbPath: null, asOf: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--test') options.test = true;
    else if (arg === '--reset') options.seedOnly = false;
    else if (arg === '--seed') options.seedOnly = false;
    else if (arg === '--seed-only') options.seedOnly = true;
    else if (arg === '--quiet') options.quiet = true;
    else if (arg === '--db') options.dbPath = argv[++index];
    else if (arg.startsWith('--db=')) options.dbPath = arg.slice(5);
    else if (arg === '--as-of') options.asOf = argv[++index];
    else if (arg.startsWith('--as-of=')) options.asOf = arg.slice(8);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

const options = parseArgs(process.argv.slice(2));
const dbPath = options.dbPath ?? (options.test ? TEST_DB_PATH : loadConfig().dbPath);
const reference = options.asOf ? new Date(`${options.asOf}T12:00:00Z`) : new Date();
if (options.asOf && Number.isNaN(reference.getTime())) throw new Error(`Invalid --as-of value: ${options.asOf}`);

const db = bootstrapDatabase(dbPath, { fresh: !options.seedOnly });
const summary = seedDatabase(db, { reference });

const counts = {
  employees: db.prepare('SELECT COUNT(*) AS total FROM employees').get().total,
  departments: db.prepare('SELECT COUNT(*) AS total FROM departments').get().total,
  attendance: db.prepare('SELECT COUNT(*) AS total FROM attendance').get().total,
  leaveRequests: db.prepare('SELECT COUNT(*) AS total FROM leave_requests').get().total,
  auditLogs: db.prepare('SELECT COUNT(*) AS total FROM audit_logs').get().total,
};

if (!options.quiet) {
  console.log(`[reset-db] database : ${dbPath}`);
  console.log(`[reset-db] mode     : ${options.seedOnly ? 'seed-only (rows wiped, file kept)' : 'fresh (file deleted)'}`);
  console.log(`[reset-db] as-of    : ${summary.reference}${options.asOf ? ' (pinned)' : ' (today)'}`);
  console.log(`[reset-db] rows     : ${JSON.stringify(counts)}`);
}
db.close();
