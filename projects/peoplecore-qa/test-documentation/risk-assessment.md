# PeopleCore HRMS — risk assessment

Assessment performed after the executed run described in `execution-report.md`. Levels are the
*residual* risk after the fixes; the "evidence" column says what would have to be re-run to keep the
level honest.

| # | Risk | Likelihood | Impact | Level | Evidence / mitigation | Residual gap |
|---|---|---|---|---|---|---|
| R-01 | **Authorization bypass** — a role reaches data outside its scope (BOLA/BFLA) | Medium | Critical | **Medium** | 7 RBAC API tests + a UI visibility test; HR-BUG-004 (attendance write without an authorization check) was found and fixed; the seeded BOLA variant proves the detection works | The surface is every endpoint × 4 roles; new endpoints must be added to `tests/api/rbac.spec.ts` and to `permissions.mjs` by hand |
| R-02 | **Authentication weakness** — brute force, session theft, session replay | Medium | High | **Low–Medium** | Lockout verified (HR-BUG-001 fixed), 8 h HTTP-only cookie, logout deletes the row, forged tokens rejected, terminated sessions revoked (HR-BUG-012) | No CSRF token, no MFA, no IP/device binding |
| R-03 | **Business-rule drift** — leave/attendance rules change unnoticed | Medium | High | **Low** | Boundary cases (30/31 days, adjacent vs overlapping dates, reason length, time ordering) plus the SQL overlap check; the seeded overlap off-by-one is reproducibly detected | Rules live in one file (`validation.js`) but are duplicated as CHECK constraints in the schema — both must be updated together |
| R-04 | **Data corruption / partial writes** | Low | High | **Low** | DB-12 runs 10 negative API calls and proves the database is unchanged and FK-clean; every mutation is a single statement inside one connection | No explicit transaction wrapping multi-statement flows (the current flows are single-statement) |
| R-05 | **Loss of audit evidence** | Low | Medium | **Low–Medium** | Every covered mutation writes exactly one row with before/after JSON; DB-09 validates shape; history survives deletions since HR-BUG-008 | Attendance writes create extra audit noise; no retention/rotation policy |
| R-06 | **Unhandled server error (500) on a core action** | Medium | Medium | **Medium** | HR-BUG-008 was exactly this class; the API suites now include a delete-with-history regression test | Only the exercised paths are proven; error handling depends on `HttpError` being thrown (raw driver errors become 500 by design) |
| R-07 | **Timezone / calendar bugs** | Medium | Medium | **Low** | Date helpers are centralised in `lib/dates.js` and reused by tests; HR-BUG-010 shows a UTC/local mix-up is caught by the suites | DST transitions and multi-timezone deployments are untested |
| R-08 | **Accessibility failure** | High | Medium | **High (unknown)** | Structural checks only (labels, skip link, headings, `role=alert`) | Keyboard, contrast and screen-reader reviews are Not Executed (HR-TC-066…068) — the largest unverified area |
| R-09 | **Cross-browser regression** | Medium | Medium | **Medium (unknown)** | Chromium suite is green | Firefox and WebKit were never executed (HR-TC-069) |
| R-10 | **Performance degradation** | Low | Medium | **Low** | autocannon baseline recorded for the three main reads | Single-process local measurement; no capacity statement, no soak test |
| R-11 | **Seeded defects leaking into a real run** | Low | High | **Low** | `SEED_DEFECTS=0` is the default in `.env.example`, in the Playwright config and in every script; the execution report records the flag state from `/api/health` | Anyone could export `SEED_DEFECTS=1`; the health endpoint exposes the flag so a run can be audited afterwards |
| R-12 | **Test-suite false confidence** | Medium | High | **Medium** | Three automation defects (HR-BUG-009/010/011) were found and logged instead of being hidden; every red result was triaged before changing the application | No coverage measurement; requirement coverage is a manual map in `traceability-matrix.csv` |

## Top three risks to watch

1. **R-08 accessibility** — the only area where nothing was executed. Cheapest next step: add axe
   scanning and one keyboard-only journey.
2. **R-01 authorization** — the highest-impact defect class in an HR system, and the seeded variant
   exists precisely to keep the guard under test. Any new endpoint must extend the RBAC matrix.
3. **R-06 unhandled errors** — the observed 500 came from a foreign key; the pattern (raw driver
   error → 500) can repeat wherever new relationships are added.
