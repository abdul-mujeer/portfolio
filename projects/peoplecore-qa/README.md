# PeopleCore HRMS — QA portfolio project

> **Portfolio practice project.** Everything in this repository is synthetic: fictional people,
> `@example.com` addresses and documented demo passwords. It is a work sample, not a commercial
> product and not employment experience.

**One-line summary:** a role-based HRMS (Express 4 + EJS + `node:sqlite` + zod) delivered together
with the QA package that proves it — 16 requirements, 69 manual test cases, 189 executed automated
checks across five suites, an audit trail you can inspect, and a defect log with nine real product
defects that were found, fixed and retested.

---

## 1 · Project overview

| Item | Value |
|---|---|
| Application | PeopleCore HRMS 1.0.0 — server-rendered HR management app with a JSON API |
| Stack | Node.js ≥ 22 ESM · Express 4 · EJS · `node:sqlite` (`DatabaseSync`) · zod · scrypt (`node:crypto`) |
| Port | **4200** (development), 4210 newman · 4220 screenshots · 4230 performance · 4240 seeded-defect evidence |
| Runtime dependencies | `express`, `ejs`, `zod` — nothing else |
| Dev dependencies | `@playwright/test`, `newman`, `autocannon`, `eslint`, `@eslint/js`, `globals` |
| Database | SQLite file, default `app/server/data/peoplecore.db`, tests use `.data/peoplecore.test.db` |
| QA artefacts | `test-data/`, `test-documentation/`, `tests/`, `postman/`, `test-reports/`, `test-evidence/` |
| Status | All executed suites green on 2026-10-14 — see §15 |

Four roles drive the whole design: **ADMIN**, **HR**, **MANAGER**, **EMPLOYEE**.

## 2 · Business problem

An HR system is a permission problem wearing a CRUD costume. The same screen must show a manager
their team and nobody else; salary must reach payroll but not a colleague; every change to a person's
record must be provable months later; and leave and attendance rules (overlaps, one row per day,
maximum lengths, terminated accounts) have to hold no matter which door the request comes through —
browser form, JSON API or a script.

That is what makes it a good QA portfolio target: the interesting defects are not "wrong button
colour", they are missing authorization checks, off-by-one date boundaries, unreachable states and
500s caused by a foreign key. This project demonstrates the full loop: write down the rules, test
them at three levels, find the real bugs, fix them, and report the truth about what remains.

## 3 · Objectives & testing scope

**Objectives**

1. Build a professional-looking, role-aware HRMS that is small enough to read end to end.
2. Express its rules as requirements + acceptance criteria and 69 executable manual cases.
3. Prove the automation works by *finding real defects*, not by producing a green wall of assertions.
4. Publish evidence that a reviewer can reproduce on their own machine in a few commands.

**In scope:** authentication and sessions (8 h opaque cookie, 5-attempt lockout), role-based
authorization for four roles, employees (list/search/filter/sort/pagination, create/update/delete,
validation), departments, attendance, the leave lifecycle, the audit trail, the scoped summary
report, the EJS UI (login, dashboard, employees, attendance, leave, audit, 403/404), the HTTP
conventions, the SQLite schema and the deterministic seed data.

**Out of scope:** payroll processing, document/letter management, e-mail or notification delivery,
CSV/PDF export, multi-tenancy, SSO/MFA, deployment and CI infrastructure, penetration testing beyond
the documented abuse cases, and load testing (the autocannon run is an indicator baseline only).

## 4 · Architecture & stack

```
Browser ──HTTP──► Express 4 (app/server/src)
                    │  middleware: session cookie/bearer → actor, zod validation, error envelope
                    │  routes/api:  health · auth · employees · departments · attendance
                    │               leave-requests · audit-logs · reports
                    │  routes/pages: the same services rendered through EJS views
                    │  lib/: services (business rules) · scope (RBAC) · queries (SQL) · audit
                    │        validation schemas · dates · passwords (scrypt)
                    ▼
                node:sqlite (DatabaseSync)  ◄── scripts/reset-db.mjs · seed.js · test-data/seed/*.json
                    ▲
     tests/db (SQL)  tests/api (Playwright request)  tests/ui (Chromium)  postman + newman
```

Key decisions: one process, one file database, **all** authorization inside the service layer so the
API and the pages cannot drift, one shared error envelope
(`{ error: { code, message, details } }`), and a seeded defect switch (`SEED_DEFECTS=1`) that is off
by default so every normal run is clean.

## 5 · Features under test

| Module | Highlights |
|---|---|
| Authentication | scrypt + per-user salt, opaque 64-char session token, `HttpOnly; SameSite=Lax` cookie (Bearer accepted for API tooling), 8 h expiry, 5-attempt/15-minute lockout, session revocation for terminated accounts |
| RBAC | `ADMIN` all · `HR` create/update but never delete or change roles · `MANAGER` self + direct reports · `EMPLOYEE` self only; enforced server-side on every endpoint and every list filter |
| Employees | search (name/e-mail/code), department/status/role filters, whitelisted sorting, 1-based pagination with `X-Total-Count`, create/update/delete with 400/409/422 distinction, salary redaction for managers |
| Departments | list for everyone, create/rename for ADMIN/HR, unique name + code, audit rows |
| Attendance | one row per employee per work day, status-specific time rules, terminated accounts blocked, team-scoped writes |
| Leave | submit (self only), inclusive day count, ≤ 30 days, reason 10…500 chars, overlap detection against PENDING/APPROVED, approve/reject with comment rules, cancel own PENDING, illegal transitions refused |
| Audit | append-only trail with actor, action, entity and before/after JSON; readable by ADMIN/HR; salary only for ADMIN/HR readers; history survives deletions |
| Reports | headcount by department, leave by status, 30-day attendance rate — always scoped to the caller |
| UI | role-aware navigation, `data-testid` on every interactive element, inline validation, empty states, real 403/404 pages, single responsive stylesheet, skip link, focus states |

## 6 · Requirements & acceptance criteria

- 16 requirements `HR-REQ-001` … `HR-REQ-016` with 48 acceptance criteria `HR-AC-001` … `HR-AC-048`.
- Single source of truth: `test-data/tests/requirements.mjs` → rendered to
  `test-documentation/requirements.md` and `acceptance-criteria.md`.
- Coverage: **16/16 requirements** have at least one test case (see `traceability-matrix.csv`).

Highlights of the written rules (the ones the tests attack): employee code `^EMP-\d{3,4}$` and unique,
email RFC-ish and unique (case-insensitive), salary in `(0, 1 000 000]` with ≤ 2 decimals, hire date
between 1990-01-01 and today, leave ≤ 30 days with no overlap, rejection comments ≥ 5 characters,
one attendance row per employee/day, `checkOut > checkIn`, and no state transition out of a decided
leave request.

## 7 · Test strategy

Risk-based and layered, with the techniques spelled out in `test-documentation/test-strategy.md`:

- **SQL validation** (12 checks) — constraints, seed determinism, orphan checks and a "negative API
  calls leave no trace" integration check.
- **API** (58 tests) — status codes, payload validation, scoping, pagination boundaries, workflow
  transitions, audit writes, plus an 8 endpoints × 4 roles authorization matrix.
- **UI** (20 tests) — the journeys a person judges the product by, selectors anchored on `data-testid`.
- **Postman/newman** — the same API driven by a tool that knows nothing about Playwright (45 requests,
  96 assertions) — this is where the 500 defect surfaced.
- **Exploratory** — 6 timeboxed charters (all executed) that produced the session/terminated-account
  finding and the seeded BOLA scenario.
- **Performance baseline** — autocannon, local indicator only.

Boundary analysis, equivalence partitioning, decision tables (role × capability) and state-transition
testing are the design techniques; every case names its technique in the CSV.

## 8 · Test case organisation

| Where | What |
|---|---|
| `test-data/tests/test-cases.mjs` | 69 manual cases (`HR-TC-001` … `HR-TC-069`), executable by hand, each bound to a requirement |
| `test-documentation/test-cases.csv` | generated CSV, RFC-4180 quoted, 16 columns as required by the portfolio standard |
| `test-documentation/traceability-matrix.csv` | requirement → acceptance criteria → cases → coverage |
| `test-documentation/test-scenarios.md` | 23 end-to-end scenarios mapped to the cases |
| `test-data/tests/permissions.mjs` | 24 capability rows × 4 roles → `role-permission-matrix.md` |
| `test-data/tests/defects.mjs` | defect log (product, automation and the two SEEDED defects) |
| `test-data/tests/exploratory.mjs` | charters, findings and session notes |

Execution status distribution of the 69 cases in the last run: **65 Pass · 4 Not Executed**
(the four manual accessibility/cross-browser checks — reason recorded per case).

## 9 · API testing approach

Playwright **request contexts** (no browser) with one cookie jar per test, so a test can be any role
without touching the UI. `tests/api/` covers health, auth/sessions, employees (list, filter, sort,
paging, create, update, delete), departments, attendance, leave (submit, review, cancel),
audit logs, reports and the RBAC matrix. The RBAC test walks 8 endpoints × 4 roles and reports *all*
mismatches in one message.

The status-code contract (documented in `test-documentation/api-test-plan.md`) is enforced as:
**400** malformed payload · **401** unauthenticated · **403** forbidden · **404** unknown id ·
**409** conflict (duplicate code/e-mail/department, duplicate attendance day, overlapping leave) ·
**422** business-rule violation (salary range, future hire date, unknown reference, date order, > 30
days, impossible times, terminated employee, illegal transition) · **423** locked.

## 10 · UI automation approach

Playwright + Chromium against the running EJS pages. Every interactive element and every important
output has a `data-testid` (`login-email`, `login-submit`, `login-error`, `login-locked`,
`employee-row`, `employee-search`, `employee-sort`, `pagination-next`, `empty-state`,
`form-error-<field>`, `review-approve-<id>`, `audit-row`, `forbidden-page`, `not-found-page`, …), so
nothing depends on CSS or DOM order. No `waitForTimeout`; web-first assertions only. Each test either
signs in through the real form or opens a fresh browser context, and destructive steps restore what
other tests rely on. Details: `test-documentation/ui-automation.md`.

## 11 · Database testing approach

`tests/db/run.mjs` gives every check its own copy of a freshly seeded database (so constraint probes
cannot influence each other), runs the checks and writes `test-reports/db-results.json`. The 12
checks include duplicate/FK/CHECK probes, seed determinism with pinned dates, attendance and leave
data rules, the overlap query itself, audit payload shape, orphan queries and a check that fires ten
negative API calls at a real server and then proves the SQLite file is unchanged and FK-clean.
Details and ad-hoc queries: `test-documentation/database-testing.md`.

## 12 · Install & run the application

```bash
cd projects/peoplecore-qa
npm install                 # ~316 packages, no native builds
npm run db:reset            # create + seed app/server/data/peoplecore.db (deterministic)
npm start                   # http://127.0.0.1:4200
```

`npm run dev` runs the same server with `--watch`. Copy `.env.example` to `.env` to change `PORT`,
`DB_PATH`, `SEED_AS_OF`, `SEED_DEFECTS` and the lockout/session values.

### Demo credentials (synthetic, documented on purpose)

| Role | Email | Password |
|---|---|---|
| ADMIN | `admin@example.com` | `Admin#12345` |
| HR | `hr@example.com` | `Hr#1234567` |
| MANAGER | `manager@example.com` | `Manager#12345` |
| EMPLOYEE (7 accounts) | `employee1@example.com` … `employee7@example.com` | `Employee#1234` |

Seeded content: 3 departments (ENG/HR/SLS), 10 employees (`EMP-001`…`EMP-010`), 60 attendance rows
over the last 6 work days, 6 leave requests covering PENDING/APPROVED/REJECTED/CANCELLED (including
the documented overlap scenario for `EMP-009`), 2 audit rows. Dates follow the day you seed; pin them
with `SEED_AS_OF=2026-01-15 npm run seed`.

## 13 · Run each test suite (exact commands)

```bash
npm run lint             # eslint over app, tests and scripts (generated output ignored)
npm run test:db          # 12 SQL validation checks            → test-reports/db-results.json
npm run test:api         # 58 Playwright API tests (port 4200) → test-reports/playwright/api.json
npm run test:ui          # 20 Playwright UI tests (Chromium)   → test-reports/playwright/ui.json
npm run test:postman     # 45 requests / 96 assertions via newman on port 4210
npm run test:perf        # autocannon baseline (3 endpoints)   → test-reports/perf-baseline.json
npm run test:smoke       # @smoke subset (API + UI)
npm run test:regression  # @regression subset
npm run screenshots      # 12 JPEG evidence screenshots (1440x900 + 390x844)
npm run seeded:evidence  # proves the two SEEDED defects are detected with SEED_DEFECTS=1
npm run test:all         # orchestrates every suite, writes the logs, summary.json + execution report
npm run docs:csv         # regenerate the CSV/Markdown documentation from test-data/tests/*.mjs
npm run docs:report      # regenerate the execution report from the latest raw artefacts
```

Each suite resets and seeds its own database and boots its own server on a private port, so the
commands above never pollute the development database and never depend on each other's leftovers.

## 14 · Where reports live

| Artefact | Path |
|---|---|
| Machine-readable summary (per suite, per check, git commit, node version) | `test-reports/summary.json` |
| Human-readable execution report | `test-reports/execution-report-2026-10-14.md` · `test-documentation/execution-report.md` |
| Raw Playwright JSON + HTML report | `test-reports/playwright/api.json`, `ui.json`, `playwright/html/` |
| newman JSON report | `test-reports/newman/newman-report.json` |
| SQL check results | `test-reports/db-results.json` |
| Performance baseline | `test-reports/perf-baseline.json` |
| Raw command logs (install, lint, every suite) | `test-evidence/logs/*.txt` |
| Screenshots | `test-evidence/screenshots/*.jpg` (+ `screenshots.json`) |
| Seeded-defect detection proof | `test-evidence/seeded-defects/seed-defects-evidence.json` |
| Requirements, cases, traceability, defect log, charters | `test-documentation/` |

## 15 · Actual execution results

Executed **2026-10-14** on Windows 11 with Node **v24.21.0**, Chromium (Playwright 1.56), one worker,
`SEED_DEFECTS=0`. Numbers copied from `test-reports/summary.json`; raw logs in `test-evidence/logs/`.

| Suite | Command | Executed | Passed | Failed | Raw log |
|---|---|---|---|---|---|
| SQL validation | `npm run test:db` | 12 | 12 | 0 | `test-evidence/logs/db.txt` |
| Playwright API | `npm run test:api` | 58 | 58 | 0 | `test-evidence/logs/api.txt` |
| Playwright UI | `npm run test:ui` | 20 | 20 | 0 | `test-evidence/logs/ui.txt` |
| Postman (newman) | `npm run test:postman` | 96 assertions (45 requests) | 96 | 0 | `test-evidence/logs/postman.txt` |
| Performance baseline | `npm run test:perf` | 3 targets | 3 | 0 | `test-evidence/logs/perf.txt` |
| **Orchestrated run** | `npm run test:all` | **189** | **189** | **0** | `test-evidence/logs/test-all.txt` |

Other real numbers from the same day:

- Manual test cases: **69** (65 Pass, 4 Not Executed) — `test-documentation/test-cases.csv`.
- Requirement coverage: **16/16** requirements have cases (`traceability-matrix.csv`).
- Defects: **9 product defects + 3 automation/test-code defects** found, fixed, retested and closed;
  **2 SEEDED** defects open by design and reproducibly detected with `npm run seeded:evidence`.
- Screenshots: **12** JPEG q70 files at 1440x900 and 390x844.
- Performance indicator (local, single process, 10 connections, 5 s each): `/api/health` ≈ 5 100 req/s
  (p99 3 ms) · `/api/employees?limit=20` ≈ 2 050 req/s (p99 7 ms) · `/api/reports/summary` ≈ 1 500 req/s
  (p99 10 ms). **Not a capacity claim.**
- Release recommendation from the report generator: **GO — all executed suites are green.**

## 16 · Known issues & limitations

Open by design (labelled SEEDED, off unless `SEED_DEFECTS=1`):

- `HR-SEEDED-01` — manager employee list loses its direct-report scope.
- `HR-SEEDED-02` — leave overlap guard skips requests that start on the same day.

Not executed (recorded as such in the CSV, with reasons):

- `HR-TC-066` keyboard-only navigation, `HR-TC-067` colour contrast (no axe/pa11y — the dependency set
  is fixed by the portfolio standard), `HR-TC-068` screen-reader pass, `HR-TC-069` Firefox/WebKit
  (only the Chromium build is available here: `npx playwright install firefox webkit` adds them).

Design limitations worth knowing:

- No CSRF token on the HTML forms; the control is `SameSite=Lax` plus server-side authorization.
- A MANAGER can see a direct report's salary (documented decision); a manager cannot edit it.
- Weekend days count as leave days (days = inclusive difference, as specified).
- Approved leave does not create attendance rows automatically.
- No rate limiting besides the login lockout; no MFA; no audit retention policy.
- `applySchema` is idempotent but there is no migration history: schema changes are applied with
  `npm run db:reset` (a deliberate simplification for a demo database).

## 17 · Screenshots & evidence

All screenshots were captured from the running application by `npm run screenshots` (never mockups):
login, admin dashboard, employee list, employee detail (attendance and leave tabs), audit log,
an employee leave submission, the 403 page, the manager review queue, and mobile views at 390x844.
Files: `test-evidence/screenshots/*.jpg` with machine-readable metadata in
`test-evidence/screenshots/screenshots.json`. Seeded-defect proof:
`test-evidence/seeded-defects/seed-defects-evidence.json`.

## 18 · Future improvements

1. **Accessibility**: add axe-core scanning plus one keyboard-only journey (closes HR-TC-066/067).
2. **Authorization exhaustiveness**: generate the RBAC matrix from `permissions.mjs` so a new
   endpoint fails the build until its permission row is added.
3. **Error-path hardening**: assert the documented envelope for raw driver errors on every route
   (the class of bug behind HR-BUG-008).
4. **CSRF protection** for cookie-authenticated writes and optional MFA for ADMIN.
5. **Working-day calendar** for leave (and an option to generate attendance from approved leave).
6. **Firefox/WebKit** projects plus a GitHub Actions workflow that publishes the artefacts.
7. **Bulk/soak data** to test pagination and query plans on realistic volumes.

---

## Known deviations from `docs/PROJECT-STANDARD.md`

| # | Deviation | Reason |
|---|---|---|
| 1 | TypeScript specs (`tests/**/*.spec.ts`) and `playwright.config.ts` are excluded from eslint | The dependency set is fixed (no `typescript-eslint`), so linting them would require an extra dev dependency. Everything else (`app`, `tests/db`, `scripts`) is linted and clean. |
| 2 | `test-reports/summary.json` and the newman JSON report are committed | They are the evidence artefacts required by §7 of the standard ("machine readable: suites, counts, timestamps, git commit"). Playwright's raw output (`test-reports/playwright/`) stays ignored. |
| 3 | The `logs` rule in the repository root `.gitignore` also matches `test-evidence/logs/` | Re-included with a project-level negation so the raw transcripts can be committed (required evidence). |
| 4 | The root `.gitignore` rule `.env.*` also matched `.env.example` | Re-included from the project `.gitignore`; the template contains placeholders and demo values only. |
| 5 | Seed dates are relative to the run day (unless `SEED_AS_OF` is pinned) | Keeps the demo data current so "last 30 days" reports and screenshots stay meaningful; `DB-11` verifies determinism for a pinned date. |
| 6 | `npm run test:smoke` / `test:regression` no longer reset the database themselves | The Playwright `webServer` entry resets and seeds before each suite, which makes them correct even when invoked directly with `npx playwright test`. |
| 7 | Only the Chromium project is configured | Only the cached Chromium build exists in this environment; the commands to add Firefox/WebKit are documented in §16. |
