import { Router } from 'express';
import { paginationQuerySchema } from '../lib/validators.js';
import { validateQuery } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { overdueCondition } from '../lib/queries.js';
import { todayUtc } from '../lib/datetime.js';

export const reportsRouter = Router();
reportsRouter.use(requireAuth);

/**
 * GET /api/v1/reports/overdue
 *
 * Overdue tasks across the caller's projects (projects they are a member of).
 * Archived projects are excluded. Rule: due_date < today AND status NOT IN
 * ('DONE', 'CANCELED'); a task due today is NOT overdue.
 */
reportsRouter.get('/overdue', validateQuery(paginationQuerySchema), (req, res) => {
  const db = req.app.locals.db;
  const { page, limit } = req.validatedQuery;
  const today = todayUtc();

  const scopeFrom = `
    FROM tasks t
    JOIN projects p ON p.id = t.project_id
    JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ?
  `;
  const scopeWhere = `WHERE p.archived = 0 AND ${overdueCondition('t')}`;
  const scopeParams = [req.user.id, today];

  const total = db.prepare(`SELECT COUNT(*) AS c ${scopeFrom} ${scopeWhere}`).get(...scopeParams).c;

  const byProject = db
    .prepare(
      `SELECT p.id AS project_id, p.key AS project_key, p.name AS project_name, COUNT(*) AS count
       ${scopeFrom} ${scopeWhere}
       GROUP BY p.id, p.key, p.name
       ORDER BY count DESC, p.key ASC`
    )
    .all(...scopeParams);

  const rows = db
    .prepare(
      `SELECT t.id, t.project_id, t.title, t.status, t.priority, t.due_date, t.assignee_id,
              t.created_at, t.updated_at,
              p.key AS project_key, p.name AS project_name,
              ua.display_name AS assignee_name
       ${scopeFrom}
       LEFT JOIN users ua ON ua.id = t.assignee_id
       ${scopeWhere}
       ORDER BY t.due_date ASC, t.id ASC
       LIMIT ? OFFSET ?`
    )
    .all(...scopeParams, limit, (page - 1) * limit)
    .map((row) => ({
      id: row.id,
      project_id: row.project_id,
      project_key: row.project_key,
      project_name: row.project_name,
      title: row.title,
      status: row.status,
      priority: row.priority,
      due_date: row.due_date,
      assignee_id: row.assignee_id,
      assignee_name: row.assignee_name ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

  res.set('X-Total-Count', String(total));
  res.status(200).json({ count: total, byProject, data: rows, page, limit, total });
});
