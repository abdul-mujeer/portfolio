import { expect, test } from "@playwright/test";
import {
  PRODUCT_IDS,
  addToCart,
  getCart,
  sessionAs,
  sessionAsFreshCustomer,
  setStock,
} from "./helpers";

test.describe("Shopping cart", () => {
  let admin: Awaited<ReturnType<typeof sessionAs>>;

  test.beforeAll(async () => {
    admin = await sessionAs("admin");
    await setStock(admin.context, PRODUCT_IDS.powerBankOutOfStock, 0);
    await setStock(admin.context, PRODUCT_IDS.deskLampLowStock, 3);
    await setStock(admin.context, PRODUCT_IDS.headphones, 25);
    await setStock(admin.context, PRODUCT_IDS.mugSet, 60);
  });

  test.afterAll(async () => {
    await admin.dispose();
  });

  test("@smoke a customer can add a product and receives recomputed totals", async () => {
    const customer = await sessionAsFreshCustomer();
    try {
      const response = await addToCart(customer.context, PRODUCT_IDS.mugSet, 2);
      expect(response.status()).toBe(201);
      const cart = await response.json();
      expect(cart.items).toHaveLength(1);
      expect(cart.items[0].quantity).toBe(2);
      expect(cart.subtotal).toBe(49);
      // 49.00 is 1 cent below the free-shipping threshold -> shipping applies
      expect(cart.shipping).toBe(5);
      expect(cart.total).toBe(54);
    } finally {
      await customer.dispose();
    }
  });

  test("adding the same product twice merges the quantity into one line", async () => {
    const customer = await sessionAsFreshCustomer();
    try {
      await addToCart(customer.context, PRODUCT_IDS.mugSet, 2);
      const response = await addToCart(customer.context, PRODUCT_IDS.mugSet, 3);
      expect(response.status()).toBe(201);
      const cart = await response.json();
      expect(cart.items).toHaveLength(1);
      expect(cart.items[0].quantity).toBe(5);
    } finally {
      await customer.dispose();
    }
  });

  test("quantity boundaries: 1 and 10 are accepted, 0 and 11 are rejected", async () => {
    const customer = await sessionAsFreshCustomer();
    try {
      expect((await addToCart(customer.context, PRODUCT_IDS.headphones, 1)).status()).toBe(201);
      expect((await addToCart(customer.context, PRODUCT_IDS.headphones, 9)).status()).toBe(201);

      const zero = await addToCart(customer.context, PRODUCT_IDS.mugSet, 0);
      expect(zero.status()).toBe(400);

      const eleven = await addToCart(customer.context, PRODUCT_IDS.mugSet, 11);
      expect(eleven.status()).toBe(400);
      const body = await eleven.json();
      expect(JSON.stringify(body.error.details)).toContain("at most 10");
    } finally {
      await customer.dispose();
    }
  });

  test("@regression merging beyond 10 units on one line is rejected with 422", async () => {
    const customer = await sessionAsFreshCustomer();
    try {
      await addToCart(customer.context, PRODUCT_IDS.headphones, 6);
      const response = await addToCart(customer.context, PRODUCT_IDS.headphones, 5);
      expect(response.status()).toBe(422);
      expect((await response.json()).error.code).toBe("QUANTITY_LIMIT_EXCEEDED");
    } finally {
      await customer.dispose();
    }
  });

  test("@regression adding more units than stock is rejected with 422", async () => {
    const customer = await sessionAsFreshCustomer();
    try {
      const response = await addToCart(customer.context, PRODUCT_IDS.deskLampLowStock, 4);
      expect(response.status()).toBe(422);
      const body = await response.json();
      expect(body.error.code).toBe("INSUFFICIENT_STOCK");
      expect(body.error.message).toContain("3");
    } finally {
      await customer.dispose();
    }
  });

  test("out-of-stock products cannot be added", async () => {
    const customer = await sessionAsFreshCustomer();
    try {
      const response = await addToCart(customer.context, PRODUCT_IDS.powerBankOutOfStock, 1);
      expect(response.status()).toBe(422);
      expect((await response.json()).error.code).toBe("OUT_OF_STOCK");
    } finally {
      await customer.dispose();
    }
  });

  test("unknown product id cannot be added (404)", async () => {
    const customer = await sessionAsFreshCustomer();
    try {
      const response = await addToCart(customer.context, 99999, 1);
      expect(response.status()).toBe(404);
    } finally {
      await customer.dispose();
    }
  });

  test("updating a line quantity above stock is rejected; a valid quantity succeeds", async () => {
    const customer = await sessionAsFreshCustomer();
    try {
      const added = await addToCart(customer.context, PRODUCT_IDS.deskLampLowStock, 2);
      const cart = await added.json();
      const lineId = cart.items[0].id;

      const tooMany = await customer.context.patch(`/api/cart/items/${lineId}`, { data: { quantity: 4 } });
      expect(tooMany.status()).toBe(422);
      expect((await tooMany.json()).error.code).toBe("INSUFFICIENT_STOCK");

      const ok = await customer.context.patch(`/api/cart/items/${lineId}`, { data: { quantity: 3 } });
      expect(ok.status()).toBe(200);
      const updated = await ok.json();
      expect(updated.items[0].quantity).toBe(3);
    } finally {
      await customer.dispose();
    }
  });

  test("@regression cart items are private: another customer cannot modify or delete them", async () => {
    const owner = await sessionAsFreshCustomer();
    const intruder = await sessionAsFreshCustomer();
    try {
      const added = await addToCart(owner.context, PRODUCT_IDS.mugSet, 1);
      const lineId = (await added.json()).items[0].id;

      const patch = await intruder.context.patch(`/api/cart/items/${lineId}`, { data: { quantity: 2 } });
      expect(patch.status()).toBe(404);

      const remove = await intruder.context.delete(`/api/cart/items/${lineId}`);
      expect(remove.status()).toBe(404);

      const ownerCart = await getCart(owner.context);
      expect(ownerCart.items[0].quantity).toBe(1);
    } finally {
      await owner.dispose();
      await intruder.dispose();
    }
  });

  test("removing a line empties the cart; clearing the cart removes everything", async () => {
    const customer = await sessionAsFreshCustomer();
    try {
      const added = await addToCart(customer.context, PRODUCT_IDS.mugSet, 1);
      const lineId = (await added.json()).items[0].id;

      const removed = await customer.context.delete(`/api/cart/items/${lineId}`);
      expect(removed.status()).toBe(204);
      expect((await getCart(customer.context)).items).toHaveLength(0);

      await addToCart(customer.context, PRODUCT_IDS.mugSet, 1);
      await addToCart(customer.context, PRODUCT_IDS.cleanTesting, 1);
      const cleared = await customer.context.delete("/api/cart");
      expect(cleared.status()).toBe(204);
      expect((await getCart(customer.context)).items).toHaveLength(0);
    } finally {
      await customer.dispose();
    }
  });

  test("the cart persists across requests and reflects the pricing rules", async () => {
    const customer = await sessionAsFreshCustomer();
    try {
      await addToCart(customer.context, PRODUCT_IDS.webcam, 1); // 100.00 -> discount boundary
      const first = await getCart(customer.context);
      const second = await getCart(customer.context);

      expect(first.items).toHaveLength(1);
      expect(second).toEqual(first);
      expect(second.subtotal).toBe(100);
      expect(second.discount).toBe(10);
      expect(second.shipping).toBe(0);
      expect(second.total).toBe(90);
    } finally {
      await customer.dispose();
    }
  });

  test("unauthenticated cart access returns 401 for all cart endpoints", async ({ request }) => {
    expect((await request.get("/api/cart")).status()).toBe(401);
    expect((await request.post("/api/cart/items", { data: { productId: 1, quantity: 1 } })).status()).toBe(401);
    expect((await request.patch("/api/cart/items/1", { data: { quantity: 1 } })).status()).toBe(401);
    expect((await request.delete("/api/cart/items/1")).status()).toBe(401);
    expect((await request.delete("/api/cart")).status()).toBe(401);
  });

  test("cart payload rejects malformed bodies with 400", async () => {
    const customer = await sessionAsFreshCustomer();
    try {
      const noProduct = await customer.context.post("/api/cart/items", { data: { quantity: 1 } });
      expect(noProduct.status()).toBe(400);

      const stringQuantity = await customer.context.post("/api/cart/items", { data: { productId: 1, quantity: "two" } });
      expect(stringQuantity.status()).toBe(400);

      const fractional = await customer.context.post("/api/cart/items", { data: { productId: 1, quantity: 1.5 } });
      expect(fractional.status()).toBe(400);
    } finally {
      await customer.dispose();
    }
  });
});
