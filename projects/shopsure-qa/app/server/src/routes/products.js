import express from "express";
import { asyncHandler, notFound, badRequest } from "../lib/errors.js";
import { escapeLike } from "../lib/helpers.js";
import { parseListQuery, validateIdParam } from "../middleware/validate.js";
import { minPriceIsExclusive } from "../seeded-defects.js";

const SORTABLE = { id: "p.id", name: "p.name", price: "p.price", stock: "p.stock", created_at: "p.created_at" };

export function createProductRouter(db) {
  const router = express.Router();

  const selectProduct = `
    SELECT p.id, p.sku, p.name, p.description, p.price, p.stock, p.low_stock_threshold AS lowStockThreshold,
           p.image, p.active, p.created_at AS createdAt,
           c.id AS categoryId, c.name AS categoryName, c.slug AS categorySlug
    FROM products p JOIN categories c ON c.id = p.category_id`;

  router.get(
    "/categories",
    asyncHandler(async (_req, res) => {
      const rows = db.prepare("SELECT id, name, slug FROM categories ORDER BY name ASC").all();
      res.json({ items: rows });
    })
  );

  router.get(
    "/products",
    asyncHandler(async (req, res) => {
      const { page, limit, offset, sort, order } = parseListQuery(req.query, {
        sortable: SORTABLE,
        defaultSort: "id",
        maxLimit: 50,
        defaultLimit: 12,
      });

      const where = ["p.active = 1"];
      const params = [];

      const q = String(req.query.q ?? "").trim();
      if (q) {
        where.push("(p.name LIKE ? ESCAPE '\\' OR p.description LIKE ? ESCAPE '\\')");
        const pattern = `%${escapeLike(q)}%`;
        params.push(pattern, pattern);
      }

      if (req.query.category !== undefined) {
        where.push("c.slug = ?");
        params.push(String(req.query.category));
      }

      if (req.query.minPrice !== undefined) {
        const value = Number(req.query.minPrice);
        if (!Number.isFinite(value) || value < 0) throw badRequest('Query parameter "minPrice" must be a non-negative number.');
        // SEEDED DEFECT (SHOP-BUG-003): '>' instead of '>=' when SEED_DEFECTS=1 (exclusive boundary).
        where.push(minPriceIsExclusive() ? "p.price > ?" : "p.price >= ?");
        params.push(value);
      }

      if (req.query.maxPrice !== undefined) {
        const value = Number(req.query.maxPrice);
        if (!Number.isFinite(value) || value < 0) throw badRequest('Query parameter "maxPrice" must be a non-negative number.');
        where.push("p.price <= ?");
        params.push(value);
      }

      if (req.query.minPrice !== undefined && req.query.maxPrice !== undefined && Number(req.query.minPrice) > Number(req.query.maxPrice)) {
        throw badRequest('"minPrice" cannot be greater than "maxPrice".');
      }

      if (req.query.inStock !== undefined) {
        const raw = String(req.query.inStock).toLowerCase();
        if (raw !== "true" && raw !== "false") throw badRequest('Query parameter "inStock" must be "true" or "false".');
        where.push(raw === "true" ? "p.stock > 0" : "p.stock = 0");
      }

      // Low-stock filter used by the storefront banner; not part of the public requirement set
      // but handy for exploratory testing.
      if (req.query.lowStock !== undefined) {
        const raw = String(req.query.lowStock).toLowerCase();
        if (raw !== "true" && raw !== "false") throw badRequest('Query parameter "lowStock" must be "true" or "false".');
        where.push(raw === "true" ? "p.stock > 0 AND p.stock <= p.low_stock_threshold" : "p.stock > p.low_stock_threshold");
      }

      const whereSql = `WHERE ${where.join(" AND ")}`;
      const total = db
        .prepare(`SELECT COUNT(*) AS c FROM products p JOIN categories c ON c.id = p.category_id ${whereSql}`)
        .get(...params).c;
      const rows = db
        .prepare(`${selectProduct} ${whereSql} ORDER BY ${sort} ${order.toUpperCase()}, p.id ASC LIMIT ? OFFSET ?`)
        .all(...params, limit, offset);

      res.set("X-Total-Count", String(total));
      res.json({ items: rows, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) });
    })
  );

  router.get(
    "/products/:id",
    validateIdParam(),
    asyncHandler(async (req, res) => {
      const row = db.prepare(`${selectProduct} WHERE p.id = ? AND p.active = 1`).get(req.params.id);
      if (!row) throw notFound("Product not found.");
      res.json({ product: row });
    })
  );

  return router;
}
