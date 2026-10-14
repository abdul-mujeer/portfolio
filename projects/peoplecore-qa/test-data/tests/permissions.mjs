/**
 * PeopleCore HRMS — role/capability matrix.
 * SINGLE SOURCE OF TRUTH for test-documentation/role-permission-matrix.md and for the
 * RBAC test cases (HR-TC-056..HR-TC-060).
 *
 * Values: ALLOW · DENY · ALL (unscoped) · TEAM (self + direct reports) · SELF · CONDITIONAL
 */
export const roles = ['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'];

export const capabilityMatrix = [
  { capability: 'Sign in, read own session', ADMIN: 'ALLOW', HR: 'ALLOW', MANAGER: 'ALLOW', EMPLOYEE: 'ALLOW', notes: '8 hour HttpOnly cookie, 5-attempt lockout' },
  { capability: 'Read own employee profile', ADMIN: 'ALLOW', HR: 'ALLOW', MANAGER: 'ALLOW', EMPLOYEE: 'ALLOW', notes: 'GET /api/employees/:id' },
  { capability: 'Read another employee profile', ADMIN: 'ALL', HR: 'ALL', MANAGER: 'TEAM', EMPLOYEE: 'DENY', notes: '403 for out-of-scope ids' },
  { capability: 'Read own salary', ADMIN: 'ALLOW', HR: 'ALLOW', MANAGER: 'ALLOW', EMPLOYEE: 'ALLOW', notes: 'the employee themself always sees it' },
  { capability: 'Read the salary of another employee', ADMIN: 'ALLOW', HR: 'ALLOW', MANAGER: 'DENY', EMPLOYEE: 'DENY', notes: 'manager payload uses salaryRedacted' },
  { capability: 'List employees', ADMIN: 'ALL', HR: 'ALL', MANAGER: 'TEAM', EMPLOYEE: 'SELF', notes: 'list endpoints always apply the scope filter' },
  { capability: 'Create employee', ADMIN: 'ALLOW', HR: 'CONDITIONAL', MANAGER: 'DENY', EMPLOYEE: 'DENY', notes: 'HR may not create an ADMIN account (403)' },
  { capability: 'Update employee record', ADMIN: 'ALLOW', HR: 'CONDITIONAL', MANAGER: 'DENY', EMPLOYEE: 'DENY', notes: 'HR may not modify an ADMIN account' },
  { capability: 'Change an employee role', ADMIN: 'ALLOW', HR: 'DENY', MANAGER: 'DENY', EMPLOYEE: 'DENY', notes: '403 ROLE_CHANGE_FORBIDDEN' },
  { capability: 'Delete employee', ADMIN: 'ALLOW', HR: 'DENY', MANAGER: 'DENY', EMPLOYEE: 'DENY', notes: 'guards: self, direct reports' },
  { capability: 'List departments', ADMIN: 'ALLOW', HR: 'ALLOW', MANAGER: 'ALLOW', EMPLOYEE: 'ALLOW', notes: 'read-only for managers and employees' },
  { capability: 'Create or rename department', ADMIN: 'ALLOW', HR: 'ALLOW', MANAGER: 'DENY', EMPLOYEE: 'DENY', notes: 'UI form is ADMIN/HR' },
  { capability: 'Read attendance', ADMIN: 'ALL', HR: 'ALL', MANAGER: 'TEAM', EMPLOYEE: 'SELF', notes: 'employeeId filter outside the scope is 403' },
  { capability: 'Write attendance', ADMIN: 'ALLOW', HR: 'ALLOW', MANAGER: 'TEAM', EMPLOYEE: 'DENY', notes: 'defect HR-BUG-004 was found here' },
  { capability: 'Read leave requests', ADMIN: 'ALL', HR: 'ALL', MANAGER: 'TEAM', EMPLOYEE: 'SELF', notes: 'own requests are always readable' },
  { capability: 'Submit leave for themself', ADMIN: 'ALLOW', HR: 'ALLOW', MANAGER: 'ALLOW', EMPLOYEE: 'ALLOW', notes: 'employeeId of somebody else is 403' },
  { capability: 'Approve or reject leave', ADMIN: 'ALL', HR: 'ALL', MANAGER: 'TEAM', EMPLOYEE: 'DENY', notes: 'nobody may review their own request (403)' },
  { capability: 'Cancel leave', ADMIN: 'OWN PENDING', HR: 'OWN PENDING', MANAGER: 'OWN PENDING', EMPLOYEE: 'OWN PENDING', notes: 'only PENDING, only the owner' },
  { capability: 'Read audit logs', ADMIN: 'ALLOW', HR: 'ALLOW', MANAGER: 'DENY', EMPLOYEE: 'DENY', notes: 'salary inside audit payloads is ADMIN/HR only' },
  { capability: 'Read reports summary', ADMIN: 'ALL', HR: 'ALL', MANAGER: 'TEAM', EMPLOYEE: 'SELF', notes: 'scope is echoed in the payload' },
  { capability: 'Record attendance for a terminated employee', ADMIN: 'DENY', HR: 'DENY', MANAGER: 'DENY', EMPLOYEE: 'DENY', notes: '422 EMPLOYEE_TERMINATED' },
  { capability: 'Submit leave while terminated', ADMIN: 'DENY', HR: 'DENY', MANAGER: 'DENY', EMPLOYEE: 'DENY', notes: '422 on a stale session, 403 at sign-in' },
  { capability: 'Sign in while terminated', ADMIN: 'DENY', HR: 'DENY', MANAGER: 'DENY', EMPLOYEE: 'DENY', notes: '403 ACCOUNT_TERMINATED' },
  { capability: 'Delete own account', ADMIN: 'DENY', HR: 'DENY', MANAGER: 'DENY', EMPLOYEE: 'DENY', notes: '422 CANNOT_DELETE_SELF' },
];

export function matrixRowFor(capability) {
  return capabilityMatrix.find((row) => row.capability === capability) ?? null;
}
