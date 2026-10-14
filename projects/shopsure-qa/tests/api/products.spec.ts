import { expect, test } from "@playwright/test";
import { PRODUCT_IDS, sessionAs, setStock } from "./helpers";

/**
 * Product catalog: search, filters, sorting, pagination and query validation.
 * Stock-sensitive expectations are normalised in beforeAll so the suite is order-independent.
 */
test.describe("Product catalog", () => {
  let admin: Awaited<ReturnType<typeof sessionAs>>;

  test.beforeAll(async () => {
    admin = await sessionAs("admin");
    await setStock(admin.context, PRODUCT_IDS.powerBankOutOfStock, 0);
    await setStock(admin.context, PRODUCT_IDS.deskLampLowStock, 3);
    await setStock(admin.context, PRODUCT_IDS.headphones, 25);
  });

  test.afterAll(async () => {
    await admin.dispose();
  });

  test("@smoke catalog returns the first page with metadata", async ({ request }) => {
    const response = await request.get("/api/products");
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.items).toHaveLength(12);
    expect(body.total).toBe(24);
    expect(body.totalPages).toBe(2);
    expect(response.headers()["x-total-count"]).toBe("24");
    expect(body.items[0]).toHaveProperty("categoryName");
  });

  test("search matches name and description case-insensitively", async ({ request }) => {
    const response = await request.get("/api/products?q=WIRELESS");
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.total).toBeGreaterThan(0);
    for (const item of body.items) {
      expect(`${item.name} ${item.description}`.toLowerCase()).toContain("wireless");
    }
  });

  test("search treats % and _ as literal characters (LIKE wildcards are escaped)", async ({ request }) => {
    // The seeded catalog contains "75%" in one description, so a literal-percent search must return
    // only that row - NOT the whole catalog (which is what an unescaped '%' wildcard would match).
    const response = await request.get("/api/products?q=%25&limit=50");
    const body = await response.json();
    expect(body.total).toBeGreaterThan(0);
    expect(body.total).toBeLessThan(5);
    for (const item of body.items) {
      expect(`${item.name} ${item.description}`).toContain("%");
    }

    const underscore = await request.get("/api/products?q=_&limit=50");
    const underscoreBody = await underscore.json();
    expect(underscoreBody.total).toBeLessThan(5);
    for (const item of underscoreBody.items) {
      expect(`${item.name} ${item.description}`).toContain("_");
    }
  });

  test("search with no matches returns an empty page, not an error", async ({ request }) => {
    const response = await request.get("/api/products?q=zzzz-no-such-product");
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.items).toHaveLength(0);
    expect(body.total).toBe(0);
  });

  test("category filter returns only that category", async ({ request }) => {
    const response = await request.get("/api/products?category=sports&limit=50");
    const body = await response.json();
    expect(body.total).toBe(4);
    for (const item of body.items) expect(item.categorySlug).toBe("sports");
  });

  test("inStock filter excludes zero-stock products; inStock=false returns only zero-stock products", async ({ request }) => {
    const inStock = await request.get("/api/products?inStock=true&limit=50");
    const inStockBody = await inStock.json();
    expect(inStockBody.total).toBe(23);
    for (const item of inStockBody.items) expect(item.stock).toBeGreaterThan(0);

    const outOfStock = await request.get("/api/products?inStock=false&limit=50");
    const outBody = await outOfStock.json();
    expect(outBody.total).toBe(1);
    expect(outBody.items[0].id).toBe(PRODUCT_IDS.powerBankOutOfStock);
  });

  test("@regression lowStock filter returns only products at or below their threshold", async ({ request }) => {
    const response = await request.get("/api/products?lowStock=true&limit=50");
    const body = await response.json();
    expect(body.total).toBeGreaterThan(0);
    for (const item of body.items) {
      expect(item.stock).toBeGreaterThan(0);
      expect(item.stock).toBeLessThanOrEqual(item.lowStockThreshold);
    }
  });

  test("sorting by price ascending/descending is stable and correct", async ({ request }) => {
    const asc = await request.get("/api/products?sort=price&order=asc&limit=50");
    const ascItems = (await asc.json()).items;
    const ascPrices = ascItems.map((item: { price: number }) => item.price);
    expect(ascPrices).toEqual([...ascPrices].sort((a: number, b: number) => a - b));
    expect(ascPrices[0]).toBe(12.5);

    const desc = await request.get("/api/products?sort=price&order=desc&limit=50");
    const descPrices = (await desc.json()).items.map((item: { price: number }) => item.price);
    expect(descPrices).toEqual([...descPrices].sort((a: number, b: number) => b - a));
    expect(descPrices[0]).toBe(149.99);
  });

  test("@regression minPrice boundary is inclusive (a product priced exactly at the boundary is returned)", async ({ request }) => {
    const response = await request.get("/api/products?minPrice=50&limit=50");
    const body = await response.json();
    const prices = body.items.map((item: { price: number }) => item.price);
    expect(prices).toContain(50);
    for (const price of prices) expect(price).toBeGreaterThanOrEqual(50);
  });

  test("maxPrice boundary is inclusive", async ({ request }) => {
    const response = await request.get("/api/products?maxPrice=12.5&limit=50");
    const body = await response.json();
    const prices = body.items.map((item: { price: number }) => item.price);
    expect(prices).toContain(12.5);
    for (const price of prices) expect(price).toBeLessThanOrEqual(12.5);
  });

  test("minPrice together with maxPrice returns the range only", async ({ request }) => {
    const response = await request.get("/api/products?minPrice=20&maxPrice=40&limit=50");
    const body = await response.json();
    expect(body.total).toBeGreaterThan(0);
    for (const item of body.items) {
      expect(item.price).toBeGreaterThanOrEqual(20);
      expect(item.price).toBeLessThanOrEqual(40);
    }
  });

  test("pagination returns the second page with the remaining items", async ({ request }) => {
    const response = await request.get("/api/products?page=2&limit=12");
    const body = await response.json();
    expect(body.page).toBe(2);
    expect(body.items).toHaveLength(12);
  });

  test("page beyond the last page returns an empty list without error", async ({ request }) => {
    const response = await request.get("/api/products?page=99&limit=12");
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.items).toHaveLength(0);
    expect(body.total).toBe(24);
  });

  test("invalid list parameters are rejected with 400 and field details", async ({ request }) => {
    const cases = [
      "/api/products?sort=evil",
      "/api/products?order=sideways",
      "/api/products?limit=0",
      "/api/products?limit=51",
      "/api/products?page=0",
      "/api/products?minPrice=-1",
      "/api/products?inStock=maybe",
      "/api/products?minPrice=100&maxPrice=10",
    ];
    for (const path of cases) {
      const response = await request.get(path);
      expect(response.status(), `${path} should be rejected`).toBe(400);
      expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
    }
  });

  test("unknown product id returns 404", async ({ request }) => {
    const response = await request.get("/api/products/9999");
    expect(response.status()).toBe(404);
    expect((await response.json()).error.code).toBe("NOT_FOUND");
  });

  test("non-numeric product id returns 400", async ({ request }) => {
    const response = await request.get("/api/products/abc");
    expect(response.status()).toBe(400);
  });

  test("product detail exposes pricing and stock fields used by the storefront", async ({ request }) => {
    const response = await request.get(`/api/products/${PRODUCT_IDS.headphones}`);
    expect(response.status()).toBe(200);
    const { product } = await response.json();
    expect(product).toMatchObject({ id: PRODUCT_IDS.headphones, price: 149.99, categorySlug: "electronics" });
    expect(typeof product.stock).toBe("number");
    expect(product.image).toContain("/images/products/");
  });
});
