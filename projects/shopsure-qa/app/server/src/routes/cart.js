import express from "express";
import { z } from "zod";
import { asyncHandler, notFound, unprocessable } from "../lib/errors.js";
import { priceOrder, round2, MAX_LINE_QUANTITY } from "../lib/helpers.js";
import { requireAuth } from "../middleware/auth.js";
import { validateBody, validateIdParam } from "../middleware/validate.js";
import { skipCartStockCheck } from "../seeded-defects.js";

const addItemSchema = z.object({
  productId: z.coerce.number().int("productId must be an integer.").positive("productId must be a positive integer."),
  quantity: z.coerce
    .number()
    .int("quantity must be an integer.")
    .min(1, "quantity must be at least 1.")
    .max(MAX_LINE_QUANTITY, `quantity must be at most ${MAX_LINE_QUANTITY} per line.`)
    .default(1),
});

const updateItemSchema = z.object({
  quantity: z.coerce
    .number()
    .int("quantity must be an integer.")
    .min(1, "quantity must be at least 1.")
    .max(MAX_LINE_QUANTITY, `quantity must be at most ${MAX_LINE_QUANTITY} per line.`),
});

export function createCartRouter(db) {
  const router = express.Router();

  const findProduct = db.prepare("SELECT id, name, price, stock, image, sku, active FROM products WHERE id = ?");
  const findLine = db.prepare("SELECT id, quantity FROM cart_items WHERE user_id = ? AND product_id = ?");
  const findLineById = db.prepare(
    `SELECT ci.id, ci.quantity, p.id AS productId, p.name, p.price, p.stock, p.image, p.sku
     FROM cart_items ci JOIN products p ON p.id = ci.product_id
     WHERE ci.id = ? AND ci.user_id = ?`
  );
  const selectCart = db.prepare(
    `SELECT ci.id, ci.quantity, p.id AS productId, p.sku, p.name, p.price, p.stock, p.image,
            ROUND(p.price * ci.quantity, 2) AS lineTotal
     FROM cart_items ci JOIN products p ON p.id = ci.product_id
     WHERE ci.user_id = ?
     ORDER BY ci.id ASC`
  );

  function cartPayload(userId) {
    const items = selectCart.all(userId);
    const subtotal = round2(items.reduce((sum, item) => sum + item.lineTotal, 0));
    return { items, ...priceOrder(subtotal) };
  }

  router.get(
    "/cart",
    requireAuth,
    asyncHandler(async (req, res) => {
      res.json(cartPayload(req.user.id));
    })
  );

  router.post(
    "/cart/items",
    requireAuth,
    validateBody(addItemSchema),
    asyncHandler(async (req, res) => {
      const { productId, quantity } = req.body;
      const product = findProduct.get(productId);
      if (!product || product.active !== 1) throw notFound("Product not found.");
      if (product.stock === 0) throw unprocessable("Product is out of stock.", "OUT_OF_STOCK");

      const existing = findLine.get(req.user.id, productId);
      const targetQuantity = (existing ? existing.quantity : 0) + quantity;

      if (targetQuantity > MAX_LINE_QUANTITY) {
        throw unprocessable(`At most ${MAX_LINE_QUANTITY} units of the same product are allowed per order.`, "QUANTITY_LIMIT_EXCEEDED");
      }
      if (targetQuantity > product.stock && !skipCartStockCheck()) {
        // SEEDED DEFECT (SHOP-BUG-001): this guard is intentionally skipped when SEED_DEFECTS=1.
        throw unprocessable(`Only ${product.stock} unit(s) of "${product.name}" are in stock.`, "INSUFFICIENT_STOCK");
      }

      if (existing) {
        db.prepare("UPDATE cart_items SET quantity = ? WHERE id = ?").run(targetQuantity, existing.id);
      } else {
        db.prepare("INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)").run(req.user.id, productId, quantity);
      }

      res.status(201).json(cartPayload(req.user.id));
    })
  );

  router.patch(
    "/cart/items/:id",
    requireAuth,
    validateIdParam(),
    validateBody(updateItemSchema),
    asyncHandler(async (req, res) => {
      const line = findLineById.get(req.params.id, req.user.id);
      if (!line) throw notFound("Cart item not found.");
      if (req.body.quantity > line.stock) {
        throw unprocessable(`Only ${line.stock} unit(s) of "${line.name}" are in stock.`, "INSUFFICIENT_STOCK");
      }
      db.prepare("UPDATE cart_items SET quantity = ? WHERE id = ?").run(req.body.quantity, line.id);
      res.json(cartPayload(req.user.id));
    })
  );

  router.delete(
    "/cart/items/:id",
    requireAuth,
    validateIdParam(),
    asyncHandler(async (req, res) => {
      const line = findLineById.get(req.params.id, req.user.id);
      if (!line) throw notFound("Cart item not found.");
      db.prepare("DELETE FROM cart_items WHERE id = ?").run(line.id);
      res.status(204).end();
    })
  );

  router.delete(
    "/cart",
    requireAuth,
    asyncHandler(async (req, res) => {
      db.prepare("DELETE FROM cart_items WHERE user_id = ?").run(req.user.id);
      res.status(204).end();
    })
  );

  return router;
}
