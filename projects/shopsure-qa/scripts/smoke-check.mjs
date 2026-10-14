#!/usr/bin/env node
/**
 * ShopSure smoke check — the fastest way to answer "is the application healthy?".
 *
 * Boots a fresh seeded database, starts the API server, drives the critical path
 * (health -> login -> cart -> checkout -> order history -> cancel -> admin transition rules)
 * and prints a pass/fail table. Exits non-zero when any check fails.
 *
 * Usage:
 *   node scripts/smoke-check.mjs [--port 4199] [--keep-server]
 */
import { startServer, stopServer, waitForHealth, createClient } from "./lib/server-control.mjs";

const args = process.argv.slice(2);
const portFlag = args.indexOf("--port");
const port = portFlag !== -1 ? Number(args[portFlag + 1]) : 4199;
const baseUrl = `http://127.0.0.1:${port}`;

const checks = [];
function check(id, title, condition, details = "") {
  checks.push({ id, title, passed: Boolean(condition), details });
}

const { child, logs } = startServer({ port, dbPath: ".data/shopsure.smoke.db", reset: true });

try {
  const health = await waitForHealth(baseUrl);
  check("SMOKE-01", "Health endpoint reports ok", health.status === "ok", JSON.stringify(health));

  const customer = createClient(baseUrl);
  const admin = createClient(baseUrl);

  const anonymousCart = await customer.get("/api/cart");
  check("SMOKE-02", "Unauthenticated cart access is rejected with 401", anonymousCart.status === 401, `status=${anonymousCart.status}`);

  const login = await customer.post("/api/auth/login", { email: "customer@example.com", password: "Customer#12345" });
  check("SMOKE-03", "Customer can log in", login.status === 200 && Boolean(customer.getCookie()), `status=${login.status}`);

  const adminLogin = await admin.post("/api/auth/login", { email: "admin@example.com", password: "Admin#12345" });
  check("SMOKE-04", "Admin can log in", adminLogin.status === 200, `status=${adminLogin.status}`);

  const add = await customer.post("/api/cart/items", { productId: 1, quantity: 1 });
  check("SMOKE-05", "Add to cart succeeds and returns pricing", add.status === 201 && add.body.subtotal === 149.99, `status=${add.status} subtotal=${add.body?.subtotal}`);

  check(
    "SMOKE-06",
    "10% discount applies at/above $100 (pricing decision table)",
    add.body?.discount === 15 && add.body?.shipping === 0 && add.body?.total === 134.99,
    JSON.stringify({ discount: add.body?.discount, shipping: add.body?.shipping, total: add.body?.total })
  );

  const oversell = await customer.post("/api/cart/items", { productId: 1, quantity: 10 });
  check("SMOKE-07", "Quantity limit per line is enforced (max 10)", oversell.status === 422, `status=${oversell.status} code=${oversell.body?.error?.code}`);

  const outOfStock = await customer.post("/api/cart/items", { productId: 4, quantity: 1 });
  check("SMOKE-08", "Out-of-stock product cannot be added", outOfStock.status === 422, `status=${outOfStock.status} code=${outOfStock.body?.error?.code}`);

  const checkout = await customer.post("/api/orders", {
    name: "Casey Customer",
    email: "customer@example.com",
    phone: "+1 555 0199",
    address: "77 Smoke Test Avenue",
    city: "Springfield",
    postcode: "12345",
  });
  check("SMOKE-09", "Checkout creates a PENDING order", checkout.status === 201 && checkout.body?.order?.status === "PENDING", `status=${checkout.status}`);
  const orderId = checkout.body?.order?.id;
  check("SMOKE-10", "Order number follows the ORD-##### format", /^ORD-\d{5}$/.test(checkout.body?.order?.orderNumber ?? ""), checkout.body?.order?.orderNumber);

  const history = await customer.get("/api/orders");
  check("SMOKE-11", "Order history contains the new order", history.status === 200 && history.body.items.some((order) => order.id === orderId), `orders=${history.body?.items?.length}`);

  const illegal = await admin.patch(`/api/admin/orders/${orderId}/status`, { status: "DELIVERED" });
  check("SMOKE-12", "Illegal status jump PENDING -> DELIVERED is rejected (422)", illegal.status === 422, `status=${illegal.status} code=${illegal.body?.error?.code}`);

  const legal = await admin.patch(`/api/admin/orders/${orderId}/status`, { status: "PAID" });
  check("SMOKE-13", "Legal transition PENDING -> PAID succeeds", legal.status === 200 && legal.body?.order?.status === "PAID", `status=${legal.status}`);

  const stockBeforeCancel = (await admin.get("/api/admin/products?q=SKU-EL-001")).body?.items?.[0]?.stock;
  const cancel = await customer.post(`/api/orders/${orderId}/cancel`);
  const stockAfterCancel = (await admin.get("/api/admin/products?q=SKU-EL-001")).body?.items?.[0]?.stock;
  check("SMOKE-14", "Cancelling an order restores product stock", cancel.status === 200 && stockAfterCancel === stockBeforeCancel + 1, `before=${stockBeforeCancel} after=${stockAfterCancel}`);

  const forbidden = await customer.get("/api/admin/orders");
  check("SMOKE-15", "Customer receives 403 on admin endpoints", forbidden.status === 403, `status=${forbidden.status}`);
} catch (error) {
  check("SMOKE-00", "Smoke check completed without exceptions", false, String(error));
} finally {
  if (!args.includes("--keep-server")) await stopServer(child);
}

const passed = checks.filter((item) => item.passed).length;
console.log("\nShopSure smoke check");
console.log("====================");
for (const item of checks) {
  console.log(`${item.passed ? "PASS" : "FAIL"}  ${item.id}  ${item.title}${item.passed ? "" : `  [${item.details}]`}`);
}
console.log(`\n${passed}/${checks.length} checks passed.`);

if (passed !== checks.length) {
  console.error("\n--- server log tail ---");
  console.error(logs.join("").split("\n").slice(-60).join("\n"));
  process.exit(1);
}
