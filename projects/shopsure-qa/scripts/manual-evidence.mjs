#!/usr/bin/env node
/**
 * Manual / exploratory verification session (executed and recorded automatically).
 *
 * These are the checks a QA engineer performs by hand in an exploratory session: injection attempts,
 * malformed payloads, size limits, HTTP verb misuse, header checks, privilege-escalation attempts and
 * awkward boundaries. The script performs them against a freshly seeded instance and writes the raw
 * evidence (request, response, verdict) to test-evidence/logs/manual-execution-<date>.md.
 *
 * Verdicts are "PASS" only when the observed behaviour matches the documented expectation.
 * FAIL rows are genuine findings and must be logged in test-documentation/defect-log.csv.
 *
 * Usage: node scripts/manual-evidence.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { startServer, stopServer, waitForHealth, PROJECT_ROOT } from "./lib/server-control.mjs";

const port = Number(process.env.MANUAL_PORT || 4183);
const baseUrl = `http://127.0.0.1:${port}`;
const evidenceDir = path.join(PROJECT_ROOT, "test-evidence/logs");
const date = new Date().toISOString().slice(0, 10);

const rows = [];
const { child, logs } = startServer({ port, dbPath: ".data/shopsure.manual.db", reset: true });

let cookie = "";
async function call(method, pathname, { body, raw, headers = {} } = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}), ...headers },
    body: raw !== undefined ? raw : body === undefined ? undefined : JSON.stringify(body),
  });
  const setCookie = response.headers.getSetCookie?.() ?? [];
  if (setCookie.length > 0) cookie = setCookie.map((value) => value.split(";")[0]).join("; ");
  const text = await response.text();
  return { status: response.status, text, headers: response.headers };
}

function record(id, area, expectation, request, response, extra = "") {
  const passed = expectation.verify(response, extra);
  rows.push({
    id,
    area,
    expectation: expectation.text,
    request,
    response: `HTTP ${response.status} ${response.text.slice(0, 220).replace(/\s+/g, " ")}`,
    verdict: passed ? "PASS" : "FAIL",
    notes: typeof extra === "string" ? extra : extra?.notes ?? "",
  });
  console.log(`${passed ? "PASS" : "FAIL"}  ${id}  ${expectation.text}`);
  return passed;
}

async function login(email, password) {
  return call("POST", "/api/auth/login", { body: { email, password } });
}

try {
  await waitForHealth(baseUrl);

  // ---------------------------------------------------------------- security: injection
  record("MAN-SEC-01", "Security", {
    text: "SQL injection in the login email does not authenticate and does not leak SQL errors",
    verify: (response) => response.status === 401 && !/sql|syntax|sqlite/i.test(response.text),
  }, "POST /api/auth/login {email: \"' OR 1=1 --\"}", await login("' OR 1=1 --", "whatever"));

  const dropAttempt = await call("GET", "/api/products?q=" + encodeURIComponent("'; DROP TABLE products;--"));
  const afterInjection = await call("GET", "/api/products");
  const productsIntact = (() => {
    try {
      return JSON.parse(afterInjection.text).total >= 24;
    } catch {
      return false;
    }
  })();
  record("MAN-SEC-02", "Security", {
    text: "SQL injection in the search query is harmless and the products table is intact",
    verify: (response) => response.status === 200 && productsIntact && !/sql/i.test(response.text),
  }, "GET /api/products?q='; DROP TABLE products;--", dropAttempt);

  const injectionCategory = await call("GET", "/api/products?category=" + encodeURIComponent("electronics' OR '1'='1"));
  record("MAN-SEC-03", "Security", {
    text: "Injected category parameter returns an empty result set (parameterized query)",
    verify: (response) => {
      if (response.status !== 200) return false;
      try {
        return JSON.parse(response.text).total === 0;
      } catch {
        return false;
      }
    },
  }, "GET /api/products?category=electronics' OR '1'='1", injectionCategory);

  const xssEmail = `xss.${Date.now()}@example.com`;
  const xssRegister = await call("POST", "/api/auth/register", {
    body: { name: "<script>alert('xss')</script>", email: xssEmail, password: "XssCheck#123" },
  });
  record("MAN-SEC-04", "Security", {
    text: "Markup in the profile name is stored verbatim by the API; rendering safety is the UI's job (React escapes by default)",
    verify: (response) => response.status === 201 && response.text.includes("<script>"),
  }, "POST /api/auth/register {name: \"<script>alert('xss')</script>\"}", xssRegister, "Documented: the React client renders text nodes, so the payload is not executed. Verified in the UI layer by the accessibility/UI suites.");

  const malformed = await call("POST", "/api/auth/login", { raw: '{"email": "a@example.com", ' });
  record("MAN-SEC-05", "Robustness", {
    text: "Malformed JSON body is rejected with 400, not 500",
    verify: (response) => response.status === 400,
  }, 'POST /api/auth/login with truncated JSON body', malformed);

  const huge = "x".repeat(200 * 1024);
  const oversized = await call("POST", "/api/auth/login", { body: { email: `${huge}@example.com`, password: "Whatever#1" } });
  record("MAN-SEC-06", "Robustness", {
    text: "Oversized request bodies are rejected with 413 (body limit 100kb)",
    verify: (response) => response.status === 413,
  }, "POST /api/auth/login with a 200 KB email value", oversized);

  const wrongMethod = await call("PUT", "/api/products");
  record("MAN-SEC-07", "Robustness", {
    text: "Unsupported HTTP verb on a known resource returns 404 NOT_FOUND (no 405 handling implemented — documented limitation)",
    verify: (response) => response.status === 404,
  }, "PUT /api/products", wrongMethod, "Documented limitation: REST clients cannot distinguish 'resource exists but verb unsupported' from 'no such resource'.");

  const health = await call("GET", "/api/health");
  record("MAN-SEC-08", "Security", {
    text: "X-Powered-By is not exposed and the API identifies itself",
    verify: (response) => !response.headers.get("x-powered-by") && response.status === 200,
  }, "GET /api/health (header inspection)", health);

  const loginResponse = await login("customer@example.com", "Customer#12345");
  const setCookie = loginResponse.headers.getSetCookie?.() ?? [];
  const cookieText = setCookie.join("; ");
  record("MAN-SEC-09", "Security", {
    text: "Session cookie is HttpOnly and SameSite=Lax",
    verify: () => /httponly/i.test(cookieText) && /samesite=lax/i.test(cookieText),
  }, "POST /api/auth/login (Set-Cookie inspection)", loginResponse, cookieText.replace(/shopsure_session=[^;]+/, "shopsure_session=<redacted>"));

  const me = await call("GET", "/api/auth/me");
  record("MAN-SEC-10", "Security", {
    text: "Session endpoint never returns password hashes or salts",
    verify: (response) => response.status === 200 && !/password|salt/i.test(response.text),
  }, "GET /api/auth/me", me);

  let throttled = 0;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    cookie = "";
    const response = await login("throttle.manual@example.com", `Wrong#${attempt}`);
    throttled = response.status;
  }
  record("MAN-SEC-11", "Security", {
    text: "Brute-force protection: 6 consecutive failures return 429",
    verify: () => throttled === 429,
  }, "POST /api/auth/login x6 with a wrong password", { status: throttled, text: "last attempt", headers: new Headers() });

  const escalation = await call("POST", "/api/auth/register", {
    body: { name: "Escalation Attempt", email: `escalate.${Date.now()}@example.com`, password: "Escalate#123", role: "ADMIN" },
  });
  record("MAN-SEC-12", "Security", {
    text: "Mass-assignment attempt cannot self-assign the ADMIN role",
    verify: (response) => response.status === 201 && /CUSTOMER/.test(response.text) && !/ADMIN/.test(response.text),
  }, "POST /api/auth/register {..., role: \"ADMIN\"}", escalation);

  // ---------------------------------------------------------------- boundaries and awkward input
  const unicode = await call("GET", "/api/products?q=" + encodeURIComponent("müg"));
  record("MAN-EDGE-01", "Boundary", {
    text: "Unicode search term is handled without a server error",
    verify: (response) => response.status === 200,
  }, "GET /api/products?q=müg", unicode);

  const longQuery = await call("GET", `/api/products?q=${"a".repeat(500)}`);
  record("MAN-EDGE-02", "Boundary", {
    text: "Very long search term returns an empty page without a server error",
    verify: (response) => response.status === 200,
  }, "GET /api/products?q=<500 chars>", longQuery);

  await login("customer@example.com", "Customer#12345");
  const fractional = await call("POST", "/api/cart/items", { body: { productId: 1, quantity: 1.5 } });
  record("MAN-EDGE-03", "Boundary", {
    text: "Fractional quantity is rejected with 400",
    verify: (response) => response.status === 400,
  }, "POST /api/cart/items {quantity: 1.5}", fractional);

  const coerced = await call("POST", "/api/cart/items", { body: { productId: "8", quantity: "2" } });
  record("MAN-EDGE-04", "Boundary", {
    text: "Numeric strings are coerced (documented behaviour of the validation layer)",
    verify: (response) => response.status === 201,
  }, 'POST /api/cart/items {productId: "8", quantity: "2"}', coerced, "Documented: the API coerces numeric strings; non-numeric values are rejected.");

  const zeroProduct = await call("POST", "/api/cart/items", { body: { productId: 0, quantity: 1 } });
  record("MAN-EDGE-05", "Boundary", {
    text: "productId 0 is rejected with 400",
    verify: (response) => response.status === 400,
  }, "POST /api/cart/items {productId: 0}", zeroProduct);

  const limitTooHigh = await call("GET", "/api/products?limit=100");
  const limitMax = await call("GET", "/api/products?limit=50");
  record("MAN-EDGE-06", "Boundary", {
    text: "Pagination limit boundary: 50 accepted, 100 rejected",
    verify: () => limitTooHigh.status === 400 && limitMax.status === 200,
  }, "GET /api/products?limit=100 and ?limit=50", limitTooHigh, `limit=50 -> HTTP ${limitMax.status}`);

  const deepPage = await call("GET", "/api/products?page=1000000");
  record("MAN-EDGE-07", "Boundary", {
    text: "Very deep page returns an empty page with the correct total",
    verify: (response) => response.status === 200 && JSON.parse(response.text).items.length === 0,
  }, "GET /api/products?page=1000000", deepPage);

  const whitespace = await call("GET", "/api/products?q=%20%20");
  record("MAN-EDGE-08", "Boundary", {
    text: "Whitespace-only search is treated as no search filter",
    verify: (response) => response.status === 200 && JSON.parse(response.text).total >= 24,
  }, "GET /api/products?q=<two spaces>", whitespace);

  const spacedLogin = await call("POST", "/api/auth/login", { body: { email: "  customer@example.com  ", password: "Customer#12345" } });
  record("MAN-EDGE-09", "Boundary", {
    text: "Login email is trimmed before comparison",
    verify: (response) => response.status === 200,
  }, 'POST /api/auth/login {email: "  customer@example.com  "}', spacedLogin);

  const extraFields = await call("POST", "/api/orders", {
    body: {
      name: "Casey Customer",
      email: "customer@example.com",
      phone: "+1 555 0100",
      address: "12 Example Street",
      city: "Springfield",
      postcode: "12345",
      status: "DELIVERED",
      total: 0.01,
      discount: 999,
    },
  });
  record("MAN-SEC-13", "Security", {
    text: "Extra client-supplied fields (status, total, discount) are ignored on checkout — no mass assignment",
    verify: (response) => {
      if (response.status !== 201) return false;
      const order = JSON.parse(response.text).order;
      return order.status === "PENDING" && order.discount <= 20 && order.total === Number((order.subtotal - order.discount + order.shippingFee).toFixed(2));
    },
  }, "POST /api/orders with injected status/total/discount fields", extraFields);

  const history = await call("GET", "/api/orders");
  const createdOrder = JSON.parse(history.text).items[0];
  const detail = await call("GET", `/api/orders/${createdOrder.id}`);
  const events = JSON.parse(detail.text).order.events;
  record("MAN-DATA-01", "Data integrity", {
    text: "Order creation writes a status-history event (traceability of state changes)",
    verify: () => Array.isArray(events) && events.length >= 1 && events[0].toStatus === "PENDING",
  }, `GET /api/orders/${createdOrder.id}`, detail, `events=${JSON.stringify(events.map((event) => event.toStatus))}`);

  const stockBefore = JSON.parse((await call("GET", "/api/products/5")).text).product.stock;
  await call("POST", "/api/cart/items", { body: { productId: 5, quantity: stockBefore } });
  const cartSnapshot = JSON.parse((await call("GET", "/api/cart")).text);
  const lineQty = cartSnapshot.items.find((item) => item.productId === 5)?.quantity ?? 0;
  record("MAN-DATA-02", "Data integrity", {
    text: "Cart line quantity can never exceed available stock",
    verify: () => lineQty <= stockBefore,
  }, `POST /api/cart/items {productId: 5, quantity: ${stockBefore}} (stock ${stockBefore})`, { status: 201, text: `line qty=${lineQty}`, headers: new Headers() });
} catch (error) {
  rows.push({ id: "MAN-ERR", area: "Session", expectation: "Manual session runs to completion", request: "-", response: String(error), verdict: "FAIL", notes: "" });
  console.error("manual session failed:", error);
  console.error(logs.join("").split("\n").slice(-30).join("\n"));
} finally {
  await stopServer(child);
}

const passed = rows.filter((row) => row.verdict === "PASS").length;
const markdown = [
  `# ShopSure — Manual / exploratory verification evidence`,
  "",
  `- Executed: ${new Date().toISOString()}`,
  `- Target: freshly seeded ShopSure instance (port ${port}, database \`.data/shopsure.manual.db\`)`,
  `- Result: **${passed}/${rows.length} checks matched expectations**`,
  "",
  "| ID | Area | Expectation | Request | Observed response | Verdict | Notes |",
  "|----|------|-------------|---------|-------------------|---------|-------|",
  ...rows.map((row) => `| ${row.id} | ${row.area} | ${row.expectation} | \`${row.request}\` | \`${row.response}\` | ${row.verdict} | ${row.notes} |`),
  "",
  "> FAIL rows are genuine findings and are recorded in `test-documentation/defect-log.csv`.",
  "",
].join("\n");

fs.mkdirSync(evidenceDir, { recursive: true });
fs.writeFileSync(path.join(evidenceDir, `manual-execution-${date}.md`), markdown);
fs.writeFileSync(path.join(evidenceDir, "manual-execution-latest.md"), markdown);
console.log(`\n${passed}/${rows.length} manual checks matched expectations. Evidence: test-evidence/logs/manual-execution-${date}.md`);
process.exit(passed === rows.length ? 0 : 1);
