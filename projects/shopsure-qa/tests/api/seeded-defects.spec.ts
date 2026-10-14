import { expect, test } from "@playwright/test";
import { PRODUCT_IDS, addToCart, placeOrder, sessionAs, sessionAsFreshCustomer, setStock } from "./helpers";

/**
 * Seeded-defect detection suite.
 *
 * These three tests assert the CORRECT behaviour. They pass on a clean build and fail when the
 * application is started with SEED_DEFECTS=1, which proves that the automated suite really detects
 * the deliberately injected defects (SHOP-BUG-101..103). See test-documentation/seeded-defects.md.
 */
test.describe("Seeded defect detection", () => {
  test("@regression SHOP-BUG-103: minPrice filter includes products priced exactly at the boundary", async ({ request }) => {
    const response = await request.get("/api/products?minPrice=50&limit=50");
    const body = await response.json();
    expect(body.items.map((item: { price: number }) => item.price)).toContain(50);
  });

  test("@regression SHOP-BUG-101: cart refuses more units than the product has in stock", async () => {
    const admin = await sessionAs("admin");
    const customer = await sessionAsFreshCustomer();
    try {
      await setStock(admin.context, PRODUCT_IDS.deskLampLowStock, 3);
      const response = await addToCart(customer.context, PRODUCT_IDS.deskLampLowStock, 4);
      expect(response.status()).toBe(422);
      expect((await response.json()).error.code).toBe("INSUFFICIENT_STOCK");
    } finally {
      await admin.dispose();
      await customer.dispose();
    }
  });

  test("@regression SHOP-BUG-102: cancelling an order restores stock", async () => {
    const admin = await sessionAs("admin");
    const customer = await sessionAsFreshCustomer();
    try {
      await setStock(admin.context, PRODUCT_IDS.mugSet, 10);
      await addToCart(customer.context, PRODUCT_IDS.mugSet, 2);
      const { order } = await (await placeOrder(customer.context)).json();

      await customer.context.post(`/api/orders/${order.id}/cancel`);

      const product = await admin.context.get(`/api/admin/products?q=SKU-HK-001`);
      const body = await product.json();
      expect(body.items[0].stock).toBe(10);
    } finally {
      await admin.dispose();
      await customer.dispose();
    }
  });
});
