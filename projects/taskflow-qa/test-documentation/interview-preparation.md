# TaskFlow API — Interview Preparation

Ten questions an interviewer is likely to ask about this project, answered from the
actual implementation and the evidence this build produced. Every answer points at a
file or report you can open live.

**1. Walk me through the app under test.**
TaskFlow is an API-first project-management service: Express 4 + `node:sqlite`
(file database) + a vanilla-JS console on port 4300. The API exposes auth, projects,
members, tasks, a status workflow, comments, an activity feed and an overdue report —
all under `/api/v1`. The domain model is in `app/server/src/db.js`; routes are split per
resource in `app/server/src/routes/`. Every mutation writes an `activity` row with a
JSON detail payload, so the audit trail is testable, not just decorative.

**2. How do you test authorization, and why 404 instead of 403 for outsiders?**
The rule is: 403 when the caller *can see* the resource but lacks rights (e.g. a MEMBER
renaming a project), 404 when the caller must not even learn it exists (non-members).
That's implemented in `lib/access.js` (`getProjectOr404` / `getTaskOr404`) and proven
by `tests/api/isolation.spec.ts` (TASK-TC-039/040) plus a scripted IDOR sweep
(TASK-TC-302) that walks all 18 seeded task ids per persona and counts mismatches — 0.

**3. What does your status-workflow coverage look like?**
`tests/api/status.spec.ts` walks the full chain TODO→IN_PROGRESS→IN_REVIEW→DONE,
proves DONE and CANCELED are terminal (422 from every direction), that skipped jumps
are 422, that unknown values are 400, and that a same-status request is a 200 no-op
with **no** new activity row (activity counts compared before/after). Seeded defect 002
flips DONE to non-terminal and the same tests detect it — `npm run seeded:demo` shows
the detection with counts (422 vs 200).

**4. How do you handle date boundaries, which are notoriously flaky?**
Three layers: (1) strict calendar validation (`isRealCalendarDate` round-trips through
`Date.UTC`, so 2026-02-30 and 2027-02-29 are 400 while 2028-02-29 passes);
(2) business rule — a due date may not precede the task's creation date (422 on create
and update), and a task due *today* is not overdue because the predicate is strict `<`;
(3) test robustness — suites derive expected overdue sets from the API at runtime
(`expectedOverdueIds`), and DB checks compute their expectations in SQL, so a run that
crosses UTC midnight cannot produce a false failure. We actually hit that rollover
during the build and hardened the tests instead of adding retries.

**5. Which defect are you proudest of finding?**
TASK-BUG-003: `GET /projects` returned `{ data: [], total: 30 }` — the count was right
but the payload empty, because the route added a second `pm.user_id = ?` to a query
whose JOIN already bound it, shifting values into `LIMIT/OFFSET`. `node:sqlite` leaves
missing parameters NULL instead of throwing, so the WHERE compared against NULL.
It's the kind of bug a UI-only test might miss (the project switcher just looks empty);
it broke the API suite loudly (TASK-TC-006/008/048). After the fix I added API↔SQL
count parity checks to the DB suite so the class of bug can't come back unnoticed.

**6. How do you make sure a test actually tested something (no green-by-accident)?**
Every list/detail assertion checks content *and* counts; pagination tests collect ids
across pages and assert 12 unique rows; the DB suite compares API totals with
`COUNT(*)`; the CSV pipeline fills case status only from real report files. And the two
seeded defects prove the suite fails when the behaviour regresses — detection is part
of the deliverable, not a claim.

**7. How is the manual test documentation kept honest?**
`test-data/tests/*.mjs` is the single source of truth; test titles embed `TASK-TC-nnn`
ids. `scripts/docs/generate-csv.mjs` scans the real Playwright JSON, the DB result file
and the manual run output and fills `Status`, `ActualResult` and `EvidenceLink` for each
case — cases with no evidence are exported as `Not Executed` with an empty actual
result. Manual cases (TASK-TC-301..304) are executed by `scripts/manual-cases.mjs`,
which performs the documented steps and saves the raw log.

**8. Tell me about a security finding.**
Stored markup: creating a task with `<script>alert(1)</script>` stores and returns it
verbatim (correct for JSON), and the console renders it with `textContent` — verified in
TC-110, which also asserts no `<script>` element ends up in the DOM and no dialog fires.
On the transport side, cookie flags are asserted per login, tampered session signatures
are rejected before any DB lookup, and both mass-assignment and SQL-injection probes are
regressions now (TC-044..046). The gap list is explicit: no rate limiting, no CSRF
token, no security headers — assessed in `security-testing.md` and `risk-assessment.md`.

**9. How do you keep suites independent and repeatable?**
The orchestrator (`scripts/run-tests.mjs`) resets + seeds the test DB, starts the server
once and runs API → UI → DB → Postman, killing the server even on failure. Standalone
`test:api`/`test:ui` runs get a fresh reset from the Playwright `webServer` command.
Mutating tests create their own projects with collision-proof keys; tests that need a
card on a specific page create it through the API inside the test. Only the DB suite
deliberately runs against accumulated state, and its checks are parity-based.

**10. What would you test next with another week?**
Rate limiting and account lockout (the top accepted security risk), a soak/scale test
against the SQLite writer (R12/R13), a second browser engine for the UI suite (R14),
axe-core accessibility scans plus contrast checks (R15), and session rotation on
privilege change. Each is already scoped in `risk-assessment.md` so the backlog is
traceable to evidence rather than opinion.
