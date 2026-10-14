# ShopSure — Database Testing

- **Engine:** SQLite via Node's built-in `node:sqlite` (`DatabaseSync`) — no native modules required.
- **Schema:** `app/server/src/db.js` · **Seed:** `app/server/src/seed.js` + `test-data/seed/seed-data.mjs`
- **Checks:** `tests/db/constraints.mjs` (23 checks) · **Runner:** `scripts/run-db-checks.mjs` (`npm run test:db`)
- **Raw results:** `test-reports/db-checks.json`

## 1. Why database testing matters here

API tests prove *behaviour*; they cannot prove that the database itself refuses to store nonsense.
If a future code path bypasses the API validation, the schema is the last line of defence. These checks
verify constraints, relationships and business-rule consistency directly in SQL, and they run **after**
the API and UI suites so they also inspect data produced by real user journeys.

## 2. Tables under test

| Table | Purpose | Key rules |
|-------|---------|-----------|
| `users` | Accounts | unique, case-insensitive email; scrypt hash + salt; role ∈ {CUSTOMER, ADMIN} |
| `sessions` | Login sessions | token primary key; FK to users; future expiry |
| `categories` | Catalog taxonomy | unique name/slug |
| `products` | Catalog | unique SKU; price > 0; stock ≥ 0; FK category; active flag |
| `cart_items` | Per-user cart | unique (user, product); quantity 1..10 (CHECK); FKs |
| `orders` | Orders | unique ORD-##### number; status CHECK; FK user |
| `order_items` | Order lines | FK order (cascade); quantity ≥ 1 |
| `order_events` | Status audit trail | FK order; from/to status pair |

## 3. Check catalogue

| ID | Check | Method |
|----|-------|--------|
| DB-01 | Seed reference data complete (≥3 users, 6 categories, ≥24 products) | `SELECT COUNT(*)` |
| DB-02 | At least one out-of-stock product exists for negative testing | `SELECT COUNT(*) ... WHERE stock = 0` |
| DB-03 | `price > 0` CHECK rejects a negative price | INSERT expected to fail |
| DB-04 | `stock >= 0` CHECK rejects negative stock | INSERT expected to fail |
| DB-05 | UNIQUE SKU rejects duplicates | INSERT expected to fail |
| DB-06 | UNIQUE, case-insensitive email rejects duplicates | INSERT expected to fail |
| DB-07 | UNIQUE (user_id, product_id) prevents duplicate cart lines | INSERT expected to fail |
| DB-08 | Cart quantity CHECK enforces 1..10 at database level | UPDATE expected to fail |
| DB-09 | Order status CHECK rejects unknown statuses | INSERT expected to fail |
| DB-10 | No foreign-key violations anywhere | `PRAGMA foreign_key_check` |
| DB-11 | No order items without a parent order | LEFT JOIN orphan query |
| DB-12 | Every order has at least one order item | NOT EXISTS query |
| DB-13 | `total = subtotal - discount + shipping` for every order | ROUND comparison |
| DB-14 | `line_total = unit_price × quantity` for every line | ROUND comparison |
| DB-15 | Discount rule consistent for all stored orders (10% from 100.00) | Rule query |
| DB-16 | Shipping rule consistent for all stored orders (free from 50.00) | Rule query |
| DB-17 | Order numbers match `ORD-#####` | GLOB pattern |
| DB-18 | Order numbers are unique | GROUP BY/HAVING |
| DB-19 | Passwords are 128-char scrypt hashes with 32-char salts, never plaintext | Length + value comparison |
| DB-20 | No session row carries a past expiry | Date comparison |
| DB-21 | Every order event belongs to an existing order | LEFT JOIN orphan query |
| DB-22 | Every order records its initial `PENDING` event | NOT EXISTS query |
| DB-23 | Cancelled orders always have a `CANCELED` event | NOT EXISTS query |

## 4. Representative SQL

Business-rule consistency that a pure API test cannot see:

```sql
-- DB-13: stored totals must equal the pricing formula
SELECT COUNT(*) AS bad_totals
FROM orders
WHERE ROUND(subtotal - discount + shipping_fee, 2) <> ROUND(total, 2);

-- DB-15: the discount rule must hold for every stored order
SELECT COUNT(*) AS inconsistent
FROM orders
WHERE (subtotal >= 100 AND discount = 0) OR (subtotal < 100 AND discount <> 0);

-- DB-22: every order must have an initial PENDING event
SELECT COUNT(*) AS missing
FROM orders o
WHERE NOT EXISTS (
  SELECT 1 FROM order_events e
  WHERE e.order_id = o.id AND e.to_status = 'PENDING' AND e.from_status IS NULL
);

-- DB-19: credential storage sanity
SELECT COUNT(*) AS weak
FROM users
WHERE length(password_hash) < 64 OR length(salt) < 16
   OR password_hash IN ('Customer#12345', 'Admin#12345', 'Second#12345');
```

## 5. How to run

```powershell
# Self-contained: resets + seeds .data/shopsure.db, then runs all checks
npm run test:db

# Check the current state of the Playwright database (used by npm run test:all)
node scripts/run-db-checks.mjs --no-reset --db .data/shopsure.e2e.db --json test-reports/db-checks.json

# Check any database file
node scripts/run-db-checks.mjs --db path/to/file.db
```

## 6. Setup, teardown and isolation

- The runner deletes and recreates the target database, then applies the deterministic seed, so results
  never depend on previous runs.
- In the full orchestrator the SQL checks run **without** a reset, deliberately inspecting the state
  left behind by the API and UI suites (this is how SHOP-BUG-001 was discovered).
- No production database, dump or real personal data is ever used. Databases live under `.data/` and
  `app/server/data/` and are git-ignored.

## 7. Defect found by these checks

| Defect | Symptom | Detection | Resolution |
|--------|---------|-----------|------------|
| SHOP-BUG-001 | The seeded `DELIVERED` order only had a single `DELIVERED` event; the PENDING → PAID → SHIPPED chain was missing, so order history looked wrong. | DB-22 failed (1 order missing its initial PENDING event) | Seed now writes the full status chain per order status; DB-22 and the API event tests pass on re-run. |

## 8. Limitations

- SQLite-specific SQL is used (`PRAGMA`, `GLOB`, `ROUND`); porting to MySQL/PostgreSQL would require
  equivalent queries — the check ideas transfer 1:1.
- No migration framework: the schema is created idempotently from `db.js`. Checks therefore validate
  the current schema rather than migration history.
- Concurrency is limited by SQLite's single-writer model; race conditions under real parallel writes
  are out of scope for this demo.
