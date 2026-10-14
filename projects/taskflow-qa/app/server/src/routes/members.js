import { Router } from 'express';
import { memberAddSchema, memberRoleSchema } from '../lib/validators.js';
import { validateBody } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { findMember, getProjectOr404 } from '../lib/access.js';
import { recordActivity } from '../lib/activity.js';
import { businessRule, conflict, forbidden, notFound } from '../lib/errors.js';
import { nowIso } from '../lib/datetime.js';

export const membersRouter = Router({ mergeParams: true });
membersRouter.use(requireAuth);

function serializeMember(row) {
  return {
    user_id: row.user_id,
    email: row.email,
    display_name: row.display_name,
    role: row.role,
    joined_at: row.joined_at,
  };
}

function requireAdmin(role) {
  if (role !== 'OWNER' && role !== 'ADMIN') {
    throw forbidden('Only project OWNER or ADMIN can manage members');
  }
}

function assertNotArchived(project) {
  if (project.archived) {
    throw businessRule('ARCHIVED_PROJECT', 'This project is archived and cannot be modified');
  }
}

function parseUserId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** GET /api/v1/projects/:id/members - any member can read the roster. */
membersRouter.get('/', (req, res) => {
  const db = req.app.locals.db;
  const { project } = getProjectOr404(db, req.params.projectId, req.user.id);
  const rows = db
    .prepare(
      `SELECT pm.user_id, pm.role, pm.joined_at, u.email, u.display_name
       FROM project_members pm JOIN users u ON u.id = pm.user_id
       WHERE pm.project_id = ?
       ORDER BY CASE pm.role WHEN 'OWNER' THEN 0 WHEN 'ADMIN' THEN 1 ELSE 2 END, pm.user_id`
    )
    .all(project.id);
  res.set('X-Total-Count', String(rows.length));
  res.status(200).json({ data: rows.map(serializeMember), page: 1, limit: rows.length, total: rows.length });
});

/** POST /api/v1/projects/:id/members - add an existing user by email. */
membersRouter.post('/', validateBody(memberAddSchema), (req, res) => {
  const db = req.app.locals.db;
  const { project, role } = getProjectOr404(db, req.params.projectId, req.user.id);
  requireAdmin(role);
  assertNotArchived(project);

  const email = req.validatedBody.email.toLowerCase();
  const { role: newRole } = req.validatedBody;
  const user = db.prepare('SELECT id, email, display_name FROM users WHERE email = ?').get(email);
  if (!user) {
    throw notFound('No user with this email exists');
  }
  if (findMember(db, project.id, user.id)) {
    throw conflict('MEMBER_ALREADY_EXISTS', 'This user is already a member of the project');
  }
  const now = nowIso();
  db.prepare('INSERT INTO project_members (project_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)').run(
    project.id,
    user.id,
    newRole,
    now
  );
  recordActivity(db, {
    projectId: project.id,
    actorId: req.user.id,
    action: 'MEMBER_ADDED',
    detail: { userId: user.id, email: user.email, role: newRole },
    at: now,
  });
  res.status(201).json(serializeMember({
    user_id: user.id,
    email: user.email,
    display_name: user.display_name,
    role: newRole,
    joined_at: now,
  }));
});

/** PATCH /api/v1/projects/:id/members/:userId - change a member role. */
membersRouter.patch('/:userId', validateBody(memberRoleSchema), (req, res) => {
  const db = req.app.locals.db;
  const { project, role } = getProjectOr404(db, req.params.projectId, req.user.id);
  requireAdmin(role);
  assertNotArchived(project);

  const targetId = parseUserId(req.params.userId);
  const target = targetId ? findMember(db, project.id, targetId) : null;
  if (!target) {
    throw notFound('Member not found');
  }
  if (target.role === 'OWNER') {
    throw conflict('OWNER_ROLE_LOCKED', 'The OWNER role cannot be changed; transfer ownership instead');
  }
  if (target.role === req.validatedBody.role) {
    const user = db.prepare('SELECT email, display_name FROM users WHERE id = ?').get(target.user_id);
    res.status(200).json(serializeMember({ ...target, ...user }));
    return;
  }
  if (target.role === 'ADMIN' && req.validatedBody.role === 'MEMBER') {
    const admins = db
      .prepare("SELECT COUNT(*) AS c FROM project_members WHERE project_id = ? AND role = 'ADMIN'")
      .get(project.id).c;
    if (admins <= 1) {
      throw conflict('LAST_ADMIN', 'The last ADMIN cannot be demoted; promote another member first');
    }
  }
  const now = nowIso();
  db.prepare('UPDATE project_members SET role = ? WHERE project_id = ? AND user_id = ?').run(
    req.validatedBody.role,
    project.id,
    target.user_id
  );
  recordActivity(db, {
    projectId: project.id,
    actorId: req.user.id,
    action: 'MEMBER_ROLE_CHANGED',
    detail: { userId: target.user_id, from: target.role, to: req.validatedBody.role },
    at: now,
  });
  const user = db.prepare('SELECT email, display_name FROM users WHERE id = ?').get(target.user_id);
  res.status(200).json(serializeMember({
    user_id: target.user_id,
    email: user.email,
    display_name: user.display_name,
    role: req.validatedBody.role,
    joined_at: target.joined_at,
  }));
});

/** DELETE /api/v1/projects/:id/members/:userId - remove a member (never the OWNER). */
membersRouter.delete('/:userId', (req, res) => {
  const db = req.app.locals.db;
  const { project, role } = getProjectOr404(db, req.params.projectId, req.user.id);
  requireAdmin(role);
  assertNotArchived(project);

  const targetId = parseUserId(req.params.userId);
  const target = targetId ? findMember(db, project.id, targetId) : null;
  if (!target) {
    throw notFound('Member not found');
  }
  if (target.role === 'OWNER') {
    throw conflict(
      'CANNOT_REMOVE_OWNER',
      'The OWNER cannot be removed; transfer ownership to another member first'
    );
  }
  const user = db.prepare('SELECT email FROM users WHERE id = ?').get(target.user_id);
  db.prepare('DELETE FROM project_members WHERE project_id = ? AND user_id = ?').run(
    project.id,
    target.user_id
  );
  recordActivity(db, {
    projectId: project.id,
    actorId: req.user.id,
    action: 'MEMBER_REMOVED',
    detail: { userId: target.user_id, email: user?.email ?? null, role: target.role },
  });
  res.status(204).end();
});
