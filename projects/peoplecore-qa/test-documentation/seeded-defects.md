# PeopleCore HRMS — seeded defects

Two defects are **deliberately injected** so the test suites can be shown to *detect* something,
not only to pass. They are:

- **off by default** — `SEED_DEFECTS=0` everywhere (`.env.example`, `playwright.config.ts`, every script),
- **labelled SEEDED** in the code, in `defect-log.csv` and in every report,
- **reproducibly detectable** with one command that stores its evidence,
- **absent** from clean runs, where the same probes pass.

Implementation: `app/server/src/lib/seed-defects.js` (every touch point is marked
`SEEDED DEFECT` in the surrounding code, so a reader can see what the clean path does).

## SEEDED-01 — broken object level authorization on the manager employee list

| | |
|---|---|
| Module | RBAC / Employees |
| Severity | Critical |
| Injected in | `app/server/src/lib/queries.js` → `listEmployees()` |
| Behaviour | `GET /api/employees` returns **every** employee when the caller is a MANAGER. The detail endpoint keeps answering 403, which is exactly what makes the leak easy to miss during a manual walkthrough. |
| Detection probe | sign in as `manager@example.com`, call `/api/employees?limit=100`, assert that every row is either the manager themself or one of their direct reports |

## SEEDED-02 — leave overlap guard off-by-one

| | |
|---|---|
| Module | Leave |
| Severity | High |
| Injected in | `app/server/src/lib/services.js` → `createLeaveRequest()` |
| Behaviour | A new request whose `startDate` equals the `startDate` of an existing PENDING/APPROVED request skips the overlap check and is accepted (201 instead of 409). |
| Detection probe | sign in as `employee6@example.com` (EMP-009 owns the seeded PENDING request `today+10 → today+12`), POST exactly that start date and assert 409 `LEAVE_OVERLAP` |

## How to reproduce the detection

```bash
npm run seeded:evidence
```

The script (1) resets a private database on port 4240, (2) boots the app with `SEED_DEFECTS=1`,
(3) runs both probes and expects them to **fail**, (4) restarts with `SEED_DEFECTS=0` and expects
both probes to **pass**, (5) writes the proof.

Evidence: `test-evidence/seeded-defects/seed-defects-evidence.json`, log:
`test-evidence/logs/seeded.txt`.

Expected output (abridged, real run 2026-10-14):

```
[seeded] SEED_DEFECTS=1 (defects enabled) · SEEDED-01: FAIL (Manager employee list stays inside the team)
[seeded] SEED_DEFECTS=1 (defects enabled) · SEEDED-02: FAIL (Same-start-date leave overlap is refused)
[seeded] SEED_DEFECTS=0 (clean build) · SEEDED-01: PASS (Manager employee list stays inside the team)
[seeded] SEEDED_DEFECTS=0 (clean build) · SEEDED-02: PASS (Same-start-date leave overlap is refused)
```

## Which suites would catch them in a normal run?

| Seeded defect | Catching test | Manual case |
|---|---|---|
| SEEDED-01 | `tests/api/rbac.spec.ts` › *MANAGER is limited to self plus direct reports* (property assertion over all rows) | HR-TC-059, HR-TC-060 |
| SEEDED-02 | `tests/api/leave.spec.ts` › *overlapping PENDING or APPROVED requests are rejected with 409* (exact-window variant) | HR-TC-045 |

Because the assertion for SEEDED-01 is *property based* ("every returned row is in scope") instead of
a fixed count, it also survives legitimate data growth — the same technique that a real team needs
to keep a scope guard honest.
