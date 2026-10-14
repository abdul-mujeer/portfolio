# Bug Report Template (TaskFlow API)

Copy this template for every defect. `defect-log.csv` keeps the same fields in CSV
form; this file is the human-readable long form.

---

## TASK-BUG-nnn — <short imperative title>

| Field | Value |
|-------|-------|
| **Module** | e.g. Reports / Status workflow / Console |
| **Severity** | Critical / High / Medium / Low (user impact) |
| **Priority** | P0 / P1 / P2 / P3 (fix urgency) |
| **Type** | Functional / Security / Data / Usability / Performance |
| **Status** | Open / In progress / Fixed / Closed / Reopened / Blocked |
| **Environment** | OS, Node version, database path, commit/build identifier |
| **Detected by** | Which suite/session (e.g. "Playwright API suite, TASK-TC-006") |
| **Detected on** | YYYY-MM-DD |
| **Related test case** | TASK-TC-nnn |

### Steps to reproduce

1. …
2. …
3. …

### Expected result

<What the requirement says — link TASK-REQ-nnn / acceptance criterion.>

### Actual result

<Observed behaviour. Include the exact error payload/status or a short log excerpt.>

### Evidence

- Raw log: `test-evidence/logs/<file>`
- Report: `test-reports/…`
- Screenshot/trace: `test-results/…` or `test-evidence/screenshots/…`

### Root cause

<One or two sentences on the underlying cause.>

### Fix

<Commit/PR reference and what changed.>

### Retest

- Retest result: Pass/Fail — command and report file.
- Regression: which suites were re-run and their result.

### Notes / rationale

<Why this severity/priority, related defects, follow-up work.>
