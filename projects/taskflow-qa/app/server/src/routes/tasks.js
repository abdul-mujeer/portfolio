import { Router } from 'express';
import {
  taskCreateSchema,
  taskUpdateSchema,
  taskStatusSchema,
  taskListQuerySchema,
  paginationQuerySchema,
} from '../lib/validators.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { findMember, getProjectOr404, getTaskOr404 } from '../lib/access.js';
import { recordActivity } from '../lib/activity.js';
import { businessRule, forbidden } from '../lib/errors.js';
import { nowIso, todayUtc } from '../lib/datetime.js';
import { escapeLike, overdueCondition } from '../lib/queries.js';
import { getAllowedTransitions } from '../lib/workflow.js';
import { serializeActivity } from '../lib/serialize.js';
import { commentsRouter } from './comments.js';

const TASK_SELECT = `
  SELECT t.*, p.key AS project_key, p.archived AS project_archived, p.name AS project_name,
         ua.display_name AS assignee_name,
         ur.display_name AS reporter_name,
         (SELECT COUNT(*) FROM comments c WHERE c.task_id = t.id) AS comment_count
  FROM tasks t
  JOIN projects p ON p.id = t.project_id
  LEFT JOIN users ua ON ua.id = t.assignee_id
  LEFT JOIN users ur ON ur.id = t.reporter_id
`;

export function serializeTask(row) {
  return {
    id: row.id,
    project_id: row.project_id,
    project_key: row.project_key,
    project_name: row.project_name ?? null,
    project_archived: !!row.project_archived,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    assignee_id: row.assignee_id,
    assignee_name: row.assignee_name ?? null,
    reporter_id: row.reporter_id,
    reporter_name: row.reporter_name ?? null,
    due_date: row.due_date,
    estimated_hours: row.estimated_hours,
    created_at: row.created_at,
    updated_at: row.updated_at,
    comment_count: row.comment_count ?? 0,
    overdue:
      row.due_date !== null &&
      row.due_date < todayUtc() &&
      row.status !== 'DONE' &&
      row.status !== 'CANCELED',
  };
}

function snapshotTask(db, taskId) {
  return db.prepare(`${TASK_SELECT} WHERE t.id = ?`).get(taskId);
}

function assertNotArchived(task) {
  if (task.project_archived) {
    throw businessRule('ARCHIVED_PROJECT', 'This project is archived and cannot be modified');
  }
}

/** Reporter, assignee, project ADMIN or project OWNER may change a task. */
function assertTaskWriter(userId, task, role) {
  const canWrite =
    userId === task.reporter_id ||
    userId === task.assignee_id ||
    role === 'ADMIN' ||
    role === 'OWNER';
  if (!canWrite) {
    throw forbidden('Only the reporter, the assignee or a project admin can change this task');
  }
}

const SORT_COLUMNS = {
  id: 't.id',
  created_at: 't.created_at',
  updated_at: 't.updated_at',
  due_date: 't.due_date',
  priority:
    "CASE t.priority WHEN 'LOW' THEN 1 WHEN 'MEDIUM' THEN 2 WHEN 'HIGH' THEN 3 WHEN 'CRITICAL' THEN 4 END",
  status:
    "CASE t.status WHEN 'TODO' THEN 1 WHEN 'IN_PROGRESS' THEN 2 WHEN 'IN_REVIEW' THEN 3 WHEN 'DONE' THEN 4 WHEN 'CANCELED' THEN 5 END",
  title: 'LOWER(t.title)',
};

function buildTaskFilters(query, projectId) {
  const where = ['t.project_id = ?'];
  const params = [projectId];
  if (query.status) {
    where.push('t.status = ?');
    params.push(query.status);
  }
  if (query.priority) {
    where.push('t.priority = ?');
    params.push(query.priority);
  }
  if (query.assigneeId !== undefined) {
    where.push('t.assignee_id = ?');
    params.push(query.assigneeId);
  }
  if (query.q !== undefined && query.q.trim() !== '') {
    const like = `%${escapeLike(query.q.trim().toLowerCase())}%`;
    where.push(
      "(LOWER(t.title) LIKE ? ESCAPE '\\' OR LOWER(COALESCE(t.description, '')) LIKE ? ESCAPE '\\')"
    );
    params.push(like, like);
  }
  if (query.dueBefore) {
    where.push('t.due_date IS NOT NULL AND t.due_date < ?');
    params.push(query.dueBefore);
  }
  if (query.overdue === 'true') {
    where.push(overdueCondition('t'));
    params.push(todayUtc());
  }
  return { where: where.join(' AND '), params };
}

// ------------------------------------------------- project-scoped task routes

export const projectTasksRouter = Router({ mergeParams: true });
projectTasksRouter.use(requireAuth);

/** GET /api/v1/projects/:id/tasks */
projectTasksRouter.get('/', validateQuery(taskListQuerySchema), (req, res) => {
  const db = req.app.locals.db;
  const { project } = getProjectOr404(db, req.params.projectId, req.user.id);
  const query = req.validatedQuery;
  const { where, params } = buildTaskFilters(query, project.id);
  const total = db.prepare(`SELECT COUNT(*) AS c FROM tasks t WHERE ${where}`).get(...params).c;
  const direction = query.order.toUpperCase();
  const rows = db
    .prepare(
      `${TASK_SELECT} WHERE ${where}
       ORDER BY ${SORT_COLUMNS[query.sort]} ${direction}, t.id ${direction}
       LIMIT ? OFFSET ?`
    )
    .all(...params, query.limit, (query.page - 1) * query.limit);
  res.set('X-Total-Count', String(total));
  res.status(200).json({ data: rows.map(serializeTask), page: query.page, limit: query.limit, total });
});

/** POST /api/v1/projects/:id/tasks - any member can create a task. */
projectTasksRouter.post('/', validateBody(taskCreateSchema), (req, res) => {
  const db = req.app.locals.db;
  const { project } = getProjectOr404(db, req.params.projectId, req.user.id);
  if (project.archived) {
    throw businessRule('ARCHIVED_PROJECT', 'This project is archived and cannot be modified');
  }
  const body = req.validatedBody;
  if (body.assigneeId !== null && !findMember(db, project.id, body.assigneeId)) {
    throw businessRule('ASSIGNEE_NOT_MEMBER', 'Assignee must be a member of this project');
  }
  const today = todayUtc();
  if (body.dueDate !== null && body.dueDate < today) {
    throw businessRule(
      'DUE_DATE_BEFORE_CREATION',
      `Due date cannot be before the task creation date (${today})`
    );
  }
  const now = nowIso();
  const info = db
    .prepare(
      `INSERT INTO tasks (project_id, title, description, status, priority, assignee_id,
         reporter_id, due_date, estimated_hours, created_at, updated_at)
       VALUES (?, ?, ?, 'TODO', ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      project.id,
      body.title.trim(),
      body.description,
      body.priority,
      body.assigneeId,
      req.user.id,
      body.dueDate,
      body.estimatedHours,
      now,
      now
    );
  const taskId = Number(info.lastInsertRowid);
  recordActivity(db, {
    projectId: project.id,
    taskId,
    actorId: req.user.id,
    action: 'TASK_CREATED',
    detail: {
      title: body.title.trim(),
      status: 'TODO',
      priority: body.priority,
      assigneeId: body.assigneeId,
      dueDate: body.dueDate,
    },
    at: now,
  });
  res.status(201).json(serializeTask(snapshotTask(db, taskId)));
});

// ------------------------------------------------------------ single-task API

export const tasksRouter = Router();
tasksRouter.use(requireAuth);

/** GET /api/v1/tasks/:id */
tasksRouter.get('/:id', (req, res) => {
  const db = req.app.locals.db;
  const { task } = getTaskOr404(db, req.params.id, req.user.id);
  res.status(200).json(serializeTask(snapshotTask(db, task.id)));
});

/** PATCH /api/v1/tasks/:id */
tasksRouter.patch('/:id', validateBody(taskUpdateSchema), (req, res) => {
  const db = req.app.locals.db;
  const { task, role } = getTaskOr404(db, req.params.id, req.user.id);
  assertNotArchived(task);
  assertTaskWriter(req.user.id, task, role);

  const body = req.validatedBody;
  const changes = {};
  const next = {
    title: task.title,
    description: task.description,
    priority: task.priority,
    assignee_id: task.assignee_id,
    due_date: task.due_date,
    estimated_hours: task.estimated_hours,
  };

  if (body.title !== undefined) {
    const trimmed = body.title.trim();
    if (trimmed !== task.title) changes.title = { from: task.title, to: trimmed };
    next.title = trimmed;
  }
  if (body.description !== undefined && body.description !== task.description) {
    changes.description = { from: task.description, to: body.description };
    next.description = body.description;
  }
  if (body.priority !== undefined && body.priority !== task.priority) {
    changes.priority = { from: task.priority, to: body.priority };
    next.priority = body.priority;
  }
  if (body.assigneeId !== undefined) {
    if (body.assigneeId !== null && !findMember(db, task.project_id, body.assigneeId)) {
      throw businessRule('ASSIGNEE_NOT_MEMBER', 'Assignee must be a member of this project');
    }
    if (body.assigneeId !== task.assignee_id) {
      changes.assignee_id = { from: task.assignee_id, to: body.assigneeId };
      next.assignee_id = body.assigneeId;
    }
  }
  if (body.dueDate !== undefined) {
    if (body.dueDate !== null) {
      const creationDate = task.created_at.slice(0, 10);
      if (body.dueDate < creationDate) {
        throw businessRule(
          'DUE_DATE_BEFORE_CREATION',
          `Due date cannot be before the task creation date (${creationDate})`
        );
      }
    }
    if (body.dueDate !== task.due_date) {
      changes.due_date = { from: task.due_date, to: body.dueDate };
      next.due_date = body.dueDate;
    }
  }
  if (body.estimatedHours !== undefined && body.estimatedHours !== task.estimated_hours) {
    changes.estimated_hours = { from: task.estimated_hours, to: body.estimatedHours };
    next.estimated_hours = body.estimatedHours;
  }

  if (Object.keys(changes).length === 0) {
    res.status(200).json(serializeTask(snapshotTask(db, task.id)));
    return;
  }

  const now = nowIso();
  db.prepare(
    `UPDATE tasks SET title = ?, description = ?, priority = ?, assignee_id = ?,
       due_date = ?, estimated_hours = ?, updated_at = ? WHERE id = ?`
  ).run(
    next.title,
    next.description,
    next.priority,
    next.assignee_id,
    next.due_date,
    next.estimated_hours,
    now,
    task.id
  );
  recordActivity(db, {
    projectId: task.project_id,
    taskId: task.id,
    actorId: req.user.id,
    action: 'TASK_UPDATED',
    detail: { changes },
    at: now,
  });
  res.status(200).json(serializeTask(snapshotTask(db, task.id)));
});

/** PATCH /api/v1/tasks/:id/status - workflow transition. */
tasksRouter.patch('/:id/status', validateBody(taskStatusSchema), (req, res) => {
  const db = req.app.locals.db;
  const { task, role } = getTaskOr404(db, req.params.id, req.user.id);
  assertNotArchived(task);
  assertTaskWriter(req.user.id, task, role);

  const target = req.validatedBody.status;
  if (target === task.status) {
    // Same-status update is a no-op 200 and writes no activity row.
    res.status(200).json(serializeTask(snapshotTask(db, task.id)));
    return;
  }
  const allowed = getAllowedTransitions(task.status);
  if (!allowed.includes(target)) {
    throw businessRule(
      'INVALID_STATUS_TRANSITION',
      `Cannot change status from ${task.status} to ${target}`,
      [{ from: task.status, to: target, allowed }]
    );
  }
  const now = nowIso();
  db.prepare('UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?').run(target, now, task.id);
  recordActivity(db, {
    projectId: task.project_id,
    taskId: task.id,
    actorId: req.user.id,
    action: 'TASK_STATUS_CHANGED',
    detail: { from: task.status, to: target },
    at: now,
  });
  res.status(200).json(serializeTask(snapshotTask(db, task.id)));
});

/** DELETE /api/v1/tasks/:id - reporter or project ADMIN/OWNER. */
tasksRouter.delete('/:id', (req, res) => {
  const db = req.app.locals.db;
  const { task, role } = getTaskOr404(db, req.params.id, req.user.id);
  assertNotArchived(task);
  const canDelete = req.user.id === task.reporter_id || role === 'ADMIN' || role === 'OWNER';
  if (!canDelete) {
    throw forbidden('Only the task reporter or a project admin can delete this task');
  }
  db.prepare('DELETE FROM tasks WHERE id = ?').run(task.id);
  recordActivity(db, {
    projectId: task.project_id,
    actorId: req.user.id,
    action: 'TASK_DELETED',
    detail: { taskId: task.id, title: task.title },
  });
  res.status(204).end();
});

/** GET /api/v1/tasks/:id/activity */
tasksRouter.get('/:id/activity', validateQuery(paginationQuerySchema), (req, res) => {
  const db = req.app.locals.db;
  const { task } = getTaskOr404(db, req.params.id, req.user.id);
  const { page, limit } = req.validatedQuery;
  const total = db.prepare('SELECT COUNT(*) AS c FROM activity WHERE task_id = ?').get(task.id).c;
  const rows = db
    .prepare(
      `SELECT a.*, u.display_name AS actor_name, t.title AS task_title
       FROM activity a JOIN users u ON u.id = a.actor_id
       LEFT JOIN tasks t ON t.id = a.task_id
       WHERE a.task_id = ?
       ORDER BY a.created_at DESC, a.id DESC LIMIT ? OFFSET ?`
    )
    .all(task.id, limit, (page - 1) * limit);
  res.set('X-Total-Count', String(total));
  res.status(200).json({ data: rows.map(serializeActivity), page, limit, total });
});

// nested: /api/v1/tasks/:id/comments
tasksRouter.use('/:id/comments', commentsRouter);
