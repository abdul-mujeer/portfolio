import { expect, test } from "@playwright/test";

test.describe("Storefront catalog (UI)", () => {
  test("@smoke home page renders the catalog with navigation and 12 products", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("brand")).toBeVisible();
    await expect(page.getByTestId("nav-catalog")).toBeVisible();
    await expect(page.getByTestId("product-card")).toHaveCount(12);
    await expect(page.getByTestId("result-count")).toContainText("24 product(s)");
  });

  test("search narrows the catalog and clearing it restores the list", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("search-input").fill("wireless");
    await expect(page.getByTestId("result-count")).toContainText("2 product(s)");
    const names = await page.getByTestId("product-link").allInnerTexts();
    for (const name of names) expect(name.toLowerCase()).toContain("wireless");
  });

  test("no-match search shows the empty state instead of an error", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("search-input").fill("zzzz-no-product");
    await expect(page.getByTestId("empty-state")).toBeVisible();
    await expect(page.getByTestId("empty-state")).toContainText("No products match");
  });

  test("category filter shows only the chosen category", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("category-filter").selectOption("sports");
    await expect(page.getByTestId("result-count")).toContainText("4 product(s)");
    await expect(page.getByTestId("product-card")).toHaveCount(4);
  });

  test("sorting by price ascending shows the cheapest product first", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("sort-select").selectOption("price:asc");
    const firstPrice = page.getByTestId("product-card").first().getByTestId("product-price");
    await expect(firstPrice).toHaveText("$12.50");
  });

  test("in-stock filter hides the out-of-stock product", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("in-stock-filter").check();
    await expect(page.getByTestId("result-count")).toContainText("23 product(s)");
    await expect(page.getByTestId("product-card").filter({ hasText: "Volt Power Bank 20000" })).toHaveCount(0);
  });

  test("pagination moves to the second page and back", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("pagination-info")).toHaveText("Page 1 of 2");
    await page.getByTestId("pagination-next").click();
    await expect(page.getByTestId("pagination-info")).toHaveText("Page 2 of 2");
    await expect(page.getByTestId("pagination-next")).toBeDisabled();
    await page.getByTestId("pagination-prev").click();
    await expect(page.getByTestId("pagination-info")).toHaveText("Page 1 of 2");
  });

  test("product detail page shows stock state and disables the add button when out of stock", async ({ page }) => {
    await page.goto("/product/4");
    await expect(page.getByTestId("product-name")).toContainText("Volt Power Bank");
    await expect(page.getByTestId("product-stock")).toHaveText("Out of stock");
    await expect(page.getByTestId("add-to-cart")).toBeDisabled();
  });

  test("unknown route renders the not-found page", async ({ page }) => {
    await page.goto("/this-route-does-not-exist");
    await expect(page.getByTestId("not-found-title")).toBeVisible();
  });
});
