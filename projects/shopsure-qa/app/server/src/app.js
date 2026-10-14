import express from "express";
import path from "node:path";
import fs from "node:fs";
import { PROJECT_ROOT } from "./db.js";
import { cookieParser, attachUser } from "./middleware/auth.js";
import { notFoundHandler, errorHandler } from "./lib/errors.js";
import { createAuthRouter } from "./routes/auth.js";
import { createProductRouter } from "./routes/products.js";
import { createCartRouter } from "./routes/cart.js";
import { createOrderRouter } from "./routes/orders.js";
import { createAdminRouter } from "./routes/admin.js";

export const APP_VERSION = "1.0.0";

/**
 * Builds the Express application around an open database handle.
 * Kept free of `listen()` so tests can import it directly.
 */
export function createApp(db) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser);
  app.use(attachUser(db));

  app.get("/api/health", (_req, res) => {
    const products = db.prepare("SELECT COUNT(*) AS c FROM products").get().c;
    res.json({
      status: "ok",
      app: "shopsure",
      version: APP_VERSION,
      seededProducts: products,
      time: new Date().toISOString(),
    });
  });

  app.use("/api/auth", createAuthRouter(db));
  app.use("/api", createProductRouter(db));
  app.use("/api", createCartRouter(db));
  app.use("/api", createOrderRouter(db));
  app.use("/api/admin", createAdminRouter(db));

  // Static assets shipped with the API (product images used by the SPA and by screenshots).
  app.use(express.static(path.join(PROJECT_ROOT, "app/public")));

  // Built React application (app/web/dist). Present in production/CI and after `npm run build`.
  const webDist = path.join(PROJECT_ROOT, "app/web/dist");
  if (fs.existsSync(webDist)) {
    app.use(express.static(webDist));
    app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(webDist, "index.html")));
  }

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
