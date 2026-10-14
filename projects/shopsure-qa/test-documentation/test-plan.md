# ShopSure — Test Plan

- **Plan owner:** Qazi Abdul Mujeer · **Version:** 1.0 · **Date:** 2026-10-14
- **Related documents:** [test-strategy.md](test-strategy.md) · [requirements.md](requirements.md) ·
  [acceptance-criteria.md](acceptance-criteria.md) · [test-scenarios.md](test-scenarios.md) ·
  [execution-report.md](execution-report.md) · [risk-assessment.md](risk-assessment.md)

## 1. Test items

| Item | Location |
|------|----------|
| REST API + server-rendered static app | `app/server/src/**` |
| Single-page storefront | `app/web/src/**` (built to `app/web/dist`) |
| Database schema, constraints and seed data | `app/server/src/db.js`, `app/server/src/seed.js`, `test-data/seed/seed-data.mjs` |
| Automated tests | `tests/api/**` (72), `tests/ui/**` (31), `tests/db/**` (23 SQL checks) |
| Postman collection | `postman/ShopSure-API.postman_collection.json` (35 requests, 76 assertions) |
| Manual/test-case library | `test-data/tests/**` → `test-documentation/test-cases.csv` (101 cases) |

## 2. Features to be tested

Registration, login/logout/sessions, brute-force throttling, product listing, search, sorting,
filtering, pagination, product detail, cart add/merge/limits/update/remove/clear, cart ownership,
checkout validation, stock re-validation, pricing rules, order creation, order history and isolation,
cancellation with stock restore, admin order workflow, admin inventory management, role-based access
control, database integrity and audit events, empty/loading/error states, mobile layout.

## 3. Features not to be tested

Real payment gateways, email/SMS delivery, third-party shipping providers, production hosting,
multi-tenant isolation, browser engines other than Chromium (documented in the risk assessment).

## 4. Test approach and responsibilities

| Activity | Approach | Owner |
|----------|----------|-------|
| Requirements analysis | Translate seeded demo behaviour into 24 requirements with acceptance criteria | QA |
| Test design | 101 test cases: functional, negative, boundary, validation, integration, regression, smoke, security, usability, API, database, exploratory | QA |
| API testing | Playwright API suites + Postman collection executed with Newman | QA |
| UI automation | Playwright UI suites against the built SPA | QA |
| Database validation | 23 SQL checks (constraints, integrity, pricing consistency, audit trail, credential storage) | QA |
| Manual/exploratory | Recorded session covering security, robustness and awkward boundaries (24 checks) | QA |
| Defect management | Defect log with severity, priority, evidence, retest and regression results | QA |
| Reporting | Machine-generated execution report + narrative risk assessment | QA |

## 5. Test data

- **Seed data:** 6 categories, 24 products (deliberately including out-of-stock and low-stock items
  and boundary prices), 3 users (2 customers + 1 admin) and 2 pre-existing orders in different states.
- **Runtime data:** created by tests themselves — unique registered customers per test, orders placed
  through the API/UI, stock normalised before stock-sensitive assertions.
- **Demo credentials:** `customer@example.com / Customer#12345`, `second@example.com / Second#12345`,
  `admin@example.com / Admin#12345`. These are documented, synthetic values — not secrets.
- **Reset procedure:** `npm run db:reset` (deletes the file, recreates the schema, seeds deterministically).

## 6. Environment matrix

| Environment | Purpose | Port | Database |
|-------------|---------|------|----------|
| Local development | Manual exploration | 4100 | `app/server/data/shopsure.db` |
| Playwright suites | API + UI automation | 4180 | `.data/shopsure.e2e.db` (reset per run) |
| Postman/Newman | Contract checks | 4181 | `.data/shopsure.postman.db` (reset per run) |
| Screenshots | Visual evidence capture | 4182 | `.data/shopsure.screenshots.db` (reset per run) |
| Manual session | Security/robustness evidence | 4183 | `.data/shopsure.manual.db` (reset per run) |
| CI (GitHub Actions) | Regression on push/PR | 4180 | `.data/shopsure.e2e.db` |

## 7. Schedule and milestones

| Milestone | Deliverable | Status |
|-----------|-------------|--------|
| M1 Requirements and strategy | requirements.md, acceptance-criteria.md, test-strategy.md, this plan | Done |
| M2 Test design | test-scenarios.md, test-cases.csv, traceability-matrix.csv | Done |
| M3 Implementation | API/UI/SQL suites, Postman collection, runners | Done |
| M4 Execution | All suites executed; raw logs in `test-evidence/logs/` | Done |
| M5 Defect management | defect-log.csv with retest evidence | Done |
| M6 Reporting | summary.json + execution report + risk assessment | Done |

## 8. Entry/exit criteria

See [test-strategy.md](test-strategy.md) sections 6–7. Exit criteria are enforced by `npm run test:all`
(which fails when any required suite fails) plus the traceability matrix check in the report builder.

## 9. Suspension criteria

- Application cannot start or seed → stop, fix the environment, restart the full suite.
- More than 20% of tests fail with the same infrastructure error → stop and treat as environmental.

## 10. Risks and mitigations

See [risk-assessment.md](risk-assessment.md). The short version: pricing boundaries, stock consistency,
privilege escalation and state-machine corruption are the four risks that shaped the test design, and
each one has dedicated, automated evidence.

## 11. Deliverables checklist

- [x] requirements.md · acceptance-criteria.md
- [x] test-strategy.md · test-plan.md
- [x] test-scenarios.md · test-cases.csv · traceability-matrix.csv
- [x] api-test-plan.md · database-testing.md · ui-automation.md
- [x] bug-report-template.md · defect-log.csv
- [x] exploratory-testing.md · risk-assessment.md · seeded-defects.md
- [x] execution-report (generated) · summary.json (generated)
- [x] Screenshots and raw logs in `test-evidence/`
- [x] interview-preparation.md · README.md
