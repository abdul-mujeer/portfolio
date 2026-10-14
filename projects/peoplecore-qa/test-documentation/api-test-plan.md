# PeopleCore HRMS — API test plan

## 1 · What is under test

A JSON API under `/api` served by Express 4, backed by `node:sqlite`. Sessions are opaque
tokens delivered as an `HttpOnly; SameSite=Lax` cookie; the same token may also be sent as
`Authorization: Bearer <token>` so that API tooling (Postman, newman, curl) can authenticate
without a cookie jar. Both mechanisms resolve to the same server-side session.

## 2 · Conventions under test

| Rule | Value |
|---|---|
| Success | `200` (read/update), `201` + `Location` (create), `204` (delete/logout) |
| Client errors | `400` validation · `401` unauthenticated · `403` forbidden · `404` not found · `409` conflict · `422` business rule · `423` locked |
| Error envelope | `{ "error": { "code": "STRING_CODE", "message": "human readable", "details": [ { "path", "code", "message" } ] } }` |
| Lists | `page` (1-based, default 1) · `limit` (1..100, default 20) · `X-Total-Count` header · `total`/`totalPages` in the body |
| Sorting | whitelisted `sort` columns per resource, `order=asc|desc`, stable tie-breaker on `id` |
| Dates | `YYYY-MM-DD` for date-only fields, validated as real calendar dates |
| No leakage | no stack traces, no `password_hash`/`salt`, salary only for ADMIN/HR/self |

### 400 vs 422 (documented decision)

- **400** — the payload is malformed: missing field, wrong type, unknown enum value, bad format
  (employee code, e-mail, password policy, time format, impossible calendar date, unknown field,
  `limit` out of range).
- **422** — the payload is well-formed but breaks a business rule: salary out of range or more than
  2 decimals, future/pre-1990 hire date, unknown referenced department/manager/employee, leave
  date order, more than 30 leave days, impossible attendance time combination, terminated employee,
  illegal state transition.
- **409** — a conflict with existing state: duplicate employee code/e-mail/department name or code,
  duplicate attendance for one employee/day, overlapping leave request.

## 3 · Coverage map

| Area | Endpoints | Automated tests |
|---|---|---|
| Health | `GET /api/health` | `tests/api/health.spec.ts` |
| Auth | `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/session` | `tests/api/auth.spec.ts` |
| Employees | `GET/POST /api/employees`, `GET/PUT/DELETE /api/employees/:id` | `tests/api/employees.spec.ts` (list/paging/sort/filter, create/update/delete, validation boundaries) |
| Departments | `GET/POST /api/departments`, `GET/PUT /api/departments/:id` | `tests/api/attendance-departments-reports.spec.ts` |
| Attendance | `GET/POST /api/attendance`, `PATCH /api/attendance/:id` | same file |
| Leave | `GET/POST /api/leave-requests`, `GET /api/leave-requests/:id`, `PATCH …/approve`, `PATCH …/reject`, `DELETE /api/leave-requests/:id` | `tests/api/leave.spec.ts` |
| Audit | `GET /api/audit-logs` | `tests/api/audit.spec.ts` |
| Reports | `GET /api/reports/summary` | `tests/api/attendance-departments-reports.spec.ts` |
| RBAC matrix | all of the above × 4 roles | `tests/api/rbac.spec.ts` |

## 4 · Techniques used

- **Data-driven matrices** — the RBAC suite walks 8 endpoints × 4 roles and reports *all*
  mismatches in one assertion message instead of failing on the first one.
- **Relative fixtures** — unique employee codes/e-mails per test (time-seeded so parallel spec
  files cannot collide, see HR-BUG-009) and date windows computed from today.
- **Boundary sweeps** — `limit` 0/1/100/101, page 1/last/beyond-last, salary limits, 30/31 leave
  days, 9/10/500/501 characters, 5-attempt lockout.
- **State transition assertions** — every illegal follow-up action after a decision returns 422,
  every ownership violation returns 403.
- **Cross-checking with the database** — `tests/db/06-seed-and-api-integration.mjs` runs negative
  API calls and then asserts the SQLite file did not change.

## 5 · Execution

```bash
npm run test:api        # Playwright project "api" (resets + seeds .data/peoplecore.test.db)
npm run test:smoke      # @smoke subset
npm run test:regression # @regression subset
npm run test:postman    # the same API driven by newman on port 4210
```

Evidence: `test-evidence/logs/api.txt`, `test-evidence/logs/postman.txt`,
`test-reports/playwright/api.json`, `test-reports/newman/newman-report.json`.

## 6 · Known gaps

- No rate limiting beyond the login lockout (not required by the specification).
- No CSRF token for cookie-based writes; `SameSite=Lax` plus server-side authorization is the
  documented control (`Sec-Fetch-Site` is not inspected).
- No content negotiation beyond JSON and EJS; no API versioning.
- Long-running pagination over very large tables is untested (the seed holds 10 employees, 60
  attendance rows and 6 leave requests).
