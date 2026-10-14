# PeopleCore — requirements

> Generated from `test-data/tests/requirements.mjs` by `npm run docs:csv`.

Total requirements: **16** · acceptance criteria: **48** · manual test cases: **69**.

## HR-REQ-001 — Sign-in, sign-out and session lifetime

- **Module:** Authentication
- **Priority:** P1
- **Status:** implemented+tested
- **Test cases:** HR-TC-001, HR-TC-002, HR-TC-004, HR-TC-006, HR-TC-007

Users authenticate with email + password. Passwords are stored as scrypt hashes with a per-user salt. A successful sign-in creates an opaque session token stored server-side, delivered as an HttpOnly SameSite=Lax cookie with an 8 hour expiry. Repeated failures lock the account.

### Acceptance criteria

- **HR-AC-001** — POST /api/auth/login with valid credentials returns 200, a 64-character opaque token, the actor profile and an HttpOnly SameSite=Lax cookie that expires in 8 hours.
- **HR-AC-002** — Invalid credentials return 401 INVALID_CREDENTIALS; an unknown email and a wrong password are indistinguishable.
- **HR-AC-003** — GET /api/auth/session returns the signed-in actor; POST /api/auth/logout deletes the server-side session so the token stops working.
- **HR-AC-004** — Expired, forged or missing tokens return 401 on every protected endpoint.
- **HR-AC-005** — Five failed attempts for one account within the window lock it for 15 minutes (423 ACCOUNT_LOCKED); a correct password is still refused while the lock is active.

## HR-REQ-002 — Server-side role-based authorization

- **Module:** RBAC
- **Priority:** P1
- **Status:** implemented+tested
- **Test cases:** HR-TC-059, HR-TC-060

ADMIN, HR, MANAGER and EMPLOYEE have different capabilities. Every check happens on the server; hiding a control in the UI is never the control. Direct API calls with an under-privileged role must fail with 403, never 200 with filtered data.

### Acceptance criteria

- **HR-AC-006** — ADMIN has full access; HR may create/update employees but never delete them or change roles; MANAGER is limited to self + direct reports; EMPLOYEE sees only their own record.
- **HR-AC-007** — Direct API access by an under-privileged role to an existing record returns 403 with an error envelope; unknown ids return 404.
- **HR-AC-008** — A role-level refusal on a whole endpoint (for example audit logs for MANAGER) returns 403 without any data.

## HR-REQ-003 — Scoped employee list with search, filter, sort and pagination

- **Module:** Employees
- **Priority:** P1
- **Status:** implemented+tested
- **Test cases:** HR-TC-016, HR-TC-017, HR-TC-026, HR-TC-027, HR-TC-028, HR-TC-029

GET /api/employees returns only records the caller may see, supports q/departmentId/status/role filters, sort/order, page/limit and always reports X-Total-Count. The EJS list page renders the same data with a stable data-testid per element.

### Acceptance criteria

- **HR-AC-009** — page is 1-based, limit accepts 1..100 (default 20), X-Total-Count matches the body total and a page beyond the last page returns an empty data array with the real total.
- **HR-AC-010** — q searches first name, last name, email and employee code; departmentId/status/role filters combine with AND.
- **HR-AC-011** — Salary is returned only to ADMIN/HR and to the employee themself; a manager viewing a direct report receives salaryRedacted instead.

## HR-REQ-004 — Employee creation with validation

- **Module:** Employees
- **Priority:** P1
- **Status:** implemented+tested
- **Test cases:** HR-TC-018, HR-TC-019, HR-TC-020, HR-TC-021, HR-TC-025

ADMIN/HR create employees. employee_code matches ^EMP-\d{3,4}$ and is unique, email is RFC-ish and unique (case-insensitive), salary is in (0, 1000000] with at most 2 decimals, hire_date is a real calendar date within [1990-01-01, today], department and manager must exist.

### Acceptance criteria

- **HR-AC-012** — A valid payload returns 201 with a Location header and an EMPLOYEE_CREATE audit row; duplicate employee code or email returns 409 with a specific error code.
- **HR-AC-013** — Malformed values (code format, email format, password policy, unknown enum, wrong type, unknown field) return 400 with field-level details.
- **HR-AC-014** — Well-formed but rule-breaking values (salary out of range or 3 decimals, future hire date, hire date before 1990-01-01, unknown department or manager) return 422 with a specific error code.

## HR-REQ-005 — Employee update and role-change rules

- **Module:** Employees
- **Priority:** P1
- **Status:** implemented+tested
- **Test cases:** HR-TC-024, HR-TC-030, HR-TC-065

PUT /api/employees/:id applies a partial update. Only ADMIN may change the role; HR may not modify an ADMIN account; salary is editable by ADMIN/HR only (a MANAGER cannot update employees at all). Every update writes an EMPLOYEE_UPDATE audit row with before/after JSON.

### Acceptance criteria

- **HR-AC-015** — Untouched fields keep their previous values and the response reflects the new state.
- **HR-AC-016** — HR receives 403 ROLE_CHANGE_FORBIDDEN for a role change and 403 when modifying an ADMIN; MANAGER receives 403 for any update.
- **HR-AC-017** — The audit row contains the previous and the new value of every changed field, including salary.

## HR-REQ-006 — Employee deletion with safety guards

- **Module:** Employees
- **Priority:** P2
- **Status:** implemented+tested
- **Test cases:** HR-TC-022, HR-TC-023

DELETE /api/employees/:id is ADMIN only, returns 204 and never leaves dangling references. The actor cannot delete themself; an employee who still manages direct reports must be reassigned first; attendance, leave and sessions of the deleted person are cascaded while audit rows survive with a cleared actor reference.

### Acceptance criteria

- **HR-AC-018** — Deleting an existing employee returns 204 and the record is 404 afterwards; a missing id returns 404.
- **HR-AC-019** — Deleting yourself returns 422 CANNOT_DELETE_SELF; deleting a manager with direct reports returns 409 MANAGER_HAS_DIRECT_REPORTS.
- **HR-AC-020** — Deleting an employee who has attendance, leave requests and audit history succeeds without a server error and leaves no orphan rows (PRAGMA foreign_key_check is clean).

## HR-REQ-007 — Department list, creation and rename

- **Module:** Departments
- **Priority:** P3
- **Status:** implemented+tested
- **Test cases:** HR-TC-031, HR-TC-032, HR-TC-033

GET /api/departments is available to every authenticated role; create and update are ADMIN/HR only on the API surface (the UI exposes them to ADMIN only). Department name and code are unique; the code is normalised to upper case and matches ^[A-Z]{2,6}$.

### Acceptance criteria

- **HR-AC-021** — Creating a department returns 201; a duplicate name or code returns 409 with DUPLICATE_DEPARTMENT_NAME / DUPLICATE_DEPARTMENT_CODE.
- **HR-AC-022** — Updating a department changes only the supplied fields and writes a DEPARTMENT_UPDATE audit row; unknown ids return 404.
- **HR-AC-023** — MANAGER and EMPLOYEE receive 403 for create/update but 200 for the list.

## HR-REQ-008 — Attendance recording and rules

- **Module:** Attendance
- **Priority:** P1
- **Status:** implemented+tested
- **Test cases:** HR-TC-034, HR-TC-035, HR-TC-036, HR-TC-037, HR-TC-038, HR-TC-039, HR-TC-040, HR-TC-064

Attendance has exactly one row per employee per work date. ADMIN/HR may write for anyone, MANAGER for self + direct reports, EMPLOYEE is read-only. LEAVE and ABSENT rows carry no times, PRESENT/REMOTE rows always carry them, check-out must be after check-in and a terminated employee cannot receive attendance.

### Acceptance criteria

- **HR-AC-024** — POST /api/attendance returns 201 and the row is visible in the scoped list and on the page; the same employee/day again returns 409 DUPLICATE_ATTENDANCE.
- **HR-AC-025** — checkOut <= checkIn returns 422 INVALID_TIME_RANGE; LEAVE or ABSENT with times and PRESENT/REMOTE without times return 422 INVALID_ATTENDANCE_PAYLOAD.
- **HR-AC-026** — Attendance writes are authorized: EMPLOYEE 403 everywhere, MANAGER 403 outside the team, MANAGER 201 inside the team, and a terminated employee returns 422 EMPLOYEE_TERMINATED.

## HR-REQ-009 — Leave submission with validation and overlap detection

- **Module:** Leave
- **Priority:** P1
- **Status:** implemented+tested
- **Test cases:** HR-TC-041, HR-TC-042, HR-TC-043, HR-TC-044, HR-TC-045, HR-TC-053

Any authenticated employee may submit leave for themself: start_date <= end_date, days computed inclusively, at most 30 days per request, reason between 10 and 500 characters, and no PENDING/APPROVED request of the same employee may overlap the requested window (409 LEAVE_OVERLAP).

### Acceptance criteria

- **HR-AC-027** — A valid request returns 201 with the computed inclusive day count and status PENDING, plus a LEAVE_CREATE audit row.
- **HR-AC-028** — endDate before startDate returns 422 INVALID_LEAVE_RANGE; more than 30 days returns 422 LEAVE_TOO_LONG; a 30-day request is accepted (boundary).
- **HR-AC-029** — Overlapping PENDING/APPROVED requests return 409 LEAVE_OVERLAP, while adjacent (touching) dates are accepted; reason shorter than 10 characters returns 400.

## HR-REQ-010 — Leave review workflow

- **Module:** Leave
- **Priority:** P1
- **Status:** implemented+tested
- **Test cases:** HR-TC-046, HR-TC-047, HR-TC-049, HR-TC-050, HR-TC-052

ADMIN/HR may review any request, a MANAGER only the requests of direct reports and nobody may review their own. Only PENDING requests can be approved or rejected; approving keeps the comment optional, rejecting requires at least 5 characters; leave of a terminated employee cannot be decided.

### Acceptance criteria

- **HR-AC-030** — Approve returns 200 with status APPROVED, reviewedBy, reviewedAt and the optional comment, and writes a LEAVE_APPROVE audit row with PENDING before / APPROVED after.
- **HR-AC-031** — Reject without a comment or with fewer than 5 characters returns 400; a valid reject stores REJECTED plus the comment and writes LEAVE_REJECT.
- **HR-AC-032** — A second decision returns 422 INVALID_STATE_TRANSITION, reviewing outside the scope returns 403 and a terminated employee returns 422 EMPLOYEE_TERMINATED.

## HR-REQ-011 — Leave cancellation

- **Module:** Leave
- **Priority:** P2
- **Status:** implemented+tested
- **Test cases:** HR-TC-048

An employee cancels their own PENDING request, which sets the status to CANCELLED. Reviewed requests and requests owned by someone else cannot be cancelled, and the cancellation is audited.

### Acceptance criteria

- **HR-AC-033** — DELETE /api/leave-requests/:id on an own PENDING request returns 200 with status CANCELLED and writes a LEAVE_CANCEL audit row.
- **HR-AC-034** — Cancelling a request twice, or one that is APPROVED/REJECTED, returns 422 INVALID_STATE_TRANSITION; cancelling another employee request returns 403.

## HR-REQ-012 — Immutable audit trail

- **Module:** Audit
- **Priority:** P1
- **Status:** implemented+tested
- **Test cases:** HR-TC-054, HR-TC-055

Employee create/update/delete, department create/update and attendance/leave mutations write an audit row with actor, action, entity, before JSON and after JSON. The trail is readable by ADMIN/HR through the API and the EJS page; salary appears in audit payloads for ADMIN/HR readers only.

### Acceptance criteria

- **HR-AC-035** — GET /api/audit-logs filters by entityType/entityId and returns parsed before/after objects; MANAGER and EMPLOYEE receive 403.
- **HR-AC-036** — Every covered mutation produces exactly one audit row with the correct action name and a diffable before/after payload.
- **HR-AC-037** — Audit rows survive the deletion of the actor (actor reference cleared) so history is never lost.

## HR-REQ-013 — Scoped HR summary report

- **Module:** Reports
- **Priority:** P3
- **Status:** implemented+tested
- **Test cases:** HR-TC-056

GET /api/reports/summary returns headcount by department, leave counts by status and the attendance rate of the last 30 days, always limited to the caller's scope (ALL for ADMIN/HR, TEAM for MANAGER, SELF for EMPLOYEE).

### Acceptance criteria

- **HR-AC-038** — The payload contains scope, scopeEmployeeIds, headcount, headcountByDepartment, leaveByStatus (all four statuses) and attendance with from/to/records/attendanceRate.
- **HR-AC-039** — A manager summary counts only self + direct reports and an employee summary only their own record.

## HR-REQ-014 — HTTP conventions and error envelope

- **Module:** API conventions
- **Priority:** P1
- **Status:** implemented+tested
- **Test cases:** HR-TC-005, HR-TC-011, HR-TC-012, HR-TC-013, HR-TC-014, HR-TC-015, HR-TC-057

Success uses 200/201/204; 400 validation, 401 unauthenticated, 403 forbidden, 404 not found, 409 conflict, 422 business rule, 423 locked. Errors always use { error: { code, message, details } } and never leak stack traces. List endpoints return X-Total-Count.

### Acceptance criteria

- **HR-AC-040** — GET /api/health reports status/service/database/employees and answers 200.
- **HR-AC-041** — Unknown API routes return 404 NOT_FOUND, malformed JSON returns 400 INVALID_JSON, and no response contains a stack trace.
- **HR-AC-042** — Every list endpoint supports page/limit, validates them (0, 101, non-numeric are 400) and returns X-Total-Count.

## HR-REQ-015 — Server-rendered EJS interface

- **Module:** UI
- **Priority:** P2
- **Status:** implemented+tested
- **Test cases:** HR-TC-003, HR-TC-008, HR-TC-009, HR-TC-010, HR-TC-051, HR-TC-061, HR-TC-062, HR-TC-063, HR-TC-066, HR-TC-067, HR-TC-068, HR-TC-069

The UI shares the API session cookie, renders role-aware navigation and data, provides stable data-testid attributes on every interactive element, real 403/404 pages, inline form validation, an empty state for empty lists, a responsive single stylesheet and accessible markup (labels, semantic headings, skip link, focus states).

### Acceptance criteria

- **HR-AC-043** — Login, dashboard, employee list/detail/form, attendance, leave and audit pages render with the documented data-testid hooks and role-aware content.
- **HR-AC-044** — Restricted pages render a real 403 page with the error code; unknown records render 404; validation problems are shown inline next to the offending field.
- **HR-AC-045** — Empty results show an empty state, pagination controls stay in sync with the filters and the layout works at 390x844 as well as 1440x900.

## HR-REQ-016 — Deterministic seed data and reset

- **Module:** Data
- **Priority:** P2
- **Status:** implemented+tested
- **Test cases:** HR-TC-058

npm run db:reset recreates the schema and inserts a deterministic data set: 3 departments, 10 employees (1 ADMIN, 1 HR, 1 MANAGER, 7 EMPLOYEE), 60 attendance rows over 6 work days, 6 leave requests in all four statuses including the documented overlap scenario, and 2 audit rows. Relative dates follow the run date, or a pinned SEED_AS_OF.

### Acceptance criteria

- **HR-AC-046** — Two seeds with the same reference date produce identical rows (including hashes and salts); the reset prints the row counts.
- **HR-AC-047** — Employees reference real departments/managers, attendance never lands on a weekend and every seeded leave row satisfies the documented rules.
- **HR-AC-048** — Demo credentials are documented and work for all four roles at 8+ characters with letter + number + symbol.

