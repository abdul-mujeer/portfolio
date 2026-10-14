# Bug report template — PeopleCore HRMS

Copy this template into a new row of `defect-log.csv` (or a new entry in
`test-data/tests/defects.mjs`, from which the CSV is generated) and fill every field.
A report that cannot be reproduced by someone else is not a bug report.

---

## HR-BUG-nnn — <one-line summary in the form "action → observed result">

| Field | Value |
|---|---|
| **Defect ID** | HR-BUG-nnn |
| **Title** | |
| **Module / Component** | e.g. Attendance API, Leave UI, RBAC |
| **Severity** | Critical · High · Medium · Low |
| **Priority** | P1 · P2 · P3 |
| **Status** | New · In Progress · Fixed · Retest · Closed · Rejected · Deferred |
| **Type** | Functional · Validation · Security · Performance · UI · Database · Automation |
| **Environment** | OS · Node version · app version/schema version · database path · port |
| **Build / Commit** | e.g. schema v2 · commit abc1234 |
| **Test case** | HR-TC-nnn and/or the automated test name |
| **Detected by** | person or suite (be specific: file + test name) |
| **Detected on** | YYYY-MM-DD |

### Steps to reproduce

1. …
2. …
3. …

### Test data

Credentials, ids and payloads used (synthetic data only — never real personal data).

### Expected result

What the requirement/acceptance criterion says (`HR-REQ-nnn` / `HR-AC-nnn`).

### Actual result

What happened, including the exact status code, error code and message, or a screenshot/log path.
Do not paraphrase error messages.

### Evidence

- Raw log: `test-evidence/logs/<suite>.txt`
- Screenshot: `test-evidence/screenshots/<file>.jpg`
- Report artefact: `test-reports/<file>.json`

### Impact

Who is affected, how often, and what the workaround is (or why there is none).

### Root cause

Filled in after triage: the file, function and line that caused the behaviour.

### Fix and retest

- Fix: link/commit or description.
- Retest result: Pass/Fail + date + which test proved it.
- Regression result: which suite(s) were re-run and stayed green.

### Rationale

Why this severity/priority (what breaks if it ships).
