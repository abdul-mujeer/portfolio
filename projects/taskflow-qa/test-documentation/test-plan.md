# TaskFlow API — Test Plan

## 1. Scope

In scope: REST API `/api/v1` (auth, projects, members, tasks, status workflow,
comments, activity, reports), the SQLite persistence layer and the vanilla-JS console
at `/`.

Out of scope: any third-party system, production infrastructure, real personal data.

## 2. Deliverables

| Deliverable | Location |
|-------------|----------|
| Manual test cases (67) | `test-documentation/test-cases.csv` (generated) |
| Traceability matrix (20 requirements) | `test-documentation/traceability-matrix.csv` (generated) |
| Playwright API + UI suites | `tests/api/`, `tests/ui/` |
| SQL validation suite | `tests/db/` |
| Postman collection + env template | `postman/` |
| Performance baseline | `test-reports/performance-baseline.{json,md}` |
| Execution report + summary | `test-reports/execution-report-<date>.md`, `summary.json` |
| Evidence | `test-evidence/` (logs, screenshots, seeded-defect run) |
| Defects | `test-documentation/defect-log.csv` |

## 3. Test data

Deterministic seed (`test-data/seed/*.json`): 5 users, 3 projects (TASK active,
OPS active, ARCH archived), 8 memberships, 18 tasks (3 overdue, 1 due today),
12 comments, 51 activity rows. Demo credentials are documented in the README and
`.env.example`; the data is entirely synthetic (`example.com`).

## 4. Schedule / execution order

1. `npm run db:reset` (demo DB) — quick app sanity.
2. `npm run test:api` → API contract + authz + isolation (48 tests).
3. `npm run test:ui` → console journeys (10 tests).
4. `npm run test:db` → SQL validation on the suite-generated state (22 checks).
5. `npm run test:postman` → newman lifecycle (48 requests, 50 assertions).
6. `npm run test:perf` → autocannon baseline (2 targets, 5 s each).
7. `npm run manual:cases` → scripted manual execution (4 cases, 30 probes).
8. `npm run seeded:demo` → labelled seeded-defect detection (2 detections).
9. `npm run screenshots` → evidence images.
10. `npm run test:all` → orchestrator: reset → server → suites → report.

## 5. Roles and responsibilities

Single-engineer portfolio build working as its own QA function: test design (this
package), implementation, execution, defect recording, retest and reporting.

## 6. Risks to the plan and mitigations

| Risk | Mitigation |
|------|------------|
| Date-dependent seed assertions flake across UTC midnight | Expectations derived from the API at runtime; dynamic SQL checks |
| Shared test DB state between suites | Orchestrator resets before running; checks are state-agnostic (parity-based) |
| Port 4300 already in use by the dev server | Documented: stop `npm run dev` before suites; reuse is intentional for the orchestrator |
| Seeded defects leaking into normal runs | `SEED_DEFECTS` defaults to 0 everywhere; demo uses its own DB file |
| No CI runner in this environment | Everything runs locally and deterministically; raw logs committed |
