import { Router } from 'express';
import { commentCreateSchema, paginationQuerySchema } from '../lib/validators.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { getTaskOr404 } from '../lib/access.js';
import { recordActivity } from '../lib/activity.js';
import { businessRule } from '../lib/errors.js';
import { nowIso } from '../lib/datetime.js';
import { serializeComment } from '../lib/serialize.js';

export const commentsRouter = Router({ mergeParams: true });
commentsRouter.use(requireAuth);

const COMMENT_SELECT = `
  SELECT c.*, u.display_name AS author_name
  FROM comments c JOIN users u ON u.id = c.author_id
`;

/** GET /api/v1/tasks/:id/comments */
commentsRouter.get('/', validateQuery(paginationQuerySchema), (req, res) => {
  const db = req.app.locals.db;
  const { task } = getTaskOr404(db, req.params.id, req.user.id);
  const { page, limit } = req.validatedQuery;
  const total = db.prepare('SELECT COUNT(*) AS c FROM comments WHERE task_id = ?').get(task.id).c;
  const rows = db
    .prepare(`${COMMENT_SELECT} WHERE c.task_id = ? ORDER BY c.created_at ASC, c.id ASC LIMIT ? OFFSET ?`)
    .all(task.id, limit, (page - 1) * limit);
  res.set('X-Total-Count', String(total));
  res.status(200).json({ data: rows.map(serializeComment), page, limit, total });
});

/** POST /api/v1/tasks/:id/comments - any member can comment. */
commentsRouter.post('/', validateBody(commentCreateSchema), (req, res) => {
  const db = req.app.locals.db;
  const { task } = getTaskOr404(db, req.params.id, req.user.id);
  if (task.project_archived) {
    throw businessRule('ARCHIVED_PROJECT', 'This project is archived and cannot be modified');
  }
  const now = nowIso();
  const body = req.validatedBody.body.trim();
  const info = db
    .prepare('INSERT INTO comments (task_id, author_id, body, created_at) VALUES (?, ?, ?, ?)')
    .run(task.id, req.user.id, body, now);
  const commentId = Number(info.lastInsertRowid);
  recordActivity(db, {
    projectId: task.project_id,
    taskId: task.id,
    actorId: req.user.id,
    action: 'COMMENT_ADDED',
    detail: { commentId, taskId: task.id },
    at: now,
  });
  const row = db.prepare(`${COMMENT_SELECT} WHERE c.id = ?`).get(commentId);
  res.status(201).json(serializeComment(row));
});
