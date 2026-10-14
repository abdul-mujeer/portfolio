import assert from 'node:assert/strict';
import { all, get, run } from '../../app/server/src/db.js';

export const checks = [
  {
    id: 'DB-01',
    title: 'UNIQUE constraints: employee_code, email, department name/code and one attendance row per employee per day',
    run({ db }) {
      const attendanceIndexes = all(db, `PRAGMA index_list('attendance')`);
      const uniqueAttendanceIndex = attendanceIndexes.find((row) => Number(row.unique) === 1);
      assert.ok(uniqueAttendanceIndex, 'attendance must carry a UNIQUE index');
      const uniqueColumns = all(db, `PRAGMA index_info('${uniqueAttendanceIndex.name}')`)
        .map((row) => row.name)
        .sort();
      assert.deepEqual(uniqueColumns, ['employee_id', 'work_date'], 'the UNIQUE index must cover (employee_id, work_date)');

      const duplicateCode = () =>
        run(db, `INSERT INTO employees (employee_code, first_name, last_name, email, password_hash, salt, role,
                   department_id, position, salary, hire_date, status, created_at, updated_at)
                 VALUES ('EMP-001', 'Clone', 'User', 'clone.code@example.com', 'h', 's', 'EMPLOYEE', 1, 'Engineer', 50000, '2024-01-01', 'ACTIVE', '2026-01-01', '2026-01-01')`);
      assert.throws(duplicateCode, /UNIQUE constraint failed: employees\.employee_code/);

      const duplicateEmail = () =>
        run(db, `INSERT INTO employees (employee_code, first_name, last_name, email, password_hash, salt, role,
                   department_id, position, salary, hire_date, status, created_at, updated_at)
                 VALUES ('EMP-999', 'Clone', 'User', 'admin@example.com', 'h', 's', 'EMPLOYEE', 1, 'Engineer', 50000, '2024-01-01', 'ACTIVE', '2026-01-01', '2026-01-01')`);
      assert.throws(duplicateEmail, /UNIQUE constraint failed: employees\.email/);

      const duplicateDepartment = () => run(db, `INSERT INTO departments (name, code, created_at) VALUES ('Engineering', 'EN2', '2026-01-01')`);
      assert.throws(duplicateDepartment, /UNIQUE constraint failed: departments\.name/);

      const duplicateDepartmentCode = () => run(db, `INSERT INTO departments (name, code, created_at) VALUES ('Engineering Two', 'ENG', '2026-01-01')`);
      assert.throws(duplicateDepartmentCode, /UNIQUE constraint failed: departments\.code/);

      const seededAttendance = get(db, 'SELECT employee_id, work_date FROM attendance LIMIT 1');
      const duplicateAttendance = () =>
        run(db, `INSERT INTO attendance (employee_id, work_date, status, created_at) VALUES (?, ?, 'PRESENT', '2026-01-01')`, [
          seededAttendance.employee_id,
          seededAttendance.work_date,
        ]);
      assert.throws(duplicateAttendance, /UNIQUE constraint failed: attendance\.employee_id, attendance\.work_date/);

      const indexCount = all(db, `SELECT name FROM sqlite_master WHERE type = 'index'`).length;
      return `${indexCount} indexes present (attendance UNIQUE on employee_id+work_date), 5 duplicate probes rejected`;
    },
  },
  {
    id: 'DB-02',
    title: 'Foreign keys are enforced (PRAGMA foreign_keys=ON) for every relationship',
    run({ db }) {
      const pragma = get(db, 'PRAGMA foreign_keys');
      assert.equal(Number(pragma.foreign_keys), 1, 'PRAGMA foreign_keys must be enabled on the connection');

      const fkTables = all(db, `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('employees','attendance','leave_requests','sessions')`);
      assert.equal(fkTables.length, 4);

      const employeeWithUnknownDepartment = () =>
        run(db, `INSERT INTO employees (employee_code, first_name, last_name, email, password_hash, salt, role,
                   department_id, position, salary, hire_date, status, created_at, updated_at)
                 VALUES ('EMP-998', 'Orphan', 'User', 'orphan@example.com', 'h', 's', 'EMPLOYEE', 9999, 'Engineer', 50000, '2024-01-01', 'ACTIVE', '2026-01-01', '2026-01-01')`);
      assert.throws(employeeWithUnknownDepartment, /FOREIGN KEY constraint failed/);

      const attendanceForGhostEmployee = () =>
        run(db, `INSERT INTO attendance (employee_id, work_date, status, created_at) VALUES (9999, '2026-02-02', 'PRESENT', '2026-01-01')`);
      assert.throws(attendanceForGhostEmployee, /FOREIGN KEY constraint failed/);

      const leaveForGhostEmployee = () =>
        run(db, `INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, days, reason, status, created_at)
                 VALUES (9999, 'ANNUAL', '2026-03-01', '2026-03-02', 2, 'Ghost request reason.', 'PENDING', '2026-01-01')`);
      assert.throws(leaveForGhostEmployee, /FOREIGN KEY constraint failed/);

      const sessionForGhostEmployee = () =>
        run(db, `INSERT INTO sessions (token, employee_id, created_at, expires_at) VALUES ('deadbeef', 9999, '2026-01-01', '2026-01-02')`);
      assert.throws(sessionForGhostEmployee, /FOREIGN KEY constraint failed/);

      const foreignKeyCheck = all(db, 'PRAGMA foreign_key_check');
      assert.deepEqual(foreignKeyCheck, [], 'PRAGMA foreign_key_check must not report violations');

      return 'PRAGMA foreign_keys=1, 4 FK probes rejected, foreign_key_check clean';
    },
  },
];
