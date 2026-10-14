# ShopSure — test scenarios, coverage groups and decision tables

> Generated from `test-data/tests/test-cases.mjs` by `npm run docs:csv` — do not edit by hand.

**Test cases:** 101 across 24 requirements.

**Execution status:** Pass: 99 · Not Executed: 2

## 1. Coverage groups by module

### Authentication (10 cases)

| Case | Type | Priority | Scenario | Status |
|------|------|----------|----------|--------|
| SHOP-TC-001 | Functional | High | Register a new customer with valid data | Pass |
| SHOP-TC-002 | Negative | High | Reject registration with an already registered email (negative) | Pass |
| SHOP-TC-003 | Validation | High | Validate name, email and password with field-level details (validation) | Pass |
| SHOP-TC-004 | Boundary | Medium | Password policy rejects passwords without a digit (boundary) | Pass |
| SHOP-TC-005 | Functional | Critical | Log in with valid credentials and receive a secure session cookie | Pass |
| SHOP-TC-006 | Negative | Critical | Reject a wrong password with a generic 401 (negative) | Pass |
| SHOP-TC-007 | Security | High | Unknown email returns the same generic 401 (no user enumeration) | Pass |
| SHOP-TC-008 | Functional | High | Logout invalidates the session | Pass |
| SHOP-TC-009 | Security | Critical | Protected endpoints reject anonymous access | Pass |
| SHOP-TC-010 | Functional | Medium | Session survives a page reload in the browser | Pass |

### Security (13 cases)

| Case | Type | Priority | Scenario | Status |
|------|------|----------|----------|--------|
| SHOP-TC-011 | Security | Medium | Throttle repeated failed logins (security) | Pass |
| SHOP-TC-078 | Security | Critical | Customers receive 403 on every admin endpoint (security) | Pass |
| SHOP-TC-079 | Security | High | Anonymous admin requests return 401, not 403 (security) | Pass |
| SHOP-TC-080 | Security | Critical | The admin user list never exposes password material (security) | Pass |
| SHOP-TC-081 | Security | High | The UI blocks customers from the admin area | Pass |
| SHOP-TC-082 | Security | Critical | SQL injection in the login email fails safely (security) | Pass |
| SHOP-TC-083 | Security | Critical | SQL injection in search and filters is harmless (security) | Pass |
| SHOP-TC-084 | Security | Critical | Mass assignment cannot escalate privileges or alter totals (security) | Pass |
| SHOP-TC-085 | Regression | High | Malformed JSON returns 400 instead of 500 (regression) | Pass |
| SHOP-TC-086 | Regression | Medium | Oversized request bodies return 413 (boundary, regression) | Pass |
| SHOP-TC-087 | Security | Low | Security-relevant headers are sane | Pass |
| SHOP-TC-100 | Exploratory | High | Exploratory: hostile inputs and awkward values in the catalog and cart (exploratory) | Pass |
| SHOP-TC-101 | Exploratory | Medium | Exploratory: HTTP verb and content-type misuse (exploratory) | Pass |

### Catalog (23 cases)

| Case | Type | Priority | Scenario | Status |
|------|------|----------|----------|--------|
| SHOP-TC-012 | Smoke | Critical | Default catalog listing returns the first page with metadata (smoke) | Pass |
| SHOP-TC-013 | Integration | High | Deactivated products disappear from the storefront (integration) | Pass |
| SHOP-TC-014 | Functional | High | Search matches name and description case-insensitively | Pass |
| SHOP-TC-015 | Security | High | LIKE wildcards are escaped in search (security) | Pass |
| SHOP-TC-016 | Negative | Medium | No-match search returns an empty page, not an error | Pass |
| SHOP-TC-017 | Usability/Accessibility | Medium | Empty state is displayed for a no-match search in the UI (usability) | Pass |
| SHOP-TC-018 | Boundary | High | Sort by price ascending is correctly ordered (boundary) | Pass |
| SHOP-TC-019 | Functional | Medium | Sort by price descending is correctly ordered | Pass |
| SHOP-TC-020 | Negative | Medium | Unsupported sort field/order is rejected (negative) | Pass |
| SHOP-TC-021 | Functional | Low | Sorting through the UI reorders the product cards | Pass |
| SHOP-TC-022 | Functional | High | Category filter returns only that category | Pass |
| SHOP-TC-023 | Boundary | High | minPrice boundary is inclusive (boundary) | Pass |
| SHOP-TC-024 | Boundary | High | maxPrice boundary is inclusive (boundary) | Pass |
| SHOP-TC-025 | Functional | High | inStock filter returns only purchasable products | Pass |
| SHOP-TC-026 | Functional | Medium | inStock=false returns only zero-stock products | Pass |
| SHOP-TC-027 | Negative | Medium | minPrice greater than maxPrice is rejected (negative) | Pass |
| SHOP-TC-028 | Functional | Medium | Combined price range returns the expected window | Pass |
| SHOP-TC-029 | Boundary | High | Pagination limit boundaries: 1 and 50 accepted, 0 and 51 rejected (boundary) | Pass |
| SHOP-TC-030 | Functional | Medium | Second page returns the remaining items | Pass |
| SHOP-TC-031 | Boundary | Medium | Page far beyond the last page returns an empty list (boundary) | Pass |
| SHOP-TC-032 | Functional | Medium | Product detail returns pricing and stock for an existing product | Pass |
| SHOP-TC-033 | Negative | Medium | Unknown and non-numeric product ids are rejected (negative) | Pass |
| SHOP-TC-034 | Usability/Accessibility | Medium | Out-of-stock product page disables the add button (usability) | Pass |

### Cart (13 cases)

| Case | Type | Priority | Scenario | Status |
|------|------|----------|----------|--------|
| SHOP-TC-035 | Smoke | Critical | Add a product to the cart and get recomputed totals (smoke) | Pass |
| SHOP-TC-036 | Functional | High | Adding the same product merges into one line | Pass |
| SHOP-TC-037 | Functional | Low | Cart badge reflects the number of units in the UI | Pass |
| SHOP-TC-038 | Boundary | High | Quantity boundaries 1 and 10 accepted, 0 and 11 rejected (boundary) | Pass |
| SHOP-TC-039 | Negative | Critical | Adding more units than stock is rejected (negative) | Pass |
| SHOP-TC-040 | Boundary | High | Merging beyond 10 units on one line is rejected (boundary) | Pass |
| SHOP-TC-041 | Negative | High | Out-of-stock products cannot be added (negative) | Pass |
| SHOP-TC-042 | Data integrity | Critical | Stock guard cannot be bypassed by a low-stock race (data integrity) | Pass |
| SHOP-TC-043 | Negative | Medium | Fractional quantities are rejected (negative) | Pass |
| SHOP-TC-044 | Validation | High | Updating a line quantity above stock is rejected, a valid value succeeds | Pass |
| SHOP-TC-045 | Functional | Medium | Removing a line and clearing the cart empty it | Pass |
| SHOP-TC-046 | Security | Critical | Cart items are private to their owner (security) | Pass |
| SHOP-TC-047 | Regression | Medium | Cart contents persist across requests and reloads | Pass |

### Checkout (10 cases)

| Case | Type | Priority | Scenario | Status |
|------|------|----------|----------|--------|
| SHOP-TC-048 | Integration | Critical | Placing an order decrements stock (integration) | Pass |
| SHOP-TC-049 | Negative | Critical | Checkout re-validates stock when it changed after adding to cart (negative) | Pass |
| SHOP-TC-050 | Boundary | Critical | Shipping boundary: 49.99 charges 5.00, 50.00 is free (boundary) | Pass |
| SHOP-TC-051 | Boundary | Critical | Discount boundary: 99.99 has no discount, 100.00 receives 10% (boundary) | Pass |
| SHOP-TC-052 | Functional | Critical | Mixed cart combines discount and free shipping correctly | Pass |
| SHOP-TC-053 | Functional | High | Cart totals are recalculated live in the UI | Pass |
| SHOP-TC-054 | Validation | High | Every invalid shipping field is reported (validation) | Pass |
| SHOP-TC-055 | Boundary | Medium | Postcode length boundaries 2 and 11 are rejected (boundary) | Pass |
| SHOP-TC-056 | Negative | High | Checkout with an empty cart is rejected (negative) | Pass |
| SHOP-TC-057 | Usability/Accessibility | Medium | Checkout field errors are displayed inline in the UI (usability) | Pass |

### Orders (16 cases)

| Case | Type | Priority | Scenario | Status |
|------|------|----------|----------|--------|
| SHOP-TC-058 | Smoke | Critical | Checkout creates a PENDING order, clears the cart and records an event (smoke) | Pass |
| SHOP-TC-059 | Database | High | Order numbers are unique and follow ORD-##### (boundary) | Pass |
| SHOP-TC-060 | Database | Critical | Stored totals and line totals are internally consistent (database) | Pass |
| SHOP-TC-061 | Functional | High | Order confirmation is shown with the generated order number | Pass |
| SHOP-TC-062 | Security | High | Order history returns only the current customer's orders, newest first | Pass |
| SHOP-TC-063 | Security | Critical | Reading another customer's order returns 404 (security) | Pass |
| SHOP-TC-064 | Functional | Medium | Order history is displayed with statuses in the UI | Pass |
| SHOP-TC-065 | Regression | Critical | Cancelling a PENDING order restores stock and records the transition (regression) | Pass |
| SHOP-TC-066 | Negative | High | A SHIPPED order cannot be cancelled (negative) | Pass |
| SHOP-TC-067 | Negative | Medium | Cancelling the same order twice is rejected (negative) | Pass |
| SHOP-TC-068 | Regression | Medium | The UI reflects cancellation with the new status and history | Pass |
| SHOP-TC-069 | Negative | High | Illegal status jumps are rejected (negative, regression) | Pass |
| SHOP-TC-070 | Functional | High | The legal chain PENDING -> PAID -> SHIPPED -> DELIVERED works end to end | Pass |
| SHOP-TC-071 | Boundary | Medium | Setting the current status is a no-op reporting changed=false (boundary) | Pass |
| SHOP-TC-072 | Functional | Medium | Admin order list can be filtered by status and rejects unknown values | Pass |
| SHOP-TC-073 | Usability/Accessibility | Medium | Admin UI offers only the legal next statuses (usability) | Pass |

### Admin (4 cases)

| Case | Type | Priority | Scenario | Status |
|------|------|----------|----------|--------|
| SHOP-TC-074 | Boundary | High | Stock updates accept 0 and reject negative/non-integer values (boundary) | Pass |
| SHOP-TC-075 | Negative | High | Duplicate SKUs are rejected when creating products (negative) | Pass |
| SHOP-TC-076 | Integration | High | Stock 0 makes a product unpurchasable while it stays visible | Pass |
| SHOP-TC-077 | Functional | Medium | Admin can update stock from the UI and the table refreshes | Pass |

### Data (6 cases)

| Case | Type | Priority | Scenario | Status |
|------|------|----------|----------|--------|
| SHOP-TC-088 | Database | Critical | CHECK constraints reject invalid prices, stock and statuses (database) | Pass |
| SHOP-TC-089 | Database | High | UNIQUE constraints prevent duplicates (database) | Pass |
| SHOP-TC-090 | Database | High | Cart quantity CHECK enforces the 1..10 limit at database level | Pass |
| SHOP-TC-091 | Database | Critical | No referential-integrity violations after the automated suites (database) | Pass |
| SHOP-TC-092 | Database | Critical | Passwords are stored as salted scrypt hashes, never plaintext (database, security) | Pass |
| SHOP-TC-093 | Database | High | Every order carries a complete status-event history (database) | Pass |

### Usability (6 cases)

| Case | Type | Priority | Scenario | Status |
|------|------|----------|----------|--------|
| SHOP-TC-094 | Usability/Accessibility | Medium | The layout is usable at a mobile viewport (usability) | Pass |
| SHOP-TC-095 | Usability/Accessibility | Medium | API errors are announced in an accessible alert region (accessibility) | Pass |
| SHOP-TC-096 | Usability/Accessibility | Medium | Keyboard users can skip to the main content (accessibility) | Pass |
| SHOP-TC-097 | Regression | Medium | No uncaught console errors on the main user journey (regression) | Pass |
| SHOP-TC-098 | Compatibility | Low | Cross-browser check in Firefox and WebKit (compatibility) | Not Executed |
| SHOP-TC-099 | Usability/Accessibility | Low | Screen-reader announcement of dynamic cart updates (accessibility) | Not Executed |

## 2. Decision table — order pricing

| # | Subtotal condition | Discount (10%) | Shipping (flat 5.00) | Rule verified by |
|---|--------------------|----------------|----------------------|------------------|
| 1 | subtotal < 50 | no | yes | SHOP-TC-050 (49.99) |
| 2 | 50 <= subtotal < 100 | no | free | SHOP-TC-050 (50.00) |
| 3 | subtotal = 99.99 | no | free | SHOP-TC-051 |
| 4 | subtotal >= 100 | yes (10%) | free | SHOP-TC-051 (100.00), SHOP-TC-052 |

## 3. Decision table — order status transitions

| Current status | PAID | SHIPPED | DELIVERED | CANCELED |
|----------------|------|---------|-----------|----------|
| PENDING | allowed | rejected (422) | rejected (422) | allowed |
| PAID | no-op | allowed | rejected (422) | allowed |
| SHIPPED | rejected (422) | no-op | allowed | rejected (422) |
| DELIVERED | rejected (422) | rejected (422) | no-op (changed=false) | rejected (422) |
| CANCELED | rejected (422) | rejected (422) | rejected (422) | no-op |

Verified by SHOP-TC-069, SHOP-TC-070, SHOP-TC-071, SHOP-TC-066, SHOP-TC-067.

## 4. Decision table — cart quantity validation

| Input | Existing line qty | Stock | Result | Rule verified by |
|-------|-------------------|-------|--------|------------------|
| quantity 1..10, first add | 0 | >= qty | accepted (201) | SHOP-TC-038 |
| quantity 11 | any | any | 400 validation | SHOP-TC-038 |
| quantity 0 / 1.5 | any | any | 400 validation | SHOP-TC-038, SHOP-TC-043 |
| quantity 4 | 0 | 3 | 422 INSUFFICIENT_STOCK | SHOP-TC-039 |
| quantity 5 | 6 | 25 | 422 QUANTITY_LIMIT_EXCEEDED | SHOP-TC-040 |
| quantity 1 | 0 | 0 | 422 OUT_OF_STOCK | SHOP-TC-041 |

## 5. Equivalence partitioning — search terms

| Partition | Example | Expectation | Case |
|-----------|---------|-------------|------|
| Exact match | 'Ember Ceramic Mug Set' | 1 result | SHOP-TC-014 |
| Partial, different case | 'WIRELESS' | only matching items | SHOP-TC-014 |
| Wildcard characters | '%', '_' | literal handling only | SHOP-TC-015 |
| No match | 'zzzz-no-such-product' | empty page, 200 | SHOP-TC-016 |
| Whitespace only | '  ' | treated as no filter | MAN-EDGE-08 |
| Very long | 500 characters | empty page, 200 | MAN-EDGE-02 |

## 6. Exploratory charters

1. **Hostile input charter** — attack the catalog and cart with injections, oversized payloads and malformed
   JSON; look for 5xx responses, data damage or information leaks (executed: MAN-SEC-01..13).
2. **Boundary sweep charter** — walk every numeric boundary in the API (quantities, limits, prices, pages)
   and confirm the documented rule at the exact edge (executed: MAN-EDGE-01..09).
3. **Workflow charter** — drive an order through every status by both customer and admin paths, including
   illegal jumps, and confirm stock and history stay consistent (executed: API suites + MAN-DATA-01/02).
