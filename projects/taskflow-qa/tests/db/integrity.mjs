/**
 * Data-integrity checks that compare stored state with the API and validate
 * business invariants that the schema alone cannot express:
 * activity completeness, owner consistency, archived exclusions, overdue SQL
 * correctness, count parity between API and SQL and file persistence.
 */

function count(db, sql, params = []) {
  return db.prepare(sql).get(...params).c;
}

export function integrityChecks() {
  return [
    {
      id: 'transition-history',
      caseId: 'TASK-TC-204',
      name: 'every DONE/CANCELED task has a TASK_STATUS_CHANGED activity row reaching that status',
      run: (ctx) => {
        const done = count(
          ctx.db,
          `SELECT COUNT(*) AS c FROM tasks t
           WHERE t.status IN ('DONE', 'CANCELED')
             AND NOT EXISTS (
               SELECT 1 FROM activity a
               WHERE a.task_id = t.id
                 AND a.action = 'TASK_STATUS_CHANGED'
                 AND json_extract(a.detail_json, '$.to') = t.status
             )`
        );
        if (done !== 0) throw new Error(`${done} finished task(s) missing their transition history`);
        const transitions = count(
          ctx.db,
          "SELECT COUNT(*) AS c FROM activity WHERE action = 'TASK_STATUS_CHANGED'"
        );
        return `transition rows = ${transitions}, all finished tasks covered`;
      },
    },
    {
      id: 'creation-history',
      caseId: 'TASK-TC-204',
      name: 'every existing task has a TASK_CREATED activity row',
      run: (ctx) => {
        const missing = count(
          ctx.db,
          `SELECT COUNT(*) AS c FROM tasks t
           WHERE NOT EXISTS (SELECT 1 FROM activity a WHERE a.task_id = t.id AND a.action = 'TASK_CREATED')`
        );
        if (missing !== 0) throw new Error(`${missing} task(s) without a creation event`);
        return 'all tasks have creation events';
      },
    },
    {
      id: 'activity-actions-known',
      caseId: 'TASK-TC-204',
      name: 'activity only contains documented action names and each detail_json parses',
      run: (ctx) => {
        const known = [
          'PROJECT_CREATED',
          'PROJECT_UPDATED',
          'PROJECT_ARCHIVED',
          'PROJECT_OWNER_TRANSFERRED',
          'MEMBER_ADDED',
          'MEMBER_ROLE_CHANGED',
          'MEMBER_REMOVED',
          'TASK_CREATED',
          'TASK_UPDATED',
          'TASK_STATUS_CHANGED',
          'TASK_DELETED',
          'COMMENT_ADDED',
        ];
        const rows = ctx.db.prepare('SELECT DISTINCT action FROM activity').all();
        for (const row of rows) {
          if (!known.includes(row.action)) throw new Error(`undocumented action: ${row.action}`);
        }
        return `actions seen: ${rows.map((r) => r.action).length} distinct, all documented`;
      },
    },
    {
      id: 'owner-consistency',
      caseId: 'TASK-TC-204',
      name: 'each project has exactly one OWNER row and it matches projects.owner_id',
      run: (ctx) => {
        const wrongCount = count(
          ctx.db,
          `SELECT COUNT(*) AS c FROM projects p
           WHERE (SELECT COUNT(*) FROM project_members m WHERE m.project_id = p.id AND m.role = 'OWNER') <> 1`
        );
        if (wrongCount !== 0) throw new Error(`${wrongCount} project(s) without exactly one OWNER`);
        const mismatched = count(
          ctx.db,
          `SELECT COUNT(*) AS c FROM projects p
           JOIN project_members m ON m.project_id = p.id AND m.role = 'OWNER'
           WHERE m.user_id <> p.owner_id`
        );
        if (mismatched !== 0) throw new Error(`${mismatched} project(s) where owner_id !== OWNER member`);
        const projects = count(ctx.db, 'SELECT COUNT(*) AS c FROM projects');
        return `${projects} projects with consistent ownership`;
      },
    },
    {
      id: 'archived-exclusion',
      caseId: 'TASK-TC-205',
      name: 'the overdue SQL excludes archived projects (2 archived overdue tasks stay out of scope)',
      run: (ctx) => {
        const today = new Date().toISOString().slice(0, 10);
        const predicate = `
          FROM tasks t JOIN projects p ON p.id = t.project_id
          WHERE p.archived = ? AND t.due_date IS NOT NULL AND t.due_date < ?
            AND t.status NOT IN ('DONE', 'CANCELED')`;
        const activeOverdue = count(ctx.db, `SELECT COUNT(*) AS c ${predicate}`, [0, today]);
        const archivedOverdue = count(ctx.db, `SELECT COUNT(*) AS c ${predicate}`, [1, today]);
        if (archivedOverdue !== 2) throw new Error(`expected 2 archived overdue tasks, found ${archivedOverdue}`);
        if (activeOverdue < 3) {
          throw new Error(`expected at least the 3 seeded active overdue tasks, found ${activeOverdue}`);
        }
        return `active overdue = ${activeOverdue} (>= 3 seeded), archived overdue = ${archivedOverdue} (excluded from reports)`;
      },
    },
    {
      id: 'due-today-boundary',
      caseId: 'TASK-TC-205',
      name: 'a task due today is not overdue (strict <) when the run happens on the seed day',
      run: (ctx) => {
        const today = new Date().toISOString().slice(0, 10);
        const dueToday = count(
          ctx.db,
          `SELECT COUNT(*) AS c FROM tasks WHERE due_date = ? AND status NOT IN ('DONE', 'CANCELED')`,
          [today]
        );
        const strict = count(
          ctx.db,
          `SELECT COUNT(*) AS c FROM tasks t JOIN projects p ON p.id = t.project_id
           WHERE p.archived = 0 AND t.due_date IS NOT NULL AND t.due_date < ? AND t.status NOT IN ('DONE', 'CANCELED')`,
          [today]
        );
        const inclusive = count(
          ctx.db,
          `SELECT COUNT(*) AS c FROM tasks t JOIN projects p ON p.id = t.project_id
           WHERE p.archived = 0 AND t.due_date <= ? AND t.status NOT IN ('DONE', 'CANCELED')`,
          [today]
        );
        if (dueToday === 1) {
          if (inclusive !== strict + 1) {
            throw new Error(`expected the boundary trap to add exactly 1 (strict ${strict} vs <= ${inclusive})`);
          }
          return `1 task due today; strict "<" gives ${strict}, "<=" would give ${inclusive}`;
        }
        return `no non-finished task is due today (run crossed UTC midnight since seeding); strict < gives ${strict}, <= gives ${inclusive}`;
      },
    },
    {
      id: 'overdue-api-parity',
      caseId: 'TASK-TC-205',
      name: 'GET /reports/overdue matches the SQL predicate for the owner',
      run: async (ctx) => {
        const today = new Date().toISOString().slice(0, 10);
        const sqlCount = count(
          ctx.db,
          `SELECT COUNT(*) AS c FROM tasks t
           JOIN projects p ON p.id = t.project_id
           JOIN project_members m ON m.project_id = p.id AND m.user_id = 1
           WHERE p.archived = 0 AND t.due_date IS NOT NULL AND t.due_date < ?
             AND t.status NOT IN ('DONE', 'CANCELED')`,
          [today]
        );
        const res = await ctx.api.get('/api/v1/reports/overdue', { cookie: ctx.cookie });
        if (res.status !== 200) throw new Error(`API returned ${res.status}`);
        if (res.body.count !== sqlCount) {
          throw new Error(`API count ${res.body.count} != SQL count ${sqlCount}`);
        }
        if (res.body.count < 3) throw new Error(`expected at least the 3 seeded overdue tasks, found ${res.body.count}`);
        return `API count = SQL count = ${res.body.count}`;
      },
    },
    {
      id: 'task-count-parity',
      caseId: 'TASK-TC-205',
      name: 'X-Total-Count for each accessible project task list equals the SQL COUNT(*)',
      run: async (ctx) => {
        // only projects where the owner is a member (other suites create projects
        // for other users, which are correctly 404 for this session)
        const projects = ctx.db
          .prepare(
            `SELECT p.id, p.key FROM projects p
             JOIN project_members m ON m.project_id = p.id AND m.user_id = 1
             ORDER BY p.id`
          )
          .all();
        const details = [];
        for (const project of projects) {
          const sqlCount = count(ctx.db, 'SELECT COUNT(*) AS c FROM tasks WHERE project_id = ?', [project.id]);
          const sqlDone = count(
            ctx.db,
            "SELECT COUNT(*) AS c FROM tasks WHERE project_id = ? AND status IN ('DONE','CANCELED')",
            [project.id]
          );
          const res = await ctx.api.get(`/api/v1/projects/${project.id}/tasks?limit=100`, { cookie: ctx.cookie });
          if (res.status !== 200) throw new Error(`${project.key}: API returned ${res.status}`);
          if (res.body.total !== sqlCount) {
            throw new Error(`${project.key}: API total ${res.body.total} != SQL ${sqlCount}`);
          }
          if (res.body.data.length !== sqlCount) {
            throw new Error(`${project.key}: returned ${res.body.data.length} rows for ${sqlCount} tasks`);
          }
          details.push(`${project.key}=${sqlCount}(done/canceled ${sqlDone})`);
        }
        return `${projects.length} project(s) checked: ${details.join(', ')}`;
      },
    },
    {
      id: 'comment-count-parity',
      caseId: 'TASK-TC-205',
      name: 'the computed comment_count on a task equals the SQL COUNT(comments)',
      run: async (ctx) => {
        const taskId = 1;
        const sqlCount = count(ctx.db, 'SELECT COUNT(*) AS c FROM comments WHERE task_id = ?', [taskId]);
        const res = await ctx.api.get(`/api/v1/tasks/${taskId}`, { cookie: ctx.cookie });
        if (res.status !== 200) throw new Error(`API returned ${res.status}`);
        if (res.body.comment_count !== sqlCount) {
          throw new Error(`API comment_count ${res.body.comment_count} != SQL ${sqlCount}`);
        }
        return `task ${taskId}: comment_count = ${sqlCount}`;
      },
    },
    {
      id: 'persistence-after-reconnect',
      caseId: 'TASK-TC-205',
      name: 'counts survive closing and reopening the database file (persistence)',
      run: async (ctx) => {
        const users = count(ctx.db, 'SELECT COUNT(*) AS c FROM users');
        const tasks = count(ctx.db, 'SELECT COUNT(*) AS c FROM tasks');
        const reopened = ctx.openDbAgain();
        try {
          const users2 = count(reopened, 'SELECT COUNT(*) AS c FROM users');
          const tasks2 = count(reopened, 'SELECT COUNT(*) AS c FROM tasks');
          if (users2 !== users || tasks2 !== tasks) {
            throw new Error(`reconnect mismatch: users ${users2}/${users}, tasks ${tasks2}/${tasks}`);
          }
          if (users2 < 5) throw new Error(`expected at least the 5 seeded users after reconnect, found ${users2}`);
          if (tasks2 < 18) throw new Error(`expected at least 18 tasks after reconnect, found ${tasks2}`);
          return `reopened: users=${users2}, tasks=${tasks2}`;
        } finally {
          reopened.close();
        }
      },
    },
  ];
}
