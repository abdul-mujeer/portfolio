/**
 * Schema-level SQL validation checks: UNIQUE keys, PRAGMA foreign_keys,
 * FK integrity, orphan detection and CHECK constraints.
 *
 * Multi-statement probes run inside an explicit transaction that is rolled
 * back, so the database under test is never mutated.
 */

function expectSqlError(db, sql, params, label) {
  db.exec('BEGIN');
  try {
    let threw = false;
    let message = '';
    try {
      db.prepare(sql).run(...params);
    } catch (error) {
      threw = true;
      message = String(error.message ?? error);
    }
    if (!threw) {
      throw new Error(`${label}: expected a SQL constraint error but the statement succeeded`);
    }
    return message;
  } finally {
    db.exec('ROLLBACK');
  }
}

function softDeleteSafeCount(db, sql) {
  return db.prepare(sql).get().c;
}

const NOW = '2026-01-01T00:00:00.000Z';

export function constraintChecks() {
  return [
    {
      id: 'unique-user-email',
      caseId: 'TASK-TC-201',
      name: 'users.email UNIQUE rejects a duplicate insert and leaves the table untouched',
      run: (ctx) => {
        const before = ctx.db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
        expectSqlError(
          ctx.db,
          'INSERT INTO users (email, display_name, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?)',
          ['owner@example.com', 'Duplicate Owner', 'x', 'y', NOW],
          'duplicate email'
        );
        const after = ctx.db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
        if (after !== before) throw new Error(`users count changed from ${before} to ${after}`);
        return `duplicate email rejected, users still ${after}`;
      },
    },
    {
      id: 'unique-project-key',
      caseId: 'TASK-TC-201',
      name: 'projects.key UNIQUE rejects a duplicate insert',
      run: (ctx) => {
        expectSqlError(
          ctx.db,
          `INSERT INTO projects (key, name, description, owner_id, created_at, updated_at, archived)
           VALUES (?, ?, ?, ?, ?, ?, 0)`,
          ['TASK', 'Duplicate key project', null, 1, NOW, NOW],
          'duplicate project key'
        );
        return 'duplicate project key rejected';
      },
    },
    {
      id: 'foreign-keys-enabled',
      caseId: 'TASK-TC-202',
      name: 'PRAGMA foreign_keys is ON for the application connection',
      run: (ctx) => {
        const value = ctx.db.prepare('PRAGMA foreign_keys').get().foreign_keys;
        if (value !== 1) throw new Error(`foreign_keys = ${value}, expected 1`);
        return 'foreign_keys = 1';
      },
    },
    {
      id: 'foreign-key-check-clean',
      caseId: 'TASK-TC-202',
      name: 'PRAGMA foreign_key_check returns no violations',
      run: (ctx) => {
        const violations = ctx.db.prepare('PRAGMA foreign_key_check').all();
        if (violations.length > 0) {
          throw new Error(`foreign_key_check found ${violations.length} violation(s)`);
        }
        return 'no FK violations';
      },
    },
    {
      id: 'fk-insert-rejected',
      caseId: 'TASK-TC-202',
      name: 'tasks.project_id FK rejects a task pointing at a missing project',
      run: (ctx) => {
        expectSqlError(
          ctx.db,
          `INSERT INTO tasks (project_id, title, status, priority, reporter_id, created_at, updated_at)
           VALUES (999999, ?, 'TODO', 'MEDIUM', 1, ?, ?)`,
          ['Orphan task', NOW, NOW],
          'orphan task insert'
        );
        return 'orphan task rejected by FK';
      },
    },
    {
      id: 'no-orphan-rows',
      caseId: 'TASK-TC-202',
      name: 'no orphan tasks / comments / members / activity rows exist',
      run: (ctx) => {
        const orphans = {
          tasks: softDeleteSafeCount(
            ctx.db,
            `SELECT COUNT(*) AS c FROM tasks t LEFT JOIN projects p ON p.id = t.project_id WHERE p.id IS NULL`
          ),
          comments: softDeleteSafeCount(
            ctx.db,
            `SELECT COUNT(*) AS c FROM comments c LEFT JOIN tasks t ON t.id = c.task_id WHERE t.id IS NULL`
          ),
          members: softDeleteSafeCount(
            ctx.db,
            `SELECT COUNT(*) AS c FROM project_members m
             LEFT JOIN projects p ON p.id = m.project_id
             LEFT JOIN users u ON u.id = m.user_id
             WHERE p.id IS NULL OR u.id IS NULL`
          ),
          activity: softDeleteSafeCount(
            ctx.db,
            `SELECT COUNT(*) AS c FROM activity a LEFT JOIN projects p ON p.id = a.project_id WHERE p.id IS NULL`
          ),
          activityTask: softDeleteSafeCount(
            ctx.db,
            `SELECT COUNT(*) AS c FROM activity a LEFT JOIN tasks t ON t.id = a.task_id
             WHERE a.task_id IS NOT NULL AND t.id IS NULL`
          ),
        };
        for (const [table, count] of Object.entries(orphans)) {
          if (count !== 0) throw new Error(`orphan rows in ${table}: ${count}`);
        }
        return 'tasks=0, comments=0, members=0, activity=0, activity.tasks=0';
      },
    },
    {
      id: 'check-task-status',
      caseId: 'TASK-TC-203',
      name: "tasks.status CHECK rejects values outside the enum ('BLOCKED')",
      run: (ctx) => {
        expectSqlError(
          ctx.db,
          `INSERT INTO tasks (project_id, title, status, priority, reporter_id, created_at, updated_at)
           VALUES (1, ?, 'BLOCKED', 'MEDIUM', 1, ?, ?)`,
          ['Invalid status task', NOW, NOW],
          'invalid status'
        );
        return 'invalid status rejected';
      },
    },
    {
      id: 'check-task-title-length',
      caseId: 'TASK-TC-203',
      name: 'tasks.title CHECK rejects titles shorter than 3 characters',
      run: (ctx) => {
        expectSqlError(
          ctx.db,
          `INSERT INTO tasks (project_id, title, status, priority, reporter_id, created_at, updated_at)
           VALUES (1, ?, 'TODO', 'MEDIUM', 1, ?, ?)`,
          ['ab', NOW, NOW],
          'short title'
        );
        return 'short title rejected';
      },
    },
    {
      id: 'check-estimated-hours',
      caseId: 'TASK-TC-203',
      name: 'tasks.estimated_hours CHECK rejects values below 0.5',
      run: (ctx) => {
        expectSqlError(
          ctx.db,
          `INSERT INTO tasks (project_id, title, status, priority, reporter_id, estimated_hours, created_at, updated_at)
           VALUES (1, ?, 'TODO', 'MEDIUM', 1, 0.25, ?, ?)`,
          ['Bad estimate task', NOW, NOW],
          'estimated_hours below range'
        );
        return 'estimated_hours 0.25 rejected';
      },
    },
    {
      id: 'check-comment-body-length',
      caseId: 'TASK-TC-203',
      name: 'comments.body CHECK rejects bodies over 1000 characters',
      run: (ctx) => {
        expectSqlError(
          ctx.db,
          'INSERT INTO comments (task_id, author_id, body, created_at) VALUES (1, 1, ?, ?)',
          ['x'.repeat(1001), NOW],
          'oversized comment body'
        );
        return '1001-char comment rejected';
      },
    },
    {
      id: 'check-project-key-pattern',
      caseId: 'TASK-TC-203',
      name: 'projects.key CHECK rejects lowercase keys',
      run: (ctx) => {
        expectSqlError(
          ctx.db,
          `INSERT INTO projects (key, name, owner_id, created_at, updated_at, archived)
           VALUES ('task', 'Lowercase key', 1, ?, ?, 0)`,
          [NOW, NOW],
          'lowercase project key'
        );
        return 'lowercase key rejected';
      },
    },
    {
      id: 'check-activity-detail-json',
      caseId: 'TASK-TC-203',
      name: 'activity.detail_json CHECK rejects non-JSON payloads and existing rows are all valid',
      run: (ctx) => {
        expectSqlError(
          ctx.db,
          'INSERT INTO activity (project_id, task_id, actor_id, action, detail_json, created_at) VALUES (1, NULL, 1, ?, ?, ?)',
          ['BAD_JSON', 'this is not json', NOW],
          'invalid detail_json'
        );
        const invalid = softDeleteSafeCount(
          ctx.db,
          'SELECT COUNT(*) AS c FROM activity WHERE json_valid(detail_json) = 0'
        );
        if (invalid !== 0) throw new Error(`${invalid} activity rows have invalid detail_json`);
        return 'invalid JSON rejected; all stored detail_json values are valid';
      },
    },
  ];
}
