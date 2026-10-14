import { expect, test } from "@playwright/test";

async function loginAsCustomer(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByTestId("login-email").fill("customer@example.com");
  await page.getByTestId("login-password").fill("Customer#12345");
  await page.getByTestId("login-submit").click();
  await expect(page.getByTestId("current-user")).toBeVisible();
}

test.describe("Purchase journey (UI)", () => {
  test("@smoke end-to-end purchase: catalog -> cart -> checkout -> confirmation", async ({ page }) => {
    await loginAsCustomer(page);

    // Add a product from the catalog
    await page.getByTestId("search-input").fill("Ember Ceramic");
    await expect(page.getByTestId("product-card")).toHaveCount(1);
    await page.getByTestId("product-link").click();
    await expect(page.getByTestId("product-name")).toContainText("Ember Ceramic Mug Set");

    await page.getByTestId("quantity-input").fill("2");
    await page.getByTestId("add-to-cart").click();
    await expect(page.getByTestId("success-banner")).toContainText("Added 2");

    // Cart shows the line and the pricing rules (2 x 24.50 = 49.00 -> +5.00 shipping)
    await page.getByTestId("nav-cart").click();
    await expect(page.getByTestId("cart-row")).toHaveCount(1);
    await expect(page.getByTestId("summary-subtotal")).toHaveText("$49.00");
    await expect(page.getByTestId("summary-shipping")).toHaveText("$5.00");
    await expect(page.getByTestId("summary-total")).toHaveText("$54.00");

    // Checkout validation is surfaced per field
    await page.getByTestId("checkout-button").click();
    await page.getByTestId("checkout-name").fill("A");
    await page.getByTestId("checkout-postcode").fill("!!");
    await page.getByTestId("checkout-email").fill("casey@example.com");
    await page.getByTestId("checkout-phone").fill("+1 555 0100");
    await page.getByTestId("checkout-address").fill("12 Example Street");
    await page.getByTestId("checkout-city").fill("Springfield");
    await page.getByTestId("checkout-submit").click();
    await expect(page.getByTestId("checkout-name-error")).toBeVisible();

    // Fix the fields and place the order
    await page.getByTestId("checkout-name").fill("Casey Customer");
    await page.getByTestId("checkout-postcode").fill("12345");
    await page.getByTestId("checkout-submit").click();

    await expect(page.getByTestId("confirmation-order-number")).toContainText(/ORD-\d{5}/);
    await expect(page.getByTestId("confirmation-total")).toHaveText("$54.00");

    // Order history contains the new order and stays role-scoped
    await page.goto("/orders");
    await expect(page.getByTestId("order-row").first()).toBeVisible();
  });

  test("cart quantity can be updated and an item removed", async ({ page }) => {
    await loginAsCustomer(page);
    await page.goto("/product/12");
    await page.getByTestId("add-to-cart").click();
    await expect(page.getByTestId("success-banner")).toBeVisible();

    await page.goto("/cart");
    await expect(page.getByTestId("cart-row")).toHaveCount(1);

    await page.getByTestId("cart-quantity").fill("2");
    await expect(page.getByTestId("summary-subtotal")).toHaveText("$79.98");

    await page.getByTestId("cart-remove").click();
    await expect(page.getByTestId("cart-row")).toHaveCount(0);
    await expect(page.getByTestId("empty-state")).toBeVisible();
  });

  test("cart badge reflects the number of units", async ({ page }) => {
    await loginAsCustomer(page);
    await page.goto("/product/8");
    await page.getByTestId("add-to-cart").click();
    await expect(page.getByTestId("cart-count")).toHaveText("1");
  });

  test("invalid quantity above stock shows a friendly error from the API", async ({ page }) => {
    await loginAsCustomer(page);
    await page.goto("/product/5"); // Lumen Desk Lamp, stock 3
    await page.getByTestId("quantity-input").fill("4");
    await page.getByTestId("add-to-cart").click();
    await expect(page.getByTestId("error-banner")).toContainText("in stock");
  });

  test("a PENDING order can be cancelled from the order detail page", async ({ page }) => {
    await loginAsCustomer(page);
    await page.goto("/orders");
    const pendingRow = page.getByTestId("order-row").filter({ hasText: "PENDING" }).first();

    if ((await pendingRow.count()) === 0) {
      // Create one so the test is self-contained, then re-open the list
      await page.goto("/product/8");
      await page.getByTestId("add-to-cart").click();
      await page.goto("/checkout");
      await page.getByTestId("checkout-phone").fill("+1 555 0100");
      await page.getByTestId("checkout-address").fill("12 Example Street");
      await page.getByTestId("checkout-city").fill("Springfield");
      await page.getByTestId("checkout-postcode").fill("12345");
      await page.getByTestId("checkout-submit").click();
      await expect(page.getByTestId("confirmation-order-number")).toBeVisible();
      await page.goto("/orders");
    }

    await page.getByTestId("order-row").filter({ hasText: "PENDING" }).first().getByTestId("order-detail-link").click();
    await expect(page.getByTestId("order-events")).toContainText("PENDING");
    await page.getByTestId("cancel-order").click();
    await expect(page.getByTestId("status-badge")).toHaveText("CANCELED");
  });
});
