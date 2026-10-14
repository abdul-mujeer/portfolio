import assert from 'node:assert/strict';
import { all, get, run } from '../../app/server/src/db.js';
import { daysBetweenInclusive } from '../../app/server/src/lib/dates.js';

export const checks = [
  {
    id: 'DB-07',
    title: 'Leave data: days match the inclusive date difference, 6 seeded requests cover all four statuses',
    run({ db }) {
      const rows = all(db, 'SELECT id, employee_id, start_date, end_date, days, status, reason, reviewed_by, review_comment FROM leave_requests ORDER BY id');
      assert.equal(rows.length, 6, 'the seed must create 6 leave requests');

      for (const row of rows) {
        const expected = daysBetweenInclusive(row.start_date, row.end_date);
        assert.equal(Number(row.days), expected, `leave #${row.id} days must equal the inclusive difference`);
        assert.ok(expected >= 1 && expected <= 30, `leave #${row.id} must be within 1..30 days`);
        assert.ok(row.start_date <= row.end_date, `leave #${row.id} must not end before it starts`);
        assert.ok(String(row.reason).length >= 10 && String(row.reason).length <= 500, `leave #${row.id} reason length`);
      }

      const statuses = new Set(rows.map((row) => row.status));
      assert.deepEqual([...statuses].sort(), ['APPROVED', 'CANCELLED', 'PENDING', 'REJECTED']);

      const reviewedWithoutReviewer = rows.filter((row) => ['APPROVED', 'REJECTED'].includes(row.status) && !row.reviewed_by);
      assert.deepEqual(reviewedWithoutReviewer, [], 'APPROVED/REJECTED rows need a reviewed_by employee');

      const pendingWithReviewer = rows.filter((row) => row.status === 'PENDING' && row.reviewed_by);
      assert.deepEqual(pendingWithReviewer, [], 'PENDING rows must not have a reviewer');

      const rejectedWithoutComment = all(
        db,
        `SELECT id FROM leave_requests WHERE status = 'REJECTED' AND (review_comment IS NULL OR length(review_comment) < 5)`,
      );
      assert.deepEqual(rejectedWithoutComment, [], 'a rejection always carries a comment of at least 5 characters');

      const pendingOverlapScenario = get(
        db,
        `SELECT id, start_date, end_date FROM leave_requests WHERE employee_id = 9 AND status = 'PENDING' ORDER BY start_date LIMIT 1`,
      );
      assert.ok(pendingOverlapScenario, 'EMP-009 must own the documented PENDING overlap scenario');

      return `6 requests, statuses APPROVED/CANCELLED/PENDING/REJECTED, overlap scenario #${pendingOverlapScenario.id} (${pendingOverlapScenario.start_date} → ${pendingOverlapScenario.end_date})`;
    },
  },
  {
    id: 'DB-08',
    title: 'Overlap detection query catches an intersecting PENDING/APPROVED booking and ignores cancelled/adjacent ones',
    run({ db }) {
      const target = get(db, `SELECT employee_id, start_date, end_date, id FROM leave_requests WHERE status = 'PENDING' ORDER BY id LIMIT 1`);
      const overlapQuery = (employeeId, startDate, endDate, excludeId = null) =>
        all(
          db,
          `SELECT id FROM leave_requests
           WHERE employee_id = ?
             AND status IN ('PENDING','APPROVED')
             AND start_date <= ?
             AND end_date >= ?
             AND (? IS NULL OR id <> ?)`,
          [employeeId, endDate, startDate, excludeId, excludeId],
        );

      const exact = overlapQuery(target.employee_id, target.start_date, target.end_date);
      assert.ok(exact.length >= 1, 'the exact same window must be detected as an overlap');

      const contained = overlapQuery(target.employee_id, target.start_date, target.start_date);
      assert.ok(contained.length >= 1, 'a single day inside the window must overlap');

      const dayBefore = overlapQuery(target.employee_id, shiftDate(target.start_date, -1), shiftDate(target.start_date, -1));
      assert.deepEqual(dayBefore, [], 'the adjacent earlier day must not overlap');

      const dayAfter = overlapQuery(target.employee_id, shiftDate(target.end_date, 1), shiftDate(target.end_date, 1));
      assert.deepEqual(dayAfter, [], 'the adjacent later day must not overlap');

      const cancelled = get(db, `SELECT employee_id, start_date, end_date FROM leave_requests WHERE status = 'CANCELLED' LIMIT 1`);
      const cancelledOverlap = overlapQuery(cancelled.employee_id, cancelled.start_date, cancelled.end_date);
      assert.deepEqual(cancelledOverlap, [], 'CANCELLED requests are ignored by the overlap guard');

      const excludeSelf = overlapQuery(target.employee_id, target.start_date, target.end_date, target.id);
      assert.deepEqual(excludeSelf, [], 'a request never overlaps itself when it is excluded');

      const inserted = run(
        db,
        `INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, days, reason, status, created_at)
         VALUES (?, 'ANNUAL', ?, ?, 2, 'Inserted by the SQL overlap probe.', 'PENDING', '2026-01-01')`,
        [target.employee_id, target.start_date, target.end_date],
      );
      assert.equal(inserted.changes, 1, 'the database itself does not block overlaps (the API does)');
      const afterInsert = overlapQuery(target.employee_id, target.start_date, target.end_date);
      assert.equal(afterInsert.length, 2, 'the probe row must be detected by the same query the API uses');

      return `overlap query verified on employee ${target.employee_id} (request #${target.id}), 5 boundary probes`;
    },
  },
];

function shiftDate(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
