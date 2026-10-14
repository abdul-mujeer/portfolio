import assert from 'node:assert/strict';
import { all, get } from '../../app/server/src/db.js';

export const checks = [
  {
    id: 'DB-09',
    title: 'Audit rows are present, well formed and carry the seeded before/after payloads',
    run({ db }) {
      const total = Number(get(db, 'SELECT COUNT(*) AS total FROM audit_logs').total);
      assert.equal(total, 2, 'the seed must create exactly 2 audit rows');

      const rows = all(db, 'SELECT * FROM audit_logs ORDER BY id');
      const seedCreate = rows.find((row) => row.action === 'EMPLOYEE_CREATE');
      const seedApprove = rows.find((row) => row.action === 'LEAVE_APPROVE');
      assert.ok(seedCreate && seedApprove, 'both documented seed actions must exist');

      for (const row of rows) {
        assert.ok(row.actor_id, `audit #${row.id} must reference an actor`);
        assert.ok(row.entity_type && row.entity_id, `audit #${row.id} must reference an entity`);
        assert.ok(row.created_at, `audit #${row.id} must have a timestamp`);
        if (row.before_json) assert.doesNotThrow(() => JSON.parse(row.before_json), `audit #${row.id} before_json must be JSON`);
        if (row.after_json) assert.doesNotThrow(() => JSON.parse(row.after_json), `audit #${row.id} after_json must be JSON`);
      }

      assert.equal(seedCreate.before_json, null, 'a creation has no before state');
      const after = JSON.parse(seedCreate.after_json);
      assert.equal(after.employeeCode, 'EMP-010');
      assert.ok(after.salary > 0, 'salary is part of the employee audit payload');

      const approveAfter = JSON.parse(seedApprove.after_json);
      const approveBefore = JSON.parse(seedApprove.before_json);
      assert.equal(approveBefore.status, 'PENDING');
      assert.equal(approveAfter.status, 'APPROVED');

      const unknownEntities = all(
        db,
        `SELECT id FROM audit_logs WHERE entity_type = 'EMPLOYEE' AND entity_id NOT IN (SELECT CAST(id AS TEXT) FROM employees)`,
      );
      assert.deepEqual(unknownEntities, [], 'EMPLOYEE audit rows must point at employees that exist');

      return '2 rows, JSON payloads parse, creation has no before state, approve transition recorded';
    },
  },
  {
    id: 'DB-10',
    title: 'Orphan check: no child row references a missing parent (attendance, leave, sessions, employees, reviewers)',
    run({ db }) {
      const orphanAttendance = all(db, `SELECT a.id FROM attendance a LEFT JOIN employees e ON e.id = a.employee_id WHERE e.id IS NULL`);
      assert.deepEqual(orphanAttendance, []);

      const orphanLeave = all(db, `SELECT l.id FROM leave_requests l LEFT JOIN employees e ON e.id = l.employee_id WHERE e.id IS NULL`);
      assert.deepEqual(orphanLeave, []);

      const orphanReviewer = all(
        db,
        `SELECT l.id FROM leave_requests l LEFT JOIN employees r ON r.id = l.reviewed_by WHERE l.reviewed_by IS NOT NULL AND r.id IS NULL`,
      );
      assert.deepEqual(orphanReviewer, []);

      const orphanDepartment = all(
        db,
        `SELECT e.id FROM employees e LEFT JOIN departments d ON d.id = e.department_id WHERE e.department_id IS NOT NULL AND d.id IS NULL`,
      );
      assert.deepEqual(orphanDepartment, []);

      const orphanManager = all(
        db,
        `SELECT e.id FROM employees e LEFT JOIN employees m ON m.id = e.manager_id WHERE e.manager_id IS NOT NULL AND m.id IS NULL`,
      );
      assert.deepEqual(orphanManager, []);

      const selfManaged = all(db, `SELECT id FROM employees WHERE manager_id = id`);
      assert.deepEqual(selfManaged, [], 'nobody may be their own manager');

      const managerChain = all(
        db,
        `SELECT m.employee_code AS manager_code, COUNT(e.id) AS reports
         FROM employees m JOIN employees e ON e.manager_id = m.id
         GROUP BY m.id ORDER BY m.employee_code`,
      );
      assert.equal(managerChain.length, 1);
      assert.equal(managerChain[0].manager_code, 'EMP-003');
      assert.equal(Number(managerChain[0].reports), 7, 'the seeded manager must own 7 direct reports');

      const danglingSessions = all(db, `SELECT s.token FROM sessions s LEFT JOIN employees e ON e.id = s.employee_id WHERE e.id IS NULL`);
      assert.deepEqual(danglingSessions, []);

      const fkCheck = all(db, 'PRAGMA foreign_key_check');
      assert.deepEqual(fkCheck, []);

      return '6 orphan queries + self-manager + manager chain (EMP-003 → 7 reports) + PRAGMA foreign_key_check all clean';
    },
  },
];
