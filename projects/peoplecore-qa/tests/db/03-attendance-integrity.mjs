import assert from 'node:assert/strict';
import { all, get, run } from '../../app/server/src/db.js';

export const checks = [
  {
    id: 'DB-05',
    title: 'Attendance: 60 seeded rows, one per employee per work day, duplicate insert rejected',
    run({ db }) {
      const total = Number(get(db, 'SELECT COUNT(*) AS total FROM attendance').total);
      assert.equal(total, 60, 'the seed must create 60 attendance rows');

      const duplicatePairs = all(
        db,
        `SELECT employee_id, work_date, COUNT(*) AS rows_for_day FROM attendance GROUP BY employee_id, work_date HAVING COUNT(*) > 1`,
      );
      assert.deepEqual(duplicatePairs, []);

      const workdaysPerEmployee = all(
        db,
        `SELECT employee_id, COUNT(DISTINCT work_date) AS days FROM attendance GROUP BY employee_id ORDER BY employee_id`,
      );
      assert.equal(workdaysPerEmployee.length, 10);
      for (const row of workdaysPerEmployee) assert.equal(Number(row.days), 6, `employee ${row.employee_id} should have 6 days`);

      const distinctDates = Number(get(db, 'SELECT COUNT(DISTINCT work_date) AS total FROM attendance').total);
      assert.equal(distinctDates, 6, 'all rows must fall inside the same 6 seeded work days');

      const weekendRows = all(
        db,
        `SELECT work_date FROM attendance WHERE strftime('%w', work_date) IN ('0', '6')`,
      );
      assert.deepEqual(weekendRows, [], 'seeded attendance must not fall on a weekend');

      const duplicateProbe = () =>
        run(db, `INSERT INTO attendance (employee_id, work_date, status, created_at) VALUES (1, (SELECT work_date FROM attendance WHERE employee_id = 1 LIMIT 1), 'PRESENT', '2026-01-01')`);
      assert.throws(duplicateProbe, /UNIQUE constraint failed/);

      return '60 rows / 10 employees / 6 work days, no duplicates, no weekends';
    },
  },
  {
    id: 'DB-06',
    title: 'Attendance time rules: LEAVE and ABSENT rows carry no times, PRESENT/REMOTE always do, check-out is after check-in',
    run({ db }) {
      const leaveWithTimes = all(
        db,
        `SELECT id FROM attendance WHERE status IN ('LEAVE','ABSENT') AND (check_in IS NOT NULL OR check_out IS NOT NULL)`,
      );
      assert.deepEqual(leaveWithTimes, [], `LEAVE/ABSENT rows must not have times: ${JSON.stringify(leaveWithTimes)}`);

      const presentWithoutTimes = all(
        db,
        `SELECT id FROM attendance WHERE status IN ('PRESENT','REMOTE') AND (check_in IS NULL OR check_out IS NULL)`,
      );
      assert.deepEqual(presentWithoutTimes, []);

      const reversedTimes = all(db, `SELECT id FROM attendance WHERE check_in IS NOT NULL AND check_out IS NOT NULL AND check_out <= check_in`);
      assert.deepEqual(reversedTimes, []);

      const badTimeFormat = all(
        db,
        `SELECT id FROM attendance
         WHERE (check_in IS NOT NULL AND check_in NOT GLOB '[0-2][0-9]:[0-5][0-9]')
            OR (check_out IS NOT NULL AND check_out NOT GLOB '[0-2][0-9]:[0-5][0-9]')`,
      );
      assert.deepEqual(badTimeFormat, []);

      const statusMix = all(db, `SELECT status, COUNT(*) AS total FROM attendance GROUP BY status ORDER BY status`);
      const statuses = statusMix.map((row) => row.status);
      assert.ok(statuses.includes('PRESENT') && statuses.includes('REMOTE'));
      assert.ok(statuses.includes('ABSENT') && statuses.includes('LEAVE'), 'all four statuses must be represented');

      return `statuses: ${statusMix.map((row) => `${row.status}=${row.total}`).join(', ')}`;
    },
  },
];
