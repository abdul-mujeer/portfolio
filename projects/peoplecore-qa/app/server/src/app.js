import express from 'express';
import { authRouter } from './routes/auth.js';
import { auditLogsRouter } from './routes/audit-logs.js';
import { attendanceRouter } from './routes/attendance.js';
import { departmentsRouter } from './routes/departments.js';
import { employeesRouter } from './routes/employees.js';
import { healthRouter } from './routes/health.js';
import { leaveRequestsRouter } from './routes/leave-requests.js';
import { pagesRouter } from './routes/pages.js';
import { reportsRouter } from './routes/reports.js';
import { sessionMiddleware } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { setSeedDefects } from './lib/seed-defects.js';

/**
 * Express application factory — no `listen` here so tests can boot it on a random
 * port and exercise exactly the same stack that production uses.
 */
export function createApp({ db, config, startedAt = Date.now() }) {
  const app = express();

  setSeedDefects(config.seedDefects);

  app.disable('x-powered-by');
  app.set('trust proxy', false);
  app.set('view engine', 'ejs');
  app.set('views', config.viewsDir);
  app.set('json spaces', 0);

  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));
  app.use(express.static(config.publicDir, { maxAge: '1h' }));

  app.use((req, res, next) => {
    res.set('X-PeopleCore-Version', '1.0.0');
    next();
  });

  app.use(sessionMiddleware({ db, config }));

  app.use('/api', healthRouter({ db, config, startedAt }));
  app.use('/api', authRouter({ db, config }));
  app.use('/api/employees', employeesRouter({ db }));
  app.use('/api/departments', departmentsRouter({ db }));
  app.use('/api/attendance', attendanceRouter({ db }));
  app.use('/api/leave-requests', leaveRequestsRouter({ db }));
  app.use('/api/audit-logs', auditLogsRouter({ db }));
  app.use('/api/reports', reportsRouter({ db }));

  app.use('/', pagesRouter({ db, config }));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
