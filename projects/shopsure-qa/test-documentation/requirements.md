# ShopSure — product requirements

> Generated from `test-data/tests/requirements.mjs` by `npm run docs:csv` — do not edit by hand.

ShopSure is a fictional demo storefront built specifically as a test target for this QA portfolio project.
It is not a commercial product and contains no real customer data.

**24 requirements** drive **101 test cases**.

| ID | Module | Requirement | Priority |
|----|--------|-------------|----------|
| SHOP-REQ-001 | Authentication | User registration | High |
| SHOP-REQ-002 | Authentication | Login, session handling and logout | High |
| SHOP-REQ-003 | Security | Brute-force protection | Medium |
| SHOP-REQ-004 | Catalog | Product listing | High |
| SHOP-REQ-005 | Catalog | Product search | High |
| SHOP-REQ-006 | Catalog | Sorting | Medium |
| SHOP-REQ-007 | Catalog | Filtering | High |
| SHOP-REQ-008 | Catalog | Pagination | Medium |
| SHOP-REQ-009 | Catalog | Product detail | Medium |
| SHOP-REQ-010 | Cart | Add to cart and merge | High |
| SHOP-REQ-011 | Cart | Cart quantity limits | High |
| SHOP-REQ-012 | Cart | Cart update, remove and clear | Medium |
| SHOP-REQ-013 | Checkout | Stock validation at checkout | Critical |
| SHOP-REQ-014 | Checkout | Pricing rules | Critical |
| SHOP-REQ-015 | Checkout | Checkout form validation | High |
| SHOP-REQ-016 | Orders | Order creation and persistence | Critical |
| SHOP-REQ-017 | Orders | Order history and data isolation | High |
| SHOP-REQ-018 | Orders | Order cancellation and stock restore | High |
| SHOP-REQ-019 | Orders | Order status workflow (admin) | High |
| SHOP-REQ-020 | Admin | Inventory management | Medium |
| SHOP-REQ-021 | Security | Role-based access control | Critical |
| SHOP-REQ-022 | Security | Input safety and request hardening | Critical |
| SHOP-REQ-023 | Data | Database integrity and audit trail | Critical |
| SHOP-REQ-024 | Usability | Empty, loading and error states | Medium |

## Details

### SHOP-REQ-001 — User registration

- **Module:** Authentication
- **Priority:** High
- **Description:** A visitor can create a customer account with a unique email, a display name and a password that satisfies the password policy.
- **Test cases:** SHOP-TC-001, SHOP-TC-002, SHOP-TC-003, SHOP-TC-004

### SHOP-REQ-002 — Login, session handling and logout

- **Module:** Authentication
- **Priority:** High
- **Description:** Registered users can authenticate with email + password, receive an HttpOnly session cookie and log out, which invalidates the session.
- **Test cases:** SHOP-TC-005, SHOP-TC-006, SHOP-TC-007, SHOP-TC-008, SHOP-TC-009, SHOP-TC-010

### SHOP-REQ-003 — Brute-force protection

- **Module:** Security
- **Priority:** Medium
- **Description:** Repeated failed logins for the same email/IP are throttled to slow down credential attacks.
- **Test cases:** SHOP-TC-011

### SHOP-REQ-004 — Product listing

- **Module:** Catalog
- **Priority:** High
- **Description:** The storefront lists active products with price, stock, category and image information.
- **Test cases:** SHOP-TC-012, SHOP-TC-013

### SHOP-REQ-005 — Product search

- **Module:** Catalog
- **Priority:** High
- **Description:** Free-text search matches product names and descriptions case-insensitively without allowing LIKE wildcard abuse.
- **Test cases:** SHOP-TC-014, SHOP-TC-015, SHOP-TC-016, SHOP-TC-017

### SHOP-REQ-006 — Sorting

- **Module:** Catalog
- **Priority:** Medium
- **Description:** Users can sort by name, price, stock and creation date in ascending or descending order using a whitelist.
- **Test cases:** SHOP-TC-018, SHOP-TC-019, SHOP-TC-020, SHOP-TC-021

### SHOP-REQ-007 — Filtering

- **Module:** Catalog
- **Priority:** High
- **Description:** Products can be filtered by category, price range and stock availability, with inclusive boundaries.
- **Test cases:** SHOP-TC-022, SHOP-TC-023, SHOP-TC-024, SHOP-TC-025, SHOP-TC-026, SHOP-TC-027, SHOP-TC-028

### SHOP-REQ-008 — Pagination

- **Module:** Catalog
- **Priority:** Medium
- **Description:** List endpoints paginate with a page/limit contract and reject invalid pagination parameters.
- **Test cases:** SHOP-TC-029, SHOP-TC-030, SHOP-TC-031

### SHOP-REQ-009 — Product detail

- **Module:** Catalog
- **Priority:** Medium
- **Description:** A single active product can be retrieved by id; unknown or invalid ids are rejected.
- **Test cases:** SHOP-TC-032, SHOP-TC-033, SHOP-TC-034

### SHOP-REQ-010 — Add to cart and merge

- **Module:** Cart
- **Priority:** High
- **Description:** Authenticated customers add products to a per-user cart; adding the same product merges into a single line.
- **Test cases:** SHOP-TC-035, SHOP-TC-036, SHOP-TC-037

### SHOP-REQ-011 — Cart quantity limits

- **Module:** Cart
- **Priority:** High
- **Description:** A cart line is limited to 10 units and can never exceed the available stock, including when merging.
- **Test cases:** SHOP-TC-038, SHOP-TC-039, SHOP-TC-040, SHOP-TC-041, SHOP-TC-042, SHOP-TC-043

### SHOP-REQ-012 — Cart update, remove and clear

- **Module:** Cart
- **Priority:** Medium
- **Description:** Customers can change quantities, remove single lines and clear the whole cart; carts are private to their owner.
- **Test cases:** SHOP-TC-044, SHOP-TC-045, SHOP-TC-046, SHOP-TC-047

### SHOP-REQ-013 — Stock validation at checkout

- **Module:** Checkout
- **Priority:** Critical
- **Description:** Checkout re-validates stock and fails atomically when stock changed after the cart was filled.
- **Test cases:** SHOP-TC-048, SHOP-TC-049

### SHOP-REQ-014 — Pricing rules

- **Module:** Checkout
- **Priority:** Critical
- **Description:** Discount (10% from subtotal 100.00) and shipping (free from subtotal 50.00) rules are applied consistently.
- **Test cases:** SHOP-TC-050, SHOP-TC-051, SHOP-TC-052, SHOP-TC-053

### SHOP-REQ-015 — Checkout form validation

- **Module:** Checkout
- **Priority:** High
- **Description:** All shipping fields are validated with field-level error details and sensible boundaries.
- **Test cases:** SHOP-TC-054, SHOP-TC-055, SHOP-TC-056, SHOP-TC-057

### SHOP-REQ-016 — Order creation and persistence

- **Module:** Orders
- **Priority:** Critical
- **Description:** Orders are created in PENDING status with a unique ORD-##### number, persisted line items and an audit event.
- **Test cases:** SHOP-TC-058, SHOP-TC-059, SHOP-TC-060, SHOP-TC-061

### SHOP-REQ-017 — Order history and data isolation

- **Module:** Orders
- **Priority:** High
- **Description:** Customers see only their own orders, newest first; other users' orders are not reachable.
- **Test cases:** SHOP-TC-062, SHOP-TC-063, SHOP-TC-064

### SHOP-REQ-018 — Order cancellation and stock restore

- **Module:** Orders
- **Priority:** High
- **Description:** PENDING and PAID orders can be cancelled by their owner, restoring stock and recording the transition.
- **Test cases:** SHOP-TC-065, SHOP-TC-066, SHOP-TC-067, SHOP-TC-068

### SHOP-REQ-019 — Order status workflow (admin)

- **Module:** Orders
- **Priority:** High
- **Description:** Only legal transitions are allowed: PENDING -> PAID -> SHIPPED -> DELIVERED, plus CANCELED from PENDING/PAID.
- **Test cases:** SHOP-TC-069, SHOP-TC-070, SHOP-TC-071, SHOP-TC-072, SHOP-TC-073

### SHOP-REQ-020 — Inventory management

- **Module:** Admin
- **Priority:** Medium
- **Description:** Administrators manage products: create, update, adjust stock and deactivate items.
- **Test cases:** SHOP-TC-074, SHOP-TC-075, SHOP-TC-076, SHOP-TC-077

### SHOP-REQ-021 — Role-based access control

- **Module:** Security
- **Priority:** Critical
- **Description:** Administrative endpoints require the ADMIN role and are protected server-side, not only in the UI.
- **Test cases:** SHOP-TC-078, SHOP-TC-079, SHOP-TC-080, SHOP-TC-081

### SHOP-REQ-022 — Input safety and request hardening

- **Module:** Security
- **Priority:** Critical
- **Description:** SQL injection, mass assignment, malformed JSON and oversized payloads are handled safely.
- **Test cases:** SHOP-TC-082, SHOP-TC-083, SHOP-TC-084, SHOP-TC-085, SHOP-TC-086, SHOP-TC-087, SHOP-TC-100, SHOP-TC-101

### SHOP-REQ-023 — Database integrity and audit trail

- **Module:** Data
- **Priority:** Critical
- **Description:** Constraints, relationships and audit events keep stored data trustworthy even when API calls fail.
- **Test cases:** SHOP-TC-088, SHOP-TC-089, SHOP-TC-090, SHOP-TC-091, SHOP-TC-092, SHOP-TC-093

### SHOP-REQ-024 — Empty, loading and error states

- **Module:** Usability
- **Priority:** Medium
- **Description:** The SPA communicates loading, empty and error states and remains usable on mobile viewports.
- **Test cases:** SHOP-TC-094, SHOP-TC-095, SHOP-TC-096, SHOP-TC-097, SHOP-TC-098, SHOP-TC-099
