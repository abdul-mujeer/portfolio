# PeopleCore HRMS — test strategy

## 1 · Purpose

Define *how* PeopleCore is tested, which risks drive the effort and what evidence a
release needs. The application is a role-based HRMS, so the strategy is weighted towards
**authorization, business rules and data integrity**, not towards volume of test cases.

## 2 · Test basis

| Source | What it provides |
|---|---|
| `test-data/tests/requirements.mjs` | 16 requirements (`HR-REQ-001`…`HR-REQ-016`) with 48 acceptance criteria (`HR-AC-001`…`HR-AC-048`) — the single source of truth |
| `test-data/tests/test-cases.mjs` | 69 manual test cases (`HR-TC-001`…`HR-TC-069`) derived from the acceptance criteria |
| `test-data/tests/permissions.mjs` | 24 capability rows × 4 roles — the role permission matrix |
| `test-data/tests/exploratory.mjs` | 6 exploratory charters (all executed) |
| `app/server/src/*` | Implementation: zod schemas, scope helpers, SQLite schema with CHECK/FK/UNIQUE constraints |
| `docs/PROJECT-STANDARD.md` | Portfolio-wide contract for structure, tooling and evidence |

## 3 · Risk-based priorities

| Priority | Meaning | Examples |
|---|---|---|
| **P1** | Wrong behaviour breaks the product's promise or leaks data | authorization, authentication, employee/leave workflows, audit integrity |
| **P2** | Wrong behaviour blocks a workflow or corrupts data | attendance rules, cancellation, department management, UI validation |
| **P3** | Wrong behaviour is annoying or cosmetic | sorting defaults, responsive layout, screen-reader structure |

## 4 · Test levels and types

| Level | Tooling | Scope |
|---|---|---|
| SQL validation | `tests/db/*.mjs` (node:sqlite) | schema constraints, seed determinism, orphan checks, referential integrity after negative API calls |
| API | `tests/api/*.spec.ts` (Playwright request contexts) | every endpoint, status codes, payload validation, scoping, pagination, workflow transitions |
| UI | `tests/ui/*.spec.ts` (Playwright + Chromium) | top journeys, inline validation, empty states, role-aware rendering, 403/404 pages |
| Contract/collection | `postman/PeopleCore-API.postman_collection.json` executed by newman | a tool-independent end-to-end flow that also serves as a demo artifact |
| Exploratory | charters in `test-data/tests/exploratory.mjs` | attacks that no script encodes (scope abuse, session abuse, workflow abuse) |
| Performance baseline | `scripts/perf-baseline.mjs` (autocannon) | local indicator for latency/throughput of the three main reads |

## 5 · Test design techniques

- **Boundary value analysis** — salary (0 · 1,000,000 · 1,000,001 · 2 vs 3 decimals), leave
  (1 · 30 · 31 days), reason length (9/10 and 500/501), pagination (1 · 100 · 101), dates
  (1990-01-01, today, today+1, impossible calendar dates), login attempts (5).
- **Equivalence partitioning** — statuses (`ACTIVE`/`ON_LEAVE`/`TERMINATED`), leave statuses,
  attendance statuses, four roles.
- **Decision tables** — the role × capability matrix (see `role-permission-matrix.md`).
- **State transition testing** — leave lifecycle `PENDING → APPROVED|REJECTED|CANCELLED`,
  with every illegal transition asserted (422) and legal-but-forbidden transitions (403).
- **Negative/abuse testing** — direct API access with under-privileged sessions, foreign ids,
  stale sessions of terminated accounts, unknown enums, extra fields, wrong types.
- **Data-oriented testing** — SQL assertions on the file that the API produced.

## 6 · Entry and exit criteria

**Entry:** `npm run db:reset` succeeds, `npm run lint` is clean, `npm run test:api` green on a
clean checkout (proves the environment, not the feature).

**Exit (per run):**

1. All executed suites green (SQL, API, UI, Postman) or every failure documented with a defect entry.
2. `test-reports/summary.json` + the execution report written from real artefacts.
3. Every P1 requirement has at least one executed test case; deviations recorded.
4. Seeded defects provably detected with `SEED_DEFECTS=1` and absent with `SEED_DEFECTS=0`.
5. Any suite that could not be executed is reported as `NOT EXECUTED` with the exact command.

## 7 · Environment matrix

| Suite | Database | Port | Notes |
|---|---|---|---|
| `npm run dev` / `npm run start` | `app/server/data/peoplecore.db` | 4200 | development database |
| `test:api`, `test:ui`, `test:smoke`, `test:regression` | `.data/peoplecore.test.db` | 4200 | reset + seeded by the Playwright `webServer` entry |
| `test:db` | `.data/db-checks/*.db` | – | one private copy per check |
| `test:postman` | `.data/peoplecore.newman.db` | 4210 | newman cookie/token session |
| `test:perf` | `.data/peoplecore.perf.db` | 4230 | autocannon |
| `screenshots` | `.data/peoplecore.screenshots.db` | 4220 | evidence capture |
| `seeded:evidence` | `.data/peoplecore.seeded.db` | 4240 | `SEED_DEFECTS=1` detection run |

## 8 · What this strategy deliberately does *not* do

- No production-like load test (single process, local file, no capacity claims).
- No penetration test beyond the documented BOLA/BFLA, session and injection-adjacent checks.
- No cross-browser or screen-reader execution in this environment — recorded as Not Executed.
- No mutation testing or code coverage tooling; coverage is expressed as requirement coverage
  (`traceability-matrix.csv`), which is what a QA portfolio should be judged on.
