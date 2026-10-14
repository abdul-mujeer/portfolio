import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { parseIdParam, validateBody, validateQuery } from '../middleware/validate.js';
import { HttpError } from '../lib/errors.js';
import { listEmployees } from '../lib/queries.js';
import { canViewEmployee, findEmployee, toPublicEmployee } from '../lib/scope.js';
import { createEmployee, deleteEmployee, employeeDtoForActor, updateEmployee } from '../lib/services.js';
import { employeeCreateSchema, employeeQuerySchema, employeeUpdateSchema, paginationSchema } from '../validation.js';

const listQuerySchema = employeeQuerySchema.merge(paginationSchema);

export function employeesRouter({ db }) {
  const router = Router();

  router.get('/', requireAuth, validateQuery(listQuerySchema), (req, res) => {
    const query = req.validatedQuery;
    const { rows, total, page, limit } = listEmployees(db, {
      actor: req.actor,
      filters: query,
      page: query.page,
      limit: query.limit,
    });

    res.set('X-Total-Count', String(total));
    res.json({
      data: rows.map((row) => employeeDtoForActor(db, req.actor, row)),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  });

  router.post('/', requireRole('ADMIN', 'HR'), validateBody(employeeCreateSchema), (req, res, next) => {
    try {
      const created = createEmployee(db, req.actor, req.validatedBody);
      const dto = toPublicEmployee(created, { includeSalary: true });
      res.status(201).location(`/api/employees/${created.id}`).json({ data: dto });
    } catch (error) {
      next(error);
    }
  });

  router.get('/:id', requireAuth, (req, res, next) => {
    try {
      const id = parseIdParam(req);
      const row = findEmployee(db, id);
      if (!row) throw HttpError.notFound(`Employee ${id} does not exist`);
      if (!canViewEmployee(db, req.actor, id)) {
        throw HttpError.forbidden('You are not allowed to view this employee', 'FORBIDDEN');
      }
      res.json({ data: employeeDtoForActor(db, req.actor, row) });
    } catch (error) {
      next(error);
    }
  });

  router.put('/:id', requireRole('ADMIN', 'HR'), validateBody(employeeUpdateSchema), (req, res, next) => {
    try {
      const id = parseIdParam(req);
      const updated = updateEmployee(db, req.actor, id, req.validatedBody);
      res.json({ data: toPublicEmployee(updated, { includeSalary: true }) });
    } catch (error) {
      next(error);
    }
  });

  router.delete('/:id', requireRole('ADMIN'), (req, res, next) => {
    try {
      const id = parseIdParam(req);
      deleteEmployee(db, req.actor, id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
