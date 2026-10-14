import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { bootstrapDatabase } from './db.js';

const config = loadConfig();
const db = bootstrapDatabase(config.dbPath, { fresh: false });
const app = createApp({ db, config });

const server = app.listen(config.port, config.host, () => {
  console.log(
    `[peoplecore] PeopleCore HRMS listening on http://${config.host}:${config.port} (env=${config.nodeEnv}, db=${config.dbPath})`,
  );
});

function shutdown(signal) {
  console.log(`[peoplecore] received ${signal}, shutting down`);
  server.close(() => {
    try {
      db.close();
    } catch {
      /* ignore */
    }
    process.exit(0);
  });
  // Fallback if connections keep the socket open.
  setTimeout(() => process.exit(0), 3000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
