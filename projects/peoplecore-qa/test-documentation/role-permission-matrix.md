# PeopleCore — role permission matrix

> Generated from `test-data/tests/permissions.mjs` by `npm run docs:csv`. Do not edit by hand.

Legend: **ALLOW** implemented and verified · **ALL** unrestricted scope · **TEAM** self + direct reports · **SELF** own record only ·
**CONDITIONAL** allowed with an extra rule (noted) · **OWN PENDING** only the caller's pending record · **DENY** refused with a 4xx status code.

| Capability | ADMIN | HR | MANAGER | EMPLOYEE | Notes | Verified by |
|---|---|---|---|---|---| ---|
| Sign in, read own session | **ALLOW** | **ALLOW** | **ALLOW** | **ALLOW** | 8 hour HttpOnly cookie, 5-attempt lockout | HR-TC-001, HR-TC-002 |
| Read own employee profile | **ALLOW** | **ALLOW** | **ALLOW** | **ALLOW** | GET /api/employees/:id | HR-TC-039, HR-TC-061 |
| Read another employee profile | **ALL** | **ALL** | **TEAM** | **DENY** | 403 for out-of-scope ids | HR-TC-059, HR-TC-061 |
| Read own salary | **ALLOW** | **ALLOW** | **ALLOW** | **ALLOW** | the employee themself always sees it | HR-TC-002, HR-TC-030 |
| Read the salary of another employee | **ALLOW** | **ALLOW** | **DENY** | **DENY** | manager payload uses salaryRedacted | HR-TC-059 |
| List employees | **ALL** | **ALL** | **TEAM** | **SELF** | list endpoints always apply the scope filter | HR-TC-016, HR-TC-059 |
| Create employee | **ALLOW** | **CONDITIONAL** | **DENY** | **DENY** | HR may not create an ADMIN account (403) | HR-TC-025, HR-TC-064 |
| Update employee record | **ALLOW** | **CONDITIONAL** | **DENY** | **DENY** | HR may not modify an ADMIN account | HR-TC-024, HR-TC-065 |
| Change an employee role | **ALLOW** | **DENY** | **DENY** | **DENY** | 403 ROLE_CHANGE_FORBIDDEN | HR-TC-065 |
| Delete employee | **ALLOW** | **DENY** | **DENY** | **DENY** | guards: self, direct reports | HR-TC-022, HR-TC-023, HR-TC-065 |
| List departments | **ALLOW** | **ALLOW** | **ALLOW** | **ALLOW** | read-only for managers and employees | HR-TC-032 |
| Create or rename department | **ALLOW** | **ALLOW** | **DENY** | **DENY** | UI form is ADMIN/HR | HR-TC-031, HR-TC-032 |
| Read attendance | **ALL** | **ALL** | **TEAM** | **SELF** | employeeId filter outside the scope is 403 | HR-TC-034, HR-TC-039 |
| Write attendance | **ALLOW** | **ALLOW** | **TEAM** | **DENY** | defect HR-BUG-004 was found here | HR-TC-064 |
| Read leave requests | **ALL** | **ALL** | **TEAM** | **SELF** | own requests are always readable | HR-TC-053 |
| Submit leave for themself | **ALLOW** | **ALLOW** | **ALLOW** | **ALLOW** | employeeId of somebody else is 403 | HR-TC-041, HR-TC-053 |
| Approve or reject leave | **ALL** | **ALL** | **TEAM** | **DENY** | nobody may review their own request (403) | HR-TC-046, HR-TC-049, HR-TC-064 |
| Cancel leave | **OWN PENDING** | **OWN PENDING** | **OWN PENDING** | **OWN PENDING** | only PENDING, only the owner | HR-TC-048, HR-TC-051 |
| Read audit logs | **ALLOW** | **ALLOW** | **DENY** | **DENY** | salary inside audit payloads is ADMIN/HR only | HR-TC-054, HR-TC-059, HR-TC-061 |
| Read reports summary | **ALL** | **ALL** | **TEAM** | **SELF** | scope is echoed in the payload | HR-TC-056 |
| Record attendance for a terminated employee | **DENY** | **DENY** | **DENY** | **DENY** | 422 EMPLOYEE_TERMINATED | HR-TC-038, HR-TC-064 |
| Submit leave while terminated | **DENY** | **DENY** | **DENY** | **DENY** | 422 on a stale session, 403 at sign-in | HR-TC-050 |
| Sign in while terminated | **DENY** | **DENY** | **DENY** | **DENY** | 403 ACCOUNT_TERMINATED | HR-TC-050 |
| Delete own account | **DENY** | **DENY** | **DENY** | **DENY** | 422 CANNOT_DELETE_SELF | HR-TC-023 |

## How the matrix is enforced

All authorization lives in `app/server/src/lib/scope.js` and is applied inside the service layer, so the JSON API and the EJS pages
share exactly the same rules. The UI only *hides* controls; every hidden control is also refused by the server (see HR-TC-059, HR-TC-064, HR-TC-065).

## Seeded defect toggle

With `SEED_DEFECTS=1` the manager list scope is deliberately dropped (HR-SEEDED-01). Clean runs (`SEED_DEFECTS=0`, the default) enforce
the matrix above; `npm run seeded:evidence` demonstrates the difference.
