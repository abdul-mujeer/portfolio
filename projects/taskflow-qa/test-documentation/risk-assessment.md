# TaskFlow API — Risk Assessment

Companion to `test-reports/execution-report-<date>.md`. Likelihood/impact scored
Low/Medium/High; the residual column reflects the state **after** the executed suites
and the six fixes recorded in `defect-log.csv`.

## Product / quality risks

| # | Risk | L | I | Residual | Evidence / mitigation |
|---|------|---|---|----------|-----------------------|
| R1 | Wrong status workflow (terminal states, skipped jumps) silently regressing | M | H | **Low** | Full transition matrix covered (TC-027..029) incl. no-op and activity counts; seeded-defect 002 proves the coverage detects a broken terminal state |
| R2 | Cross-project data leak (IDOR) | L | H | **Low** | 404-not-403 policy enforced in code; 7-endpoint isolation test + 18-id IDOR sweep per persona, 0 mismatches |
| R3 | Privilege escalation via role endpoints | L | H | **Low** | OWNER protection, last-admin guard, role enum tests; mass-assignment rejected by strict schemas |
| R4 | Overdue/date boundaries miscomputed (due-today, leap years, timezone) | M | M | **Low** | Strict calendar validator + UTC day boundary; boundary cases TC-023/038/042 and DB check with the `<=` trap; the historical seed bug (TASK-BUG-002) is now regression-covered |
| R5 | Pagination/filter regressions (duplicate rows, wrong totals) | M | M | **Low** | Page-union assertions, out-of-range semantics, LIKE-escape test, X-Total-Count parity in SQL |
| R6 | Archived projects still mutable / reports polluted by archived data | L | M | **Low** | Archive suite asserts 422 on all mutations incl. delete; archived exclusion verified in SQL and report |
| R7 | Data integrity drift (orphans, broken FKs) | L | H | **Low** | 22 SQL checks incl. `PRAGMA foreign_key_check` and orphan queries, all green |
| R8 | Auth/session weaknesses (tamper, expiry, cookie flags) | L | H | **Low** | Token signed + validated, expiry cleanup verified, flags asserted |
| R9 | Brute-force / credential stuffing | H | M | **High (accepted)** | No rate limiting implemented; explicitly out of scope, documented in security-testing.md |
| R10 | Stored XSS executing in the console | L | H | **Low** | All console rendering uses `textContent`; TC-110 asserts no script element and no dialog |
| R11 | Localisation/unicode corruption | L | L | **Low** | Emoji/CJK round-trip verified (TC-304) |
| R12 | Performance unknown at production scale | H | M | **High (accepted)** | Only a local single-process baseline exists; no soak/spike, no multi-instance; clearly caveated |
| R13 | SQLite concurrency/backup gaps | M | M | **Medium (accepted)** | Single-writer demo database; no WAL/backup tests; documented limitation |
| R14 | Browser coverage limited to Chromium | M | L | **Medium** | UI suite runs Chromium only; console is standards-based but cross-browser behaviour is asserted only by construction |
| R15 | Accessibility gaps beyond what was checked | M | M | **Medium** | Labels, live regions, focus management verified; no axe-core scan, contrast manual only |

## Project/process risks

| # | Risk | Mitigation |
|---|------|------------|
| P1 | Suites flake across UTC midnight | Overdue expectations derived at runtime; dynamic SQL checks; observed and fixed during this build |
| P2 | Shared test database polluted by earlier suites | Orchestrator resets first; DB checks are parity-based and pass on "dirty" state too |
| P3 | Seeded defects leaking into demos | `SEED_DEFECTS` defaults to 0 in every script; the demo uses its own DB file and is clearly labelled |
| P4 | Fabricated results | Every number in the reports is generated from raw report files; the CSV fills Actual/Status only from executed evidence |

## Release recommendation (see execution report for the generated text)

For the documented **demo scope**: ready. Six real defects were found, fixed and
retested; all suites are green. For a **real production deployment**: the High-severity
accepted risks (R9 rate limiting, R12 capacity validation) plus missing security
headers, CSRF tokens and password-reset flows must be addressed first.
