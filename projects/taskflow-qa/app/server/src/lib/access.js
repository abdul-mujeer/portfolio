import { notFound } from './errors.js';

/**
 * Cross-project isolation helpers.
 *
 * If a project exists but the requester is not a member we return **404**, not
 * 403: outsiders must not be able to learn that a project/task exists.
 */

export function findMember(db, projectId, userId) {
  return db
    .prepare('SELECT * FROM project_members WHERE project_id = ? AND user_id = ?')
    .get(projectId, userId);
}

export function getProjectOr404(db, projectId, userId) {
  const id = Number(projectId);
  if (!Number.isInteger(id) || id <= 0) throw notFound('Project not found');
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  if (!project) throw notFound('Project not found');
  const member = findMember(db, project.id, userId);
  if (!member) throw notFound('Project not found');
  return { project, role: member.role };
}

export function getTaskOr404(db, taskId, userId) {
  const id = Number(taskId);
  if (!Number.isInteger(id) || id <= 0) throw notFound('Task not found');
  const task = db
    .prepare(
      `SELECT t.*, p.key AS project_key, p.archived AS project_archived, p.name AS project_name
       FROM tasks t JOIN projects p ON p.id = t.project_id
       WHERE t.id = ?`
    )
    .get(id);
  if (!task) throw notFound('Task not found');
  const member = findMember(db, task.project_id, userId);
  if (!member) throw notFound('Task not found');
  return { task, role: member.role };
}
