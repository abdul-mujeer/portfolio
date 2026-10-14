# PeopleCore HRMS — interview preparation

> **Context, stated plainly:** this project is a **portfolio practice exercise**. It was built and
> tested by me (with AI coding agents) as a work sample. Nothing here is employment experience, and
> no metric was copied from a real product. The numbers come from the executed runs in
> `test-reports/summary.json`.
>
> The answers below are written the way I would give them out loud: what I built, how I tested it,
> what I found, and what I would do differently.

---

### 1. Why did you build an HRMS to demonstrate QA skills?

Because an HRMS is the cheapest way to make **authorization** the centre of gravity. The same page
must show different data to four roles, salary is payroll-sensitive, and almost every action leaves
an audit trail. That gave me real material for the things QA engineers are actually asked about:
role-based tests, boundary values on dates and money, workflow transitions and negative API checks —
instead of another to-do list. Practically: Express + EJS + `node:sqlite` + zod means one
`npm install`, no native dependencies, and a database file I can also inspect with SQL, which is
what let me test the same feature from three angles (HTTP, UI, SQL).

### 2. How did you structure the tests so they stay honest?

Four layers, each with its own database and its own truth:

1. **SQL validation** (`tests/db`, 12 checks) — one private copy of a freshly seeded database per
   check, including one check that fires 10 negative API calls against a real server and then proves
   the file did not change.
2. **API** (`tests/api`, Playwright request contexts) — every endpoint, status code and boundary,
   plus an 8 endpoints × 4 roles authorization matrix.
3. **UI** (`tests/ui`, Chromium) — the journeys a person would judge the app by, selected with
   `data-testid` only.
4. **Postman/newman** — the same API driven by a tool that knows nothing about Playwright, which is
   how I caught the 500 in `HR-BUG-008`.

Everything is regenerated from one source of truth (`test-data/tests/*.mjs` →
`test-documentation/*.csv`), so the CSV, the traceability matrix and the report cannot drift apart.

### 3. Walk me through the most interesting defect you found.

`HR-BUG-004`: `POST /api/attendance` had **no authorization check at all**. I had written the check
in the `PATCH` handler and simply forgot it in the create handler. My RBAC spec tried to write
attendance as an EMPLOYEE and as a MANAGER outside their team and both returned **201 Created** —
a vertical *and* horizontal privilege escalation, because attendance feeds salary-relevant
reporting. The fix moved the scope decision into `services.createAttendance()` so both the API and
the EJS form go through the same guard. The lesson I would tell in an interview: a passing "happy
path" suite proves nothing about authorization; you have to try every role against every endpoint,
and you have to test the *list* and *create* endpoints, not just the detail ones.

### 4. How do you test a rule like "no overlapping leave request"?

Three ways, deliberately redundant:

- **Design**: boundary cases — exact same window, a window shifted by one day, a single day inside,
  the day before and the day after, and the same window against an APPROVED (not just PENDING)
  request.
- **SQL** (`DB-08`): the overlap predicate itself is probed directly, including that CANCELLED rows
  are ignored and that a request does not overlap itself when excluded.
- **Seeded defect** (`SEEDED-02`): an off-by-one that only triggers when the start dates are equal.
  It is off by default and detected by `npm run seeded:evidence`, so I can prove the guard is
  actually testing something.

### 5. How did you handle the 400 vs 409 vs 422 question?

I wrote the mapping down before writing the tests, documented it in `api-test-plan.md` and enforced
it consistently: **400** = malformed payload (wrong type, missing field, bad format, unknown enum,
impossible calendar date, `limit` out of range), **409** = conflict with existing state (duplicate
code/e-mail/department, duplicate attendance day, overlapping leave), **422** = well-formed but
business-illegal (salary range/precision, future hire date, unknown referenced department, ≤30 days,
`checkOut <= checkIn`, terminated employee, illegal state transition). The value of writing it down
is that tests assert *the code*, not just "some 4xx", and a reviewer can argue with the mapping
instead of guessing it.

### 6. What did the database layer teach you that the API layer could not?

That foreign keys are a behavioural contract. `DELETE /api/employees/:id` looked fine in isolation,
but `audit_logs.actor_id` had no `ON DELETE` action, so deleting an employee who had ever acted in
the system blew up with `FOREIGN KEY constraint failed` → HTTP 500 (`HR-BUG-008`). The API test only
found it once I created data *as that employee* first. The fix was `ON DELETE SET NULL` for the audit
reference (history survives, the actor reference is cleared) plus mapping any remaining FK error to
409 instead of 500. My SQL suite now checks `PRAGMA foreign_key_check` and orphan queries as a
matter of routine, and `DB-12` proves failed requests leave no partial rows.

### 7. How do you keep secrets and personal data out of a test suite?

All data is synthetic: fictional names, `@example.com` addresses, and passwords that are documented
demo values (`Admin#12345`) rather than secrets. Passwords are stored as scrypt hashes with a
per-user salt — the seed uses *fixed* salts so two seeds produce byte-identical databases
(`DB-11` tests exactly that). `.env.example` documents every environment variable, `.env` and all
`*.db` files are ignored, and the reports never contain a token. The one place a token appears at
all is the login response, which exists so API tooling can authenticate; the browser only ever sees
the `HttpOnly` cookie.

### 8. How did you decide what *not* to automate?

Three things stayed manual, and I recorded them as *Not Executed* rather than pretending:

- keyboard-only navigation and focus visibility (`HR-TC-066`) — needs a human or a dedicated tool,
- colour contrast (`HR-TC-067`) — no contrast checker is installed, and the portfolio standard fixes
  the dependency set, so adding axe/pa11y was out of scope,
- screen-reader output (`HR-TC-068`) and cross-browser runs (`HR-TC-069`) — only Chromium is
  available here.

That honesty is deliberate: a QA portfolio that claims 100% coverage of accessibility without ever
running a screen reader is worse than one that lists the gap and the exact command to close it.

### 9. How do you make the suites reproducible for someone else?

Everything resets itself. `npm run db:reset` recreates and seeds the database; the Playwright
`webServer` entry resets and seeds the *test* database before the API/UI suites start; newman and
autocannon each get their own port and database. Dates in the seed are relative to the run day but
`SEED_AS_OF=YYYY-MM-DD` pins them, and `DB-11` verifies determinism that way. Every suite writes a
raw log to `test-evidence/logs/`, and `scripts/reports/build-report.mjs` turns those artefacts into
`test-reports/summary.json` plus a Markdown report with real counts — including the git commit and
node version, so a result can always be tied to a revision.

### 10. If you had one more day on this project, what would you do first?

Three things, in this order:

1. **Accessibility**: add axe-core scanning plus one keyboard-only journey, because that is the
   largest unverified area (risk R-08) and it is cheap.
2. **Authorization exhaustiveness**: generate the RBAC matrix from `permissions.mjs` so a new
   endpoint fails the build until a row is added — right now the matrix is a hand-maintained list of
   eight endpoints.
3. **Error-path hardening**: assert that *every* route returns the documented envelope for a raw
   driver error (not just for thrown `HttpError`s), because `HR-BUG-008` showed how a foreign-key
   error escapes as a 500.

I would also fix the smaller, documented limitations: CSRF tokens, a working-day leave calendar, and
Firefox/WebKit in the UI project.
