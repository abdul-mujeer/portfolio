# ShopSure — Exploratory Testing

- **Session type:** time-boxed, charter-based exploratory testing with recorded evidence
- **Executor:** Qazi Abdul Mujeer (portfolio practice project)
- **Tooling:** the recorded session script `scripts/manual-evidence.mjs` drives the same checks an
  exploratory tester performs by hand and stores the raw request/response evidence so the results are
  reproducible and auditable.
- **Evidence:** `test-evidence/logs/manual-execution-latest.md` (24 checks)

## Session 1 — Hostile input charter (45 minutes)

**Mission:** attack the catalog, cart and authentication endpoints with input a normal user would never
type, and find ways to break data, leak information or force 5xx responses.

**Areas explored:** login email, product search, category filter, cart quantities, registration body,
checkout body, request sizes, JSON syntax, HTTP verbs and headers.

**Findings (all reproduced and recorded):**

| Finding | Severity | Outcome |
|---------|----------|---------|
| Malformed (truncated) JSON body returned **500** instead of 400 | Medium | Logged as SHOP-BUG-002, fixed in the error handler, retested — now 400 `VALIDATION_ERROR` |
| A 200 KB request body returned **500** instead of 413 | Medium | Logged as SHOP-BUG-003, fixed, retested — now 413 `PAYLOAD_TOO_LARGE` |
| `PUT /api/products` returns 404 rather than 405 | Low | Documented limitation (no method-not-allowed handling); no security impact |
| No CSP/HSTS headers in development | Low | Documented limitation; production hardening would add a reverse proxy |

**Things that behaved well (worth stating in an interview):** SQL injection attempts in every string
parameter changed nothing and leaked no SQL; mass-assignment attempts (injecting `role=ADMIN`,
`status=DELIVERED`, `total=0.01`, `discount=999`) were all ignored because the server parses only known
fields; `%` and `_` in search were treated literally; oversized pagination values returned empty pages
rather than errors; the 6th failed login was throttled with 429.

## Session 2 — Boundary sweep charter (30 minutes)

**Mission:** walk every numeric and string boundary in the API and confirm the documented rule at the
exact edge value.

**Boundaries checked:** cart quantity 0/1/10/11 and merging into a 10-unit line; stock 0/1/3/4 and
checkout-time stock reduction; price subtotals 49.99/50.00 and 99.99/100.00; pagination limit 0/1/50/51;
page 1, last page, 99 and 1,000,000; postcode lengths 2/3/10/11; search terms of 0, 2 spaces, 500
characters, and Unicode.

**Outcome:** all boundaries behaved exactly as the decision tables in `test-scenarios.md` predict; no new
defects. Two behaviours were captured as *documented behaviours* rather than defects: numeric strings are
coerced (`"2"` becomes `2`) and page parameters far beyond the last page return an empty page with the
correct `total`.

## Session 3 — Workflow and data-integrity charter (30 minutes)

**Mission:** push orders through every reachable state by both the customer and administrator paths,
including illegal jumps, then verify stock, order history and audit events agree.

**Scenarios executed:** PENDING → PAID → SHIPPED → DELIVERED; CANCELED from PENDING and PAID;
illegal jumps (PENDING → SHIPPED/DELIVERED, DELIVERED → CANCELED); double cancellation; cancellation
after shipment; cross-customer order access.

**Outcome:** the state machine held in every case. This session is also where the incomplete seeded
event chain was confirmed, which the SQL check DB-22 later caught formally (SHOP-BUG-001).

## Session 4 — Onboarding and usability observations (20 minutes)

**Mission:** approach the store as a first-time user on a 390x844 viewport.

**Observations:** the search box and filters remain reachable; the out-of-stock state is explicit and the
add button is disabled rather than erroring on click; empty states explain what to do next; error banners
are announced as `role=alert`. Improvement ideas (not defects) are listed in the README's *Future
improvements* section: persist filters in the URL for pagination, show a low-stock badge in the cart, and
announce cart changes with an `aria-live` region.

## Sessions not executed (honest gaps)

| Session | Reason | How to run later |
|---------|--------|------------------|
| Screen-reader session with NVDA | No screen reader installed in this environment | SHOP-TC-099 steps |
| Cross-browser exploratory session (Firefox/WebKit) | Browsers not installed | `npx playwright install firefox webkit` then SHOP-TC-098 |
| Slow-network/poor-connectivity session | Not modelled in the demo stack | Throttle in DevTools and repeat the purchase journey |
