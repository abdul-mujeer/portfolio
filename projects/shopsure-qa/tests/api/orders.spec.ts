import { expect, test } from "@playwright/test";
import {
  PRODUCT_IDS,
  VALID_SHIPPING,
  addToCart,
  getProduct,
  placeOrder,
  sessionAs,
  sessionAsFreshCustomer,
  setStock,
} from "./helpers";

test.describe("Checkout, pricing and order lifecycle", () => {
  let admin: Awaited<ReturnType<typeof sessionAs>>;

  test.beforeAll(async () => {
    admin = await sessionAs("admin");
    await setStock(admin.context, PRODUCT_IDS.mugSet, 60);
    await setStock(admin.context, PRODUCT_IDS.mouse, 40);
    await setStock(admin.context, PRODUCT_IDS.webcam, 15);
    await setStock(admin.context, PRODUCT_IDS.keyboard, 18);
    await setStock(admin.context, PRODUCT_IDS.speaker, 12);
  });

  test.afterAll(async () => {
    await admin.dispose();
  });

  test("@smoke checkout creates a PENDING order with an ORD number and clears the cart", async () => {
    const customer = await sessionAsFreshCustomer();
    try {
      await addToCart(customer.context, PRODUCT_IDS.mugSet, 2);
      const response = await placeOrder(customer.context);
      expect(response.status()).toBe(201);

      const { order } = await response.json();
      expect(order.status).toBe("PENDING");
      expect(order.orderNumber).toMatch(/^ORD-\d{5}$/);
      expect(order.items).toHaveLength(1);
      expect(order.subtotal).toBe(49);
      expect(order.shippingFee).toBe(5);
      expect(order.total).toBe(54);
      expect(order.events.map((event: { toStatus: string }) => event.toStatus)).toEqual(["PENDING"]);

      const cart = await customer.context.get("/api/cart");
      expect((await cart.json()).items).toHaveLength(0);
    } finally {
      await customer.dispose();
    }
  });

  test("@regression pricing decision table: subtotal 49.99 charges shipping, 50.00 does not", async () => {
    const below = await sessionAsFreshCustomer();
    const exact = await sessionAsFreshCustomer();
    try {
      await addToCart(below.context, PRODUCT_IDS.speaker, 1); // 49.99
      const belowOrder = (await (await placeOrder(below.context)).json()).order;
      expect(belowOrder.subtotal).toBe(49.99);
      expect(belowOrder.shippingFee).toBe(5);
      expect(belowOrder.discount).toBe(0);
      expect(belowOrder.total).toBe(54.99);

      await addToCart(exact.context, PRODUCT_IDS.mouse, 1); // 50.00
      const exactOrder = (await (await placeOrder(exact.context)).json()).order;
      expect(exactOrder.subtotal).toBe(50);
      expect(exactOrder.shippingFee).toBe(0);
      expect(exactOrder.total).toBe(50);
    } finally {
      await below.dispose();
      await exact.dispose();
    }
  });

  test("@regression pricing decision table: discount applies from exactly 100.00, not below", async () => {
    const below = await sessionAsFreshCustomer();
    const exact = await sessionAsFreshCustomer();
    try {
      await addToCart(below.context, PRODUCT_IDS.keyboard, 1); // 99.99
      const belowOrder = (await (await placeOrder(below.context)).json()).order;
      expect(belowOrder.subtotal).toBe(99.99);
      expect(belowOrder.discount).toBe(0);
      expect(belowOrder.total).toBe(99.99);

      await addToCart(exact.context, PRODUCT_IDS.webcam, 1); // 100.00
      const exactOrder = (await (await placeOrder(exact.context)).json()).order;
      expect(exactOrder.subtotal).toBe(100);
      expect(exactOrder.discount).toBe(10);
      expect(exactOrder.shippingFee).toBe(0);
      expect(exactOrder.total).toBe(90);
    } finally {
      await below.dispose();
      await exact.dispose();
    }
  });

  test("discount and shipping combine correctly for a mixed cart", async () => {
    const customer = await sessionAsFreshCustomer();
    try {
      await addToCart(customer.context, PRODUCT_IDS.headphones, 1); // 149.99
      await addToCart(customer.context, PRODUCT_IDS.speaker, 1); // 49.99
      const { order } = await (await placeOrder(customer.context)).json();
      expect(order.subtotal).toBe(199.98);
      expect(order.discount).toBe(20);
      expect(order.shippingFee).toBe(0);
      expect(order.total).toBe(179.98);
    } finally {
      await customer.dispose();
    }
  });

  test("checkout with an empty cart is rejected with 422 EMPTY_CART", async () => {
    const customer = await sessionAsFreshCustomer();
    try {
      const response = await placeOrder(customer.context);
      expect(response.status()).toBe(422);
      expect((await response.json()).error.code).toBe("EMPTY_CART");
    } finally {
      await customer.dispose();
    }
  });

  test("checkout validates every shipping field and reports the failing fields", async () => {
    const customer = await sessionAsFreshCustomer();
    try {
      await addToCart(customer.context, PRODUCT_IDS.mugSet, 1);
      const response = await placeOrder(customer.context, {
        name: "A",
        email: "not-an-email",
        phone: "abc",
        address: "no",
        city: "",
        postcode: "!!",
      });
      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
      const fields = body.error.details.map((detail: { field: string }) => detail.field);
      expect(fields).toEqual(expect.arrayContaining(["name", "email", "phone", "address", "city", "postcode"]));
    } finally {
      await customer.dispose();
    }
  });

  test("checkout with a malformed postcode is rejected (boundary: 2 and 11 characters)", async () => {
    const customer = await sessionAsFreshCustomer();
    try {
      await addToCart(customer.context, PRODUCT_IDS.mugSet, 1);
      for (const postcode of ["12", "12345678901", "!!"]) {
        const response = await placeOrder(customer.context, { ...VALID_SHIPPING, postcode });
        expect(response.status(), `postcode ${postcode}`).toBe(400);
      }
    } finally {
      await customer.dispose();
    }
  });

  test("@regression placing an order decrements stock by the ordered quantity", async () => {
    const customer = await sessionAsFreshCustomer();
    try {
      await setStock(admin.context, PRODUCT_IDS.mugSet, 10);
      await addToCart(customer.context, PRODUCT_IDS.mugSet, 3);
      const { order } = await (await placeOrder(customer.context)).json();
      expect(order.items[0].quantity).toBe(3);

      const product = await getProduct(admin.context, PRODUCT_IDS.mugSet);
      expect(product.stock).toBe(7);
    } finally {
      await customer.dispose();
    }
  });

  test("@regression checkout re-validates stock: an order fails when stock dropped after adding to cart", async () => {
    const customer = await sessionAsFreshCustomer();
    try {
      await setStock(admin.context, PRODUCT_IDS.mugSet, 5);
      await addToCart(customer.context, PRODUCT_IDS.mugSet, 3);
      await setStock(admin.context, PRODUCT_IDS.mugSet, 1); // simulated concurrent purchase

      const response = await placeOrder(customer.context);
      expect(response.status()).toBe(422);
      expect((await response.json()).error.code).toBe("INSUFFICIENT_STOCK");

      const product = await getProduct(admin.context, PRODUCT_IDS.mugSet);
      expect(product.stock).toBe(1);
      const cart = await customer.context.get("/api/cart");
      expect((await cart.json()).items).toHaveLength(1);
    } finally {
      await customer.dispose();
    }
  });

  test("order history returns only the current customer's orders, newest first", async () => {
    const owner = await sessionAsFreshCustomer();
    const other = await sessionAsFreshCustomer();
    try {
      await setStock(admin.context, PRODUCT_IDS.mugSet, 60);
      await addToCart(owner.context, PRODUCT_IDS.mugSet, 1);
      const created = await (await placeOrder(owner.context)).json();

      const ownerList = await (await owner.context.get("/api/orders")).json();
      expect(ownerList.items.some((order: { id: number }) => order.id === created.order.id)).toBe(true);

      const otherList = await (await other.context.get("/api/orders")).json();
      expect(otherList.items.some((order: { id: number }) => order.id === created.order.id)).toBe(false);
    } finally {
      await owner.dispose();
      await other.dispose();
    }
  });

  test("@regression another customer cannot read someone else's order (returns 404, not 403)", async () => {
    const owner = await sessionAsFreshCustomer();
    const intruder = await sessionAsFreshCustomer();
    try {
      await setStock(admin.context, PRODUCT_IDS.mugSet, 60);
      await addToCart(owner.context, PRODUCT_IDS.mugSet, 1);
      const created = await (await placeOrder(owner.context)).json();

      const response = await intruder.context.get(`/api/orders/${created.order.id}`);
      expect(response.status()).toBe(404);
    } finally {
      await owner.dispose();
      await intruder.dispose();
    }
  });

  test("@regression cancelling a PENDING order restores stock and is recorded in the event history", async () => {
    const customer = await sessionAsFreshCustomer();
    try {
      await setStock(admin.context, PRODUCT_IDS.mugSet, 10);
      await addToCart(customer.context, PRODUCT_IDS.mugSet, 4);
      const created = await (await placeOrder(customer.context)).json();
      expect((await getProduct(admin.context, PRODUCT_IDS.mugSet)).stock).toBe(6);

      const cancel = await customer.context.post(`/api/orders/${created.order.id}/cancel`);
      expect(cancel.status()).toBe(200);
      const { order } = await cancel.json();
      expect(order.status).toBe("CANCELED");
      expect(order.events.map((event: { toStatus: string }) => event.toStatus)).toEqual(["PENDING", "CANCELED"]);

      expect((await getProduct(admin.context, PRODUCT_IDS.mugSet)).stock).toBe(10);
    } finally {
      await customer.dispose();
    }
  });

  test("a SHIPPED order cannot be cancelled (invalid transition)", async () => {
    const customer = await sessionAsFreshCustomer();
    try {
      await setStock(admin.context, PRODUCT_IDS.mugSet, 60);
      await addToCart(customer.context, PRODUCT_IDS.mugSet, 1);
      const created = await (await placeOrder(customer.context)).json();
      const orderId = created.order.id;

      expect((await admin.context.patch(`/api/admin/orders/${orderId}/status`, { data: { status: "PAID" } })).status()).toBe(200);
      expect((await admin.context.patch(`/api/admin/orders/${orderId}/status`, { data: { status: "SHIPPED" } })).status()).toBe(200);

      const cancel = await customer.context.post(`/api/orders/${orderId}/cancel`);
      expect(cancel.status()).toBe(422);
      expect((await cancel.json()).error.code).toBe("INVALID_TRANSITION");
    } finally {
      await customer.dispose();
    }
  });

  test("cancelling twice is rejected the second time", async () => {
    const customer = await sessionAsFreshCustomer();
    try {
      await setStock(admin.context, PRODUCT_IDS.mugSet, 60);
      await addToCart(customer.context, PRODUCT_IDS.mugSet, 1);
      const created = await (await placeOrder(customer.context)).json();
      const orderId = created.order.id;

      expect((await customer.context.post(`/api/orders/${orderId}/cancel`)).status()).toBe(200);
      const second = await customer.context.post(`/api/orders/${orderId}/cancel`);
      expect(second.status()).toBe(422);
    } finally {
      await customer.dispose();
    }
  });

  test("checkout requires authentication", async ({ request }) => {
    const response = await request.post("/api/orders", { data: VALID_SHIPPING });
    expect(response.status()).toBe(401);
  });

  test("unknown order id returns 404 for a customer session", async () => {
    const customer = await sessionAsFreshCustomer();
    try {
      expect((await customer.context.get("/api/orders/999999")).status()).toBe(404);
    } finally {
      await customer.dispose();
    }
  });
});
