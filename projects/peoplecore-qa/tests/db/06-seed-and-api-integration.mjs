import assert from 'node:assert/strict';
import fs from 'node:fs';
import { all, bootstrapDatabase, get, removeDatabase } from '../../app/server/src/db.js';
import { addDays, todayIso } from '../../app/server/src/lib/dates.js';
import { seedDatabase } from '../../app/server/src/seed.js';
import { apiFetch, apiLogin, withServer } from './server-helper.mjs';

const TABLES = [
  { table: 'departments', select: 'SELECT id, name, code, created_at FROM departments ORDER BY id' },
  { table: 'employees', select: 'SELECT id, employee_code, email, role, department_id, salary, hire_date, status, manager_id, password_hash, salt, created_at, updated_at FROM employees ORDER BY id' },
  { table: 'attendance', select: 'SELECT id, employee_id, work_date, status, check_in, check_out, notes, created_at FROM attendance ORDER BY id' },
  { table: 'leave_requests', select: 'SELECT * FROM leave_requests ORDER BY id' },
  { table: 'audit_logs', select: 'SELECT id, actor_id, action, entity_type, entity_id, before_json, after_json, created_at FROM audit_logs ORDER BY id' },
];

export const checks = [
  {
    id: 'DB-11',
    title: 'Seeding is deterministic: two runs with the same reference date produce byte-identical rows',
    run({ dbPath }) {
      const firstPath = `${dbPath}.seed-a.db`;
      const secondPath = `${dbPath}.seed-b.db`;
      const reference = new Date('2026-01-15T12:00:00Z');

      const snapshots = [firstPath, secondPath].map((target) => {
        removeDatabase(target);
        const db = bootstrapDatabase(target, { fresh: true });
        const summary = seedDatabase(db, { reference });
        const snapshot = TABLES.map(({ table, select }) => ({ table, rows: all(db, select) }));
        db.close();
        removeDatabase(target);
        return { summary, snapshot };
      });

      assert.deepEqual(snapshots[0].summary, snapshots[1].summary);
      assert.deepEqual(snapshots[0].summary.reference, '2026-01-15');
      assert.equal(snapshots[0].summary.attendance, 60);

      for (let index = 0; index < TABLES.length; index += 1) {
        assert.deepEqual(
          snapshots[0].snapshot[index].rows,
          snapshots[1].snapshot[index].rows,
          `table ${TABLES[index].table} must be identical between two seeds`,
        );
      }

      const hashedPasswords = snapshots[0].snapshot[1].rows.map((row) => row.password_hash);
      assert.equal(new Set(hashedPasswords).size, 10, 'every employee needs a distinct scrypt hash');
      for (const row of snapshots[0].snapshot[1].rows) {
        assert.match(row.password_hash, /^[0-9a-f]{128}$/, 'scrypt hashes are 64 bytes hex encoded');
        assert.match(row.salt, /^[0-9a-f]{32}$/, 'each employee has a 16 byte hex salt');
      }

      const pinnedWorkdays = snapshots[0].snapshot[2].rows.map((row) => row.work_date);
      assert.ok(
        pinnedWorkdays.every((date) => date <= '2026-01-15'),
        'seeded attendance must never be after the reference date',
      );
      assert.ok(
        pinnedWorkdays.every((date) => ![0, 6].includes(new Date(`${date}T00:00:00Z`).getUTCDay())),
        'seeded attendance must fall on weekdays only',
      );
      assert.equal(new Set(pinnedWorkdays).size, 6, 'the 60 rows span exactly 6 distinct work days');

      fs.rmSync(firstPath, { force: true });
      fs.rmSync(secondPath, { force: true });

      return '5 tables identical across two seeds, 10 unique scrypt hashes, dates pinned to 2026-01-15';
    },
  },
  {
    id: 'DB-12',
    title: 'Failed (negative) API calls leave no partial rows — row counts and referential integrity unchanged',
    run({ dbPath }) {
      const before = bootstrapDatabase(dbPath, { fresh: false });
      const countsBefore = TABLES.map(({ table }) => Number(get(before, `SELECT COUNT(*) AS total FROM ${table}`).total));
      const seededAttendance = get(before, 'SELECT employee_id, work_date FROM attendance WHERE employee_id = 1 LIMIT 1');
      const pendingLeave = get(before, `SELECT id, employee_id, start_date, end_date FROM leave_requests WHERE status = 'PENDING' AND employee_id = 9 LIMIT 1`);
      before.close();

      const results = [];
      return withServer(dbPath, async (baseUrl) => {
        const adminToken = await apiLogin(baseUrl, 'admin@example.com', 'Admin#12345');
        const employeeToken = await apiLogin(baseUrl, 'employee6@example.com', 'Employee#1234');
        const outsiderToken = await apiLogin(baseUrl, 'employee1@example.com', 'Employee#1234');

        const post = async (token, url, body) => {
          const response = await apiFetch(baseUrl, token, url, { method: 'POST', body: JSON.stringify(body) });
          results.push(`${response.status} POST ${url}`);
          return response.status;
        };

        const tomorrow = addDays(todayIso(), 1);

        assert.equal(
          await post(adminToken, '/api/employees', { employeeCode: 'EMP-001', firstName: 'Dup', lastName: 'Code', email: 'dup.code@example.com', password: 'Probe#12345', role: 'EMPLOYEE', departmentId: 1, position: 'Engineer', salary: 50000, hireDate: '2024-01-01' }),
          409,
        );
        assert.equal(
          await post(adminToken, '/api/employees', { employeeCode: 'EMP-950', firstName: 'Dup', lastName: 'Email', email: 'ADMIN@example.com', password: 'Probe#12345', role: 'EMPLOYEE', departmentId: 1, position: 'Engineer', salary: 50000, hireDate: '2024-01-01' }),
          409,
        );
        assert.equal(
          await post(adminToken, '/api/employees', { employeeCode: 'EMP-951', firstName: 'Bad', lastName: 'Salary', email: 'bad.salary@example.com', password: 'Probe#12345', role: 'EMPLOYEE', departmentId: 1, position: 'Engineer', salary: 1_000_001, hireDate: '2024-01-01' }),
          422,
        );
        assert.equal(
          await post(adminToken, '/api/employees', { employeeCode: 'EMP-952', firstName: 'Future', lastName: 'Hire', email: 'future.hire@example.com', password: 'Probe#12345', role: 'EMPLOYEE', departmentId: 1, position: 'Engineer', salary: 50000, hireDate: tomorrow }),
          422,
        );
        assert.equal(
          await post(adminToken, '/api/employees', { employeeCode: 'EMP-953', firstName: 'No', lastName: 'Department', email: 'no.department@example.com', password: 'Probe#12345', role: 'EMPLOYEE', departmentId: 9999, position: 'Engineer', salary: 50000, hireDate: '2024-01-01' }),
          422,
        );
        assert.equal(
          await post(adminToken, '/api/employees', { firstName: 'Incomplete' }),
          400,
        );
        assert.equal(
          await post(adminToken, '/api/attendance', { employeeId: seededAttendance.employee_id, workDate: seededAttendance.work_date, status: 'PRESENT', checkIn: '09:00', checkOut: '17:00' }),
          409,
        );
        assert.equal(
          await post(employeeToken, '/api/leave-requests', { leaveType: 'ANNUAL', startDate: pendingLeave.start_date, endDate: pendingLeave.end_date, reason: 'Deliberate overlap attempt for the DB check.' }),
          409,
        );
        assert.equal(await post(outsiderToken, '/api/departments', { name: 'Nope Department', code: 'NOPE' }), 403);
        assert.equal(await post(outsiderToken, '/api/employees', { employeeCode: 'EMP-954', firstName: 'No', lastName: 'Rights', email: 'no.rights@example.com', password: 'Probe#12345', role: 'EMPLOYEE', departmentId: 1, position: 'Engineer', salary: 50000, hireDate: '2024-01-01' }), 403);

        const after = bootstrapDatabase(dbPath, { fresh: false });
        try {
          const countsAfter = TABLES.map(({ table }) => Number(get(after, `SELECT COUNT(*) AS total FROM ${table}`).total));
          assert.deepEqual(countsAfter, countsBefore, 'failed requests must not change any table');
          assert.deepEqual(all(after, 'PRAGMA foreign_key_check'), []);
          const probeEmails = [
            'dup.code@example.com',
            'bad.salary@example.com',
            'future.hire@example.com',
            'no.department@example.com',
            'no.rights@example.com',
          ];
          assert.deepEqual(
            all(after, `SELECT email FROM employees WHERE email IN (${probeEmails.map(() => '?').join(', ')})`, probeEmails),
            [],
            'no half-created employee rows after the rejected requests',
          );
          assert.equal(
            Number(get(after, `SELECT COUNT(*) AS total FROM employees WHERE employee_code LIKE 'EMP-9%'`).total),
            0,
            'no employee_code from a rejected request reached the database',
          );
        } finally {
          after.close();
        }

        return `10 negative calls rejected (${results.join(' · ')}); counts unchanged at ${countsBefore.join('/')}`;
      }, { port: 4316 });
    },
  },
];
