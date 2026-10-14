import { Router } from 'express';
import {
  projectCreateSchema,
  projectUpdateSchema,
  projectListQuerySchema,
  transferSchema,
} from '../lib/validators.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { findMember, getProjectOr404 } from '../lib/access.js';
import { recordActivity } from '../lib/activity.js';
import { businessRule, conflict, forbidden, notFound } from '../lib/errors.js';
import { nowIso } from '../lib/datetime.js';

export const projectsRouter = Router();
projectsRouter.use(requireAuth);

export function serializeProject(row) {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description,
    owner_id: row.owner_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    archived: !!row.archived,
    my_role: row.my_role,
    member_count: row.member_count,
    task_count: row.task_count,
  };
}

const PROJECT_SELECT = `
  SELECT p.id, p.key, p.name, p.description, p.owner_id, p.created_at, p.updated_at, p.archived,
         pm.role AS my_role,
         (SELECT COUNT(*) FROM project_members m WHERE m.project_id = p.id) AS member_count,
         (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) AS task_count
  FROM projects p
  JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ?
`;

function fetchProject(db, projectId, userId) {
  return db.prepare(`${PROJECT_SELECT} WHERE p.id = ?`).get(userId, projectId);
}

function assertNotArchived(project) {
  if (project.archived) {
    throw businessRule('ARCHIVED_PROJECT', 'This project is archived and cannot be modified');
  }
}

function assertProjectAdmin(role) {
  if (role !== 'OWNER' && role !== 'ADMIN') {
    throw forbidden('Only project OWNER or ADMIN can perform this action');
  }
}

/** GET /api/v1/projects - only projects the caller is a member of. */
projectsRouter.get('/', validateQuery(projectListQuerySchema), (req, res) => {
  const db = req.app.locals.db;
  const { page, limit, archived } = req.validatedQuery;
  // PROJECT_SELECT already joins project_members for req.user.id, so the WHERE
  // clause must NOT repeat the user filter (doing so would bind a second value
  // into the LIMIT placeholder - defect TASK-BUG-003).
  const filters = [];
  const params = [];
  if (archived !== undefined) {
    filters.push('p.archived = ?');
    params.push(archived === 'true' ? 1 : 0);
  }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const total = db
    .prepare(
      `SELECT COUNT(*) AS c FROM projects p
       JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ?
       ${where}`
    )
    .get(req.user.id, ...params).c;
  const rows = db
    .prepare(`${PROJECT_SELECT} ${where} ORDER BY p.id ASC LIMIT ? OFFSET ?`)
    .all(req.user.id, ...params, limit, (page - 1) * limit);

  res.set('X-Total-Count', String(total));
  res.status(200).json({ data: rows.map(serializeProject), page, limit, total });
});

/** POST /api/v1/projects */
projectsRouter.post('/', validateBody(projectCreateSchema), (req, res) => {
  const db = req.app.locals.db;
  const { key, name, description } = req.validatedBody;
  if (db.prepare('SELECT id FROM projects WHERE key = ?').get(key)) {
    throw conflict('PROJECT_KEY_TAKEN', `Project key "${key}" is already in use`);
  }
  const now = nowIso();
  let projectId;
  db.exec('BEGIN');
  try {
    const info = db
      .prepare(
        'INSERT INTO projects (key, name, description, owner_id, created_at, updated_at, archived) VALUES (?, ?, ?, ?, ?, ?, 0)'
      )
      .run(key, name, description, req.user.id, now, now);
    projectId = Number(info.lastInsertRowid);
    db.prepare(
      'INSERT INTO project_members (project_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)'
    ).run(projectId, req.user.id, 'OWNER', now);
    recordActivity(db, {
      projectId,
      actorId: req.user.id,
      action: 'PROJECT_CREATED',
      detail: { key, name },
      at: now,
    });
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  res.status(201).json(serializeProject(fetchProject(db, projectId, req.user.id)));
});

/** GET /api/v1/projects/:id */
projectsRouter.get('/:id', (req, res) => {
  const db = req.app.locals.db;
  const { project } = getProjectOr404(db, req.params.id, req.user.id);
  res.status(200).json(serializeProject(fetchProject(db, project.id, req.user.id)));
});

/** PATCH /api/v1/projects/:id - rename / redescribe (OWNER or ADMIN, not archived). */
projectsRouter.patch('/:id', validateBody(projectUpdateSchema), (req, res) => {
  const db = req.app.locals.db;
  const { project, role } = getProjectOr404(db, req.params.id, req.user.id);
  assertProjectAdmin(role);
  assertNotArchived(project);

  const body = req.validatedBody;
  const changes = {};
  if (body.name !== undefined && body.name !== project.name) {
    changes.name = { from: project.name, to: body.name };
  }
  if (body.description !== undefined && body.description !== project.description) {
    changes.description = { from: project.description, to: body.description };
  }
  if (Object.keys(changes).length === 0) {
    res.status(200).json(serializeProject(fetchProject(db, project.id, req.user.id)));
    return;
  }
  const now = nowIso();
  db.prepare('UPDATE projects SET name = ?, description = ?, updated_at = ? WHERE id = ?').run(
    body.name !== undefined ? body.name : project.name,
    body.description !== undefined ? body.description : project.description,
    now,
    project.id
  );
  recordActivity(db, {
    projectId: project.id,
    actorId: req.user.id,
    action: 'PROJECT_UPDATED',
    detail: { changes },
    at: now,
  });
  res.status(200).json(serializeProject(fetchProject(db, project.id, req.user.id)));
});

/** DELETE /api/v1/projects/:id - OWNER only. */
projectsRouter.delete('/:id', (req, res) => {
  const db = req.app.locals.db;
  const { project, role } = getProjectOr404(db, req.params.id, req.user.id);
  if (role !== 'OWNER') {
    throw forbidden('Only the project OWNER can delete this project');
  }
  assertNotArchived(project);
  db.prepare('DELETE FROM projects WHERE id = ?').run(project.id);
  res.status(204).end();
});

/** POST /api/v1/projects/:id/archive - OWNER or ADMIN. */
projectsRouter.post('/:id/archive', (req, res) => {
  const db = req.app.locals.db;
  const { project, role } = getProjectOr404(db, req.params.id, req.user.id);
  assertProjectAdmin(role);
  if (project.archived) {
    throw conflict('PROJECT_ALREADY_ARCHIVED', 'Project is already archived');
  }
  const now = nowIso();
  db.prepare('UPDATE projects SET archived = 1, updated_at = ? WHERE id = ?').run(now, project.id);
  recordActivity(db, {
    projectId: project.id,
    actorId: req.user.id,
    action: 'PROJECT_ARCHIVED',
    detail: { key: project.key },
    at: now,
  });
  res.status(200).json(serializeProject(fetchProject(db, project.id, req.user.id)));
});

/** POST /api/v1/projects/:id/transfer - OWNER only; target must already be a member. */
projectsRouter.post('/:id/transfer', validateBody(transferSchema), (req, res) => {
  const db = req.app.locals.db;
  const { project, role } = getProjectOr404(db, req.params.id, req.user.id);
  if (role !== 'OWNER') {
    throw forbidden('Only the project OWNER can transfer ownership');
  }
  assertNotArchived(project);

  const { userId } = req.validatedBody;
  const target = findMember(db, project.id, userId);
  if (!target) {
    throw notFound('Target user is not a member of this project');
  }
  if (target.user_id === req.user.id) {
    throw conflict('ALREADY_OWNER', 'You already own this project');
  }
  const targetUser = db.prepare('SELECT email, display_name FROM users WHERE id = ?').get(userId);
  const now = nowIso();
  db.exec('BEGIN');
  try {
    db.prepare('UPDATE project_members SET role = \'OWNER\' WHERE project_id = ? AND user_id = ?').run(
      project.id,
      userId
    );
    db.prepare('UPDATE project_members SET role = \'ADMIN\' WHERE project_id = ? AND user_id = ?').run(
      project.id,
      req.user.id
    );
    db.prepare('UPDATE projects SET owner_id = ?, updated_at = ? WHERE id = ?').run(
      userId,
      now,
      project.id
    );
    recordActivity(db, {
      projectId: project.id,
      actorId: req.user.id,
      action: 'PROJECT_OWNER_TRANSFERRED',
      detail: {
        fromUserId: req.user.id,
        toUserId: userId,
        toEmail: targetUser?.email ?? null,
      },
      at: now,
    });
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  res.status(200).json({
    project: serializeProject(fetchProject(db, project.id, req.user.id)),
    transferredTo: { id: userId, email: targetUser?.email ?? null },
  });
});
