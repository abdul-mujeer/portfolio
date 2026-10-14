# ShopSure — Test Execution Report

> Generated automatically by `npm run docs:report` from the raw outputs of executed suites.
> Nothing in this report is estimated: every number is read from a result file.

- **Date/time:** 2026-10-13T23:59:57.707Z
- **Commit:** `1f9605a`
- **Node:** v24.21.0 · **Platform:** win32
- **Target:** ShopSure demo store (Express + SQLite + React), seeded synthetic data, port 4100 (tests: 4180)

## 1. Automated results

| Suite | Executed | Total | Passed | Failed | Skipped/flaky | Duration |
|-------|----------|-------|--------|--------|---------------|----------|
| Playwright API | yes | 72 | 72 | 0 | 0 skipped / 0 flaky | 45.6s |
| Playwright UI | yes | 31 | 31 | 0 | 0 skipped / 0 flaky | 34.9s |
| SQL database checks | yes | 23 | 23 | 0 | - | - |
| Postman (Newman) | yes | 76 assertions | 76 | 0 | 35 requests | 5.3s |

**All executed automated checks passed.**

## 2. Manual test execution

| Metric | Value |
|--------|-------|
| Documented manual test cases | 101 |
| Status: Pass | 99 |
| Status: Not Executed | 2 |

Manual cases and their exact CSV location are listed in `test-documentation/test-cases.csv`.

## 3. Requirement coverage

| Metric | Value |
|--------|-------|
| Requirements in traceability matrix | 24 |
| Fully covered by test cases | 24 (100%) |

## 4. Defects

| Metric | Value |
|--------|-------|
| Logged defects | 6 |
| Closed / verified | 6 |
| Open | 0 |
| Deliberately seeded (labelled SEEDED) | 3 |

Defect details: `test-documentation/defect-log.csv`.

## 5. Risk assessment (evidence-based)

- Authentication, cart limits, pricing boundaries, stock handling, order transitions and RBAC are
  covered by automated API and UI tests and are **stable** in this run.
- Database constraints were validated directly with SQL (uniqueness, CHECK constraints, referential
  integrity, pricing consistency, audit trail).
- Residual risk is concentrated in areas outside the automated scope: real payment integration,
  multi-session race conditions under real concurrency, e-mail delivery and browser-specific rendering
  beyond Chromium. See `test-documentation/risk-assessment.md`.

## 6. Release readiness recommendation

**Recommendation: READY for the demo/release gate.** All executed automated suites passed and every documented requirement is traced to at least one test case. Outstanding seeded defects (if any) are intentional and labelled.

## 7. Known limitations

- Postman/Newman runs a single iteration (no data-driven iterations) — deliberate, for reliable CI.
- UI automation runs on Chromium only; Firefox/WebKit are not installed in this environment.
- Manual exploratory charters are documented but their sessions were performed manually (see
  `test-documentation/exploratory-testing.md` for actual notes).
- The repository's CI workflow must have run successfully before any badge is displayed as passing.
