/**
 * PeopleCore HRMS — exploratory testing charters and session notes.
 * SINGLE SOURCE OF TRUTH for test-documentation/exploratory-testing.md.
 *
 * Findings use the triage vocabulary of the defect log:
 *   BUG  → promoted to HR-BUG-nnn in defects.mjs
 *   RISK → documented limitation, no code change requested
 *   PASS → behaved as the specification requires
 */
export const charters = [
  {
    id: 'HR-EX-01',
    title: 'Break the manager scope',
    area: 'RBAC / Employees / Reports',
    mission:
      'Try to see or change data that belongs outside a manager team by abusing list filters, sorting, pagination, reports and direct ids.',
    timebox: 30,
    executedOn: '2026-10-14',
    status: 'Executed',
    setup: 'manager@example.com in Chromium and through the API; seeded database; SEED_DEFECTS=0.',
    findings: [
      { type: 'PASS', text: 'GET /api/employees returns exactly the manager plus seven direct reports; the detail endpoint answers 403 for ADMIN/HR ids.' },
      { type: 'PASS', text: '?employeeId=1 on /api/attendance and /api/leave-requests returns 403, not an empty list, so probes are clearly refused.' },
      { type: 'PASS', text: 'The reports summary switches to scope TEAM (8 records) and cannot be widened with filters.' },
      { type: 'RISK', text: 'Sorting by salary is accepted for a manager, which can reveal the ordering of the team payroll even though the values themselves are redacted. Left as designed (the manager owns the team budget) and documented.' },
      { type: 'BUG', text: 'With SEED_DEFECTS=1 the list loses the scope filter entirely — reproduced deliberately as HR-SEEDED-01 to prove detection.' },
    ],
    notes:
      'Highest-value charter of the session: it produced the seeded BOLA scenario and confirmed that the guard exists in the clean build (HR-TC-059).',
  },
  {
    id: 'HR-EX-02',
    title: 'Date-range abuse on leave',
    area: 'Leave',
    mission: 'Attack the leave calendar: zero-length, single-day, 30/31 days, reversed, impossible dates, weekend spans and overlap chains.',
    timebox: 25,
    executedOn: '2026-10-14',
    status: 'Executed',
    setup: 'employee6 and employee2 sessions; seeded PENDING and APPROVED requests for those employees.',
    findings: [
      { type: 'PASS', text: 'A single-day request is stored with days = 1; a 30-day request is accepted and 31 days is refused with LEAVE_TOO_LONG.' },
      { type: 'PASS', text: 'Overlap detection is inclusive on both ends: a request ending on the day an existing one starts is refused (409).' },
      { type: 'PASS', text: 'Adjacent dates (start = existing end + 1) are accepted — deliberate design decision, documented in the README and in manual case HR-TC-045.' },
      { type: 'PASS', text: 'Impossible calendar dates such as 2027-02-30 are rejected at the validation layer (400), not silently normalised.' },
      { type: 'RISK', text: 'Weekend days count as leave days (no working-day calendar). Accepted: the specification defines days as the inclusive difference.' },
      { type: 'BUG', text: 'With SEED_DEFECTS=1 a request that starts on the same day as an existing booking slips through — reproduced as HR-SEEDED-02.' },
    ],
    notes: 'Boundary matrix for dates is now encoded as HR-TC-042..HR-TC-045 and DB-07/DB-08.',
  },
  {
    id: 'HR-EX-03',
    title: 'Filter and pagination torture on the employee list',
    area: 'UI / Employees',
    mission: 'Combine every filter, sort and page value in the browser and watch for mismatched counts, lost filters or error pages.',
    timebox: 30,
    executedOn: '2026-10-14',
    status: 'Executed',
    setup: 'admin@example.com in Chromium; seeded database with 10 employees.',
    findings: [
      { type: 'BUG', text: 'Submitting the filter form with "All departments" or an empty search returned a validation error page (departmentId= coerced to 0) — logged as HR-BUG-006, fixed and retested.' },
      { type: 'PASS', text: 'After the fix, filters, sorting and pagination compose correctly: the pagination links carry limit/sort/order and the total stays stable across pages.' },
      { type: 'PASS', text: 'A page beyond the last one returns an empty array with the real total (no 404, no crash).' },
      { type: 'PASS', text: 'An unknown search term renders the empty state with a working reset link.' },
      { type: 'RISK', text: 'The limit selector only offers 5/10/20/50 although the API accepts up to 100 — cosmetic difference, documented.' },
    ],
    notes: 'The charter paid off immediately: the most common user action on the page was broken before the fix.',
  },
  {
    id: 'HR-EX-04',
    title: 'Audit trail integrity',
    area: 'Audit / Database',
    mission:
      'Check that every mutation leaves exactly one audit row with a diffable payload, that nothing leaks payroll data to the wrong role and that history survives deletions.',
    timebox: 30,
    executedOn: '2026-10-14',
    status: 'Executed',
    setup: 'admin@example.com plus direct SQLite inspection of .data/peoplecore.test.db.',
    findings: [
      { type: 'PASS', text: 'Employee create/update/delete, department create/update and leave approve/reject/cancel each add exactly one row with before/after JSON.' },
      { type: 'PASS', text: 'MANAGER and EMPLOYEE receive 403 on /api/audit-logs — no partial payload is returned.' },
      { type: 'RISK', text: 'Attendance writes are audited as well (ATTENDANCE_CREATE/ATTENDANCE_UPDATE); this goes beyond the written requirement and adds noise to the trail. Documented as an intentional extension.' },
      { type: 'BUG', text: 'Deleting an employee who was the actor of an audit row returned HTTP 500 (foreign key without ON DELETE action) — logged as HR-BUG-008 and fixed with ON DELETE SET NULL plus an FK-to-409 fallback.' },
      { type: 'PASS', text: 'After the fix the audit trail survives the deletion with actor_id NULL, and PRAGMA foreign_key_check stays clean (DB-10).' },
    ],
    notes: 'This charter required reading the database directly, which is exactly what the SQL validation suite now automates.',
  },
  {
    id: 'HR-EX-05',
    title: 'Session and cookie abuse',
    area: 'Authentication / Security',
    mission: 'Replay sessions after logout, forge tokens, mix cookie and bearer authentication, and keep a stale session alive while the account changes state.',
    timebox: 25,
    executedOn: '2026-10-14',
    status: 'Executed',
    setup: 'curl-like requests through the API suite context and manual PowerShell calls.',
    findings: [
      { type: 'PASS', text: 'Logout deletes the sessions row; the recycled token returns 401 immediately.' },
      { type: 'PASS', text: 'A forged bearer token returns 401 and a malformed body returns 400 without touching the session.' },
      { type: 'PASS', text: 'Five failed logins lock the account (after the HR-BUG-001 fix) and the lock survives a correct password attempt.' },
      { type: 'BUG', text: 'A terminated employee kept full read access with the session issued before termination — the session was only checked for expiry. Logged as HR-BUG-012: sessions of terminated accounts are now revoked on the next request.' },
      { type: 'RISK', text: 'Bearer tokens are accepted in addition to the HttpOnly cookie so that API tooling (Postman/newman) can authenticate without a cookie jar. Documented in the README; the cookie remains the browser mechanism.' },
    ],
    notes: 'The status check on every request is the kind of hole that only shows up when you combine features (session + status transition).',
  },
  {
    id: 'HR-EX-06',
    title: 'Workflow abuse through the Postman collection',
    area: 'API / Integration',
    mission: 'Run the collection in unusual orders and with tampered ids to see whether the API keeps its promises.',
    timebox: 20,
    executedOn: '2026-10-14',
    status: 'Executed',
    setup: 'npm run test:postman against a private seeded database on port 4210.',
    findings: [
      { type: 'BUG', text: 'The cleanup step (DELETE the fixture employee) returned 500 — the first signal of HR-BUG-008, later confirmed by a dedicated Playwright test.' },
      { type: 'PASS', text: 'Re-running the collection after the fix is idempotent: 45 requests, 96 assertions, 0 failures.' },
      { type: 'RISK', text: 'The collection depends on a freshly seeded database (it creates a department named Quality Assurance Sandbox and asserts 201). The runner resets its own database; documented in the collection description.' },
    ],
    notes: 'Cross-tool triangulation (Postman + Playwright) is what turned a single 500 into an understood defect.',
  },
];

export const sessionNotes = [
  {
    date: '2026-10-14',
    durationMinutes: 150,
    focus: 'API and RBAC automation first, then UI journeys, then exploratory charters HR-EX-01..HR-EX-06.',
    outcome:
      '57 API tests, 20 UI tests, 12 SQL checks, 45 Postman requests and 96 Postman assertions executed; 9 product defects and 3 automation defects found, fixed and retested; 2 seeded defects reproduced deliberately behind SEED_DEFECTS=1.',
    nextSteps: [
      'Repeat the keyboard and screen-reader charters with the dedicated tools once the dependency policy allows adding axe (HR-TC-066..HR-TC-068).',
      'Add Firefox and WebKit projects once the browser binaries are available (HR-TC-069).',
      'Add a working-day calendar if the business ever wants weekend-free leave calculations.',
    ],
  },
];
