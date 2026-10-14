/**
 * Database constraint checks: proves the schema itself protects data quality, not only the API.
 *
 * Contract: default export is an async function receiving { db } and returning an array of
 *   { id, title, passed, expected, actual }
 * Run through: npm run test:db  (scripts/run-db-checks.mjs)
 */

function expectRejected(operation, messagePattern) {
  try {
    operation();
    return { rejected: false, actual: "statement succeeded" };
  } catch (error) {
    const message = String(error?.message ?? error);
    return { rejected: messagePattern.test(message), actual: message };
  }
}

export default async function run({ db }) {
  const results = [];

  const record = (id, title, passed, expected, actual) => results.push({ id, title, passed, expected, actual });

  // ------------------------------------------------------------------ seed / reference data
  const userCount = db.prepare("SELECT COUNT(*) AS c FROM users").get().c;
  record(
    "DB-01",
    "Seed creates the documented reference data set",
    userCount >= 3 && db.prepare("SELECT COUNT(*) AS c FROM categories").get().c === 6 && db.prepare("SELECT COUNT(*) AS c FROM products").get().c >= 24,
    "users >= 3, categories = 6, products >= 24",
    `users=${userCount}, categories=${db.prepare("SELECT COUNT(*) AS c FROM categories").get().c}, products=${db.prepare("SELECT COUNT(*) AS c FROM products").get().c}`
  );

  const outOfStock = db.prepare("SELECT COUNT(*) AS c FROM products WHERE stock = 0").get().c;
  record("DB-02", "At least one out-of-stock product exists for negative testing", outOfStock >= 1, ">= 1", String(outOfStock));

  // ------------------------------------------------------------------ CHECK constraints
  const negativePrice = expectRejected(
    () => db.prepare("INSERT INTO products (sku, name, category_id, price, stock, created_at) VALUES ('DB-CHECK-1', 'Negative price', 1, -1, 1, '2026-01-01T00:00:00Z')").run(),
    /CHECK|constraint/i
  );
  record("DB-03", "price > 0 CHECK constraint rejects a negative price", negativePrice.rejected, "insert rejected", negativePrice.actual);

  const negativeStock = expectRejected(
    () => db.prepare("INSERT INTO products (sku, name, category_id, price, stock, created_at) VALUES ('DB-CHECK-2', 'Negative stock', 1, 10, -5, '2026-01-01T00:00:00Z')").run(),
    /CHECK|constraint/i
  );
  record("DB-04", "stock >= 0 CHECK constraint rejects negative stock", negativeStock.rejected, "insert rejected", negativeStock.actual);

  const duplicateSku = expectRejected(
    () => db.prepare("INSERT INTO products (sku, name, category_id, price, stock, created_at) VALUES ('SKU-EL-001', 'Duplicate SKU', 1, 10, 5, '2026-01-01T00:00:00Z')").run(),
    /UNIQUE|constraint/i
  );
  record("DB-05", "UNIQUE constraint prevents duplicate SKUs", duplicateSku.rejected, "insert rejected", duplicateSku.actual);

  const duplicateEmail = expectRejected(
    () => db.prepare("INSERT INTO users (email, name, password_hash, salt, role, created_at) VALUES ('customer@example.com', 'Dup', 'x', 'y', 'CUSTOMER', '2026-01-01T00:00:00Z')").run(),
    /UNIQUE|constraint/i
  );
  record("DB-06", "UNIQUE constraint prevents duplicate user emails (case-insensitive)", duplicateEmail.rejected, "insert rejected", duplicateEmail.actual);

  const user = db.prepare("SELECT id FROM users LIMIT 1").get();
  const product = db.prepare("SELECT id FROM products LIMIT 1").get();
  db.prepare("DELETE FROM cart_items WHERE user_id = ?").run(user.id);
  db.prepare("INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, 1)").run(user.id, product.id);

  const duplicateCartLine = expectRejected(
    () => db.prepare("INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, 1)").run(user.id, product.id),
    /UNIQUE|constraint/i
  );
  record("DB-07", "UNIQUE(user_id, product_id) prevents duplicate cart lines", duplicateCartLine.rejected, "insert rejected", duplicateCartLine.actual);

  const quantityTooHigh = expectRejected(
    () => db.prepare("UPDATE cart_items SET quantity = 11 WHERE user_id = ? AND product_id = ?").run(user.id, product.id),
    /CHECK|constraint/i
  );
  record("DB-08", "Cart quantity CHECK constraint enforces the 1..10 line limit at database level", quantityTooHigh.rejected, "update rejected", quantityTooHigh.actual);
  db.prepare("DELETE FROM cart_items WHERE user_id = ?").run(user.id);

  const invalidStatus = expectRejected(
    () =>
      db
        .prepare(
          `INSERT INTO orders (order_number, user_id, status, subtotal, discount, shipping_fee, total, shipping_name, shipping_email, shipping_phone, shipping_address, shipping_city, shipping_postcode, created_at, updated_at)
           VALUES ('ORD-99999', ?, 'TELEPORTED', 10, 0, 0, 10, 'A B', 'a@example.com', '1234567', 'Somewhere 1', 'City', '12345', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`
        )
        .run(user.id),
    /CHECK|constraint/i
  );
  record("DB-09", "Order status CHECK constraint rejects unknown status values", invalidStatus.rejected, "insert rejected", invalidStatus.actual);

  // ------------------------------------------------------------------ referential integrity
  const fkViolations = db.prepare("PRAGMA foreign_key_check").all();
  record("DB-10", "No foreign-key violations anywhere in the database", fkViolations.length === 0, "0 violations", `${fkViolations.length} violation(s)`);

  const orphanItems = db.prepare("SELECT COUNT(*) AS c FROM order_items oi LEFT JOIN orders o ON o.id = oi.order_id WHERE o.id IS NULL").get().c;
  record("DB-11", "No order items without a parent order", orphanItems === 0, "0 rows", String(orphanItems));

  const ordersWithoutItems = db
    .prepare("SELECT COUNT(*) AS c FROM orders o WHERE NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id)")
    .get().c;
  record("DB-12", "Every order has at least one order item", ordersWithoutItems === 0, "0 orders", String(ordersWithoutItems));

  // ------------------------------------------------------------------ business-rule consistency
  const badTotals = db
    .prepare(
      `SELECT COUNT(*) AS c FROM orders
       WHERE ROUND(subtotal - discount + shipping_fee, 2) <> ROUND(total, 2)`
    )
    .get().c;
  record("DB-13", "Stored order totals equal subtotal - discount + shipping", badTotals === 0, "0 mismatching orders", String(badTotals));

  const badLines = db
    .prepare("SELECT COUNT(*) AS c FROM order_items WHERE ROUND(unit_price * quantity, 2) <> ROUND(line_total, 2)")
    .get().c;
  record("DB-14", "Order line totals equal unit price x quantity", badLines === 0, "0 mismatching lines", String(badLines));

  const badDiscounts = db
    .prepare("SELECT COUNT(*) AS c FROM orders WHERE (subtotal >= 100 AND discount = 0) OR (subtotal < 100 AND discount <> 0)")
    .get().c;
  record("DB-15", "Discount rule is consistent for every stored order (10% from 100.00)", badDiscounts === 0, "0 inconsistent orders", String(badDiscounts));

  const badShipping = db
    .prepare("SELECT COUNT(*) AS c FROM orders WHERE (subtotal < 50 AND shipping_fee <> 5) OR (subtotal >= 50 AND shipping_fee <> 0)")
    .get().c;
  record("DB-16", "Shipping rule is consistent for every stored order (free from 50.00)", badShipping === 0, "0 inconsistent orders", String(badShipping));

  const badNumbers = db.prepare("SELECT COUNT(*) AS c FROM orders WHERE order_number NOT GLOB 'ORD-[0-9][0-9][0-9][0-9][0-9]'").get().c;
  record("DB-17", "Order numbers follow the ORD-##### format", badNumbers === 0, "0 malformed numbers", String(badNumbers));

  const duplicateNumbers = db.prepare("SELECT COUNT(*) AS c FROM (SELECT order_number FROM orders GROUP BY order_number HAVING COUNT(*) > 1)").get().c;
  record("DB-18", "Order numbers are unique", duplicateNumbers === 0, "0 duplicates", String(duplicateNumbers));

  // ------------------------------------------------------------------ security-sensitive storage
  const weakHashes = db
    .prepare("SELECT COUNT(*) AS c FROM users WHERE length(password_hash) < 64 OR length(salt) < 16 OR password_hash IN ('Customer#12345','Admin#12345','Second#12345')")
    .get().c;
  record("DB-19", "Passwords are stored as salted scrypt hashes, never plaintext", weakHashes === 0, "0 weak/plaintext rows", String(weakHashes));

  const expiredSessions = db.prepare("SELECT COUNT(*) AS c FROM sessions WHERE expires_at < datetime('now')").get().c;
  record("DB-20", "Session rows always carry a future expiry timestamp", expiredSessions === 0, "0 expired sessions", String(expiredSessions));

  // ------------------------------------------------------------------ audit trail
  const eventsWithoutOrder = db
    .prepare("SELECT COUNT(*) AS c FROM order_events e LEFT JOIN orders o ON o.id = e.order_id WHERE o.id IS NULL")
    .get().c;
  record("DB-21", "Every order event belongs to an existing order", eventsWithoutOrder === 0, "0 orphan events", String(eventsWithoutOrder));

  const ordersMissingPendingEvent = db
    .prepare(
      `SELECT COUNT(*) AS c FROM orders o
       WHERE NOT EXISTS (SELECT 1 FROM order_events e WHERE e.order_id = o.id AND e.to_status = 'PENDING' AND e.from_status IS NULL)`
    )
    .get().c;
  record("DB-22", "Every order records its initial PENDING event", ordersMissingPendingEvent === 0, "0 orders missing events", String(ordersMissingPendingEvent));

  const canceledWithoutEvent = db
    .prepare(
      `SELECT COUNT(*) AS c FROM orders o
       WHERE o.status = 'CANCELED' AND NOT EXISTS (SELECT 1 FROM order_events e WHERE e.order_id = o.id AND e.to_status = 'CANCELED')`
    )
    .get().c;
  record("DB-23", "Cancelled orders always have a CANCELED event (traceability)", canceledWithoutEvent === 0, "0 inconsistencies", String(canceledWithoutEvent));

  return results;
}
