import { createApp, PUBLIC_DIR } from './app.js';
import { openDb, ensureSchema, resolveDbPath } from './db.js';
import { seedDatabase } from './seed.js';

const port = Number(process.env.PORT || 4300);
const isProduction = process.env.NODE_ENV === 'production';
const secret = process.env.APP_SECRET || 'taskflow-dev-only-secret';

if (isProduction && !process.env.APP_SECRET) {
  console.error('[taskflow] APP_SECRET must be set when NODE_ENV=production');
  process.exit(1);
}
if (!process.env.APP_SECRET) {
  console.warn('[taskflow] APP_SECRET not set - using the documented dev-only default');
}

const dbPath = resolveDbPath();
const db = openDb(dbPath);
ensureSchema(db);

// Convenience for demos: an empty database is seeded automatically so the
// console is immediately usable. Explicit resets use `npm run db:reset`.
if (db.prepare('SELECT COUNT(*) AS c FROM users').get().c === 0) {
  const counts = seedDatabase(db);
  console.log(`[taskflow] empty database seeded automatically (${counts.tasks} tasks)`);
}

const app = createApp({ db, secret, isProduction, staticDir: PUBLIC_DIR });

const server = app.listen(port, () => {
  console.log(`[taskflow] API listening on http://127.0.0.1:${port} (db: ${dbPath})`);
});

function shutdown(signal) {
  console.log(`[taskflow] ${signal} received, shutting down`);
  server.close(() => {
    try {
      db.close();
    } catch {
      // ignore
    }
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
