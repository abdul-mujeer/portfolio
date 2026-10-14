import { Router } from 'express';

/** Health payload: no secrets, no auth required. */
export function healthPayload(db) {
  let database = 'ok';
  try {
    db.prepare('SELECT 1 AS one').get();
  } catch {
    database = 'error';
  }
  return {
    status: database === 'ok' ? 'ok' : 'degraded',
    service: 'taskflow-api',
    version: '1.0.0',
    time: new Date().toISOString(),
    database,
  };
}

export const healthRouter = Router();

healthRouter.get('/', (req, res) => {
  res.status(200).json(healthPayload(req.app.locals.db));
});
