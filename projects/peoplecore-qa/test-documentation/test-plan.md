# PeopleCore HRMS — test plan

> Companion documents: `test-strategy.md` (approach), `test-cases.csv` (cases),
> `traceability-matrix.csv` (coverage), `execution-report.md` (latest real results).

## 1 · Scope

**In scope:** authentication and sessions, role-based authorization (ADMIN/HR/MANAGER/EMPLOYEE),
employee CRUD with validation, department management, attendance recording and rules, the leave
lifecycle (submit → review → cancel), the audit trail, the scoped summary report, the
server-rendered UI (login, dashboard, employee list/detail/form, attendance, leave, audit,
403/404), the HTTP conventions of the JSON API, the SQLite schema and the deterministic seed.

**Out of scope (this iteration):** payroll, document management, notifications/e-mail, CSV export,
multi-tenancy, mobile apps, SSO, deployment/CI infrastructure, penetration testing beyond the
documented abuse cases, load testing.

## 2 · Test items

| Item | Location |
|---|---|
| API + server | `app/server/src/**` |
| Views | `app/views/**` |
| Stylesheet | `app/public/styles.css` |
| Schema + seed | `app/server/src/db.js`, `app/server/src/seed.js`, `test-data/seed/*.json` |
| Postman collection | `postman/PeopleCore-API.postman_collection.json` |

## 3 · Approach and tooling

1. **SQL validation suite** (`npm run test:db`) — 12 checks against private copies of a freshly
   seeded database, including one check that fires negative API calls against a real server
   instance and then verifies the file on disk.
2. **API suite** (`npm run test:api`) — Playwright request contexts, one cookie jar per test,
   independent of the UI.
3. **UI suite** (`npm run test:ui`) — Playwright + Chromium against the server-rendered pages,
   selectors anchored on `data-testid`.
4. **Collection suite** (`npm run test:postman`) — newman drives the committed collection on its own
   port/database, proving the API works for a tool that knows nothing about Playwright.
5. **Evidence** — `npm run screenshots` captures JPEG (q70) evidence at 1440x900 and 390x844.
6. **Exploratory** — 6 timeboxed charters, all executed (see `exploratory-testing.md`).

## 4 · Schedule and effort (single iteration, executed 2026-10-14)

| Phase | Effort | Output |
|---|---|---|
| Requirements and acceptance criteria | 45 min | `requirements.mjs`, `acceptance-criteria.md` |
| Manual case design | 90 min | `test-cases.mjs` → `test-cases.csv` (69 cases) |
| SQL validation suite | 40 min | `tests/db/*.mjs` (12 checks) |
| API suite | 90 min | `tests/api/*.spec.ts` (58 tests) |
| UI suite | 60 min | `tests/ui/*.spec.ts` (20 tests) |
| Postman collection + runner | 40 min | `postman/*`, `scripts/newman-run.mjs` |
| Exploratory charters | 150 min (timeboxed) | 6 charters, 12 findings |
| Defect triage, fixes, retests | 60 min | `defect-log.csv` |
| Reporting and evidence | 30 min | `summary.json`, execution report, screenshots |

## 5 · Risks and mitigations during execution

| Risk | Mitigation used |
|---|---|
| Test data creep between suites | one private database per suite, reset before use |
| Cross-worker fixture collisions | time-seeded unique employee codes (see HR-BUG-009) |
| Timezone-dependent date tests | the suites reuse the application's own local-date helpers (see HR-BUG-010) |
| False red from a broken check | every red result was triaged: 3 findings were test-code defects (HR-BUG-009/010/011), 9 were product defects |
| Over-powered fixtures | newman and Playwright always use the seeded demo accounts, defined once in `test-data/seed/employees.json` |

## 6 · Deliverables

- `test-reports/summary.json` — per-suite executed/passed/failed/skipped, git commit, node version.
- `test-reports/execution-report-<date>.md` + `test-documentation/execution-report.md`.
- `test-evidence/logs/*.txt` — raw stdout/stderr of every executed command.
- `test-evidence/screenshots/*.jpg` — 12 real screenshots.
- `test-evidence/seeded-defects/seed-defects-evidence.json` — detection run for the seeded bugs.
- `test-documentation/*` — this plan, the strategy, cases, matrix, defect log, charter notes.

## 7 · Exit criteria

See `test-strategy.md` §6. In addition: the README contains the *actual* numbers of the last run
and every deviation from `docs/PROJECT-STANDARD.md` is listed there under "Known deviations".
