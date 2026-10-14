#!/usr/bin/env node
/**
 * Captures genuine screenshots from the running ShopSure application.
 *
 * Screenshots are evidence, not mockups: every image is produced by driving the real UI in
 * Chromium against a freshly seeded database.
 *
 * Usage: npm run screenshots
 * Output: test-evidence/screenshots/*.jpg  + an index in test-evidence/screenshots/README.md
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import { startServer, stopServer, waitForHealth, PROJECT_ROOT } from "./lib/server-control.mjs";

const port = Number(process.env.SHOT_PORT || 4182);
const baseUrl = `http://127.0.0.1:${port}`;
const outDir = path.join(PROJECT_ROOT, "test-evidence/screenshots");
const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

fs.mkdirSync(outDir, { recursive: true });
const captured = [];

const { child, logs } = startServer({ port, dbPath: ".data/shopsure.screenshots.db", reset: true });

let browser;

async function shot(page, name, description) {
  const file = path.join(outDir, `${name}.jpg`);
  try {
    await page.screenshot({ path: file, type: "jpeg", quality: 72 });
    captured.push({ name: `${name}.jpg`, description });
    console.log(`captured ${name}.jpg — ${description}`);
  } catch (error) {
    // One failed screenshot must not abort the whole evidence run; it is recorded instead.
    captured.push({ name: `${name}.jpg`, description: `${description} (FAILED: ${String(error).slice(0, 120)})` });
    console.error(`FAILED  ${name}.jpg — ${String(error).slice(0, 200)}`);
  }
}

async function login(page, email, password) {
  await page.goto(`${baseUrl}/login`);
  await page.getByTestId("login-email").fill(email);
  await page.getByTestId("login-password").fill(password);
  await page.getByTestId("login-submit").click();
  await page.getByTestId("current-user").waitFor();
}

try {
  await waitForHealth(baseUrl);

  browser = await chromium.launch();
  const desktop = await browser.newContext({ viewport: DESKTOP, deviceScaleFactor: 1 });
  const page = await desktop.newPage();

  await page.goto(baseUrl);
  await page.getByTestId("product-card").first().waitFor();
  await shot(page, "01-catalog-desktop", "Storefront catalog with search, filters, sorting and pagination.");

  await page.getByTestId("search-input").fill("wireless");
  await page.getByTestId("result-count").waitFor();
  await shot(page, "02-catalog-search", "Search filtering the catalog to matching products.");

  await page.goto(`${baseUrl}/product/1`);
  await page.getByTestId("product-name").waitFor();
  await shot(page, "03-product-detail", "Product detail page with price, stock state and add-to-cart.");

  await page.goto(`${baseUrl}/product/4`);
  await page.getByTestId("product-stock").waitFor();
  await shot(page, "04-out-of-stock", "Out-of-stock product: the add button is disabled.");

  await login(page, "customer@example.com", "Customer#12345");
  await page.goto(`${baseUrl}/product/8`);
  await page.getByTestId("quantity-input").fill("2");
  await page.getByTestId("add-to-cart").click();
  await page.getByTestId("success-banner").waitFor();
  await page.goto(`${baseUrl}/cart`);
  await page.getByTestId("cart-row").first().waitFor();
  await shot(page, "05-cart", "Cart with pricing rules applied (subtotal, shipping, total).");

  await page.getByTestId("checkout-button").click();
  await page.getByTestId("checkout-name").fill("A");
  await page.getByTestId("checkout-postcode").fill("!!");
  await page.getByTestId("checkout-email").fill("casey@example.com");
  await page.getByTestId("checkout-phone").fill("+1 555 0100");
  await page.getByTestId("checkout-address").fill("12 Example Street");
  await page.getByTestId("checkout-city").fill("Springfield");
  await page.getByTestId("checkout-submit").click();
  await page.getByTestId("checkout-name-error").waitFor();
  await shot(page, "06-checkout-validation", "Checkout validation errors surfaced per field from the API.");

  await page.getByTestId("checkout-name").fill("Casey Customer");
  await page.getByTestId("checkout-postcode").fill("12345");
  await page.getByTestId("checkout-submit").click();
  await page.getByTestId("confirmation-order-number").waitFor();
  await shot(page, "07-order-confirmation", "Order confirmation with the generated ORD number and totals.");

  const orderUrl = page.url();
  const orderId = orderUrl.split("/").pop();
  await page.goto(`${baseUrl}/orders`);
  await page.getByTestId("order-row").first().waitFor();
  await shot(page, "08-order-history", "Customer order history with statuses.");

  await page.goto(`${baseUrl}/orders/${orderId}`);
  await page.getByTestId("order-number").waitFor();
  await shot(page, "09-order-detail", "Order detail with item lines, totals and status history.");

  await page.goto(`${baseUrl}/admin/orders`);
  await page.getByTestId("error-banner").waitFor();
  await shot(page, "10-rbac-blocked", "Role-based access control: a customer is blocked from the admin area (API returns 403).");

  const adminContext = await browser.newContext({ viewport: DESKTOP });
  const adminPage = await adminContext.newPage();
  await login(adminPage, "admin@example.com", "Admin#12345");
  await adminPage.goto(`${baseUrl}/admin/orders`);
  await adminPage.getByTestId("admin-order-row").first().waitFor();
  await shot(adminPage, "11-admin-orders", "Admin order management with legal status transitions only.");

  await adminPage.goto(`${baseUrl}/admin/products`);
  await adminPage.getByTestId("admin-product-row").first().waitFor();
  await shot(adminPage, "12-admin-inventory", "Admin inventory with direct stock adjustments.");

  const mobileContext = await browser.newContext({ viewport: MOBILE, deviceScaleFactor: 2 });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto(baseUrl);
  await mobilePage.getByTestId("product-card").first().waitFor();
  await shot(mobilePage, "13-catalog-mobile", "Responsive catalog at a 390x844 mobile viewport.");

  await login(mobilePage, "customer@example.com", "Customer#12345");
  await mobilePage.goto(`${baseUrl}/cart`);
  await shot(mobilePage, "14-cart-mobile", "Responsive cart at a mobile viewport.");

  await browser.close();
  browser = undefined;
} catch (error) {
  console.error("[screenshots] failed:", error);
  console.error(logs.join("").split("\n").slice(-40).join("\n"));
  process.exitCode = 1;
} finally {
  if (browser) await browser.close().catch(() => {});
  await stopServer(child);
}

const index = [
  "# ShopSure — application screenshots",
  "",
  "All images were captured automatically from the running application by `npm run screenshots`",
  `(last run: ${new Date().toISOString()}). They are evidence of the implemented UI, not mockups.`,
  "",
  "| File | What it shows |",
  "|------|----------------|",
  ...captured.map((item) => `| \`${item.name}\` | ${item.description} |`),
  "",
].join("\n");
fs.writeFileSync(path.join(outDir, "README.md"), index);
console.log(`\n${captured.length} screenshots written to test-evidence/screenshots/`);
