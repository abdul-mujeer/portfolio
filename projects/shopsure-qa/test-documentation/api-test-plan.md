# ShopSure — API Test Plan

- **Base URL:** `http://127.0.0.1:4100/api` (tests use 4180)
- **Formats:** JSON in, JSON out. Errors always use `{ "error": { "code", "message", "details"? } }`.
- **Authentication:** opaque session token in the `shopsure_session` cookie (`HttpOnly`, `SameSite=Lax`).
- **Executors:** `tests/api/*.spec.ts` (Playwright `APIRequestContext`) and the Postman collection via
  Newman (`npm run test:postman`).

## 1. Endpoint inventory

| # | Method & path | Auth | Purpose | Status codes covered |
|---|---------------|------|---------|----------------------|
| 1 | GET `/health` | public | Liveness + seed check | 200 |
| 2 | POST `/auth/register` | public | Create a customer account | 201, 400, 409 |
| 3 | POST `/auth/login` | public | Start a session | 200, 400, 401, 429 |
| 4 | POST `/auth/logout` | public | Invalidate a session | 204 |
| 5 | GET `/auth/me` | session | Current user | 200, 401 |
| 6 | GET `/categories` | public | Category list | 200 |
| 7 | GET `/products` | public | Search/filter/sort/paginate | 200, 400 |
| 8 | GET `/products/:id` | public | Product detail | 200, 400, 404 |
| 9 | GET `/cart` | session | Cart with pricing | 200, 401 |
| 10 | POST `/cart/items` | session | Add/merge a line | 201, 400, 401, 404, 422 |
| 11 | PATCH `/cart/items/:id` | session | Change a quantity | 200, 400, 404, 422 |
| 12 | DELETE `/cart/items/:id` | session | Remove a line | 204, 404 |
| 13 | DELETE `/cart` | session | Clear the cart | 204, 401 |
| 14 | POST `/orders` | session | Checkout | 201, 400, 401, 422 |
| 15 | GET `/orders` | session | Own order history | 200, 401 |
| 16 | GET `/orders/:id` | session | Own order detail | 200, 404 |
| 17 | POST `/orders/:id/cancel` | session | Cancel own order | 200, 403, 404, 422 |
| 18 | GET `/admin/orders` | admin | All orders + filter | 200, 400, 401, 403 |
| 19 | PATCH `/admin/orders/:id/status` | admin | Transition an order | 200, 400, 403, 404, 422 |
| 20 | GET `/admin/products` | admin | Inventory list | 200, 401, 403 |
| 21 | POST `/admin/products` | admin | Create a product | 201, 400, 403, 409 |
| 22 | PATCH `/admin/products/:id` | admin | Update a product | 200, 400, 403, 404, 409 |
| 23 | PATCH `/admin/products/:id/stock` | admin | Set stock | 200, 400, 403, 404 |
| 24 | GET `/admin/users` | admin | User list (no credentials) | 200, 401, 403 |

## 2. What every endpoint class must prove

| Class | Required checks |
|-------|-----------------|
| Public reads | 200 with correct shape; invalid parameters → 400 with field details |
| Writes | Happy path 201/200; missing fields → 400; duplicate → 409; business rule → 422 |
| Session-protected | 401 without a cookie; correct data with a cookie |
| Admin-protected | 401 anonymous, 403 as customer, 200 as admin |
| Object-scoped | Access to another user's object returns 404 (no existence leak) |
| Pagination | Correct `total`, `page`, `limit`, `totalPages`, `X-Total-Count`; invalid limits rejected |
| Persistence | State changes are visible in later reads and in SQL |

## 3. Test data strategy

- Demo users are seeded (`customer@example.com`, `second@example.com`, `admin@example.com`).
- Tests that need isolation register a **unique** customer (`qa.fresh.<timestamp>@example.com`).
- Stock-sensitive tests normalise stock through the admin API before asserting.
- Created products are deactivated at the end of the test that created them.

## 4. Error-code contract

| Code | Meaning | Example trigger |
|------|---------|-----------------|
| `VALIDATION_ERROR` | Malformed or missing input (400) | `limit=0`, invalid postcode, truncated JSON body |
| `UNAUTHENTICATED` | No or expired session (401) | `GET /api/cart` anonymously |
| `FORBIDDEN` | Role/ownership failure (403) | Customer calling an admin endpoint |
| `NOT_FOUND` | Unknown resource or unknown route (404) | `/api/products/9999` |
| `CONFLICT` / `DUPLICATE_SKU` / `EMAIL_ALREADY_REGISTERED` | Duplicate data (409) | Registering an existing email |
| `OUT_OF_STOCK`, `INSUFFICIENT_STOCK`, `QUANTITY_LIMIT_EXCEEDED`, `EMPTY_CART`, `INVALID_TRANSITION`, `PRODUCT_UNAVAILABLE` | Business rules (422) | Ordering 4 units when 3 are in stock |
| `TOO_MANY_ATTEMPTS` | Throttling (429) | 6th failed login |
| `PAYLOAD_TOO_LARGE` | Body above 100 KB (413) | Oversized JSON body |

## 5. Postman collection structure

`postman/ShopSure-API.postman_collection.json` mirrors this plan in six folders: health/access control,
authentication, catalog and search, cart rules, checkout and order lifecycle, admin operations and RBAC.
It stores `orderId`, `cartItemId`, `registeredEmail` as variables while running, and it never contains
credentials for anything other than the synthetic demo accounts.

## 6. How to execute

```powershell
# Playwright API suite (starts its own seeded server on port 4180)
npm run test:api

# Smoke subset / regression subset
npm run test:smoke
npm run test:regression

# Postman collection through Newman (starts its own seeded server on port 4181)
npm run test:postman

# Everything + report generation
npm run test:all
```

## 7. Exit criteria for the API layer

- 100% of the API suite passes on a freshly seeded database.
- Every endpoint above is exercised by at least one positive and one negative test.
- Authorization checks exist for every admin endpoint and every object-scoped read.
- Postman run completes with 0 failed assertions and 0 failed requests.
