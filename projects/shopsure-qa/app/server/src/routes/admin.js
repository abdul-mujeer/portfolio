import express from "express";
import { z } from "zod";
import { asyncHandler, badRequest, conflict, notFound, unprocessable } from "../lib/errors.js";
import { nowIso } from "../lib/helpers.js";
import { requireAdmin } from "../middleware/auth.js";
import { validateBody, validateIdParam, parseListQuery } from "../middleware/validate.js";
import { ORDER_STATUSES, ORDER_TRANSITIONS, orderWithItems, restoreStock } from "./orders.js";

const productSchema = z.object({
  sku: z.string().trim().min(3, "SKU must be at least 3 characters.").max(32, "SKU must be at most 32 characters."),
  name: z.string().trim().min(3, "Name must be at least 3 characters.").max(120, "Name must be at most 120 characters."),
  description: z.string().trim().max(500, "Description must be at most 500 characters.").default(""),
  categoryId: z.coerce.number().int().positive("categoryId must reference an existing category."),
  price: z.coerce.number().positive("Price must be greater than 0.").max(100000, "Price is unrealistically high."),
  stock: z.coerce.number().int("Stock must be an integer.").min(0, "Stock cannot be negative.").default(0),
  lowStockThreshold: z.coerce.number().int().min(0).max(1000).default(5),
  image: z.string().trim().max(200).default(""),
  active: z.coerce.number().int().min(0).max(1).default(1),
});

const productUpdateSchema = productSchema.partial();

const stockSchema = z.object({
  stock: z.coerce.number().int("Stock must be an integer.").min(0, "Stock cannot be negative.").max(100000, "Stock is unrealistically high."),
});

const statusSchema = z.object({
  status: z.enum(ORDER_STATUSES, { errorMap: () => ({ message: `Status must be one of: ${ORDER_STATUSES.join(", ")}.` }) }),
});

const ORDER_SORTABLE = { id: "o.id", total: "o.total", created_at: "o.created_at", status: "o.status" };
const PRODUCT_SORTABLE = { id: "p.id", name: "p.name", price: "p.price", stock: "p.stock" };

export function createAdminRouter(db) {
  const router = express.Router();
  router.use(requireAdmin);

  router.get(
    "/orders",
    asyncHandler(async (req, res) => {
      const { page, limit, offset, sort, order } = parseListQuery(req.query, {
        sortable: ORDER_SORTABLE,
        defaultSort: "id",
        defaultLimit: 20,
      });

      const where = [];
      const params = [];
      if (req.query.status !== undefined) {
        const status = String(req.query.status).toUpperCase();
        if (!ORDER_STATUSES.includes(status)) throw badRequest(`Unknown status "${req.query.status}".`);
        where.push("o.status = ?");
        params.push(status);
      }
      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

      const total = db.prepare(`SELECT COUNT(*) AS c FROM orders o ${whereSql}`).get(...params).c;
      const rows = db
        .prepare(
          `SELECT o.id, o.order_number AS orderNumber, o.status, o.total, o.created_at AS createdAt,
                  u.email AS customerEmail, u.name AS customerName,
                  (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS itemCount
           FROM orders o JOIN users u ON u.id = o.user_id
           ${whereSql} ORDER BY ${sort} ${order.toUpperCase()}, o.id ASC LIMIT ? OFFSET ?`
        )
        .all(...params, limit, offset);

      res.set("X-Total-Count", String(total));
      res.json({ items: rows, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) });
    })
  );

  router.patch(
    "/orders/:id/status",
    validateIdParam(),
    validateBody(statusSchema),
    asyncHandler(async (req, res) => {
      const order = orderWithItems(db, req.params.id);
      if (!order) throw notFound("Order not found.");

      const target = req.body.status;
      if (target === order.status) return res.json({ order, changed: false });
      if (!ORDER_TRANSITIONS[order.status].includes(target)) {
        throw unprocessable(`Illegal transition ${order.status} -> ${target}.`, "INVALID_TRANSITION");
      }

      db.exec("BEGIN IMMEDIATE");
      try {
        if (target === "CANCELED") restoreStock(db, order.id);
        db.prepare("UPDATE orders SET status = ?, updated_at = ? WHERE id = ?").run(target, nowIso(), order.id);
        db.prepare("INSERT INTO order_events (order_id, from_status, to_status, actor_id, created_at) VALUES (?, ?, ?, ?, ?)").run(
          order.id,
          order.status,
          target,
          req.user.id,
          nowIso()
        );
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }

      res.json({ order: orderWithItems(db, order.id), changed: true });
    })
  );

  router.get(
    "/products",
    asyncHandler(async (req, res) => {
      const { page, limit, offset, sort, order } = parseListQuery(req.query, {
        sortable: PRODUCT_SORTABLE,
        defaultSort: "id",
        defaultLimit: 20,
      });

      const where = [];
      const params = [];
      if (String(req.query.includeInactive ?? "false") !== "true") where.push("p.active = 1");
      const q = String(req.query.q ?? "").trim();
      if (q) {
        where.push("(p.name LIKE ? OR p.sku LIKE ?)");
        params.push(`%${q}%`, `%${q}%`);
      }
      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

      const total = db.prepare(`SELECT COUNT(*) AS c FROM products p ${whereSql}`).get(...params).c;
      const rows = db
        .prepare(
          `SELECT p.id, p.sku, p.name, p.price, p.stock, p.low_stock_threshold AS lowStockThreshold, p.active,
                  p.category_id AS categoryId, c.name AS categoryName
           FROM products p JOIN categories c ON c.id = p.category_id
           ${whereSql} ORDER BY ${sort} ${order.toUpperCase()}, p.id ASC LIMIT ? OFFSET ?`
        )
        .all(...params, limit, offset);

      res.set("X-Total-Count", String(total));
      res.json({ items: rows, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) });
    })
  );

  router.post(
    "/products",
    validateBody(productSchema),
    asyncHandler(async (req, res) => {
      const category = db.prepare("SELECT id FROM categories WHERE id = ?").get(req.body.categoryId);
      if (!category) throw badRequest("categoryId does not reference an existing category.");
      if (db.prepare("SELECT id FROM products WHERE sku = ?").get(req.body.sku)) {
        throw conflict("A product with this SKU already exists.", "DUPLICATE_SKU");
      }

      const info = db
        .prepare(
          `INSERT INTO products (sku, name, description, category_id, price, stock, low_stock_threshold, image, active, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          req.body.sku,
          req.body.name,
          req.body.description,
          req.body.categoryId,
          req.body.price,
          req.body.stock,
          req.body.lowStockThreshold,
          req.body.image,
          req.body.active,
          nowIso()
        );

      res.status(201).json({ product: db.prepare("SELECT * FROM products WHERE id = ?").get(Number(info.lastInsertRowid)) });
    })
  );

  router.patch(
    "/products/:id",
    validateIdParam(),
    validateBody(productUpdateSchema),
    asyncHandler(async (req, res) => {
      const product = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id);
      if (!product) throw notFound("Product not found.");

      const fields = [];
      const params = [];
      const map = {
        sku: "sku",
        name: "name",
        description: "description",
        categoryId: "category_id",
        price: "price",
        stock: "stock",
        lowStockThreshold: "low_stock_threshold",
        image: "image",
        active: "active",
      };
      for (const [key, column] of Object.entries(map)) {
        if (req.body[key] !== undefined) {
          fields.push(`${column} = ?`);
          params.push(req.body[key]);
        }
      }
      if (fields.length === 0) throw badRequest("No updatable fields were provided.");

      if (req.body.categoryId !== undefined) {
        const category = db.prepare("SELECT id FROM categories WHERE id = ?").get(req.body.categoryId);
        if (!category) throw badRequest("categoryId does not reference an existing category.");
      }
      if (req.body.sku !== undefined) {
        const clash = db.prepare("SELECT id FROM products WHERE sku = ? AND id <> ?").get(req.body.sku, req.params.id);
        if (clash) throw conflict("A product with this SKU already exists.", "DUPLICATE_SKU");
      }

      params.push(req.params.id);
      db.prepare(`UPDATE products SET ${fields.join(", ")} WHERE id = ?`).run(...params);
      res.json({ product: db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id) });
    })
  );

  router.patch(
    "/products/:id/stock",
    validateIdParam(),
    validateBody(stockSchema),
    asyncHandler(async (req, res) => {
      const product = db.prepare("SELECT id FROM products WHERE id = ?").get(req.params.id);
      if (!product) throw notFound("Product not found.");
      db.prepare("UPDATE products SET stock = ? WHERE id = ?").run(req.body.stock, req.params.id);
      res.json({ product: db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id) });
    })
  );

  router.get(
    "/users",
    asyncHandler(async (_req, res) => {
      const rows = db.prepare("SELECT id, email, name, role, created_at AS createdAt FROM users ORDER BY id ASC").all();
      res.json({ items: rows, total: rows.length });
    })
  );

  return router;
}
