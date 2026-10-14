# PeopleCore HRMS — database testing

## 1 · Why SQL-level testing matters here

The API can be perfectly validated and still write nonsense: partial rows after a failed request,
orphaned children after a delete, duplicate attendance rows, or a salary that the report then
mis-reads. The SQL suite therefore inspects the same file the application produced.

## 2 · How the suite runs

```bash
npm run test:db          # → test-reports/db-results.json, log: test-evidence/logs/db.txt
```

`tests/db/run.mjs`

1. creates `.data/db-checks/template.db` with the real schema and the real seed,
2. copies that file once per check (checks cannot influence each other),
3. executes every `tests/db/*.mjs` module and prints `PASS`/`FAIL` with a detail line,
4. writes the machine-readable result and exits non-zero if any check failed.

## 3 · The 12 checks

| ID | What it proves | Key statement |
|---|---|---|
| DB-01 | UNIQUE constraints exist and are enforced | `UNIQUE(employee_id, work_date)` via `PRAGMA index_list`/`index_info`; duplicate employee code/e-mail/department name/code probe → SQLITE_CONSTRAINT |
| DB-02 | Foreign keys are enforced | `PRAGMA foreign_keys = 1`; inserts referencing a missing department/employee/session owner fail; `PRAGMA foreign_key_check` is empty |
| DB-03 | CHECK constraints mirror the business rules | salary ≤ 0 / > 1,000,000, unknown role/status, unknown attendance status, unknown leave type/status, days > 30 are all rejected; salary = 1,000,000 is accepted |
| DB-04 | Seeded data satisfies the rules | no salary outside (0, 1,000,000], no more than 2 decimals, no future hire date, nothing before 1990-01-01, `YYYY-MM-DD` shape, exactly 10 employees |
| DB-05 | Attendance volume and shape | 60 rows, 10 employees × 6 work days, no duplicate day, no weekend rows, duplicate insert rejected |
| DB-06 | Attendance time rules hold in the data | LEAVE/ABSENT never carry times, PRESENT/REMOTE always do, `check_out > check_in`, `HH:MM` format, all four statuses present |
| DB-07 | Leave data is self-consistent | `days` equals the inclusive difference, 1..30, `start <= end`, reason 10..500, all four statuses seeded, reviewers only on decided rows, rejections carry a ≥ 5 char comment |
| DB-08 | The overlap query used by the API is correct | exact window, single contained day, day before, day after, CANCELLED ignored, self-exclusion; the probe row is then visible to the same query |
| DB-09 | The audit trail is well formed | exactly 2 seeded rows, valid JSON payloads, creation has `before = null`, PENDING → APPROVED recorded, EMPLOYEE audit ids point at existing employees |
| DB-10 | No orphans | attendance/leave/reviewer/manager/department/session references all resolve, nobody manages themself, the seeded manager owns exactly 7 reports |
| DB-11 | Seeding is deterministic | two seeds with the reference date 2026-01-15 produce identical rows (5 tables), 10 distinct scrypt hashes (128 hex chars = 64 bytes) with 16-byte hex salts, dates never after the reference date and never on a weekend |
| DB-12 | Failures leave no trace | a real server instance is started on the check's own database; 10 negative calls (duplicate code/e-mail, invalid salary, future hire date, unknown department, incomplete body, duplicate attendance, overlapping leave, two 403s) all fail — afterwards every table count is unchanged, `PRAGMA foreign_key_check` is empty and no probe e-mail/code exists |

## 4 · Findings produced by this suite

| Finding | Details |
|---|---|
| HR-BUG-008 (product) | Discovered through Postman first, then reproduced here and in the API suite: `audit_logs.actor_id` had no `ON DELETE` action, so deleting an actor raised a foreign-key error (HTTP 500). Fixed with `ON DELETE SET NULL` (audit history survives, the reference is cleared) plus an FK → 409 fallback. |
| HR-BUG-010 (test code) | The "future hire date" probe used a UTC computation and was therefore not in the future in UTC+5:30, so the check failed with `201 !== 422`. Now uses the application's own `addDays(todayIso(), 1)`. |
| HR-BUG-011 (test code) | The UNIQUE-index probe searched `sqlite_master.sql`, which is `NULL` for indexes created by a table-level UNIQUE constraint. Replaced with `PRAGMA index_list` + `PRAGMA index_info`. |

## 5 · Useful ad-hoc queries (used during the exploratory charters)

```sql
-- one row per employee per day?
SELECT employee_id, work_date, COUNT(*) FROM attendance GROUP BY 1, 2 HAVING COUNT(*) > 1;

-- overlapping PENDING/APPROVED requests for one employee
SELECT a.id, b.id, a.start_date, a.end_date, b.start_date, b.end_date
FROM leave_requests a JOIN leave_requests b
  ON a.employee_id = b.employee_id AND a.id < b.id
WHERE a.status IN ('PENDING','APPROVED') AND b.status IN ('PENDING','APPROVED')
  AND a.start_date <= b.end_date AND b.start_date <= a.end_date;

-- audit rows whose actor no longer exists (must stay empty thanks to ON DELETE SET NULL)
SELECT id FROM audit_logs WHERE actor_id IS NOT NULL
  AND actor_id NOT IN (SELECT id FROM employees);

-- integrity sweep
PRAGMA foreign_key_check;
```

## 6 · Limits

- SQLite runs without WAL mode; concurrent writers are not part of the design (single process).
- No migration tooling: `applySchema` is idempotent and the demo workflow is
  `npm run db:reset` (documented in the README as a deviation-free simplification).
- Large-data behaviour (millions of rows, query plans) is out of scope for this portfolio project.
