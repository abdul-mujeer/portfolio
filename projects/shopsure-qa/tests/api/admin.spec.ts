import { expect, test } from "@playwright/test";
import { PRODUCT_IDS, addToCart, placeOrder, sessionAs, sessionAsFreshCustomer, setStock } from "./helpers";

test.describe("Admin API: authorization, order transitions and inventory", () => {
  test("@regression a customer receives 403 on every admin endpoint", async () => {
    const customer = await sessionAsFreshCustomer();
    try {
      const endpoints: Array<[string, () => Promise<unknown>]> = [
        ["GET /api/admin/orders", () => customer.context.get("/api/admin/orders")],
        ["GET /api/admin/products", () => customer.context.get("/api/admin/products")],
        ["GET /api/admin/users", () => customer.context.get("/api/admin/users")],
        ["PATCH status", () => customer.context.patch("/api/admin/orders/1/status", { data: { status: "PAID" } })],
        ["PATCH stock", () => customer.context.patch(`/api/admin/products/${PRODUCT_IDS.mugSet}/stock`, { data: { stock: 99 } })],
        ["POST product", () => customer.context.post("/api/admin/products", { data: {} })],
      ];

      for (const [label, call] of endpoints) {
        const response = (await call()) as { status: () => number };
        expect(response.status(), label).toBe(403);
      }
    } finally {
      await customer.dispose();
    }
  });

  test("@smoke admin can list all orders and filter by status", async () => {
    const admin = await sessionAs("admin");
    try {
      const all = await admin.context.get("/api/admin/orders?limit=50");
      expect(all.status()).toBe(200);
      const body = await all.json();
      expect(body.total).toBeGreaterThan(0);

      const pending = await admin.context.get("/api/admin/orders?status=PENDING&limit=50");
      const pendingBody = await pending.json();
      for (const order of pendingBody.items) expect(order.status).toBe("PENDING");

      const invalid = await admin.context.get("/api/admin/orders?status=BOGUS");
      expect(invalid.status()).toBe(400);
    } finally {
      await admin.dispose();
    }
  });

  test("@regression order status follows the legal transition chain and rejects skips", async () => {
    const admin = await sessionAs("admin");
    const customer = await sessionAsFreshCustomer();
    try {
      await addToCart(customer.context, PRODUCT_IDS.mugSet, 1);
      const { order } = await (await placeOrder(customer.context)).json();

      const skip = await admin.context.patch(`/api/admin/orders/${order.id}/status`, { data: { status: "SHIPPED" } });
      expect(skip.status()).toBe(422);
      expect((await skip.json()).error.code).toBe("INVALID_TRANSITION");

      const chain = ["PAID", "SHIPPED", "DELIVERED"];
      for (const status of chain) {
        const response = await admin.context.patch(`/api/admin/orders/${order.id}/status`, { data: { status } });
        expect(response.status(), `transition to ${status}`).toBe(200);
        expect((await response.json()).order.status).toBe(status);
      }

      const afterDelivered = await admin.context.patch(`/api/admin/orders/${order.id}/status`, { data: { status: "CANCELED" } });
      expect(afterDelivered.status()).toBe(422);
    } finally {
      await admin.dispose();
      await customer.dispose();
    }
  });

  test("setting the same status is a no-op and returns changed=false", async () => {
    const admin = await sessionAs("admin");
    const customer = await sessionAsFreshCustomer();
    try {
      await addToCart(customer.context, PRODUCT_IDS.mugSet, 1);
      const { order } = await (await placeOrder(customer.context)).json();

      const response = await admin.context.patch(`/api/admin/orders/${order.id}/status`, { data: { status: "PENDING" } });
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.changed).toBe(false);
      expect(body.order.status).toBe("PENDING");
    } finally {
      await admin.dispose();
      await customer.dispose();
    }
  });

  test("unknown order status values are rejected with 400", async () => {
    const admin = await sessionAs("admin");
    try {
      const response = await admin.context.patch("/api/admin/orders/1/status", { data: { status: "ARCHIVED" } });
      expect(response.status()).toBe(400);
    } finally {
      await admin.dispose();
    }
  });

  test("@regression stock can be adjusted, cannot go negative, and drives purchasability", async () => {
    const admin = await sessionAs("admin");
    const customer = await sessionAsFreshCustomer();
    try {
      const negative = await admin.context.patch(`/api/admin/products/${PRODUCT_IDS.mugSet}/stock`, { data: { stock: -1 } });
      expect(negative.status()).toBe(400);

      const setZero = await admin.context.patch(`/api/admin/products/${PRODUCT_IDS.mugSet}/stock`, { data: { stock: 0 } });
      expect(setZero.status()).toBe(200);

      const blocked = await addToCart(customer.context, PRODUCT_IDS.mugSet, 1);
      expect(blocked.status()).toBe(422);

      await setStock(admin.context, PRODUCT_IDS.mugSet, 60);
      const allowed = await addToCart(customer.context, PRODUCT_IDS.mugSet, 1);
      expect(allowed.status()).toBe(201);
    } finally {
      await admin.dispose();
      await customer.dispose();
    }
  });

  test("admin product list supports includeInactive and returns category names", async () => {
    const admin = await sessionAs("admin");
    try {
      const response = await admin.context.get("/api/admin/products?includeInactive=true&limit=50");
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.total).toBe(24);
      expect(body.items[0]).toHaveProperty("categoryName");
    } finally {
      await admin.dispose();
    }
  });

  test("creating a product validates payload and rejects duplicate SKUs with 409", async () => {
    const admin = await sessionAs("admin");
    try {
      const duplicate = await admin.context.post("/api/admin/products", {
        data: { sku: "SKU-EL-001", name: "Duplicate SKU Product", categoryId: 1, price: 10, stock: 5 },
      });
      expect(duplicate.status()).toBe(409);
      expect((await duplicate.json()).error.code).toBe("DUPLICATE_SKU");

      const invalid = await admin.context.post("/api/admin/products", {
        data: { sku: "X", name: "", categoryId: 999, price: -5 },
      });
      expect(invalid.status()).toBe(400);

      const badCategory = await admin.context.post("/api/admin/products", {
        data: { sku: `SKU-QA-${Date.now()}`, name: "Valid name", categoryId: 999, price: 10, stock: 5 },
      });
      expect(badCategory.status()).toBe(400);

      const created = await admin.context.post("/api/admin/products", {
        data: { sku: `SKU-QA-${Date.now()}`, name: "QA Created Product", categoryId: 1, price: 12.34, stock: 7 },
      });
      expect(created.status()).toBe(201);
      const body = await created.json();
      expect(body.product).toMatchObject({ price: 12.34, stock: 7 });

      // Test data cleanup: deactivate the QA product so storefront totals stay deterministic for
      // the catalog suite (and to verify that inactive products disappear from the storefront).
      const deactivated = await admin.context.patch(`/api/admin/products/${body.product.id}`, { data: { active: 0 } });
      expect(deactivated.status()).toBe(200);
      const storefront = await admin.context.get(`/api/products/${body.product.id}`);
      expect(storefront.status()).toBe(404);
    } finally {
      await admin.dispose();
    }
  });

  test("admin user list never exposes password material", async () => {
    const admin = await sessionAs("admin");
    try {
      const response = await admin.context.get("/api/admin/users");
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.items.length).toBeGreaterThanOrEqual(3);
      const serialized = JSON.stringify(body);
      expect(serialized).not.toContain("password");
      expect(serialized).not.toContain("salt");
    } finally {
      await admin.dispose();
    }
  });

  test("admin order list exposes the customer email for operations", async () => {
    const admin = await sessionAs("admin");
    try {
      const response = await admin.context.get("/api/admin/orders?limit=5");
      const body = await response.json();
      expect(body.items[0]).toHaveProperty("customerEmail");
      expect(body.items[0]).toHaveProperty("itemCount");
    } finally {
      await admin.dispose();
    }
  });
});
