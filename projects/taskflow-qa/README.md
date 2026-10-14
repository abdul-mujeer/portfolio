# TaskFlow API QA — REST API Quality Engineering

> Portfolio project 3 of 3 in the QA portfolio series. Everything in this folder is
> runnable, executed and evidenced: Express 4 + `node:sqlite` API, a vanilla-JS console,
> Playwright API & UI suites, SQL validation checks, a Postman/newman lifecycle,
> an autocannon performance baseline and a full QA documentation package.

---

## 1. Project overview

TaskFlow is an API-first project-management service: users authenticate, create
projects, invite members, manage tasks through a strict status workflow, comment,
and follow a complete audit trail. A minimal vanilla-JS console (no build step)
exercises the API in a browser.

This folder contains **the product and its complete QA package**: 67 manual test cases
(all executed), 48 Playwright API tests, 10 Playwright UI tests, 22 SQL validation
checks, a 48-request Postman lifecycle with 50 assertions, a performance baseline,
six real defects found/fixed/retested and two labelled seeded defects with a
reproducible detection run.

Demo credentials (seeded, synthetic — not secrets):

| User | Password | Memberships |
|------|----------|-------------|
| `owner@example.com` | `Owner#12345` | OWNER of TASK + ARCH, ADMIN of OPS |
| `admin@example.com` | `Admin#12345` | ADMIN of TASK, OWNER of OPS |
| `member@example.com` | `Member#12345` | MEMBER of TASK + ARCH |
| `outsider@example.com` | `Outside#12345` | MEMBER of OPS only (used for isolation tests) |
| `noprojects@example.com` | `Solo#12345` | no projects (empty-scope persona) |

## 2. Business problem

Project teams need an HTTP service they can trust with **commercial data under strict
permission rules**. The failure modes that matter are not "does the button work" but:
does an outsider see someone else's project? Does an archived project still accept
writes? Does a "DONE" task silently reopen? Does a boundary date slip through? This
project was built to make those failures **detectable and provable**: every rule is
enforced server-side, every change is audited, and every rule has an executed test
with raw evidence behind it.

## 3. Objectives & testing scope

**In scope**: `/api/v1` contract (auth, sessions, projects, members/roles, tasks,
status machine, comments, activity, overdue report), SQLite integrity and persistence,
the console's journeys, error semantics, input safety and a local performance baseline.

**Out of scope (documented, not silently skipped)**: rate limiting, CSRF tokens, MFA,
password reset, file uploads, unarchive, webhooks, multi-node/TLS deployment, non-Chromium
browsers, production-scale load. See `test-documentation/risk-assessment.md`.

## 4. Architecture & stack

```
┌──────────────────────────┐        ┌───────────────────────────────────────────┐
│  Vanilla-JS console      │ fetch  │  Express 4 API  (/api/v1)                 │
│  app/public (no build)   ├───────►│  routes/*.js · middleware/* · lib/*.js    │
│  data-testid everywhere  │ cookie │  zod validation · object-level authz       │
└──────────────────────────┘        └───────────────┬───────────────────────────┘
                                                    │ node:sqlite (DatabaseSync)
                                    ┌───────────────▼───────────────────────────┐
                                    │  SQLite file DB                           │
                                    │  users · sessions · projects · members    │
                                    │  tasks · comments · activity              │
                                    └───────────────────────────────────────────┘

Test stack: @playwright/test (API + UI) · newman (Postman) · autocannon (perf)
            node:sqlite scripts (SQL checks) · eslint (js) — one `npm install`
```

Runtime deps: `express`, `zod`. Dev deps: `@playwright/test`, `newman`, `autocannon`,
`eslint`, `globals`, `@eslint/js`. Node ≥ 22.5 (built on v24). Port 4300.

## 5. Features under test

- **Auth**: register/login/logout/me, scrypt+salt hashing, signed opaque session
  cookie (HttpOnly, SameSite=Lax, 8 h), password policy (10+, upper/lower/digit).
- **Projects**: creation with `^[A-Z]{2,6}$` unique keys, rename, archive, owner-only
  delete, ownership transfer, archived = read-only (mutations 422).
- **Members**: OWNER > ADMIN > MEMBER, add/duplicate/unknown, role changes, last-admin
  guard, owner protection, self-leave after transfer.
- **Tasks**: strict validation (title 3–120 trimmed, description ≤ 2000, enum priority,
  estimates 0.5–100 in 0.5 steps), assignment restricted to members, calendar-true due
  dates never before creation, computed `overdue`/`comment_count`.
- **Workflow**: linear TODO→IN_PROGRESS→IN_REVIEW→DONE, CANCELED hatch, terminal
  states, skip rejects (422), unknown values (400), same-status no-op (200, no activity).
- **Collaboration**: comments (1–1000, trimmed), activity feed with JSON details for
  every create/update/status/comment, paginated feeds.
- **Retrieval**: pagination (page ≥ 1, limit 1–100, X-Total-Count, empty out-of-range
  pages), filters (status, priority, assignee, q with LIKE-escaping, dueBefore, overdue),
  whitelisted sorting.
- **Reports**: overdue across the caller's active projects, archived excluded, due-today
  excluded.
- **Console**: login, project switcher, five-column board, create/edit modal with
  status control, comments, activity, filters, pagination, aria-live error banners,
  keyboard-operable modal.

## 6. Requirements & acceptance criteria

20 requirements (`TASK-REQ-001..020`) with 60 acceptance criteria — full text in
`test-documentation/requirements.md` and `acceptance-criteria.md`, machine-readable
in `test-data/tests/requirements.mjs`. Every requirement maps to executed test cases in
`test-documentation/traceability-matrix.csv` (currently **20/20 Verified**).

## 7. Test strategy

Layered, risk-based and evidence-first: API contract tests carry the functional and
authorization load; SQL checks guard integrity and API↔SQL parity; the UI suite covers
top journeys plus a negative validation flow; scripted manual cases cover injection,
IDOR, payload edges and session expiry; a seeded-defect demo proves the suites fail
when behaviour regresses. Details: `test-documentation/test-strategy.md` and
`test-plan.md`.

## 8. Test case organisation

- **Single source of truth**: `test-data/tests/*.mjs` (requirements, 67 cases,
  4 exploratory charters).
- **IDs**: cases `TASK-TC-001..048` (API), `101..110` (UI), `201..205` (database),
  `301..304` (manual/exploratory); defects `TASK-BUG-nnn`; seeded `SEEDED-nnn`.
- **Generated artifacts**: `test-cases.csv` (16 columns, RFC-4180) and
  `traceability-matrix.csv`. Test titles embed case ids, so `Status`, `ActualResult`
  and `EvidenceLink` are filled **only from real report files** — a case without
  evidence would export as `Not Executed` with an empty actual result.

## 9. API testing approach

48 Playwright `APIRequestContext` tests in `tests/api/` (auth, projects, members,
tasks, status, comments, activity, pagination/filter/sort, isolation, reports,
security, persistence). Each test uses isolated contexts per persona; mutating tests
create their own projects with collision-proof keys; overdue expectations are derived
from the API at runtime so UTC-midnight rollover cannot flake the suite. The Postman
collection (run by `newman` with a cookie jar) replays one ordered lifecycle with
assertions, including the 401/403/404/409/422 negatives and cleanup. Endpoint-by-endpoint
documentation with curl examples: `test-documentation/api-reference.md`.

## 10. UI automation approach

10 Chromium tests in `tests/ui/` drive the real console with `data-testid` hooks only,
no `waitForTimeout` (web-first assertions + `expect.poll`). Coverage: login/logout,
board columns & pagination, create via modal, status change, comments, validation
banner, permission-hidden action vs server-side 403, overdue filter, keyboard/ARIA
modal behaviour and stored-markup-as-text. Details: `test-documentation/ui-automation.md`.

## 11. Database testing approach

22 checks in `tests/db/` (run via `npm run test:db`): UNIQUE/FK/CHECK constraint
rejection (rolled-back probes), orphan detection, one-OWNER-per-project consistency,
activity completeness (`TASK_CREATED`, transition history for DONE/CANCELED, valid
`detail_json`), archived exclusion and the due-today boundary, API↔SQL count parity for
tasks/comments/report, and persistence across reconnects. Details:
`test-documentation/database-testing.md`, raw results in `test-reports/db-results.json`.

## 12. Install & run the application

```bash
npm install
npm run db:reset        # delete + recreate + seed app/server/data/taskflow.db
npm start               # http://127.0.0.1:4300  (console + API)
# optional: npm run dev  (watch mode)   ·   copy .env.example to .env to override PORT/DB_PATH/...
```

`npm start` on an empty database seeds it automatically so the console is immediately
usable. `.env.example` documents `PORT`, `DB_PATH`, `NODE_ENV`, `APP_SECRET`,
`SEED_DEFECTS` and the demo credentials.

## 13. Run each test suite (exact commands)

```bash
npm run lint            # eslint over app/, scripts/, tests/db + config (TS specs: Playwright-transpiled)
npm run test:api        # 48 Playwright API tests   (starts its own server + fresh test DB)
npm run test:ui         # 10 Playwright UI tests
npm run test:db         # 22 SQL validation checks
npm run test:postman    # newman lifecycle (48 requests / 50 assertions)
npm run test:perf       # autocannon baseline -> test-reports/performance-baseline.{json,md}
npm run manual:cases    # scripted manual cases 301-304 (30 probes) -> test-evidence/logs/
npm run seeded:demo     # SEED_DEFECTS=1 detection run -> test-evidence/seeded-defects/
npm run screenshots     # real screenshots -> test-evidence/screenshots/ (JPEG q70)
npm run test:all        # orchestrator: reset -> server -> API -> UI -> DB -> Postman -> report
npm run test:smoke      # @smoke subset    ·  npm run test:regression  # @regression subset
npm run docs:csv        # regenerate test-cases.csv + traceability-matrix.csv
npm run docs:report     # regenerate summary.json + execution report
```

Note: stop `npm run dev` before running suites — the Playwright server reuses port 4300
by design (so `test:all` and standalone runs behave identically).

## 14. Where reports live

| Artifact | Path |
|----------|------|
| Machine summary | `test-reports/summary.json` |
| Execution report (generated) | `test-reports/execution-report-<date>.md` (+ copy in `test-documentation/execution-report.md`) |
| Raw Playwright reports | `test-reports/playwright/{api,ui}.json`, HTML in `playwright-report/` |
| SQL checks | `test-reports/db-results.json` |
| Postman/newman | `test-reports/newman/newman-summary.json` (+ full report) |
| Performance | `test-reports/performance-baseline.{json,md}` |
| Manual run | `test-evidence/logs/manual-results.json`, `manual-cases.txt` |
| Seeded defects | `test-evidence/seeded-defects/detection-run.{json,txt}` |
| Screenshots | `test-evidence/screenshots/*.jpg` |
| Raw command logs | `test-evidence/logs/*.txt` |

## 15. Actual execution results

**Executed 2026-10-14** (Windows 11, Node v24.21.0, commit `9b6fc8a`) — all numbers
below come from the raw report files generated by the final `npm run test:all` run.

| Suite | Command | Result |
|-------|---------|--------|
| API (Playwright) | `npm run test:api` | **48 / 48 passed** (0 failed, 47.1 s) |
| UI (Playwright) | `npm run test:ui` | **10 / 10 passed** (0 failed, 10.0 s) |
| Database (SQL checks) | `npm run test:db` | **22 / 22 checks passed** |
| Postman (newman) | `npm run test:postman` | **48 requests, 50 / 50 assertions passed** (8.0 s) |
| Manual/exploratory | `npm run manual:cases` | **4 / 4 cases passed** (30 probes) |
| Seeded-defect demo | `npm run seeded:demo` | **2 / 2 seeded defects detected** (baseline vs defect run) |
| Performance baseline | `npm run test:perf` | health **8 803 req/s avg** (p50 1 ms, p99 2 ms, 0 errors); authenticated task list **1 470 req/s avg** (p50 6 ms, p99 10 ms, 0 errors) — 10 connections, 5 s, loopback, **not production capacity** |
| Screenshots | `npm run screenshots` | 9 JPEGs (1440×900 and 390×844) captured from the running app |

**Totals from the orchestrator:** 134 checks executed, **134 passed, 0 failed**.
Manual test-case export: **67 cases — 67 Pass, 0 Fail, 0 Not Executed**;
traceability: **20 requirements Verified**.

Defects: **6 real defects found, fixed and retested** (see §16 and
`test-documentation/defect-log.csv`), plus **2 labelled SEEDED defects** behind
`SEED_DEFECTS=1` with a reproducible detection run.

## 16. Known issues & limitations

Real defects found and fixed during this build (all Closed with passing retests):

| ID | Defect | Fixed by |
|----|--------|----------|
| TASK-BUG-001 | `/reports/overdue` returned 500 (missing assignee join) | added the join in the rows query |
| TASK-BUG-002 | Seed due-date offsets were sign-inverted | `seedDate(-dueDays)`; fixture verified 3 overdue + 1 due-today |
| TASK-BUG-003 | `GET /projects` returned empty `data` (duplicate bind parameter silently NULLed the WHERE) | removed the duplicated user filter |
| TASK-BUG-004 | Console served from the wrong static directory (404 on `/`) | corrected `PUBLIC_DIR` |
| TASK-BUG-005 | CSS `display` rules defeated the `hidden` attribute → invisible modal backdrop swallowed all clicks | global `[hidden] { display: none !important; }` |
| TASK-BUG-006 | Error banner rendered under the modal backdrop (dismiss unreachable) | banner raised above the backdrop |

Open limitations (accepted/documented, not defects against any requirement):

- No rate limiting / account lockout; no CSRF token; no CSP or security headers
  (`NODE_ENV=production` adds the `Secure` cookie flag but TLS itself is untested).
- No 405 mapping: unsupported methods on known paths fall through to 404.
- Schema is create-if-not-exists; structural changes require `npm run db:reset`.
- SQLite single-writer: concurrency beyond one Node process is untested; no WAL/backup tests.
- Chromium-only UI automation; no axe-core audit (dependency allow-list).
- Performance numbers are a local loopback baseline with a single process — explicitly
  not a capacity claim.

## 17. Screenshots & evidence

`test-evidence/screenshots/` — captured from the running app (never mock-ups):
login, board with tasks, task modal, comments, overdue filter and validation banner at
1440×900, plus login/board/task-modal at 390×844 (JPEG quality 70).
`test-evidence/logs/` holds raw command output for every execution above;
`test-evidence/seeded-defects/` holds the detection-run evidence.

## 18. Future improvements

- Rate limiting + lockout and security headers (the top accepted risks).
- Soak/concurrency test around the SQLite writer; WAL mode and backup/restore checks.
- Cross-browser project for the UI suite; axe-core accessibility scan.
- Session rotation on privilege change; CSRF token if the API ever accepts form posts.
- CI workflow (lint → test:all → upload reports) once a runner is available.

---

### Known deviations from PROJECT-STANDARD.md

- `npm run lint` intentionally does not cover `tests/api/*.spec.ts` /
  `tests/ui/*.spec.ts` / `playwright.config.ts`: the dependency allow-list contains no
  TypeScript ESLint parser, and Playwright transpiles those files itself. `eslint .`
  therefore lints all JavaScript/ESM sources (app, scripts, `tests/db`).
- `docs:screenshots` produces JPEG (quality 70) rather than PNG so both required
  viewports stay small enough to commit; the standard allows `*.png|jpg`.
- One API endpoint (`POST /projects/:id/transfer`) is an addition beyond the minimum
  endpoint list in the brief — it is required to satisfy the documented ownership-transfer
  rule and is fully covered by tests.
