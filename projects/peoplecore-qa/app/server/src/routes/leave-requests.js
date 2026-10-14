import { Router } from 'express';
import { HttpError } from '../lib/errors.js';
import { listLeaveRequests } from '../lib/queries.js';
import { canViewEmployee } from '../lib/scope.js';
import { cancelLeaveRequest, createLeaveRequest, leaveDto, reviewLeaveRequest } from '../lib/services.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { parseIdParam, validateBody, validateQuery } from '../middleware/validate.js';
import { leaveCreateSchema, leaveQuerySchema, leaveRejectSchema, leaveReviewSchema, paginationSchema } from '../validation.js';

const listQuerySchema = leaveQuerySchema.merge(paginationSchema);

export function leaveRequestsRouter({ db }) {
  const router = Router();

  router.get('/', requireAuth, validateQuery(listQuerySchema), (req, res, next) => {
    try {
      const query = req.validatedQuery;
      if (query.employeeId && !canViewEmployee(db, req.actor, query.employeeId)) {
        throw HttpError.forbidden('You are not allowed to view leave requests of this employee', 'FORBIDDEN');
      }
      const { rows, total, page, limit } = listLeaveRequests(db, {
        actor: req.actor,
        filters: query,
        page: query.page,
        limit: query.limit,
      });
      res.set('X-Total-Count', String(total));
      res.json({
        data: rows.map(leaveDto),
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/', requireAuth, validateBody(leaveCreateSchema), (req, res, next) => {
    try {
      const created = createLeaveRequest(db, req.actor, req.validatedBody);
      res.status(201).location(`/api/leave-requests/${created.id}`).json({ data: leaveDto(created) });
    } catch (error) {
      next(error);
    }
  });

  router.get('/:id', requireAuth, (req, res, next) => {
    try {
      const id = parseIdParam(req);
      const row = db
        .prepare(
          `SELECT l.*, e.first_name, e.last_name, e.employee_code, e.status AS employee_status,
                  r.first_name || ' ' || r.last_name AS reviewer_name
           FROM leave_requests l
           JOIN employees e ON e.id = l.employee_id
           LEFT JOIN employees r ON r.id = l.reviewed_by
           WHERE l.id = ?`,
        )
        .get(id);
      if (!row) throw HttpError.notFound(`Leave request ${id} does not exist`);
      if (!canViewEmployee(db, req.actor, row.employee_id)) {
        throw HttpError.forbidden('You are not allowed to view this leave request', 'FORBIDDEN');
      }
      res.json({ data: leaveDto(row) });
    } catch (error) {
      next(error);
    }
  });

  router.patch(
    '/:id/approve',
    requireRole('ADMIN', 'HR', 'MANAGER'),
    validateBody(leaveReviewSchema),
    (req, res, next) => {
      try {
        const id = parseIdParam(req);
        const updated = reviewLeaveRequest(db, req.actor, id, {
          decision: 'APPROVED',
          comment: req.validatedBody.comment ?? null,
        });
        res.json({ data: leaveDto(updated) });
      } catch (error) {
        next(error);
      }
    },
  );

  router.patch('/:id/reject', requireRole('ADMIN', 'HR', 'MANAGER'), validateBody(leaveRejectSchema), (req, res, next) => {
    try {
      const id = parseIdParam(req);
      const updated = reviewLeaveRequest(db, req.actor, id, {
        decision: 'REJECTED',
        comment: req.validatedBody.comment,
      });
      res.json({ data: leaveDto(updated) });
    } catch (error) {
      next(error);
    }
  });

  router.delete('/:id', requireAuth, (req, res, next) => {
    try {
      const id = parseIdParam(req);
      const updated = cancelLeaveRequest(db, req.actor, id);
      res.json({ data: leaveDto(updated) });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
