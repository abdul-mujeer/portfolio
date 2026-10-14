import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashPassword, makeSalt } from './lib/password.js';
import { nowIso } from './lib/datetime.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SEED_DIR = path.resolve(HERE, '..', '..', '..', 'test-data', 'seed');

function loadFixture(name) {
  return JSON.parse(readFileSync(path.join(SEED_DIR, name), 'utf8'));
}

/** YYYY-MM-DD for N days before `now` (UTC). */
export function seedDate(daysAgo, now = new Date()) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

/** ISO timestamp for N days before `now` (UTC). */
export function seedStamp(daysAgo, time = '09:00:00', now = new Date()) {
  return `${seedDate(daysAgo, now)}T${time}Z`;
}

/**
 * Deterministic synthetic seed data.
 *
 * - IDs and values are identical after every reset.
 * - Relative date offsets are fixed (e.g. "3 days overdue"), so counts like
 *   "3 overdue tasks" hold on any run day. Absolute timestamps therefore differ
 *   between runs — this is documented in the README.
 * - Passwords are documented demo credentials; salts are random per reset.
 */
export function seedDatabase(db, { now = new Date() } = {}) {
  const users = loadFixture('users.json');
  const projects = loadFixture('projects.json');
  const memberships = loadFixture('memberships.json');
  const tasks = loadFixture('tasks.json');
  const comments = loadFixture('comments.json');
  const activityExtra = loadFixture('activity-extra.json');

  const existing = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (existing > 0) {
    throw new Error('Database is not empty - refusing to seed (use npm run db:reset)');
  }

  const insertUser = db.prepare(
    'INSERT INTO users (id, email, display_name, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const insertProject = db.prepare(
    `INSERT INTO projects (id, key, name, description, owner_id, created_at, updated_at, archived)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertMember = db.prepare(
    'INSERT INTO project_members (project_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)'
  );
  const insertTask = db.prepare(
    `INSERT INTO tasks (id, project_id, title, description, status, priority, assignee_id,
       reporter_id, due_date, estimated_hours, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertComment = db.prepare(
    'INSERT INTO comments (id, task_id, author_id, body, created_at) VALUES (?, ?, ?, ?, ?)'
  );
  const insertActivity = db.prepare(
    `INSERT INTO activity (project_id, task_id, actor_id, action, detail_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  const counts = { users: 0, projects: 0, members: 0, tasks: 0, comments: 0, activity: 0 };

  db.exec('BEGIN');
  try {
    for (const user of users) {
      const salt = makeSalt();
      insertUser.run(
        user.id,
        user.email,
        user.display_name,
        hashPassword(user.password, salt),
        salt,
        seedStamp(user.createdDaysAgo, '08:00:00', now)
      );
      counts.users += 1;
    }

    for (const project of projects) {
      const createdAt = seedStamp(project.createdDaysAgo, '09:00:00', now);
      const updatedAt =
        project.archived && project.archivedDaysAgo !== undefined
          ? seedStamp(project.archivedDaysAgo, '10:00:00', now)
          : createdAt;
      insertProject.run(
        project.id,
        project.key,
        project.name,
        project.description,
        project.ownerId,
        createdAt,
        updatedAt,
        project.archived ? 1 : 0
      );
      insertActivity.run(
        project.id,
        null,
        project.ownerId,
        'PROJECT_CREATED',
        JSON.stringify({ key: project.key, name: project.name }),
        createdAt
      );
      counts.activity += 1;
      if (project.archived && project.archivedDaysAgo !== undefined) {
        insertActivity.run(
          project.id,
          null,
          project.ownerId,
          'PROJECT_ARCHIVED',
          JSON.stringify({ key: project.key }),
          seedStamp(project.archivedDaysAgo, '10:00:00', now)
        );
        counts.activity += 1;
      }
      counts.projects += 1;
    }

    for (const member of memberships) {
      const joinedAt = seedStamp(member.joinedDaysAgo, '09:05:00', now);
      insertMember.run(member.projectId, member.userId, member.role, joinedAt);
      insertActivity.run(
        member.projectId,
        null,
        member.userId,
        'MEMBER_ADDED',
        JSON.stringify({ userId: member.userId, role: member.role }),
        joinedAt
      );
      counts.members += 1;
      counts.activity += 1;
    }

    for (const task of tasks) {
      const createdAt = seedStamp(
        task.createdDaysAgo,
        `09:${String((task.id * 7) % 60).padStart(2, '0')}:00`,
        now
      );
      // dueDays is "days from today" (positive = future), seedDate counts backwards.
      const dueDate = task.dueDays === null ? null : seedDate(-task.dueDays, now);
      insertTask.run(
        task.id,
        task.projectId,
        task.title,
        task.description,
        task.status,
        task.priority,
        task.assigneeId,
        task.reporterId,
        dueDate,
        task.estimatedHours,
        createdAt,
        createdAt
      );
      insertActivity.run(
        task.projectId,
        task.id,
        task.reporterId,
        'TASK_CREATED',
        JSON.stringify({ title: task.title, status: task.status, priority: task.priority }),
        createdAt
      );
      counts.tasks += 1;
      counts.activity += 1;
    }

    for (const comment of comments) {
      const createdAt = seedStamp(
        comment.createdDaysAgo,
        `1${String((comment.id * 3) % 10)}:${String((comment.id * 11) % 60).padStart(2, '0')}:00`,
        now
      );
      insertComment.run(comment.id, comment.taskId, comment.authorId, comment.body, createdAt);
      const task = tasks.find((t) => t.id === comment.taskId);
      insertActivity.run(
        task.projectId,
        comment.taskId,
        comment.authorId,
        'COMMENT_ADDED',
        JSON.stringify({ commentId: comment.id, taskId: comment.taskId }),
        createdAt
      );
      counts.comments += 1;
      counts.activity += 1;
    }

    for (const row of activityExtra) {
      insertActivity.run(
        row.projectId,
        row.taskId,
        row.actorId,
        row.action,
        JSON.stringify(row.detail),
        seedStamp(row.daysAgo, row.time || '12:00:00', now)
      );
      counts.activity += 1;
    }

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return { ...counts, seededAt: nowIso() };
}
