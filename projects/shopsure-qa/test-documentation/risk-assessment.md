# ShopSure — Risk Assessment

- **Assessment date:** 2026-10-14 · **Assessor:** Qazi Abdul Mujeer (portfolio practice project)
- **Basis:** executed results only (see `test-reports/execution-report-latest.md` and
  `test-reports/summary.json`). Nothing here is estimated.

## 1. Residual risk by area

| Area | Business impact | Likelihood of failure | Evidence status | Residual risk |
|------|-----------------|----------------------|-----------------|---------------|
| Pricing (discount/shipping boundaries) | High — wrong money charged | Low | Decision-table tests at 49.99/50.00 and 99.99/100.00 all passed; SQL consistency checks green | **Low** |
| Stock integrity (oversell, restore) | High — inventory drift, angry customers | Low | Stock guard, merge limit, checkout re-validation, cancel-restore and SQL stock/total checks all passed | **Low** |
| Order status workflow | High — orders stuck in impossible states | Low | Full transition matrix plus illegal-jump tests passed | **Low** |
| Authorization / RBAC | Critical — data exposure | Low | Every admin endpoint tested anonymous (401) and as customer (403); object-level access returns 404 | **Low** |
| Input safety (injection, mass assignment) | Critical | Low | Injection, coercion and mass-assignment attempts recorded as safe in the exploratory session | **Low** |
| Data integrity at the schema level | High | Low | 23 SQL checks pass, including FK integrity, constraints and audit events | **Low** |
| Cart/session privacy | High | Low | Cross-customer cart and order access tests return 404; no leakage observed | **Low** |
| Concurrency under real parallel load | High | Unknown | **Not tested** — SQLite single-writer demo, no parallel clients | **Medium (untested)** |
| Browser compatibility | Medium | Medium | Chromium only; Firefox/WebKit not installed here | **Medium (untested)** |
| Accessibility (WCAG conformance) | Medium | Medium | Targeted smoke checks only (skip link, labels, alt text, alert region); no full WCAG audit, no screen reader | **Medium** |
| Production hardening (TLS, CSP, HSTS, secure cookie) | Medium | Medium | Secure cookies are enabled only when `NODE_ENV=production`; no security headers are set | **Medium (by design for a demo)** |

## 2. Known limitations (documented, not hidden)

1. **Unsupported HTTP verbs return 404, not 405** — REST clients cannot distinguish "unsupported verb"
   from "unknown resource". Low impact, documented in `manual-execution-latest.md` (MAN-SEC-07).
2. **Login throttling is per-process and in-memory** — sufficient for a single-instance demo; a real
   deployment would use a shared store. Six consecutive failures are throttled, but the counter resets on
   restart.
3. **Numeric strings are coerced** (`"2"` → `2`). Deliberate and documented (MAN-EDGE-04); strict typing
   would reject them instead.
4. **No pagination on `/api/orders`** — a customer's own history is normally small; the admin list is
   paginated. Documented in the API plan.
5. **Two manual cases were not executed**: cross-browser (SHOP-TC-098) and a screen-reader check
   (SHOP-TC-099). Exact reproduction commands are in `test-cases.csv`.
6. **Concurrency is not covered.** No parallel-client test exists because the demo database is a single
   SQLite file. Mitigation for a real product: run the API against PostgreSQL and add parallel order
   tests before trusting the checkout path under load.

## 3. Defect exposure

| Category | Count | Status |
|----------|-------|--------|
| Defects genuinely found while testing (001–099) | 3 | All fixed, retested and regression-verified |
| Deliberately seeded defects (1xx, `SEED_DEFECTS=1` only) | 3 | Inactive by default; detection proven and documented |
| Open defects in the delivered build | **0** | — |

## 4. Release readiness

**Recommendation: READY for the demo/release gate**, with the caveats in section 2.

Rationale: all executed automated suites pass (API 72/72, UI 31/31, SQL 23/23, Postman 76/76
assertions), every requirement traces to at least one executed test case, and the three defects found
during testing are fixed with retest evidence. The untested areas (concurrency, non-Chromium browsers,
full WCAG, production hardening) are explicitly listed above so a reviewer can weigh them knowingly.

## 5. Risk-driven next steps

1. Add parallel order tests on PostgreSQL to close the concurrency gap.
2. Install Firefox/WebKit in CI and run the UI suite on all three engines.
3. Add a full accessibility audit (`@axe-core/playwright`) and a screen-reader pass.
4. Add production security headers and a shared throttle store before any real exposure.
5. Add contract tests that fail if `X-Total-Count` or pagination semantics change.
