import { expect, test } from "@playwright/test";

test.describe("Usability and accessibility smoke checks", () => {
  test("the skip link is the first focusable element and jumps to the main content", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const focused = page.locator(":focus");
    await expect(focused).toHaveClass(/skip-link/);
    await expect(focused).toHaveText("Skip to content");
  });

  test("login form inputs are programmatically labelled", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
  });

  test("catalog product images have alt text", async ({ page }) => {
    await page.goto("/");
    const images = page.getByTestId("product-card").locator("img");
    const count = await images.count();
    expect(count).toBeGreaterThan(0);
    for (let index = 0; index < count; index += 1) {
      const alt = await images.nth(index).getAttribute("alt");
      expect(alt && alt.length > 2).toBeTruthy();
    }
  });

  test("each page exposes exactly one h1 heading", async ({ page }) => {
    for (const path of ["/", "/login", "/register", "/cart"]) {
      await page.goto(path);
      await expect(page.locator("h1")).toHaveCount(1);
    }
  });

  test("error banners are announced as alerts", async ({ page }) => {
    await page.goto("/login");
    await page.getByTestId("login-password").fill("Wrong#12345");
    await page.getByTestId("login-submit").click();
    await expect(page.getByRole("alert")).toContainText("Invalid email or password");
  });

  test("the layout is usable at a mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.getByTestId("product-card").first()).toBeVisible();
    await expect(page.getByTestId("nav-cart")).toBeVisible();
    await expect(page.getByTestId("search-input")).toBeVisible();

    await page.getByTestId("product-link").first().click();
    await expect(page.getByTestId("product-name")).toBeVisible();
    await expect(page.getByTestId("add-to-cart")).toBeVisible();
  });

  test("no uncaught console errors on the main journey", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(`pageerror: ${String(error)}`));
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      const text = message.text();
      // The browser reports expected guest-phase 401/403 HTTP responses as resource errors
      // (e.g. /api/auth/me before login, /api/cart without a session). Those are handled
      // responses, not application errors, so they are excluded from this check.
      if (/Failed to load resource: the server responded with a status of (401|403)/.test(text)) return;
      errors.push(text);
    });

    await page.goto("/");
    await page.getByTestId("search-input").fill("mug");
    await page.goto("/product/8");
    await page.goto("/login");
    await page.getByTestId("login-submit").click();
    await page.goto("/orders");

    expect(errors, `console errors: ${errors.join(" | ")}`).toHaveLength(0);
  });
});
