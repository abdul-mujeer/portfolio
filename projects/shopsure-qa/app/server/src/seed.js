/**
 * Seeds a ShopSure database with deterministic synthetic data.
 *
 * Usage: node scripts/reset-db.mjs [--db <path>]
 * Called automatically by scripts/serve.mjs (E2E database) and by the test orchestrator.
 */
import { openDb, closeDb } from "./db.js";
import { hashPassword } from "./lib/passwords.js";
import { priceOrder, nowIso } from "./lib/helpers.js";
import { categories, demoUsers, products, seededOrders } from "../../../test-data/seed/seed-data.mjs";

export function seed(db) {
  const customersRow = db.prepare("SELECT COUNT(*) AS c FROM users").get();
  if (customersRow.c > 0) return { skipped: true };

  const createdAt = nowIso();

  const insertUser = db.prepare(
    "INSERT INTO users (email, name, password_hash, salt, role, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  );
  const userIds = new Map();
  for (const user of demoUsers) {
    const { salt, hash } = hashPassword(user.password);
    const info = insertUser.run(user.email, user.name, hash, salt, user.role, createdAt);
    userIds.set(user.email, Number(info.lastInsertRowid));
  }

  const insertCategory = db.prepare("INSERT INTO categories (name, slug) VALUES (?, ?)");
  const categoryIds = new Map();
  for (const category of categories) {
    const info = insertCategory.run(category.name, category.slug);
    categoryIds.set(category.slug, Number(info.lastInsertRowid));
  }

  const insertProduct = db.prepare(
    `INSERT INTO products (sku, name, description, category_id, price, stock, low_stock_threshold, image, active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
  );
  const productIds = new Map();
  for (const product of products) {
    const image = `/images/products/${product.sku.toLowerCase()}.svg`;
    const info = insertProduct.run(
      product.sku,
      product.name,
      product.description,
      categoryIds.get(product.categorySlug),
      product.price,
      product.stock,
      product.lowStockThreshold,
      image,
      createdAt
    );
    productIds.set(product.sku, Number(info.lastInsertRowid));
  }

  const productBySku = new Map(products.map((p) => [p.sku, p]));

  const insertOrder = db.prepare(
    `INSERT INTO orders (order_number, user_id, status, subtotal, discount, shipping_fee, total,
       shipping_name, shipping_email, shipping_phone, shipping_address, shipping_city, shipping_postcode,
       created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertOrderItem = db.prepare(
    `INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, line_total)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  const insertEvent = db.prepare(
    "INSERT INTO order_events (order_id, from_status, to_status, actor_id, created_at) VALUES (?, ?, ?, ?, ?)"
  );

  /** Seeded orders must carry a complete, realistic status history (defect SHOP-BUG-004). */
  const STATUS_CHAIN = {
    PENDING: ["PENDING"],
    PAID: ["PENDING", "PAID"],
    SHIPPED: ["PENDING", "PAID", "SHIPPED"],
    DELIVERED: ["PENDING", "PAID", "SHIPPED", "DELIVERED"],
    CANCELED: ["PENDING", "CANCELED"],
  };

  for (const order of seededOrders) {
    const lines = order.items.map((item) => {
      const product = productBySku.get(item.sku);
      return {
        productId: productIds.get(item.sku),
        name: product.name,
        unitPrice: product.price,
        quantity: item.quantity,
        lineTotal: Math.round(product.price * item.quantity * 100) / 100,
      };
    });
    const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
    const pricing = priceOrder(subtotal);
    const info = insertOrder.run(
      order.number,
      userIds.get(order.userEmail),
      order.status,
      pricing.subtotal,
      pricing.discount,
      pricing.shipping,
      pricing.total,
      order.shipping.name,
      order.shipping.email,
      order.shipping.phone,
      order.shipping.address,
      order.shipping.city,
      order.shipping.postcode,
      createdAt,
      createdAt
    );
    const orderId = Number(info.lastInsertRowid);
    for (const line of lines) {
      insertOrderItem.run(orderId, line.productId, line.name, line.unitPrice, line.quantity, line.lineTotal);
    }

    const chain = STATUS_CHAIN[order.status] ?? [order.status];
    let previous = null;
    for (const status of chain) {
      insertEvent.run(orderId, previous, status, userIds.get(order.userEmail), createdAt);
      previous = status;
    }
  }

  return { skipped: false, users: userIds.size, categories: categoryIds.size, products: productIds.size, orders: seededOrders.length };
}
