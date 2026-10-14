# ShopSure — acceptance criteria

> Generated from `test-data/tests/requirements.mjs` by `npm run docs:csv` — do not edit by hand.

| Criterion | Requirement | Statement | Verified by |
|-----------|-------------|-----------|-------------|
| AC-001 | SHOP-REQ-001 | Valid registration returns 201 and starts an authenticated session. | SHOP-TC-001, SHOP-TC-002, SHOP-TC-003, SHOP-TC-004 |
| AC-002 | SHOP-REQ-001 | Duplicate emails return 409 without creating a second account. | SHOP-TC-001, SHOP-TC-002, SHOP-TC-003, SHOP-TC-004 |
| AC-003 | SHOP-REQ-001 | Name, email and password are validated with field-level details. | SHOP-TC-001, SHOP-TC-002, SHOP-TC-003, SHOP-TC-004 |
| AC-004 | SHOP-REQ-002 | Valid credentials return 200 and a session cookie protected with HttpOnly and SameSite=Lax. | SHOP-TC-005, SHOP-TC-006, SHOP-TC-007, SHOP-TC-008, SHOP-TC-009, SHOP-TC-010 |
| AC-005 | SHOP-REQ-002 | Invalid credentials return the same generic 401 for unknown emails and wrong passwords. | SHOP-TC-005, SHOP-TC-006, SHOP-TC-007, SHOP-TC-008, SHOP-TC-009, SHOP-TC-010 |
| AC-006 | SHOP-REQ-002 | Logout invalidates the session so protected endpoints return 401. | SHOP-TC-005, SHOP-TC-006, SHOP-TC-007, SHOP-TC-008, SHOP-TC-009, SHOP-TC-010 |
| AC-007 | SHOP-REQ-002 | No response contains password hashes or salts. | SHOP-TC-005, SHOP-TC-006, SHOP-TC-007, SHOP-TC-008, SHOP-TC-009, SHOP-TC-010 |
| AC-008 | SHOP-REQ-003 | The 6th consecutive failed login within the window returns 429 TOO_MANY_ATTEMPTS. | SHOP-TC-011 |
| AC-009 | SHOP-REQ-004 | The default listing returns 12 active products with total counts and an X-Total-Count header. | SHOP-TC-012, SHOP-TC-013 |
| AC-010 | SHOP-REQ-004 | Inactive products never appear in the storefront. | SHOP-TC-012, SHOP-TC-013 |
| AC-011 | SHOP-REQ-005 | Search matches partial terms case-insensitively in name and description. | SHOP-TC-014, SHOP-TC-015, SHOP-TC-016, SHOP-TC-017 |
| AC-012 | SHOP-REQ-005 | '%' and '_' are treated as literal characters, not wildcards. | SHOP-TC-014, SHOP-TC-015, SHOP-TC-016, SHOP-TC-017 |
| AC-013 | SHOP-REQ-005 | No-match searches return an empty page with 200, never an error. | SHOP-TC-014, SHOP-TC-015, SHOP-TC-016, SHOP-TC-017 |
| AC-014 | SHOP-REQ-006 | Sorting by price returns a correctly ordered list. | SHOP-TC-018, SHOP-TC-019, SHOP-TC-020, SHOP-TC-021 |
| AC-015 | SHOP-REQ-006 | Unsupported sort fields and orders return 400 VALIDATION_ERROR. | SHOP-TC-018, SHOP-TC-019, SHOP-TC-020, SHOP-TC-021 |
| AC-016 | SHOP-REQ-007 | Category filtering returns only that category. | SHOP-TC-022, SHOP-TC-023, SHOP-TC-024, SHOP-TC-025, SHOP-TC-026, SHOP-TC-027, SHOP-TC-028 |
| AC-017 | SHOP-REQ-007 | minPrice and maxPrice boundaries are inclusive. | SHOP-TC-022, SHOP-TC-023, SHOP-TC-024, SHOP-TC-025, SHOP-TC-026, SHOP-TC-027, SHOP-TC-028 |
| AC-018 | SHOP-REQ-007 | inStock=true excludes zero-stock products; inStock=false returns only zero-stock products. | SHOP-TC-022, SHOP-TC-023, SHOP-TC-024, SHOP-TC-025, SHOP-TC-026, SHOP-TC-027, SHOP-TC-028 |
| AC-019 | SHOP-REQ-007 | minPrice greater than maxPrice returns 400. | SHOP-TC-022, SHOP-TC-023, SHOP-TC-024, SHOP-TC-025, SHOP-TC-026, SHOP-TC-027, SHOP-TC-028 |
| AC-020 | SHOP-REQ-008 | limit is accepted between 1 and 50; 0 and 51 return 400. | SHOP-TC-029, SHOP-TC-030, SHOP-TC-031 |
| AC-021 | SHOP-REQ-008 | Page beyond the last page returns an empty list with the correct total. | SHOP-TC-029, SHOP-TC-030, SHOP-TC-031 |
| AC-022 | SHOP-REQ-009 | Existing product returns 200 with pricing and stock. | SHOP-TC-032, SHOP-TC-033, SHOP-TC-034 |
| AC-023 | SHOP-REQ-009 | Unknown id returns 404; non-numeric id returns 400. | SHOP-TC-032, SHOP-TC-033, SHOP-TC-034 |
| AC-024 | SHOP-REQ-010 | Adding a product returns the recomputed cart with correct line totals. | SHOP-TC-035, SHOP-TC-036, SHOP-TC-037 |
| AC-025 | SHOP-REQ-010 | Adding the same product merges quantities into one line. | SHOP-TC-035, SHOP-TC-036, SHOP-TC-037 |
| AC-026 | SHOP-REQ-011 | Quantities 1 and 10 are accepted; 0, 11 and fractional values return 400. | SHOP-TC-038, SHOP-TC-039, SHOP-TC-040, SHOP-TC-041, SHOP-TC-042, SHOP-TC-043 |
| AC-027 | SHOP-REQ-011 | Requests above available stock return 422 INSUFFICIENT_STOCK. | SHOP-TC-038, SHOP-TC-039, SHOP-TC-040, SHOP-TC-041, SHOP-TC-042, SHOP-TC-043 |
| AC-028 | SHOP-REQ-011 | Merging beyond 10 units returns 422 QUANTITY_LIMIT_EXCEEDED. | SHOP-TC-038, SHOP-TC-039, SHOP-TC-040, SHOP-TC-041, SHOP-TC-042, SHOP-TC-043 |
| AC-029 | SHOP-REQ-011 | Out-of-stock products return 422 OUT_OF_STOCK. | SHOP-TC-038, SHOP-TC-039, SHOP-TC-040, SHOP-TC-041, SHOP-TC-042, SHOP-TC-043 |
| AC-030 | SHOP-REQ-012 | Updating a line recalculates the cart totals. | SHOP-TC-044, SHOP-TC-045, SHOP-TC-046, SHOP-TC-047 |
| AC-031 | SHOP-REQ-012 | Removing a line and clearing the cart both result in an empty cart. | SHOP-TC-044, SHOP-TC-045, SHOP-TC-046, SHOP-TC-047 |
| AC-032 | SHOP-REQ-012 | Another customer cannot read, modify or delete someone else's cart line (404). | SHOP-TC-044, SHOP-TC-045, SHOP-TC-046, SHOP-TC-047 |
| AC-033 | SHOP-REQ-013 | Successful orders decrement stock by the ordered quantity. | SHOP-TC-048, SHOP-TC-049 |
| AC-034 | SHOP-REQ-013 | When stock is insufficient at checkout the order is rejected with 422 and no partial data is written. | SHOP-TC-048, SHOP-TC-049 |
| AC-035 | SHOP-REQ-013 | Stock can never become negative. | SHOP-TC-048, SHOP-TC-049 |
| AC-036 | SHOP-REQ-014 | Subtotal 49.99 charges 5.00 shipping; 50.00 is free. | SHOP-TC-050, SHOP-TC-051, SHOP-TC-052, SHOP-TC-053 |
| AC-037 | SHOP-REQ-014 | Subtotal 99.99 has no discount; 100.00 receives 10%. | SHOP-TC-050, SHOP-TC-051, SHOP-TC-052, SHOP-TC-053 |
| AC-038 | SHOP-REQ-014 | total = subtotal - discount + shipping, rounded to 2 decimals. | SHOP-TC-050, SHOP-TC-051, SHOP-TC-052, SHOP-TC-053 |
| AC-039 | SHOP-REQ-015 | Invalid name, email, phone, address, city and postcode each produce a field-level 400 error. | SHOP-TC-054, SHOP-TC-055, SHOP-TC-056, SHOP-TC-057 |
| AC-040 | SHOP-REQ-015 | Postcodes shorter than 3 or longer than 10 characters are rejected. | SHOP-TC-054, SHOP-TC-055, SHOP-TC-056, SHOP-TC-057 |
| AC-041 | SHOP-REQ-015 | Checkout with an empty cart returns 422 EMPTY_CART. | SHOP-TC-054, SHOP-TC-055, SHOP-TC-056, SHOP-TC-057 |
| AC-042 | SHOP-REQ-016 | Checkout returns 201 with the created order and its line items. | SHOP-TC-058, SHOP-TC-059, SHOP-TC-060, SHOP-TC-061 |
| AC-043 | SHOP-REQ-016 | Order numbers match ORD-##### and are unique. | SHOP-TC-058, SHOP-TC-059, SHOP-TC-060, SHOP-TC-061 |
| AC-044 | SHOP-REQ-016 | Order creation records a PENDING event and clears the cart. | SHOP-TC-058, SHOP-TC-059, SHOP-TC-060, SHOP-TC-061 |
| AC-045 | SHOP-REQ-016 | Stored totals and line totals are consistent with the pricing rules. | SHOP-TC-058, SHOP-TC-059, SHOP-TC-060, SHOP-TC-061 |
| AC-046 | SHOP-REQ-017 | Order history returns only the current customer's orders. | SHOP-TC-062, SHOP-TC-063, SHOP-TC-064 |
| AC-047 | SHOP-REQ-017 | Reading another customer's order returns 404. | SHOP-TC-062, SHOP-TC-063, SHOP-TC-064 |
| AC-048 | SHOP-REQ-018 | Cancelling restores the stock of every ordered line. | SHOP-TC-065, SHOP-TC-066, SHOP-TC-067, SHOP-TC-068 |
| AC-049 | SHOP-REQ-018 | Cancellation is recorded in the event history. | SHOP-TC-065, SHOP-TC-066, SHOP-TC-067, SHOP-TC-068 |
| AC-050 | SHOP-REQ-018 | SHIPPED/DELIVERED orders cannot be cancelled (422 INVALID_TRANSITION). | SHOP-TC-065, SHOP-TC-066, SHOP-TC-067, SHOP-TC-068 |
| AC-051 | SHOP-REQ-018 | A second cancellation of the same order is rejected. | SHOP-TC-065, SHOP-TC-066, SHOP-TC-067, SHOP-TC-068 |
| AC-052 | SHOP-REQ-019 | Illegal jumps (PENDING -> SHIPPED/DELIVERED) return 422 INVALID_TRANSITION. | SHOP-TC-069, SHOP-TC-070, SHOP-TC-071, SHOP-TC-072, SHOP-TC-073 |
| AC-053 | SHOP-REQ-019 | Setting the current status is a no-op that reports changed=false. | SHOP-TC-069, SHOP-TC-070, SHOP-TC-071, SHOP-TC-072, SHOP-TC-073 |
| AC-054 | SHOP-REQ-019 | Cancelling an admin order restores stock. | SHOP-TC-069, SHOP-TC-070, SHOP-TC-071, SHOP-TC-072, SHOP-TC-073 |
| AC-055 | SHOP-REQ-020 | Stock updates accept 0..100000 and reject negative or non-integer values with 400. | SHOP-TC-074, SHOP-TC-075, SHOP-TC-076, SHOP-TC-077 |
| AC-056 | SHOP-REQ-020 | Duplicate SKUs are rejected with 409 DUPLICATE_SKU. | SHOP-TC-074, SHOP-TC-075, SHOP-TC-076, SHOP-TC-077 |
| AC-057 | SHOP-REQ-020 | Deactivated products disappear from the storefront. | SHOP-TC-074, SHOP-TC-075, SHOP-TC-076, SHOP-TC-077 |
| AC-058 | SHOP-REQ-020 | Stock 0 makes a product unpurchasable while remaining visible. | SHOP-TC-074, SHOP-TC-075, SHOP-TC-076, SHOP-TC-077 |
| AC-059 | SHOP-REQ-021 | Unauthenticated admin requests return 401. | SHOP-TC-078, SHOP-TC-079, SHOP-TC-080, SHOP-TC-081 |
| AC-060 | SHOP-REQ-021 | Customer sessions receive 403 on every admin endpoint. | SHOP-TC-078, SHOP-TC-079, SHOP-TC-080, SHOP-TC-081 |
| AC-061 | SHOP-REQ-021 | The admin user list never exposes password material. | SHOP-TC-078, SHOP-TC-079, SHOP-TC-080, SHOP-TC-081 |
| AC-062 | SHOP-REQ-022 | SQL injection attempts in query and login parameters never authenticate, drop data or leak SQL errors. | SHOP-TC-082, SHOP-TC-083, SHOP-TC-084, SHOP-TC-085, SHOP-TC-086, SHOP-TC-087, SHOP-TC-100, SHOP-TC-101 |
| AC-063 | SHOP-REQ-022 | Client-supplied fields such as status, total or discount are ignored. | SHOP-TC-082, SHOP-TC-083, SHOP-TC-084, SHOP-TC-085, SHOP-TC-086, SHOP-TC-087, SHOP-TC-100, SHOP-TC-101 |
| AC-064 | SHOP-REQ-022 | Malformed JSON returns 400 and oversized bodies return 413. | SHOP-TC-082, SHOP-TC-083, SHOP-TC-084, SHOP-TC-085, SHOP-TC-086, SHOP-TC-087, SHOP-TC-100, SHOP-TC-101 |
| AC-065 | SHOP-REQ-022 | Markup in stored names is escaped by the client renderer. | SHOP-TC-082, SHOP-TC-083, SHOP-TC-084, SHOP-TC-085, SHOP-TC-086, SHOP-TC-087, SHOP-TC-100, SHOP-TC-101 |
| AC-066 | SHOP-REQ-023 | CHECK constraints reject negative prices/stock and invalid statuses. | SHOP-TC-088, SHOP-TC-089, SHOP-TC-090, SHOP-TC-091, SHOP-TC-092, SHOP-TC-093 |
| AC-067 | SHOP-REQ-023 | UNIQUE constraints prevent duplicate emails, SKUs and cart lines. | SHOP-TC-088, SHOP-TC-089, SHOP-TC-090, SHOP-TC-091, SHOP-TC-092, SHOP-TC-093 |
| AC-068 | SHOP-REQ-023 | No foreign-key violations and no orphan rows exist after the suites run. | SHOP-TC-088, SHOP-TC-089, SHOP-TC-090, SHOP-TC-091, SHOP-TC-092, SHOP-TC-093 |
| AC-069 | SHOP-REQ-023 | Every order has at least one PENDING event and cancelled orders record a CANCELED event. | SHOP-TC-088, SHOP-TC-089, SHOP-TC-090, SHOP-TC-091, SHOP-TC-092, SHOP-TC-093 |
| AC-070 | SHOP-REQ-024 | Empty states are shown for no-match searches and empty carts. | SHOP-TC-094, SHOP-TC-095, SHOP-TC-096, SHOP-TC-097, SHOP-TC-098, SHOP-TC-099 |
| AC-071 | SHOP-REQ-024 | API errors appear in an accessible alert region. | SHOP-TC-094, SHOP-TC-095, SHOP-TC-096, SHOP-TC-097, SHOP-TC-098, SHOP-TC-099 |
| AC-072 | SHOP-REQ-024 | The catalog, product page and cart are usable at 390x844. | SHOP-TC-094, SHOP-TC-095, SHOP-TC-096, SHOP-TC-097, SHOP-TC-098, SHOP-TC-099 |

## Definition of done for the ShopSure demo

- Every acceptance criterion above is linked to at least one executed test case (see the traceability matrix).
- The automated suites (API, UI, SQL, Postman) pass on a freshly seeded database.
- Known limitations and any open defects are documented in `risk-assessment.md` and `defect-log.csv`.
