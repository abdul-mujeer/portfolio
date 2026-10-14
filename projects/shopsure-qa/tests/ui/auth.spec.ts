import { expect, test } from "@playwright/test";

test.describe("Authentication (UI)", () => {
  test("@smoke a seeded customer can log in and log out", async ({ page }) => {
    await page.goto("/login");
    await page.getByTestId("login-email").fill("customer@example.com");
    await page.getByTestId("login-password").fill("Customer#12345");
    await page.getByTestId("login-submit").click();

    await expect(page.getByTestId("current-user")).toHaveText("Casey Customer");
    await expect(page.getByTestId("logout-button")).toBeVisible();

    await page.getByTestId("logout-button").click();
    await expect(page.getByTestId("nav-login")).toBeVisible();
  });

  test("invalid credentials show an error banner and keep the user on the page", async ({ page }) => {
    await page.goto("/login");
    await page.getByTestId("login-email").fill("customer@example.com");
    await page.getByTestId("login-password").fill("DefinitelyWrong#1");
    await page.getByTestId("login-submit").click();

    await expect(page.getByTestId("error-banner")).toContainText("Invalid email or password");
    await expect(page.getByTestId("nav-login")).toBeVisible();
  });

  test("registration validation errors are displayed per field", async ({ page }) => {
    await page.goto("/register");
    await page.getByTestId("register-name").fill("A");
    await page.getByTestId("register-email").fill("not-an-email");
    await page.getByTestId("register-password").fill("weak");
    await page.getByTestId("register-submit").click();

    const banner = page.getByTestId("error-banner");
    await expect(banner).toBeVisible();
    await expect(banner).toContainText("name");
    await expect(banner).toContainText("email");
    await expect(banner).toContainText("password");
  });

  test("guest sees a login prompt on the cart page instead of a broken cart", async ({ page }) => {
    await page.goto("/cart");
    await expect(page.getByTestId("empty-state")).toContainText("log in");
  });

  test("session survives a page reload", async ({ page }) => {
    await page.goto("/login");
    await page.getByTestId("login-submit").click();
    await expect(page.getByTestId("current-user")).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("current-user")).toHaveText("Casey Customer");
  });
});
