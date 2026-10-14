# PeopleCore — exploratory testing

> Generated from `test-data/tests/exploratory.mjs` by `npm run docs:csv`.

Exploratory sessions are timeboxed charters, not scripts. Findings are promoted to the defect log when they are actionable,
or recorded as RISK when they are accepted behaviour that must stay documented.

Charters: **6** · executed: **6**.

## Session notes

- **2026-10-14** (150 min) — API and RBAC automation first, then UI journeys, then exploratory charters HR-EX-01..HR-EX-06.
  - Outcome: 57 API tests, 20 UI tests, 12 SQL checks, 45 Postman requests and 96 Postman assertions executed; 9 product defects and 3 automation defects found, fixed and retested; 2 seeded defects reproduced deliberately behind SEED_DEFECTS=1.
  - Next steps: Repeat the keyboard and screen-reader charters with the dedicated tools once the dependency policy allows adding axe (HR-TC-066..HR-TC-068). Add Firefox and WebKit projects once the browser binaries are available (HR-TC-069). Add a working-day calendar if the business ever wants weekend-free leave calculations.

## HR-EX-01 — Break the manager scope

- **Area:** RBAC / Employees / Reports
- **Timebox:** 30 minutes · **Status:** Executed · **Executed:** 2026-10-14
- **Setup:** manager@example.com in Chromium and through the API; seeded database; SEED_DEFECTS=0.

**Mission:** Try to see or change data that belongs outside a manager team by abusing list filters, sorting, pagination, reports and direct ids.

| Finding | Type |
|---|---|
| GET /api/employees returns exactly the manager plus seven direct reports; the detail endpoint answers 403 for ADMIN/HR ids. | PASS |
| ?employeeId=1 on /api/attendance and /api/leave-requests returns 403, not an empty list, so probes are clearly refused. | PASS |
| The reports summary switches to scope TEAM (8 records) and cannot be widened with filters. | PASS |
| Sorting by salary is accepted for a manager, which can reveal the ordering of the team payroll even though the values themselves are redacted. Left as designed (the manager owns the team budget) and documented. | RISK |
| With SEED_DEFECTS=1 the list loses the scope filter entirely — reproduced deliberately as HR-SEEDED-01 to prove detection. | BUG |

**Notes:** Highest-value charter of the session: it produced the seeded BOLA scenario and confirmed that the guard exists in the clean build (HR-TC-059).

## HR-EX-02 — Date-range abuse on leave

- **Area:** Leave
- **Timebox:** 25 minutes · **Status:** Executed · **Executed:** 2026-10-14
- **Setup:** employee6 and employee2 sessions; seeded PENDING and APPROVED requests for those employees.

**Mission:** Attack the leave calendar: zero-length, single-day, 30/31 days, reversed, impossible dates, weekend spans and overlap chains.

| Finding | Type |
|---|---|
| A single-day request is stored with days = 1; a 30-day request is accepted and 31 days is refused with LEAVE_TOO_LONG. | PASS |
| Overlap detection is inclusive on both ends: a request ending on the day an existing one starts is refused (409). | PASS |
| Adjacent dates (start = existing end + 1) are accepted — deliberate design decision, documented in the README and in manual case HR-TC-045. | PASS |
| Impossible calendar dates such as 2027-02-30 are rejected at the validation layer (400), not silently normalised. | PASS |
| Weekend days count as leave days (no working-day calendar). Accepted: the specification defines days as the inclusive difference. | RISK |
| With SEED_DEFECTS=1 a request that starts on the same day as an existing booking slips through — reproduced as HR-SEEDED-02. | BUG |

**Notes:** Boundary matrix for dates is now encoded as HR-TC-042..HR-TC-045 and DB-07/DB-08.

## HR-EX-03 — Filter and pagination torture on the employee list

- **Area:** UI / Employees
- **Timebox:** 30 minutes · **Status:** Executed · **Executed:** 2026-10-14
- **Setup:** admin@example.com in Chromium; seeded database with 10 employees.

**Mission:** Combine every filter, sort and page value in the browser and watch for mismatched counts, lost filters or error pages.

| Finding | Type |
|---|---|
| Submitting the filter form with "All departments" or an empty search returned a validation error page (departmentId= coerced to 0) — logged as HR-BUG-006, fixed and retested. | BUG |
| After the fix, filters, sorting and pagination compose correctly: the pagination links carry limit/sort/order and the total stays stable across pages. | PASS |
| A page beyond the last one returns an empty array with the real total (no 404, no crash). | PASS |
| An unknown search term renders the empty state with a working reset link. | PASS |
| The limit selector only offers 5/10/20/50 although the API accepts up to 100 — cosmetic difference, documented. | RISK |

**Notes:** The charter paid off immediately: the most common user action on the page was broken before the fix.

## HR-EX-04 — Audit trail integrity

- **Area:** Audit / Database
- **Timebox:** 30 minutes · **Status:** Executed · **Executed:** 2026-10-14
- **Setup:** admin@example.com plus direct SQLite inspection of .data/peoplecore.test.db.

**Mission:** Check that every mutation leaves exactly one audit row with a diffable payload, that nothing leaks payroll data to the wrong role and that history survives deletions.

| Finding | Type |
|---|---|
| Employee create/update/delete, department create/update and leave approve/reject/cancel each add exactly one row with before/after JSON. | PASS |
| MANAGER and EMPLOYEE receive 403 on /api/audit-logs — no partial payload is returned. | PASS |
| Attendance writes are audited as well (ATTENDANCE_CREATE/ATTENDANCE_UPDATE); this goes beyond the written requirement and adds noise to the trail. Documented as an intentional extension. | RISK |
| Deleting an employee who was the actor of an audit row returned HTTP 500 (foreign key without ON DELETE action) — logged as HR-BUG-008 and fixed with ON DELETE SET NULL plus an FK-to-409 fallback. | BUG |
| After the fix the audit trail survives the deletion with actor_id NULL, and PRAGMA foreign_key_check stays clean (DB-10). | PASS |

**Notes:** This charter required reading the database directly, which is exactly what the SQL validation suite now automates.

## HR-EX-05 — Session and cookie abuse

- **Area:** Authentication / Security
- **Timebox:** 25 minutes · **Status:** Executed · **Executed:** 2026-10-14
- **Setup:** curl-like requests through the API suite context and manual PowerShell calls.

**Mission:** Replay sessions after logout, forge tokens, mix cookie and bearer authentication, and keep a stale session alive while the account changes state.

| Finding | Type |
|---|---|
| Logout deletes the sessions row; the recycled token returns 401 immediately. | PASS |
| A forged bearer token returns 401 and a malformed body returns 400 without touching the session. | PASS |
| Five failed logins lock the account (after the HR-BUG-001 fix) and the lock survives a correct password attempt. | PASS |
| A terminated employee kept full read access with the session issued before termination — the session was only checked for expiry. Logged as HR-BUG-012: sessions of terminated accounts are now revoked on the next request. | BUG |
| Bearer tokens are accepted in addition to the HttpOnly cookie so that API tooling (Postman/newman) can authenticate without a cookie jar. Documented in the README; the cookie remains the browser mechanism. | RISK |

**Notes:** The status check on every request is the kind of hole that only shows up when you combine features (session + status transition).

## HR-EX-06 — Workflow abuse through the Postman collection

- **Area:** API / Integration
- **Timebox:** 20 minutes · **Status:** Executed · **Executed:** 2026-10-14
- **Setup:** npm run test:postman against a private seeded database on port 4210.

**Mission:** Run the collection in unusual orders and with tampered ids to see whether the API keeps its promises.

| Finding | Type |
|---|---|
| The cleanup step (DELETE the fixture employee) returned 500 — the first signal of HR-BUG-008, later confirmed by a dedicated Playwright test. | BUG |
| Re-running the collection after the fix is idempotent: 45 requests, 96 assertions, 0 failures. | PASS |
| The collection depends on a freshly seeded database (it creates a department named Quality Assurance Sandbox and asserts 201). The runner resets its own database; documented in the collection description. | RISK |

**Notes:** Cross-tool triangulation (Postman + Playwright) is what turned a single 500 into an understood defect.

## Seeded-defect evidence

Both seeded defects below are reproducible on demand and are **off by default**:

- HR-SEEDED-01 (RBAC)
- HR-SEEDED-02 (Leave)

`npm run seeded:evidence` boots the app with `SEED_DEFECTS=1` on a private port, runs the two detection probes and stores the
result in `test-evidence/seeded-defects/seed-defects-evidence.json`. The default suites run with `SEED_DEFECTS=0` and must stay green.
