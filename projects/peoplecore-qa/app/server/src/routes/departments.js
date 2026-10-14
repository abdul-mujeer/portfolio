import { Router } from 'express';
import { get } from '../db.js';
import { HttpError } from '../lib/errors.js';
import { listDepartments } from '../lib/queries.js';
import { createDepartment, updateDepartment } from '../lib/services.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { parseIdParam, validateBody } from '../middleware/validate.js';
import { departmentCreateSchema, departmentUpdateSchema } from '../validation.js';

function departmentDto(row) {
  return {
    id: Number(row.id),
    name: row.name,
    code: row.code,
    createdAt: row.created_at,
    employeeCount: row.employee_count === undefined ? undefined : Number(row.employee_count),
  };
}

export function departmentsRouter({ db }) {
  const router = Router();

  router.get('/', requireAuth, (_req, res) => {
    res.set('X-Total-Count', String(listDepartments(db).length));
    res.json({ data: listDepartments(db) });
  });

  router.post('/', requireRole('ADMIN', 'HR'), validateBody(departmentCreateSchema), (req, res, next) => {
    try {
      const created = createDepartment(db, req.actor, req.validatedBody);
      res.status(201).location(`/api/departments/${created.id}`).json({ data: departmentDto(created) });
    } catch (error) {
      next(error);
    }
  });

  router.get('/:id', requireAuth, (req, res, next) => {
    try {
      const id = parseIdParam(req);
      const row = get(db, 'SELECT id, name, code, created_at FROM departments WHERE id = ?', [id]);
      if (!row) throw HttpError.notFound(`Department ${id} does not exist`);
      res.json({ data: departmentDto(row) });
    } catch (error) {
      next(error);
    }
  });

  router.put('/:id', requireRole('ADMIN', 'HR'), validateBody(departmentUpdateSchema), (req, res, next) => {
    try {
      const id = parseIdParam(req);
      const updated = updateDepartment(db, req.actor, id, req.validatedBody);
      res.json({ data: departmentDto(updated) });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
