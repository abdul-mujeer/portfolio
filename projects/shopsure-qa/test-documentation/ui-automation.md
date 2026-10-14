# ShopSure — UI Automation

- **Framework:** Playwright (`@playwright/test`) with Chromium
- **Suite:** `tests/ui/*.spec.ts` — 31 tests across 4 files
- **Config:** `playwright.config.ts` (project `chromium`, 1440x900, trace + screenshot on failure)
- **Entry point:** `npm run test:ui` (boots a freshly seeded server through the `webServer` hook)

## 1. What is automated

| File | Focus | Highlights |
|------|-------|-----------|
| `catalog.spec.ts` (9) | Storefront browsing | Default listing, search, empty state, category filter, price sorting, in-stock filter, pagination, out-of-stock product page, unknown route |
| `auth.spec.ts` (5) | Authentication | Login/logout, invalid credentials banner, registration validation, guest cart prompt, session survival across reload |
| `purchase.spec.ts` (5) | Money path | Full purchase journey, cart quantity update/remove, cart badge, stock error surfaced from the API, order cancellation |
| `admin.spec.ts` (5) | Administration | Customer blocked from the admin area, legal status transition, status filter, stock update, stock validation error |
| `accessibility.spec.ts` (7) | Usability/a11y | Skip link, labelled inputs, image alt text, one h1 per page, `role=alert` for errors, mobile viewport, no uncaught console errors |

## 2. Design rules used

1. **Stable selectors only.** Every interactive element and key output carries a `data-testid`
   (for example `cart-quantity`, `checkout-postcode-error`, `admin-status-select`). No CSS-structure or
   text-fragile selectors except where the text itself is the assertion.
2. **No arbitrary sleeps.** Only web-first assertions (`expect(locator).toHaveText`) and locator waits.
3. **Isolation.** Tests never depend on each other's data; the suite runs with a single worker against
   one seeded database because SQLite is a single-writer engine.
4. **Deterministic data.** Stock-sensitive tests normalise stock through the used paths (for example
   setting stock back to 60 after the inventory test) so re-runs are repeatable.
5. **Failure evidence.** Trace, screenshot and error context are retained on failure
   (`test-results/`), and the JSON report is always written for the report builder.

## 3. Tagged subsets

| Tag | Purpose | Command |
|-----|---------|---------|
| `@smoke` | Critical path only — fast confidence check | `npm run test:smoke` |
| `@regression` | Wider regression set across API and UI | `npm run test:regression` |

## 4. Example: the money-path journey

```ts
// tests/ui/purchase.spec.ts (abridged)
await loginAsCustomer(page);
await page.getByTestId("search-input").fill("Ember Ceramic");
await page.getByTestId("product-link").click();
await page.getByTestId("quantity-input").fill("2");
await page.getByTestId("add-to-cart").click();

await page.getByTestId("nav-cart").click();
await expect(page.getByTestId("summary-subtotal")).toHaveText("$49.00");
await expect(page.getByTestId("summary-shipping")).toHaveText("$5.00");

await page.getByTestId("checkout-button").click();
await page.getByTestId("checkout-submit").click();          // expects field-level errors
await expect(page.getByTestId("checkout-name-error")).toBeVisible();
```

The same journey is asserted in the API suite, so a failure can be localised to the layer that broke.

## 5. Capturing evidence screenshots

```powershell
npm run screenshots   # 14 JPEG screenshots -> test-evidence/screenshots/ (desktop + mobile)
```

Screenshots are captured by driving the real UI, never mocked up.

## 6. Traceability to manual cases

| UI test | Manual cases |
|---------|--------------|
| catalog.spec.ts | SHOP-TC-017, SHOP-TC-021, SHOP-TC-031, SHOP-TC-034 |
| auth.spec.ts | SHOP-TC-010, SHOP-TC-005 (UI path) |
| purchase.spec.ts | SHOP-TC-037, SHOP-TC-053, SHOP-TC-057, SHOP-TC-061, SHOP-TC-064, SHOP-TC-068 |
| admin.spec.ts | SHOP-TC-073, SHOP-TC-077, SHOP-TC-081 |
| accessibility.spec.ts | SHOP-TC-094, SHOP-TC-095, SHOP-TC-096, SHOP-TC-097 |

## 7. Known limitations

- Chromium only. Firefox/WebKit projects exist in the config but the browsers are not installed in this
  environment; the command to run them is documented in SHOP-TC-098.
- No visual-regression snapshots (deliberate: pixel diffs on a demo app add noise without protecting
  business rules). Screenshots serve as human evidence instead.
- No screen-reader automation (SHOP-TC-099 documents the manual check that remains outstanding).
