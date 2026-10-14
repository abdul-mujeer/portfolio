import { expect, test } from "@playwright/test";

async function login(page: import("@playwright/test").Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByTestId("login-email").fill(email);
  await page.getByTestId("login-password").fill(password);
  await page.getByTestId("login-submit").click();
  await expect(page.getByTestId("current-user")).toBeVisible();
}

test.describe("Administration (UI)", () => {
  test("@regression a customer is blocked from the admin area with an explicit message", async ({ page }) => {
    await login(page, "customer@example.com", "Customer#12345");
    await page.goto("/admin/orders");
    await expect(page.getByTestId("error-banner")).toContainText("Administrator access is required");
    await expect(page.getByTestId("admin-orders-table")).toHaveCount(0);
  });

  test("@smoke admin can advance an order status with the legal transition only", async ({ page }) => {
    await login(page, "admin@example.com", "Admin#12345");
    await page.goto("/admin/orders");

    const row = page.getByTestId("admin-order-row").filter({ hasText: "PENDING" }).first();
    await expect(row).toBeVisible();

    const select = row.getByTestId("admin-status-select");
    await expect(select.locator("option")).toContainText(["PAID", "CANCELED"]);
    await select.selectOption("PAID");

    await expect(page.getByTestId("admin-order-row").filter({ hasText: "PAID" }).first()).toBeVisible();
  });

  test("admin order status filter narrows the table", async ({ page }) => {
    await login(page, "admin@example.com", "Admin#12345");
    await page.goto("/admin/orders");
    await page.getByTestId("admin-status-filter").selectOption("DELIVERED");

    const rows = page.getByTestId("admin-order-row");
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    for (let index = 0; index < count; index += 1) {
      await expect(rows.nth(index).getByTestId("status-badge")).toHaveText("DELIVERED");
    }
  });

  test("admin can update product stock and see the new value", async ({ page }) => {
    await login(page, "admin@example.com", "Admin#12345");
    await page.goto("/admin/products");

    const row = page.getByTestId("admin-product-row").filter({ hasText: "SKU-HK-001" });
    await row.getByTestId("admin-stock-input").fill("42");
    await row.getByTestId("admin-stock-save").click();

    await expect(page.getByTestId("success-banner")).toContainText("Stock updated");
    await expect(row.getByTestId("admin-product-stock")).toHaveText("42");

    // restore the seeded value to keep the demo database tidy
    await row.getByTestId("admin-stock-input").fill("60");
    await row.getByTestId("admin-stock-save").click();
    await expect(row.getByTestId("admin-product-stock")).toHaveText("60");
  });

  test("stock validation errors are surfaced from the API", async ({ page }) => {
    await login(page, "admin@example.com", "Admin#12345");
    await page.goto("/admin/products");
    const row = page.getByTestId("admin-product-row").filter({ hasText: "SKU-HK-001" });
    await row.getByTestId("admin-stock-input").fill("-5");
    await row.getByTestId("admin-stock-save").click();
    await expect(page.getByTestId("error-banner")).toBeVisible();
  });
});
