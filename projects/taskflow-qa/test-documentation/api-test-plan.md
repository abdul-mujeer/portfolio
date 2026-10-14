# TaskFlow API — API Test Plan

## 1. Objective

Prove the HTTP contract, validation rules, authorization matrix and business workflows
of `/api/v1` on a deterministic database, with traceable evidence.

## 2. Tooling & structure

- **Playwright `APIRequestContext`** — `tests/api/*.spec.ts`, 48 tests, 1 worker,
  each test creates isolated contexts (`authedContext`) so personas never bleed into
  each other. Mutating tests create their own projects/data; only read-only assertions
  touch the seeded TASK/OPS/ARCH projects, which keeps suites order-independent.
- **newman** — `postman/TaskFlow-API.postman_collection.json` (48 requests,
  50 assertions, cookie jar) exercises one full lifecycle in order, including
  login switching (owner → member → outsider → owner) and cleanup.
- Every test title carries a `TASK-TC-nnn` id so `npm run docs:csv` can fill the CSV
  from real JSON results.

## 3. Coverage map

| Area | Tests | Highlights |
|------|------:|------------|
| Auth & sessions | 5 | register/login/logout/me, cookie flags, tamper, 401 sweep |
| Projects | 7 | CRUD, key rules, list scoping, 404 isolation, archive lifecycle |
| Members & roles | 6 | add/duplicate/unknown, OWNER protection, last-admin, transfer |
| Task CRUD & validation | 8 | defaults, boundaries, types, dates, assignment, delete rights |
| Status workflow | 3 | full chain, terminals, skip/no-op/unknown |
| Comments | 2 | lifecycle, boundaries, archived, pagination |
| Activity | 2 | order, pagination, detail payloads, isolation |
| Pagination/filter/sort | 5 | defaults, invalid values, out-of-range, filters, q-escape, sort |
| Isolation | 3 | reads/writes as non-member, scope per persona |
| Reports | 2 | counts, archived exclusion, scope |
| Security probes | 3 | SQLi payloads, stored markup, mass assignment |
| Health/persistence | 2 | health endpoints, cross-session persistence |

## 4. Test data strategy

- Deterministic seed; tests that mutate the seed are avoided — mutating tests create
  their own projects with collision-proof keys.
- Overdue expectations are derived from the API at runtime (`expectedOverdueIds`) so
  UTC-midnight rollover cannot flake the suite.
- Unknown-field probes double as mass-assignment checks (strict zod schemas).

## 5. Entry/exit

Entry: server healthy on `:4300` with a freshly seeded test DB (handled automatically
by the Playwright `webServer` or the orchestrator). Exit: 48/48 green; failures would
be triaged into `defect-log.csv` before retest.

## 6. Negative-testing catalogue (excerpt)

`401` unauth sweep · `403` object-level (unrelated member, member vs admin ops) ·
`404` unknown ids and hidden cross-project ids · `409` duplicate email/key/member,
owner-protection, last admin, re-archive, already owner · `422` assignee not member,
due before creation, invalid transition, archived project · `400` every boundary and
type violation incl. strict unknown fields · `413` oversized payload · `400` malformed
JSON · `400` duplicate query params.
