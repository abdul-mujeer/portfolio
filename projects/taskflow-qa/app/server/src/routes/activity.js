import { Router } from 'express';
import { paginationQuerySchema } from '../lib/validators.js';
import { validateQuery } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { getProjectOr404 } from '../lib/access.js';
import { serializeActivity } from '../lib/serialize.js';

export const projectActivityRouter = Router({ mergeParams: true });
projectActivityRouter.use(requireAuth);

const ACTIVITY_SELECT = `
  SELECT a.*, u.display_name AS actor_name, t.title AS task_title
  FROM activity a
  JOIN users u ON u.id = a.actor_id
  LEFT JOIN tasks t ON t.id = a.task_id
`;

/** GET /api/v1/projects/:id/activity - newest first, paginated. */
projectActivityRouter.get('/', validateQuery(paginationQuerySchema), (req, res) => {
  const db = req.app.locals.db;
  const { project } = getProjectOr404(db, req.params.id, req.user.id);
  const { page, limit } = req.validatedQuery;
  const total = db.prepare('SELECT COUNT(*) AS c FROM activity WHERE project_id = ?').get(project.id).c;
  const rows = db
    .prepare(
      `${ACTIVITY_SELECT} WHERE a.project_id = ? ORDER BY a.created_at DESC, a.id DESC LIMIT ? OFFSET ?`
    )
    .all(project.id, limit, (page - 1) * limit);
  res.set('X-Total-Count', String(total));
  res.status(200).json({ data: rows.map(serializeActivity), page, limit, total });
});
