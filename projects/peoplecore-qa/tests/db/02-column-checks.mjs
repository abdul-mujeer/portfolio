import assert from 'node:assert/strict';
import { all, get, run } from '../../app/server/src/db.js';

const insertEmployee = (db, { code, email, role = 'EMPLOYEE', status = 'ACTIVE', salary = 60000, hireDate = '2024-01-01' }) =>
  run(
    db,
    `INSERT INTO employees (employee_code, first_name, last_name, email, password_hash, salt, role,
       department_id, position, salary, hire_date, status, created_at, updated_at)
     VALUES (?, 'Check', 'Probe', ?, 'h', 's', ?, 1, 'Engineer', ?, ?, ?, '2026-01-01', '2026-01-01')`,
    [code, email, role, salary, hireDate, status],
  );

export const checks = [
  {
    id: 'DB-03',
    title: 'CHECK constraints: salary range, role, employee status, attendance status, leave type/status and leave days',
    run({ db }) {
      assert.throws(() => insertEmployee(db, { code: 'EMP-901', email: 'c1@example.com', salary: 0 }), /CHECK constraint failed/);
      assert.throws(() => insertEmployee(db, { code: 'EMP-902', email: 'c2@example.com', salary: -5 }), /CHECK constraint failed/);
      assert.throws(() => insertEmployee(db, { code: 'EMP-903', email: 'c3@example.com', salary: 1_000_001 }), /CHECK constraint failed/);
      assert.throws(() => insertEmployee(db, { code: 'EMP-904', email: 'c4@example.com', role: 'SUPERUSER' }), /CHECK constraint failed/);
      assert.throws(() => insertEmployee(db, { code: 'EMP-905', email: 'c5@example.com', status: 'FIRED' }), /CHECK constraint failed/);

      assert.throws(
        () =>
          run(
            db,
            `INSERT INTO attendance (employee_id, work_date, status, created_at) VALUES (1, '2020-01-01', 'HOLIDAY', '2026-01-01')`,
          ),
        /CHECK constraint failed/,
      );

      assert.throws(
        () =>
          run(
            db,
            `INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, days, reason, status, created_at)
             VALUES (1, 'SABBATICAL', '2026-03-01', '2026-03-02', 2, 'Valid reason here.', 'PENDING', '2026-01-01')`,
          ),
        /CHECK constraint failed/,
      );

      assert.throws(
        () =>
          run(
            db,
            `INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, days, reason, status, created_at)
             VALUES (1, 'ANNUAL', '2026-03-01', '2026-03-02', 2, 'Valid reason here.', 'MAYBE', '2026-01-01')`,
          ),
        /CHECK constraint failed/,
      );

      assert.throws(
        () =>
          run(
            db,
            `INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, days, reason, status, created_at)
             VALUES (1, 'ANNUAL', '2026-03-01', '2026-05-01', 62, 'Too long for the CHECK constraint.', 'PENDING', '2026-01-01')`,
          ),
        /CHECK constraint failed/,
      );

      const salaryMax = insertEmployee(db, { code: 'EMP-906', email: 'c6@example.com', salary: 1_000_000 });
      assert.ok(salaryMax.changes === 1, 'salary = 1,000,000 must be accepted as the upper boundary');

      return '8 CHECK-constraint probes rejected, upper salary boundary accepted';
    },
  },
  {
    id: 'DB-04',
    title: 'Data rules: salary precision and hire-date window hold for every seeded row',
    run({ db }) {
      const badSalary = all(
        db,
        `SELECT employee_code, salary FROM employees
         WHERE salary <= 0 OR salary > 1000000 OR ABS(ROUND(salary * 100) - salary * 100) > 0.000001`,
      );
      assert.deepEqual(badSalary, [], `seeded salaries must respect rule 3: ${JSON.stringify(badSalary)}`);

      const futureHires = all(db, `SELECT employee_code, hire_date FROM employees WHERE hire_date > date('now', 'localtime')`);
      assert.deepEqual(futureHires, [], `no employee may be hired in the future: ${JSON.stringify(futureHires)}`);

      const ancientHires = all(db, `SELECT employee_code, hire_date FROM employees WHERE hire_date < '1990-01-01'`);
      assert.deepEqual(ancientHires, []);

      const malformedDates = all(
        db,
        `SELECT employee_code, hire_date FROM employees WHERE hire_date NOT GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'`,
      );
      assert.deepEqual(malformedDates, []);

      const counts = get(db, 'SELECT COUNT(*) AS total FROM employees');
      assert.equal(Number(counts.total), 10);

      return `10 employees verified: salary in (0, 1000000] with <=2 decimals, hire_date within [1990-01-01, today]`;
    },
  },
];
