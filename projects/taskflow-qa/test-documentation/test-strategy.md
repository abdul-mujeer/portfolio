# TaskFlow API — Test Strategy

## 1. Approach

Risk-based, layered testing of an API-first service. Because the product's contract is
HTTP + SQL, most coverage sits at the API and database layers, supported by a thin
end-to-end UI layer for the console and a scripted manual/exploratory layer for
security and usability concerns that are awkward to encode as regression tests.

| Layer | Tooling | Location | Purpose |
|-------|---------|----------|---------|
| API acceptance | Playwright `request` (48 tests, 12 files) | `tests/api/` | Contract, validation, authn/authz, workflow, isolation, pagination, reports |
| UI end-to-end | Playwright Chromium (10 tests, 3 files) | `tests/ui/` | Console journeys, error surfacing, permission hiding, accessibility, XSS-as-text |
| SQL validation | `node:sqlite` scripts (22 checks, 2 modules) | `tests/db/` | Constraints, FK integrity, orphans, activity completeness, API↔SQL parity |
| Postman lifecycle | newman (48 requests / 50 assertions) | `postman/` | Cross-feature lifecycle with a cookie jar, runnable by hand in Postman too |
| Manual/exploratory | scripted manual run (`npm run manual:cases`) | `scripts/manual-cases.mjs` | Injection, IDOR sweep, payload edges, unicode, session expiry |
| Performance baseline | autocannon (10 conn / 5 s) | `scripts/perf/` | Local regression baseline, explicitly not a capacity claim |
| Seeded-defect demo | `SEED_DEFECTS=1` probes | `scripts/seeded-defects-demo.mjs` | Proves the suites detect known injected bugs |

## 2. Test design techniques

- **Equivalence partitioning** for enums (status, priority, role).
- **Boundary value analysis** for lengths (title 3/120/121, description 2000/2001,
  comment 1/1000/1001), pagination (limit 0/1/100/101, page 0/99) and estimates
  (0.25/0.5/100/100.5, 0.5 steps).
- **State-transition testing** for the entire status machine including terminal
  states, skipped jumps and no-op transitions.
- **Decision tables** for the permission matrix (role × action × ownership) —
  see `permission-matrix.md`.
- **Error guessing** for date handling (2026-02-30, leap years, due-today, UTC
  midnight rollover), duplicate operations and archived-state interactions.
- **Exploratory sessions** (charters in `test-data/tests/exploratory-charters.mjs`)
  with findings recorded in `exploratory-testing.md`.

## 3. Environments and data

- Node.js 24 on Windows; single Express process on port 4300.
- Application demo DB: `app/server/data/taskflow.db` (`npm run db:reset`).
- Suites always run against `.data/taskflow.test.db`, recreated from the deterministic
  fixtures in `test-data/seed/*.json` before each suite (orchestrated by
  `scripts/run-tests.mjs` / the Playwright `webServer`).
- Seed fixtures are deterministic in IDs and values; date offsets are relative to the
  reset day (3 overdue, 1 due today), and suites derive overdue expectations from the
  API itself so a UTC-day rollover between reset and assertions cannot flake them.

## 4. Entry / exit criteria

**Entry:** app boots, `npm run db:reset` succeeds, lint is clean.
**Exit (all must hold):** API, UI and DB suites green; Postman collection green via
newman; no open defects above Medium; traceability matrix regenerated and every
requirement marked Verified; execution report generated from raw results.

## 5. Traceability and evidence

- `test-data/tests/requirements.mjs` + `test-cases.mjs` are the single source of truth.
- Test titles embed `TASK-TC-nnn`, so `scripts/docs/generate-csv.mjs` can fill
  `Status`/`ActualResult`/`EvidenceLink` from real report files only.
- Raw outputs: `test-reports/` (JSON summaries) and `test-evidence/logs/` (console logs).

## 6. What is deliberately NOT tested here

Production-scale load, multi-node deployments, TLS termination, real email delivery,
browser matrix (Chromium only), mobile native shells. These are documented as risks in
`risk-assessment.md` rather than silently omitted.
