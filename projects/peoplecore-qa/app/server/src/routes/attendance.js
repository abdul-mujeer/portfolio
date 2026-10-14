import { Router } from 'express';
import { HttpError } from '../lib/errors.js';
import { listAttendance } from '../lib/queries.js';
import { canViewEmployee, canWriteAttendance } from '../lib/scope.js';
import { attendanceDto, createAttendance, updateAttendance } from '../lib/services.js';
import { requireAuth } from '../middleware/auth.js';
import { parseIdParam, validateBody, validateQuery } from '../middleware/validate.js';
import { attendanceCreateSchema, attendanceQuerySchema, attendanceUpdateSchema, paginationSchema } from '../validation.js';

const listQuerySchema = attendanceQuerySchema.merge(paginationSchema);

export function attendanceRouter({ db }) {
  const router = Router();

  router.get('/', requireAuth, validateQuery(listQuerySchema), (req, res, next) => {
    try {
      const query = req.validatedQuery;
      if (query.employeeId && !canViewEmployee(db, req.actor, query.employeeId)) {
        throw HttpError.forbidden('You are not allowed to view attendance of this employee', 'FORBIDDEN');
      }
      if (query.from && query.to && query.to < query.from) {
        throw HttpError.badRequest('VALIDATION_ERROR', 'to must be on or after from', [
          { path: 'to', code: 'invalid_range', message: 'to must be on or after from' },
        ]);
      }

      const { rows, total, page, limit } = listAttendance(db, {
        actor: req.actor,
        filters: query,
        page: query.page,
        limit: query.limit,
      });
      res.set('X-Total-Count', String(total));
      res.json({
        data: rows.map(attendanceDto),
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/', requireAuth, validateBody(attendanceCreateSchema), (req, res, next) => {
    try {
      const created = createAttendance(db, req.actor, req.validatedBody);
      res.status(201).location(`/api/attendance/${created.id}`).json({ data: attendanceDto(created) });
    } catch (error) {
      next(error);
    }
  });

  router.patch('/:id', requireAuth, validateBody(attendanceUpdateSchema), (req, res, next) => {
    try {
      const id = parseIdParam(req);
      const existing = db.prepare('SELECT id, employee_id FROM attendance WHERE id = ?').get(id);
      if (!existing) throw HttpError.notFound(`Attendance record ${id} does not exist`);
      if (!canWriteAttendance(db, req.actor, existing.employee_id)) {
        throw HttpError.forbidden('You are not allowed to modify attendance of this employee', 'FORBIDDEN');
      }
      const updated = updateAttendance(db, req.actor, id, req.validatedBody);
      res.json({ data: attendanceDto(updated) });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
