/**
 * PeopleCore HRMS — requirements and acceptance criteria.
 * SINGLE SOURCE OF TRUTH: the CSVs, the traceability matrix and the execution report are
 * generated from this file by scripts/docs/generate-csv.mjs.
 *
 * Status values used below:
 *   'implemented+tested'  → automated tests exist and executed successfully
 *   'implemented'         → built, exercised manually/exploratorily
 */
export const requirements = [
  {
    id: 'HR-REQ-001',
    module: 'Authentication',
    title: 'Sign-in, sign-out and session lifetime',
    description:
      'Users authenticate with email + password. Passwords are stored as scrypt hashes with a per-user salt. A successful sign-in creates an opaque session token stored server-side, delivered as an HttpOnly SameSite=Lax cookie with an 8 hour expiry. Repeated failures lock the account.',
    priority: 'P1',
    status: 'implemented+tested',
    acceptanceCriteria: [
      { id: 'HR-AC-001', text: 'POST /api/auth/login with valid credentials returns 200, a 64-character opaque token, the actor profile and an HttpOnly SameSite=Lax cookie that expires in 8 hours.' },
      { id: 'HR-AC-002', text: 'Invalid credentials return 401 INVALID_CREDENTIALS; an unknown email and a wrong password are indistinguishable.' },
      { id: 'HR-AC-003', text: 'GET /api/auth/session returns the signed-in actor; POST /api/auth/logout deletes the server-side session so the token stops working.' },
      { id: 'HR-AC-004', text: 'Expired, forged or missing tokens return 401 on every protected endpoint.' },
      { id: 'HR-AC-005', text: 'Five failed attempts for one account within the window lock it for 15 minutes (423 ACCOUNT_LOCKED); a correct password is still refused while the lock is active.' },
    ],
  },
  {
    id: 'HR-REQ-002',
    module: 'RBAC',
    title: 'Server-side role-based authorization',
    description:
      'ADMIN, HR, MANAGER and EMPLOYEE have different capabilities. Every check happens on the server; hiding a control in the UI is never the control. Direct API calls with an under-privileged role must fail with 403, never 200 with filtered data.',
    priority: 'P1',
    status: 'implemented+tested',
    acceptanceCriteria: [
      { id: 'HR-AC-006', text: 'ADMIN has full access; HR may create/update employees but never delete them or change roles; MANAGER is limited to self + direct reports; EMPLOYEE sees only their own record.' },
      { id: 'HR-AC-007', text: 'Direct API access by an under-privileged role to an existing record returns 403 with an error envelope; unknown ids return 404.' },
      { id: 'HR-AC-008', text: 'A role-level refusal on a whole endpoint (for example audit logs for MANAGER) returns 403 without any data.' },
    ],
  },
  {
    id: 'HR-REQ-003',
    module: 'Employees',
    title: 'Scoped employee list with search, filter, sort and pagination',
    description:
      'GET /api/employees returns only records the caller may see, supports q/departmentId/status/role filters, sort/order, page/limit and always reports X-Total-Count. The EJS list page renders the same data with a stable data-testid per element.',
    priority: 'P1',
    status: 'implemented+tested',
    acceptanceCriteria: [
      { id: 'HR-AC-009', text: 'page is 1-based, limit accepts 1..100 (default 20), X-Total-Count matches the body total and a page beyond the last page returns an empty data array with the real total.' },
      { id: 'HR-AC-010', text: 'q searches first name, last name, email and employee code; departmentId/status/role filters combine with AND.' },
      { id: 'HR-AC-011', text: 'Salary is returned only to ADMIN/HR and to the employee themself; a manager viewing a direct report receives salaryRedacted instead.' },
    ],
  },
  {
    id: 'HR-REQ-004',
    module: 'Employees',
    title: 'Employee creation with validation',
    description:
      'ADMIN/HR create employees. employee_code matches ^EMP-\\d{3,4}$ and is unique, email is RFC-ish and unique (case-insensitive), salary is in (0, 1000000] with at most 2 decimals, hire_date is a real calendar date within [1990-01-01, today], department and manager must exist.',
    priority: 'P1',
    status: 'implemented+tested',
    acceptanceCriteria: [
      { id: 'HR-AC-012', text: 'A valid payload returns 201 with a Location header and an EMPLOYEE_CREATE audit row; duplicate employee code or email returns 409 with a specific error code.' },
      { id: 'HR-AC-013', text: 'Malformed values (code format, email format, password policy, unknown enum, wrong type, unknown field) return 400 with field-level details.' },
      { id: 'HR-AC-014', text: 'Well-formed but rule-breaking values (salary out of range or 3 decimals, future hire date, hire date before 1990-01-01, unknown department or manager) return 422 with a specific error code.' },
    ],
  },
  {
    id: 'HR-REQ-005',
    module: 'Employees',
    title: 'Employee update and role-change rules',
    description:
      'PUT /api/employees/:id applies a partial update. Only ADMIN may change the role; HR may not modify an ADMIN account; salary is editable by ADMIN/HR only (a MANAGER cannot update employees at all). Every update writes an EMPLOYEE_UPDATE audit row with before/after JSON.',
    priority: 'P1',
    status: 'implemented+tested',
    acceptanceCriteria: [
      { id: 'HR-AC-015', text: 'Untouched fields keep their previous values and the response reflects the new state.' },
      { id: 'HR-AC-016', text: 'HR receives 403 ROLE_CHANGE_FORBIDDEN for a role change and 403 when modifying an ADMIN; MANAGER receives 403 for any update.' },
      { id: 'HR-AC-017', text: 'The audit row contains the previous and the new value of every changed field, including salary.' },
    ],
  },
  {
    id: 'HR-REQ-006',
    module: 'Employees',
    title: 'Employee deletion with safety guards',
    description:
      'DELETE /api/employees/:id is ADMIN only, returns 204 and never leaves dangling references. The actor cannot delete themself; an employee who still manages direct reports must be reassigned first; attendance, leave and sessions of the deleted person are cascaded while audit rows survive with a cleared actor reference.',
    priority: 'P2',
    status: 'implemented+tested',
    acceptanceCriteria: [
      { id: 'HR-AC-018', text: 'Deleting an existing employee returns 204 and the record is 404 afterwards; a missing id returns 404.' },
      { id: 'HR-AC-019', text: 'Deleting yourself returns 422 CANNOT_DELETE_SELF; deleting a manager with direct reports returns 409 MANAGER_HAS_DIRECT_REPORTS.' },
      { id: 'HR-AC-020', text: 'Deleting an employee who has attendance, leave requests and audit history succeeds without a server error and leaves no orphan rows (PRAGMA foreign_key_check is clean).' },
    ],
  },
  {
    id: 'HR-REQ-007',
    module: 'Departments',
    title: 'Department list, creation and rename',
    description:
      'GET /api/departments is available to every authenticated role; create and update are ADMIN/HR only on the API surface (the UI exposes them to ADMIN only). Department name and code are unique; the code is normalised to upper case and matches ^[A-Z]{2,6}$.',
    priority: 'P3',
    status: 'implemented+tested',
    acceptanceCriteria: [
      { id: 'HR-AC-021', text: 'Creating a department returns 201; a duplicate name or code returns 409 with DUPLICATE_DEPARTMENT_NAME / DUPLICATE_DEPARTMENT_CODE.' },
      { id: 'HR-AC-022', text: 'Updating a department changes only the supplied fields and writes a DEPARTMENT_UPDATE audit row; unknown ids return 404.' },
      { id: 'HR-AC-023', text: 'MANAGER and EMPLOYEE receive 403 for create/update but 200 for the list.' },
    ],
  },
  {
    id: 'HR-REQ-008',
    module: 'Attendance',
    title: 'Attendance recording and rules',
    description:
      'Attendance has exactly one row per employee per work date. ADMIN/HR may write for anyone, MANAGER for self + direct reports, EMPLOYEE is read-only. LEAVE and ABSENT rows carry no times, PRESENT/REMOTE rows always carry them, check-out must be after check-in and a terminated employee cannot receive attendance.',
    priority: 'P1',
    status: 'implemented+tested',
    acceptanceCriteria: [
      { id: 'HR-AC-024', text: 'POST /api/attendance returns 201 and the row is visible in the scoped list and on the page; the same employee/day again returns 409 DUPLICATE_ATTENDANCE.' },
      { id: 'HR-AC-025', text: 'checkOut <= checkIn returns 422 INVALID_TIME_RANGE; LEAVE or ABSENT with times and PRESENT/REMOTE without times return 422 INVALID_ATTENDANCE_PAYLOAD.' },
      { id: 'HR-AC-026', text: 'Attendance writes are authorized: EMPLOYEE 403 everywhere, MANAGER 403 outside the team, MANAGER 201 inside the team, and a terminated employee returns 422 EMPLOYEE_TERMINATED.' },
    ],
  },
  {
    id: 'HR-REQ-009',
    module: 'Leave',
    title: 'Leave submission with validation and overlap detection',
    description:
      'Any authenticated employee may submit leave for themself: start_date <= end_date, days computed inclusively, at most 30 days per request, reason between 10 and 500 characters, and no PENDING/APPROVED request of the same employee may overlap the requested window (409 LEAVE_OVERLAP).',
    priority: 'P1',
    status: 'implemented+tested',
    acceptanceCriteria: [
      { id: 'HR-AC-027', text: 'A valid request returns 201 with the computed inclusive day count and status PENDING, plus a LEAVE_CREATE audit row.' },
      { id: 'HR-AC-028', text: 'endDate before startDate returns 422 INVALID_LEAVE_RANGE; more than 30 days returns 422 LEAVE_TOO_LONG; a 30-day request is accepted (boundary).' },
      { id: 'HR-AC-029', text: 'Overlapping PENDING/APPROVED requests return 409 LEAVE_OVERLAP, while adjacent (touching) dates are accepted; reason shorter than 10 characters returns 400.' },
    ],
  },
  {
    id: 'HR-REQ-010',
    module: 'Leave',
    title: 'Leave review workflow',
    description:
      'ADMIN/HR may review any request, a MANAGER only the requests of direct reports and nobody may review their own. Only PENDING requests can be approved or rejected; approving keeps the comment optional, rejecting requires at least 5 characters; leave of a terminated employee cannot be decided.',
    priority: 'P1',
    status: 'implemented+tested',
    acceptanceCriteria: [
      { id: 'HR-AC-030', text: 'Approve returns 200 with status APPROVED, reviewedBy, reviewedAt and the optional comment, and writes a LEAVE_APPROVE audit row with PENDING before / APPROVED after.' },
      { id: 'HR-AC-031', text: 'Reject without a comment or with fewer than 5 characters returns 400; a valid reject stores REJECTED plus the comment and writes LEAVE_REJECT.' },
      { id: 'HR-AC-032', text: 'A second decision returns 422 INVALID_STATE_TRANSITION, reviewing outside the scope returns 403 and a terminated employee returns 422 EMPLOYEE_TERMINATED.' },
    ],
  },
  {
    id: 'HR-REQ-011',
    module: 'Leave',
    title: 'Leave cancellation',
    description:
      'An employee cancels their own PENDING request, which sets the status to CANCELLED. Reviewed requests and requests owned by someone else cannot be cancelled, and the cancellation is audited.',
    priority: 'P2',
    status: 'implemented+tested',
    acceptanceCriteria: [
      { id: 'HR-AC-033', text: 'DELETE /api/leave-requests/:id on an own PENDING request returns 200 with status CANCELLED and writes a LEAVE_CANCEL audit row.' },
      { id: 'HR-AC-034', text: 'Cancelling a request twice, or one that is APPROVED/REJECTED, returns 422 INVALID_STATE_TRANSITION; cancelling another employee request returns 403.' },
    ],
  },
  {
    id: 'HR-REQ-012',
    module: 'Audit',
    title: 'Immutable audit trail',
    description:
      'Employee create/update/delete, department create/update and attendance/leave mutations write an audit row with actor, action, entity, before JSON and after JSON. The trail is readable by ADMIN/HR through the API and the EJS page; salary appears in audit payloads for ADMIN/HR readers only.',
    priority: 'P1',
    status: 'implemented+tested',
    acceptanceCriteria: [
      { id: 'HR-AC-035', text: 'GET /api/audit-logs filters by entityType/entityId and returns parsed before/after objects; MANAGER and EMPLOYEE receive 403.' },
      { id: 'HR-AC-036', text: 'Every covered mutation produces exactly one audit row with the correct action name and a diffable before/after payload.' },
      { id: 'HR-AC-037', text: 'Audit rows survive the deletion of the actor (actor reference cleared) so history is never lost.' },
    ],
  },
  {
    id: 'HR-REQ-013',
    module: 'Reports',
    title: 'Scoped HR summary report',
    description:
      'GET /api/reports/summary returns headcount by department, leave counts by status and the attendance rate of the last 30 days, always limited to the caller\'s scope (ALL for ADMIN/HR, TEAM for MANAGER, SELF for EMPLOYEE).',
    priority: 'P3',
    status: 'implemented+tested',
    acceptanceCriteria: [
      { id: 'HR-AC-038', text: 'The payload contains scope, scopeEmployeeIds, headcount, headcountByDepartment, leaveByStatus (all four statuses) and attendance with from/to/records/attendanceRate.' },
      { id: 'HR-AC-039', text: 'A manager summary counts only self + direct reports and an employee summary only their own record.' },
    ],
  },
  {
    id: 'HR-REQ-014',
    module: 'API conventions',
    title: 'HTTP conventions and error envelope',
    description:
      'Success uses 200/201/204; 400 validation, 401 unauthenticated, 403 forbidden, 404 not found, 409 conflict, 422 business rule, 423 locked. Errors always use { error: { code, message, details } } and never leak stack traces. List endpoints return X-Total-Count.',
    priority: 'P1',
    status: 'implemented+tested',
    acceptanceCriteria: [
      { id: 'HR-AC-040', text: 'GET /api/health reports status/service/database/employees and answers 200.' },
      { id: 'HR-AC-041', text: 'Unknown API routes return 404 NOT_FOUND, malformed JSON returns 400 INVALID_JSON, and no response contains a stack trace.' },
      { id: 'HR-AC-042', text: 'Every list endpoint supports page/limit, validates them (0, 101, non-numeric are 400) and returns X-Total-Count.' },
    ],
  },
  {
    id: 'HR-REQ-015',
    module: 'UI',
    title: 'Server-rendered EJS interface',
    description:
      'The UI shares the API session cookie, renders role-aware navigation and data, provides stable data-testid attributes on every interactive element, real 403/404 pages, inline form validation, an empty state for empty lists, a responsive single stylesheet and accessible markup (labels, semantic headings, skip link, focus states).',
    priority: 'P2',
    status: 'implemented+tested',
    acceptanceCriteria: [
      { id: 'HR-AC-043', text: 'Login, dashboard, employee list/detail/form, attendance, leave and audit pages render with the documented data-testid hooks and role-aware content.' },
      { id: 'HR-AC-044', text: 'Restricted pages render a real 403 page with the error code; unknown records render 404; validation problems are shown inline next to the offending field.' },
      { id: 'HR-AC-045', text: 'Empty results show an empty state, pagination controls stay in sync with the filters and the layout works at 390x844 as well as 1440x900.' },
    ],
  },
  {
    id: 'HR-REQ-016',
    module: 'Data',
    title: 'Deterministic seed data and reset',
    description:
      'npm run db:reset recreates the schema and inserts a deterministic data set: 3 departments, 10 employees (1 ADMIN, 1 HR, 1 MANAGER, 7 EMPLOYEE), 60 attendance rows over 6 work days, 6 leave requests in all four statuses including the documented overlap scenario, and 2 audit rows. Relative dates follow the run date, or a pinned SEED_AS_OF.',
    priority: 'P2',
    status: 'implemented+tested',
    acceptanceCriteria: [
      { id: 'HR-AC-046', text: 'Two seeds with the same reference date produce identical rows (including hashes and salts); the reset prints the row counts.' },
      { id: 'HR-AC-047', text: 'Employees reference real departments/managers, attendance never lands on a weekend and every seeded leave row satisfies the documented rules.' },
      { id: 'HR-AC-048', text: 'Demo credentials are documented and work for all four roles at 8+ characters with letter + number + symbol.' },
    ],
  },
];

export function requirementById(id) {
  return requirements.find((requirement) => requirement.id === id) ?? null;
}

export const acceptanceCriteria = requirements.flatMap((requirement) =>
  requirement.acceptanceCriteria.map((criterion) => ({ ...criterion, requirementId: requirement.id, module: requirement.module })),
);
