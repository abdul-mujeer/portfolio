# ShopSure — Interview Preparation

> **Honesty note:** this project is portfolio practice, not commercial employment. ShopSure is a demo
> application I built myself specifically to practise a full QA lifecycle. Nothing here claims
> professional QA experience.

## 1. The two-minute explanation

"ShopSure is a small e-commerce demo I built as a test target: a React storefront, an Express + SQLite
REST API, seeded synthetic data and deliberate business rules around pricing, stock and order status.
I wrote 24 requirements with acceptance criteria, designed 101 manual test cases, automated 72 API tests,
31 UI tests, 23 SQL validation checks and a 35-request Postman collection, and executed everything with
recorded evidence. Testing found three real defects — an incomplete order-event history and two cases
where bad client input produced HTTP 500 instead of 400/413. All three are fixed, retested and closed
with evidence. I also injected three defects behind a feature flag and proved the regression suite
detects them."

## 2. What I did (my responsibilities)

- Analysed the demo requirements and turned them into 24 requirements with acceptance criteria and a traceability matrix.
- Designed test cases using equivalence partitioning, boundary-value analysis, decision tables and state-transition testing.
- Automated API and UI tests with Playwright; built the Postman collection and ran it with Newman.
- Wrote SQL validation checks for constraints, referential integrity, pricing consistency and credential storage.
- Ran a recorded exploratory/security session (injection, mass assignment, oversized payloads, malformed JSON).
- Managed defects: severity/priority, reproduction steps, evidence, root cause, retest, regression, closure rationale.
- Built the CI-shaped runner (`npm run test:all`) that produces a machine-generated execution report.

## 3. Technical questions and answers grounded in this project

**Q1. How did you decide what to test first?**
I ranked by business impact and likelihood. Pricing and stock affect money and inventory, authorization
affects data exposure, and the order state machine can put orders into impossible states. Those four got
decision tables and dedicated automated suites; cosmetic areas got usability smoke checks.

**Q2. Show me a boundary you tested and why it matters.**
Shipping becomes free at a subtotal of exactly 50.00 and the discount starts at exactly 100.00. Those
"equals" cases are where off-by-one defects hide, so the suite asserts subtotal 49.99 vs 50.00 and
99.99 vs 100.00 through real orders and also verifies the stored totals with SQL.

**Q3. How do you test a workflow like order status?**
I made a transition matrix: PENDING → PAID → SHIPPED → DELIVERED, plus CANCELED from PENDING/PAID only.
Tests cover every legal transition, several illegal jumps expecting 422, the same-status no-op expecting
`changed=false`, and post-terminal attempts. Cancelling also has to restore stock and write an event, so
those are asserted too.

**Q4. How do you test authorization properly?**
Two rules: test every protected endpoint as anonymous (expect 401) and as the wrong role (expect 403),
and never trust the UI. For object-level access — another customer's cart line or order — the API
returns 404 rather than 403 so it does not leak that the object exists. I also test that the admin user
list never returns password material.

**Q5. A test failed. How do you decide whether the test or the app is wrong?**
First I reproduce it in isolation, then check the expectation against the requirement. In this project
two early failures were my own test bugs (`APIRequestContext.del` does not exist; a stock dependency
between tests), and one was a genuine data defect in the seed. I classify: environment, test defect,
product defect — and only then change code.

**Q6. How did you keep the automated tests reliable?**
Stable `data-testid` hooks, no arbitrary sleeps, web-first assertions, isolated users per test, and
normalising stock through the admin API before stock-sensitive assertions. Suites run with one worker
because SQLite is a single-writer database. Retries are 0 locally and 1 in CI to distinguish flakes from
real failures.

**Q7. Tell me about a defect you found and how you handled it.**
The SQL check DB-22 found that the seeded DELIVERED order had only one event (`null → DELIVERED`) instead
of the full PENDING → PAID → SHIPPED → DELIVERED history. I logged it with the failing run as evidence,
fixed the seed to replay the chain, then retested and re-ran the whole SQL suite. The contrast — failing
run preserved, then green — is the evidence trail.

**Q8. What does your test report contain?**
Machine-generated counts per suite from raw result files, manual execution status per case, requirement
coverage from the traceability matrix, defect summary, evidence-based risk table and a release
recommendation with its rationale and the known limitations.

**Q9. How would you test the checkout under concurrency?**
Two users with the same last unit: both add to cart, then both check out. The API re-validates stock at
checkout inside a transaction, so exactly one should succeed and the other must get 422 with the cart
preserved. That is currently a documented gap — the demo uses a single SQLite file — and it is my top
next step, on PostgreSQL.

**Q10. How do you know your automation would catch a regression?**
I proved it. I injected three defects behind `SEED_DEFECTS=1`: a skipped stock guard, a missing stock
restore on cancel, and an exclusive `minPrice` boundary. The same regression specs fail with the flag on
and pass with it off. A suite that has never failed is not evidence.

## 4. Difficult scenarios I worked through

| Scenario | Difficulty | What I did |
|----------|------------|-----------|
| Cart merge rules interacting with stock and the 10-unit cap | Three rules in one path | Tested the combinations, not just each rule separately (SHOP-TC-038..042) |
| Checkout when stock changes after "add to cart" | Time-dependent state | Simulated the race by reducing stock between add and checkout; asserted atomic failure |
| Pricing rounding with 10% on 149.99 | Floating-point drift risk | Fixed `round2` half-up rounding and asserted exact stored values in SQL |
| Test interdependence through shared stock | Flaky failures | Normalised stock per test through the admin API instead of relying on order |
| Distinguishing expected 401s from real console errors in the browser | Noise vs signal | Filtered expected resource-status logs, kept `pageerror` strict |

## 5. What I learned

- Boundary and state-transition design catch defects that happy-path automation never will.
- Test code needs the same design discipline as product code: no shared mutable state, no ambiguity.
- Evidence discipline matters more than test counts: a preserved failing run is worth more than a large green suite.
- Honest reporting of gaps (concurrency, browsers, accessibility) makes the rest of the results credible.

## 6. What I would improve next

1. Run the checkout race tests on PostgreSQL with parallel workers.
2. Add `@axe-core/playwright` and a real screen-reader pass.
3. Add API contract validation (JSON schema) so response shape changes fail fast.
4. Add a lightweight performance baseline for the checkout path.
5. Move the manual/exploratory session into a reusable test-management format (e.g. TestRail-style export)
   so results can be shared with non-technical stakeholders.
