import { rmSync } from 'node:fs';
import { openDb, ensureSchema, resolveDbPath } from '../app/server/src/db.js';
import { seedDatabase } from '../app/server/src/seed.js';

/**
 * Used by playwright.config.ts `webServer`. Resets the test database to the
 * deterministic seeded state and then boots the API on PORT (default 4300).
 *
 * Standalone suites therefore always run against a known state; when the
 * orchestrator (scripts/run-tests.mjs) already started a server, Playwright
 * reuses it instead of running this script.
 */
process.env.DB_PATH = process.env.DB_PATH || '.data/taskflow.test.db';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const dbPath = resolveDbPath(process.env.DB_PATH);
for (const suffix of ['', '-journal', '-wal', '-shm']) {
  rmSync(`${dbPath}${suffix}`, { force: true });
}
const db = openDb(dbPath);
ensureSchema(db);
const counts = seedDatabase(db);
db.close();
console.log(`[taskflow] test db reset: ${dbPath} (tasks=${counts.tasks})`);

await import('../app/server/src/index.js');
