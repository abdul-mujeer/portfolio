# ShopSure — Test Strategy

- **Project:** ShopSure — E-commerce Quality Assurance and Test Automation
- **Version:** 1.0 · **Author:** Qazi Abdul Mujeer (portfolio project) · **Last updated:** 2026-10-14
- **Target:** `projects/shopsure-qa` (Express + SQLite REST API, React single-page storefront)

> This is a practice portfolio project. ShopSure is a fictional store built as a test target; no
> commercial product, customer or payment system is involved.

## 1. Context and objectives

ShopSure demonstrates an end-to-end QA lifecycle for a small e-commerce system: requirements,
test design, manual and exploratory execution, API testing, UI automation, database validation,
defect management and evidence-based release reporting.

Objectives:

1. Prove functional correctness of the storefront and its REST API.
2. Prove that business rules (pricing, stock, discounts, status workflow) hold at their boundaries.
3. Prove that authorization is enforced on the server, not only in the interface.
4. Prove that stored data stays consistent even when operations fail.
5. Produce repeatable, automated regression coverage that runs locally and in CI.

## 2. Scope

**In scope**

- Authentication: registration, login, logout, sessions, brute-force throttling.
- Catalog: listing, search, sorting, filtering, pagination, product detail.
- Cart: add, merge, quantity limits, stock limits, update, remove, clear, ownership.
- Checkout: shipping-form validation, pricing rules, stock re-validation, order creation.
- Orders: history, isolation between customers, cancellation, stock restoration.
- Admin: order status workflow, inventory management, role-based access control.
- Data layer: constraints, referential integrity, pricing/audit consistency via SQL.
- Non-functional (selected): basic security robustness, usability/accessibility smoke checks, mobile layout.

**Out of scope**

- Real payment processing (there is none by design).
- Real email/SMS notifications.
- Load/performance testing beyond a documented baseline (see the TaskFlow project for that focus).
- Cross-browser certification (Chromium is the supported automation engine here; see limitations).
- Penetration testing beyond the documented input/authorization checks.

## 3. Risks that drive the strategy

| Risk | Impact | Likelihood | Mitigation in this strategy |
|------|--------|------------|------------------------------|
| Pricing rules misunderstood at boundaries | High — wrong money charged | Medium | Decision-table design + exact-boundary tests (49.99/50.00, 99.99/100.00) |
| Overselling stock under stale carts | High — inconsistent inventory | Medium | Checkout re-validation test with simulated concurrent purchase; SQL stock checks |
| Broken authorization (privilege escalation) | Critical — data exposure | Medium | RBAC tests on every admin endpoint as customer + anonymous; mass-assignment tests |
| Order state machine corruption | High — orders in impossible states | Low | Transition matrix tests, including no-op and post-terminal attempts |
| Data corruption on failed operations | High — bad reporting | Low | SQL constraint/integrity checks before and after suite execution |
| Regression after fixes | Medium | Medium | Reusable Playwright suites tagged `@smoke`/`@regression`, CI-ready |

## 4. Test levels and types

| Level | Approach | Where it lives |
|-------|----------|----------------|
| Unit-ish (module) | Small SQL/helper checks through the API and direct SQL | `tests/db/*.mjs` |
| Integration / API | HTTP-level tests with real sessions and a real database | `tests/api/*.spec.ts` (72 tests) |
| System / UI | Browser journeys on the built SPA served by the API | `tests/ui/*.spec.ts` (31 tests) |
| Contract | Postman collection (also runnable by hand) via Newman | `postman/` + `scripts/newman-run.mjs` (76 assertions) |
| Manual / exploratory | Scripted edge, security and robustness session with recorded evidence | `scripts/manual-evidence.mjs` → `test-evidence/logs/` (24 checks) |
| Smoke / regression | `@smoke` and `@regression` tagged subsets | same suites, runnable via `npm run test:smoke` / `test:regression` |

Design techniques used: equivalence partitioning, boundary-value analysis, decision tables
(pricing and status transitions), state-transition testing, negative and error-guessing,
role/permission matrix testing and structured exploratory charters.

## 5. Test environment

| Item | Value |
|------|-------|
| OS | Windows 11 (also runs on Linux/macOS and GitHub Actions Ubuntu) |
| Runtime | Node.js ≥ 20.11 (developed on v24.21.0), built-in `node:sqlite` |
| Browser | Chromium via Playwright (`@playwright/test`) — Firefox/WebKit not installed here |
| Databases | Fresh deterministic seed per run: design DB `app/server/data/shopsure.db`, test DB `.data/shopsure.e2e.db` |
| Ports | Application 4100 · API tests 4180 · Postman 4181 · screenshots 4182 · manual session 4183 |
| Test data | Synthetic seed data only (`test-data/seed/seed-data.mjs`) |

## 6. Entry and exit criteria

**Entry criteria**

- Application builds (`npm run build`) and starts (`npm start`).
- Database can be reset and seeded deterministically (`npm run db:reset`).
- Test suites and Postman collection are present in the repository.
- No blocker in the environment (Node version, browsers).

**Exit criteria**

- All executed automated suites pass on a freshly seeded database.
- Every requirement is linked to at least one executed test case (traceability matrix).
- All Severity 1/2 defects found are fixed and retested (or explicitly documented as known issues).
- Execution report, defect log and evidence are written and committed.
- Release recommendation is recorded with its evidence.

## 7. Suspension and resumption criteria

Suspension: the application cannot start, the database cannot be seeded, or more than 20% of a
suite fails for environmental reasons. Resumption: the blocker is resolved, a fresh seed is taken,
and the affected suite is re-run in full (never partially patched).

## 8. Business rules under test (summary)

1. A cart line holds 1–10 units and never more than available stock.
2. Pricing: 10% discount from subtotal 100.00; shipping 5.00 below 50.00, free from 50.00.
3. Checkout re-validates stock; failures are atomic.
4. Orders: `PENDING → PAID → SHIPPED → DELIVERED`, `CANCELED` only from `PENDING`/`PAID`.
5. Cancellation restores stock and writes an event.
6. Administrative endpoints require the ADMIN role (server-side).
7. Every order records an initial `PENDING` event; cancellations record a `CANCELED` event.

## 9. Defect management

- Severity (impact on the business) and priority (urgency) are tracked separately.
- Defects found in the seeded-defect exercise are labelled **SEEDED** and use the 1xx id range.
- Each defect record contains steps, expected vs actual, environment, evidence, root cause,
  retest and regression results and a closure rationale (`test-documentation/defect-log.csv`).

## 10. Reporting

`npm run test:all` produces `test-reports/summary.json` and
`test-reports/execution-report-<date>.md` from the raw outputs of each suite. Numbers in the report
are always read from result files; nothing is estimated.

## 11. Automation strategy

- `@playwright/test` drives both API and UI tests — one runner, one assertion library, one CI job shape.
- Tests are isolated: each creates its own users/orders and normalises any stock it touches.
- No arbitrary waits; web-first assertions and stable `data-testid` selectors only.
- Traces and screenshots are captured on failure; a JSON report is always written for the report builder.
- SQL validation runs as a separate suite against the same database after the API/UI runs.

## 12. Limitations of this strategy

- Single browser engine (Chromium) and a single viewport family.
- No parallel execution: suites share one SQLite file, so they run with one worker by design.
- The in-memory login throttle is per process, which is fine for a demo but not for multi-instance production.
- Accessibility checks are targeted smoke checks, not a full WCAG audit.
