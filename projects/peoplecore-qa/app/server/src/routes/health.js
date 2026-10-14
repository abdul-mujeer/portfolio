import { Router } from 'express';
import { get } from '../db.js';
import { nowIso } from '../lib/dates.js';

export const APP_VERSION = '1.0.0';

export function healthRouter({ db, config, startedAt = Date.now() }) {
  const router = Router();

  router.get('/health', (_req, res) => {
    let database = 'ok';
    let employees = null;
    try {
      const row = get(db, 'SELECT COUNT(*) AS total FROM employees');
      employees = Number(row?.total ?? 0);
    } catch (error) {
      database = 'error';
      console.error('[peoplecore] health check failed', error);
    }

    res.status(database === 'ok' ? 200 : 503).json({
      status: database === 'ok' ? 'ok' : 'degraded',
      service: 'peoplecore-hrms',
      version: APP_VERSION,
      database,
      employees,
      seedDefects: config.seedDefects,
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
      time: nowIso(),
    });
  });

  return router;
}
