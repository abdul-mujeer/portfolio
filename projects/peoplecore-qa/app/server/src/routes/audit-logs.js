import { Router } from 'express';
import { parseAuditRow } from '../lib/audit.js';
import { listAuditLogs } from '../lib/queries.js';
import { canViewSalary } from '../lib/scope.js';
import { requireRole } from '../middleware/auth.js';
import { validateQuery } from '../middleware/validate.js';
import { auditQuerySchema, paginationSchema } from '../validation.js';

const listQuerySchema = auditQuerySchema.merge(paginationSchema);

export function auditLogsRouter({ db }) {
  const router = Router();

  router.get('/', requireRole('ADMIN', 'HR'), validateQuery(listQuerySchema), (req, res) => {
    const query = req.validatedQuery;
    const { rows, total, page, limit } = listAuditLogs(db, {
      filters: query,
      page: query.page,
      limit: query.limit,
    });
    const includeSalary = canViewSalary(req.actor, null) || ['ADMIN', 'HR'].includes(req.actor.role);

    res.set('X-Total-Count', String(total));
    res.json({
      data: rows.map((row) => parseAuditRow(row, { includeSalary })),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  });

  return router;
}
