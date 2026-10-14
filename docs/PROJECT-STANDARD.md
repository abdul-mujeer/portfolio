# PROJECT-STANDARD.md — Shared contract for the three QA portfolio projects

Every project under `projects/` MUST follow this contract so the three packages look and behave like
one professional QA portfolio. Deviations are allowed only when documented in the project README
under "Known deviations".

> Golden rule: **never fabricate a test result.** If a suite cannot be executed, write
> `NOT EXECUTED` plus the exact command to reproduce it, and record the blocker.

---

## 1. Folder structure (exact)

```
projects/<project>-qa/
  README.md                     # 18-point structure, section 9 of this document
  package.json                  # single package for app + tests (one npm install)
  package-lock.json             # committed
  .env.example                  # placeholders only, no secrets
  eslint.config.mjs             # eslint + globals + @eslint/js, ignores generated output
  playwright.config.ts          # testDir 'tests', trace/screenshot on failure, JSON reporter
  app/
    server/                     # Express + node:sqlite API
      src/index.js              # http server bootstrap + static hosting
      src/app.js                # express app factory (testable, no listen)
      src/db.js                 # connection, schema, migrations
      src/seed.js               # deterministic synthetic seed data
      src/routes/*.js           # one router per resource
      src/middleware/*.js       # auth, roles, validation, error handler
      src/lib/*.js              # password hashing, ids, helpers
    web/                        # (ShopSure only) React+Vite TS SPA
    views/                      # (PeopleCore only) EJS templates
    public/                     # static assets / minimal console (TaskFlow)
  postman/
    <Name>-API.postman_collection.json
    <Name>-Env.postman_environment.template.json   # placeholders: {{baseUrl}}, {{token}} ...
  test-data/
    seed/*.json                 # static fixtures used by seed + API tests
    tests/*.mjs                 # SINGLE SOURCE OF TRUTH for manual test cases
  tests/
    api/*.spec.ts               # Playwright request tests
    ui/*.spec.ts                # Playwright browser tests
    db/*.mjs                    # SQL validation scripts (node:sqlite)
  scripts/
    reset-db.mjs                # drop + recreate + seed (honours DB_PATH)
    run-tests.mjs               # orchestrates: reset db → start server → suites → stop
    screenshots.mjs             # Playwright-driven screenshots into test-evidence/screenshots
    newman-run.mjs              # boots server, runs Postman collection via newman lib, saves JSON
    docs/generate-csv.mjs       # test-data/tests/*.mjs → test-documentation/*.csv
    reports/build-report.mjs    # results → test-reports/summary.json + execution report
  test-documentation/
    requirements.md  acceptance-criteria.md  test-strategy.md  test-plan.md
    test-scenarios.md  test-cases.csv  traceability-matrix.csv
    bug-report-template.md  defect-log.csv  execution-report.md
    exploratory-testing.md  risk-assessment.md  api-test-plan.md
    database-testing.md  ui-automation.md  interview-preparation.md
    seeded-defects.md
  test-evidence/
    screenshots/*.png|jpg       # captured from the RUNNING app (never mockups)
    logs/*.txt                  # raw command output of executions
  test-reports/
    summary.json                # machine readable: suites, counts, timestamps, git commit
    execution-report-<YYYY-MM-DD>.md
    playwright/                 # json + html reporter output
```

## 2. package.json script contract

| Script | Requirement |
|--------|-------------|
| `seed` | reset DB + insert deterministic synthetic data |
| `db:reset` | delete DB file, recreate schema, seed |
| `start` | production boot: serve API (+ built assets). Reads `PORT`, `DB_PATH`, `APP_SECRET` |
| `dev` | local development boot (watch if practical) |
| `build` | required only when the project has a build step (ShopSure web) |
| `lint` | eslint over `app`, `tests`, `scripts` (no generated folders) |
| `test:api` | Playwright API suite |
| `test:ui` | Playwright UI suite (starts its own servers if needed) |
| `test:db` | SQL validation suite (exits non-zero on failure) |
| `test:postman` | newman run of the committed collection |
| `test:smoke` | `@smoke`-tagged subset |
| `test:regression` | `@regression`-tagged subset |
| `test:all` | orchestrated full run → results in `test-reports/` |
| `screenshots` | capture evidence screenshots into `test-evidence/screenshots/` |
| `docs:csv` | regenerate CSVs from `test-data/tests/*.mjs` |
| `docs:report` | regenerate execution report from latest raw results |

Ports: ShopSure **4100**, PeopleCore **4200**, TaskFlow **4300**.
Environment variables: `PORT`, `DB_PATH`, `NODE_ENV`, `APP_SECRET`, `SEED_DEFECTS` (`0` default).
`.env` is never committed; `.env.example` documents every variable.

## 3. Technology rules

- Node.js ≥ 20 ESM (`"type": "module"`), Express 4, **`node:sqlite`** (`DatabaseSync`) — no native deps.
- Validation with `zod`; errors never leak stack traces to clients.
- Passwords: `node:crypto` `scrypt` + per-user random salt; sessions: opaque random token stored in
  `sessions` table, delivered as `HttpOnly; SameSite=Lax` cookie (`Secure` when `NODE_ENV=production`).
- **All** authorization enforced server-side. UI hiding is never the control.
- SQL is always parameterized. No string concatenation of user input into SQL.
- IDs are integers or `PREFIX-0001` strings, stable across seeds.
- Deterministic seed data: same IDs/values on every reset (no `Math.random()` without a fixed seed).
- HTTP conventions: `200/201/204` success, `400` validation, `401` unauthenticated, `403`
  forbidden/role failure, `404` not found, `409` conflict (duplicate), `422` business-rule violation.
  Error envelope: `{ "error": { "code": "STRING_CODE", "message": "human readable", "details": [...] } }`.
  List endpoints return `X-Total-Count` and support `page` (1-based) + `limit` (1..100, default 20).
- Dates: ISO-8601 strings in UTC, `YYYY-MM-DD` for date-only fields. Reject invalid calendar dates.

## 4. Synthetic data rules

- Only synthetic people/products: reserved example domains (`example.com`), fictional names.
- Passwords in seed data are documented demo credentials (e.g. `Admin#12345`) — they are not secrets
  and `.env.example` must say so.
- Never commit `*.db`, dumps or `node_modules`.

## 5. Manual test-case standard

- 40–70 meaningful cases per project. Quality over quantity; every case must be executable by hand.
- IDs: `<PREFIX>-TC-nnn` where PREFIX ∈ {SHOP, HR, TASK}; requirements `<PREFIX>-REQ-nnn`;
  defects `<PREFIX>-BUG-nnn`. Prefixes must match across requirements, cases, defects, traceability.
- Types: Functional, Negative, Boundary, Validation, Integration, Regression, Smoke, Security,
  Usability/Accessibility, API, Database, Exploratory.
- CSV columns (exact order, header row, RFC-4180 quoting):
  `TestCaseID,RequirementID,Module,Scenario,Preconditions,TestData,Steps,ExpectedResult,ActualResult,Status,Priority,TestType,Environment,DefectID,EvidenceLink,Notes`
- `Status` ∈ {Pass, Fail, Blocked, Not Executed}. `ActualResult`/`EvidenceLink` are filled ONLY from
  real executions; `Not Executed` cases keep them empty and get a reason in `Notes`.
- Traceability matrix CSV columns:
  `RequirementID,RequirementSummary,AcceptanceCriteriaIDs,TestCases,CoverageStatus,Notes`
- Defect log CSV columns:
  `DefectID,Title,Module,Severity,Priority,Status,Type,Environment,Build,StepsToReproduce,ExpectedResult,ActualResult,DetectedBy,DetectedOn,TestCaseID,Evidence,RootCause,RetestResult,RegressionResult,ClosedOn,Rationale`
  — use `SEEDED` in the Type or Notes column for deliberately injected defects.

## 6. Automation standard

- `@playwright/test` for UI **and** API suites (`request` fixture / `APIRequestContext`).
- Tag critical paths `@smoke`, regression set `@regression` in the test title.
- No `waitForTimeout`; rely on web-first assertions and selectors that are stable
  (`data-testid` attributes are provided by the apps for this purpose).
- Tests must be independent and repeatable: each run resets the DB to a known state.
- API tests cover: happy path, missing/invalid fields, type errors, unknown IDs, authn/authz
  boundaries, duplicates/conflicts, pagination and filtering edges, state transitions, persistence.
- UI tests cover the top user journeys plus at least one negative/validation flow.
- Traces + screenshots on failure, JSON report always, HTML report for humans.
- Postman collection must be runnable by `newman` with the environment template only (no secrets).

## 7. Evidence and reporting standard

- `scripts/run-tests.mjs` is the only entry point CI uses. It must:
  1. reset + seed the test DB (`DB_PATH=.data/<app>.test.db`),
  2. start the server on a test port, wait for `/api/health`,
  3. run API, UI, DB and Postman suites (each result captured),
  4. stop the server reliably (also on failure),
  5. write `test-reports/summary.json` (per-suite executed/passed/failed/skipped counts, timestamps,
     git commit, node version) and `test-reports/execution-report-<date>.md`.
- Save raw logs of executive commands in `test-evidence/logs/`.
- The execution report must contain: environment, per-suite counts, defect summary, requirement
  coverage, risk assessment, release recommendation, known limitations — all derived from real results.
- Seeded defects: `SEED_DEFECTS=1` enables documented bugs (see `seeded-defects.md`). There must be a
  reproducible command that demonstrates detection and saves evidence under
  `test-evidence/seeded-defects/`. Default runs are clean. Seeded defects are always labelled SEEDED.

## 8. Security / privacy standard

- No secrets, tokens or real personal data in the repo. `.env.example` only.
- Do not commit DB files, coverage output, `playwright-report/`, `test-results/`, `dist/`.
- Document any security check that could not be performed.
- Refuse and document: no destructive or load testing against third-party/public systems.

## 9. README structure (18 sections, same order in all three projects)

1. Project overview · 2. Business problem · 3. Objectives & testing scope · 4. Architecture & stack
(diagram) · 5. Features under test · 6. Requirements & acceptance criteria · 7. Test strategy ·
8. Test case organisation · 9. API testing approach · 10. UI automation approach · 11. Database
testing approach · 12. Install & run the application · 13. Run each test suite (exact commands) ·
14. Where reports live · 15. Actual execution results (date + counts, or NOT EXECUTED) · 16. Known
issues & limitations · 17. Screenshots & evidence · 18. Future improvements.

## 10. Definition of done per project

- [ ] App runs locally with documented commands; demo credentials in README.
- [ ] Seed data deterministic; `npm run db:reset` restores known state.
- [ ] 40–70 manual cases in CSV generated from `test-data/tests/*.mjs`, IDs consistent.
- [ ] Traceability matrix maps every requirement → cases.
- [ ] Postman collection + env template committed and executed via newman (evidence saved).
- [ ] Playwright API + UI suites pass; failures fixed or reported.
- [ ] DB validation scripts pass.
- [ ] Screenshots captured from the running app and committed.
- [ ] `test-reports/summary.json` + execution report with REAL numbers.
- [ ] README complete (18 sections), `interview-preparation.md` + `seeded-defects.md` present.
- [ ] `npm run lint` clean; `git status` shows no secrets/db/artifacts.
