import express from "express";
import { z } from "zod";
import { asyncHandler, notFound, unprocessable, forbidden } from "../lib/errors.js";
import { priceOrder, round2, formatOrderNumber, nowIso } from "../lib/helpers.js";
import { requireAuth } from "../middleware/auth.js";
import { validateBody, validateIdParam } from "../middleware/validate.js";
import { skipStockRestoreOnCancel } from "../seeded-defects.js";

const shippingSchema = z.object({
  name: z.string().trim().min(2, "Recipient name must be at least 2 characters.").max(60, "Recipient name must be at most 60 characters."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/, "Email format is invalid."),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9][0-9 -]{6,14}$/, "Phone must contain 7-15 digits (optional leading +)."),
  address: z.string().trim().min(5, "Address must be at least 5 characters.").max(120, "Address must be at most 120 characters."),
  city: z.string().trim().min(2, "City must be at least 2 characters.").max(60, "City must be at most 60 characters."),
  postcode: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9][A-Za-z0-9 -]{2,9}$/, "Postcode must be 3-10 alphanumeric characters."),
});

/** Legal order status transitions (see test-documentation/test-scenarios.md, decision table 2). */
export const ORDER_TRANSITIONS = {
  PENDING: ["PAID", "CANCELED"],
  PAID: ["SHIPPED", "CANCELED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  CANCELED: [],
};

export const ORDER_STATUSES = Object.keys(ORDER_TRANSITIONS);

export function orderWithItems(db, orderId) {
  const order = db
    .prepare(
      `SELECT o.id, o.order_number AS orderNumber, o.status, o.subtotal, o.discount, o.shipping_fee AS shippingFee,
              o.total, o.shipping_name AS shippingName, o.shipping_email AS shippingEmail, o.shipping_phone AS shippingPhone,
              o.shipping_address AS shippingAddress, o.shipping_city AS shippingCity, o.shipping_postcode AS shippingPostcode,
              o.created_at AS createdAt, o.updated_at AS updatedAt, o.user_id AS userId
       FROM orders o WHERE o.id = ?`
    )
    .get(orderId);
  if (!order) return null;
  order.items = db
    .prepare("SELECT id, product_id AS productId, product_name AS productName, unit_price AS unitPrice, quantity, line_total AS lineTotal FROM order_items WHERE order_id = ? ORDER BY id")
    .all(orderId);
  order.events = db
    .prepare("SELECT id, from_status AS fromStatus, to_status AS toStatus, actor_id AS actorId, created_at AS createdAt FROM order_events WHERE order_id = ? ORDER BY id")
    .all(orderId);
  return order;
}

/** Restores stock for every line of an order (used by cancel). */
export function restoreStock(db, orderId) {
  const lines = db.prepare("SELECT product_id AS productId, quantity FROM order_items WHERE order_id = ?").all(orderId);
  const update = db.prepare("UPDATE products SET stock = stock + ? WHERE id = ?");
  for (const line of lines) update.run(line.quantity, line.productId);
}

export function createOrderRouter(db) {
  const router = express.Router();

  const selectCart = db.prepare(
    `SELECT ci.id, ci.quantity, p.id AS productId, p.name, p.sku, p.price, p.stock, p.active
     FROM cart_items ci JOIN products p ON p.id = ci.product_id
     WHERE ci.user_id = ? ORDER BY ci.id ASC`
  );

  router.post(
    "/orders",
    requireAuth,
    validateBody(shippingSchema),
    asyncHandler(async (req, res) => {
      const lines = selectCart.all(req.user.id);
      if (lines.length === 0) throw unprocessable("Your cart is empty.", "EMPTY_CART");

      for (const line of lines) {
        if (line.active !== 1) throw unprocessable(`"${line.name}" is no longer available.`, "PRODUCT_UNAVAILABLE");
        if (line.quantity > line.stock) {
          throw unprocessable(`Only ${line.stock} unit(s) of "${line.name}" are in stock.`, "INSUFFICIENT_STOCK");
        }
      }

      const subtotal = round2(lines.reduce((sum, line) => sum + line.price * line.quantity, 0));
      const pricing = priceOrder(subtotal);
      const createdAt = nowIso();

      db.exec("BEGIN IMMEDIATE");
      try {
        const sequence = db.prepare("SELECT COUNT(*) AS c FROM orders").get().c + 1;
        const orderNumber = formatOrderNumber(sequence);
        const orderInfo = db
          .prepare(
            `INSERT INTO orders (order_number, user_id, status, subtotal, discount, shipping_fee, total,
               shipping_name, shipping_email, shipping_phone, shipping_address, shipping_city, shipping_postcode,
               created_at, updated_at)
             VALUES (?, ?, 'PENDING', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            orderNumber,
            req.user.id,
            pricing.subtotal,
            pricing.discount,
            pricing.shipping,
            pricing.total,
            req.body.name,
            req.body.email,
            req.body.phone,
            req.body.address,
            req.body.city,
            req.body.postcode,
            createdAt,
            createdAt
          );
        const orderId = Number(orderInfo.lastInsertRowid);

        const insertItem = db.prepare(
          "INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, line_total) VALUES (?, ?, ?, ?, ?, ?)"
        );
        const decrementStock = db.prepare("UPDATE products SET stock = stock - ? WHERE id = ?");
        for (const line of lines) {
          insertItem.run(orderId, line.productId, line.name, line.price, line.quantity, round2(line.price * line.quantity));
          decrementStock.run(line.quantity, line.productId);
        }

        db.prepare("DELETE FROM cart_items WHERE user_id = ?").run(req.user.id);
        db.prepare("INSERT INTO order_events (order_id, from_status, to_status, actor_id, created_at) VALUES (?, NULL, 'PENDING', ?, ?)").run(
          orderId,
          req.user.id,
          createdAt
        );
        db.exec("COMMIT");

        res.status(201).json({ order: orderWithItems(db, orderId) });
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    })
  );

  router.get(
    "/orders",
    requireAuth,
    asyncHandler(async (req, res) => {
      const rows = db
        .prepare(
          `SELECT o.id, o.order_number AS orderNumber, o.status, o.subtotal, o.discount, o.shipping_fee AS shippingFee,
                  o.total, o.created_at AS createdAt,
                  (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS itemCount,
                  (SELECT SUM(oi.quantity) FROM order_items oi WHERE oi.order_id = o.id) AS unitCount
           FROM orders o WHERE o.user_id = ? ORDER BY o.id DESC`
        )
        .all(req.user.id);
      res.json({ items: rows, total: rows.length });
    })
  );

  router.get(
    "/orders/:id",
    requireAuth,
    validateIdParam(),
    asyncHandler(async (req, res) => {
      const order = orderWithItems(db, req.params.id);
      if (!order) throw notFound("Order not found.");
      if (order.userId !== req.user.id && req.user.role !== "ADMIN") throw notFound("Order not found.");
      res.json({ order });
    })
  );

  router.post(
    "/orders/:id/cancel",
    requireAuth,
    validateIdParam(),
    asyncHandler(async (req, res) => {
      const order = orderWithItems(db, req.params.id);
      if (!order) throw notFound("Order not found.");
      if (order.userId !== req.user.id && req.user.role !== "ADMIN") throw forbidden("You can only cancel your own orders.");
      if (!ORDER_TRANSITIONS[order.status].includes("CANCELED")) {
        throw unprocessable(`Order in status ${order.status} cannot be canceled.`, "INVALID_TRANSITION");
      }

      db.exec("BEGIN IMMEDIATE");
      try {
        if (!skipStockRestoreOnCancel()) {
          // SEEDED DEFECT (SHOP-BUG-002): stock restore is skipped when SEED_DEFECTS=1.
          restoreStock(db, order.id);
        }
        db.prepare("UPDATE orders SET status = 'CANCELED', updated_at = ? WHERE id = ?").run(nowIso(), order.id);
        db.prepare("INSERT INTO order_events (order_id, from_status, to_status, actor_id, created_at) VALUES (?, ?, 'CANCELED', ?, ?)").run(
          order.id,
          order.status,
          req.user.id,
          nowIso()
        );
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }

      res.json({ order: orderWithItems(db, order.id) });
    })
  );

  return router;
}
