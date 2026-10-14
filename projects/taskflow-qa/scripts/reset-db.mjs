import { rmSync } from 'node:fs';
import { openDb, ensureSchema, resolveDbPath } from '../app/server/src/db.js';
import { seedDatabase } from '../app/server/src/seed.js';

/**
 * Drop + recreate + seed. Honours DB_PATH (default `app/server/data/taskflow.db`).
 * Also removes SQLite journal/WAL side files so a reset is a true reset.
 */
const dbPath = resolveDbPath();

for (const suffix of ['', '-journal', '-wal', '-shm']) {
  rmSync(`${dbPath}${suffix}`, { force: true });
}

const db = openDb(dbPath);
ensureSchema(db);
const counts = seedDatabase(db);
db.close();

console.log(`[taskflow] reset + seed complete: ${dbPath}`);
console.log(
  `[taskflow] users=${counts.users} projects=${counts.projects} members=${counts.members} ` +
    `tasks=${counts.tasks} comments=${counts.comments} activity=${counts.activity}`
);
