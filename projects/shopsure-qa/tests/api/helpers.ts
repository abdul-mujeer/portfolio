import { APIRequestContext, expect, request as playwrightRequest } from "@playwright/test";

export const BASE_URL = process.env.E2E_PORT
  ? `http://127.0.0.1:${process.env.E2E_PORT}`
  : "http://127.0.0.1:4180";

export const DEMO = {
  customer: { email: "customer@example.com", password: "Customer#12345" },
  second: { email: "second@example.com", password: "Second#12345" },
  admin: { email: "admin@example.com", password: "Admin#12345" },
};

export const PRODUCT_IDS = {
  headphones: 1, // $149.99, stock 25
  speaker: 2, // $49.99 (boundary: 1 cent below free shipping)
  mouse: 3, // $50.00 (free shipping boundary)
  powerBankOutOfStock: 4, // stock 0
  deskLampLowStock: 5, // stock 3
  keyboard: 6, // $99.99 (1 cent below discount)
  webcam: 7, // $100.00 (discount boundary)
  mugSet: 8, // $24.50
  cleanTesting: 12, // $39.99
};

export interface Session {
  context: APIRequestContext;
  dispose: () => Promise<void>;
}

/** Creates an isolated request context with its own cookie jar. */
export async function newSession(): Promise<Session> {
  const context = await playwrightRequest.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { "Content-Type": "application/json" },
  });
  return { context, dispose: () => context.dispose() };
}

export async function login(context: APIRequestContext, email: string, password: string) {
  const response = await context.post("/api/auth/login", { data: { email, password } });
  expect(response.status(), `login for ${email}`).toBe(200);
  return response.json();
}

/** A logged-in session for one of the seeded demo users. */
export async function sessionAs(role: "customer" | "second" | "admin"): Promise<Session> {
  const session = await newSession();
  await login(session.context, DEMO[role].email, DEMO[role].password);
  return session;
}

/** Registers a brand new unique customer so tests cannot collide with each other. */
export async function sessionAsFreshCustomer(suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`): Promise<Session & { email: string }> {
  const session = await newSession();
  const email = `qa.fresh.${suffix}@example.com`;
  const response = await session.context.post("/api/auth/register", {
    data: { name: "Fresh QA Customer", email, password: "FreshUser#123" },
  });
  expect(response.status(), "fresh customer registration").toBe(201);
  return { ...session, email };
}

/** Deterministic stock control so stock-sensitive tests never depend on execution order. */
export async function setStock(adminContext: APIRequestContext, productId: number, stock: number) {
  const response = await adminContext.patch(`/api/admin/products/${productId}/stock`, { data: { stock } });
  expect(response.status(), `set stock for product ${productId}`).toBe(200);
}

export async function getProduct(context: APIRequestContext, productId: number) {
  const response = await context.get(`/api/products/${productId}`);
  expect(response.status()).toBe(200);
  const body = await response.json();
  return body.product as { id: number; price: number; stock: number; name: string };
}

export async function getCart(context: APIRequestContext) {
  const response = await context.get("/api/cart");
  expect(response.status()).toBe(200);
  return response.json();
}

export async function addToCart(context: APIRequestContext, productId: number, quantity = 1) {
  return context.post("/api/cart/items", { data: { productId, quantity } });
}

export const VALID_SHIPPING = {
  name: "Casey Customer",
  email: "customer@example.com",
  phone: "+1 555 0100",
  address: "12 Example Street",
  city: "Springfield",
  postcode: "12345",
};

export async function placeOrder(context: APIRequestContext, shipping: Record<string, string> = VALID_SHIPPING) {
  return context.post("/api/orders", { data: shipping });
}
