import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { apiRouter } from './routes/index.js';
import { healthPayload } from './routes/health.js';
import { cookieParser } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// app/server/src -> app/server -> app -> app/public
export const PUBLIC_DIR = path.resolve(HERE, '..', '..', 'public');

/**
 * Express app factory - no `listen`, so tests can boot it on an ephemeral port.
 */
export function createApp({ db, secret, isProduction = false, staticDir = PUBLIC_DIR }) {
  const app = express();
  app.disable('x-powered-by');
  app.locals.db = db;
  app.locals.secret = secret;
  app.locals.isProduction = isProduction;

  app.use(cookieParser);
  app.use(express.json({ limit: '100kb' }));

  // Contract alias used by CI/orchestrators to wait for readiness.
  app.get('/api/health', (req, res) => {
    res.status(200).json(healthPayload(db));
  });

  app.use('/api/v1', apiRouter);

  app.use(express.static(staticDir, { index: 'index.html' }));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
