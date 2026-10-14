import { expect, test } from "@playwright/test";
import { DEMO, newSession, sessionAs, BASE_URL } from "./helpers";

test.describe("Authentication and session handling", () => {
  test("@smoke health endpoint reports the application status @regression", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("ok");
    expect(body.app).toBe("shopsure");
    // >= 24 because other suites may legitimately add products during a full run
    expect(body.seededProducts).toBeGreaterThanOrEqual(24);
  });

  test("register creates an account and starts a session", async () => {
    const session = await newSession();
    try {
      const email = `qa.register.${Date.now()}@example.com`;
      const response = await session.context.post("/api/auth/register", {
        data: { name: "New Shopper", email, password: "NewShopper#123" },
      });
      expect(response.status()).toBe(201);
      const body = await response.json();
      expect(body.user.email).toBe(email);
      expect(body.user.role).toBe("CUSTOMER");

      const me = await session.context.get("/api/auth/me");
      expect(me.status()).toBe(200);
      expect((await me.json()).user.email).toBe(email);
    } finally {
      await session.dispose();
    }
  });

  test("register rejects a duplicate email with 409", async () => {
    const session = await newSession();
    try {
      const response = await session.context.post("/api/auth/register", {
        data: { name: "Duplicate", email: DEMO.customer.email, password: "Duplicate#123" },
      });
      expect(response.status()).toBe(409);
      expect((await response.json()).error.code).toBe("EMAIL_ALREADY_REGISTERED");
    } finally {
      await session.dispose();
    }
  });

  test("register validates name, email and password strength", async () => {
    const session = await newSession();
    try {
      const response = await session.context.post("/api/auth/register", {
        data: { name: "A", email: "not-an-email", password: "short" },
      });
      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
      const fields = body.error.details.map((detail: { field: string }) => detail.field);
      expect(fields).toContain("name");
      expect(fields).toContain("email");
      expect(fields).toContain("password");
    } finally {
      await session.dispose();
    }
  });

  test("password without a digit is rejected", async () => {
    const session = await newSession();
    try {
      const response = await session.context.post("/api/auth/register", {
        data: { name: "Digits Missing", email: `qa.nodigit.${Date.now()}@example.com`, password: "onlyletters" },
      });
      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(JSON.stringify(body.error.details)).toContain("digit");
    } finally {
      await session.dispose();
    }
  });

  test("login succeeds with the seeded customer and fails with a wrong password", async () => {
    const session = await newSession();
    try {
      const ok = await session.context.post("/api/auth/login", { data: DEMO.customer });
      expect(ok.status()).toBe(200);

      const bad = await session.context.post("/api/auth/login", {
        data: { email: DEMO.customer.email, password: "WrongPassword#1" },
      });
      expect(bad.status()).toBe(401);
      expect((await bad.json()).error.code).toBe("UNAUTHENTICATED");
    } finally {
      await session.dispose();
    }
  });

  test("login with an unknown email returns the same generic 401 (no user enumeration)", async () => {
    const session = await newSession();
    try {
      const response = await session.context.post("/api/auth/login", {
        data: { email: "nobody@example.com", password: "Whatever#123" },
      });
      expect(response.status()).toBe(401);
      expect((await response.json()).error.message).toBe("Invalid email or password.");
    } finally {
      await session.dispose();
    }
  });

  test("repeated failed logins are throttled with 429", async () => {
    const session = await newSession();
    try {
      let last = 0;
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const response = await session.context.post("/api/auth/login", {
          data: { email: "throttle@example.com", password: `Wrong#${attempt}` },
        });
        last = response.status();
      }
      expect(last).toBe(429);
    } finally {
      await session.dispose();
    }
  });

  test("logout invalidates the session", async () => {
    const session = await newSession();
    try {
      await session.context.post("/api/auth/login", { data: DEMO.customer });
      expect((await session.context.get("/api/auth/me")).status()).toBe(200);

      const logout = await session.context.post("/api/auth/logout");
      expect(logout.status()).toBe(204);

      const me = await session.context.get("/api/auth/me");
      expect(me.status()).toBe(401);
    } finally {
      await session.dispose();
    }
  });

  test("protected endpoints return 401 without a session", async ({ request }) => {
    for (const path of ["/api/cart", "/api/orders", "/api/auth/me"]) {
      const response = await request.get(path);
      expect(response.status(), `${path} should require authentication`).toBe(401);
    }
  });

  test("session cookie is HttpOnly and SameSite=Lax", async () => {
    const session = await newSession();
    try {
      const response = await session.context.post("/api/auth/login", { data: DEMO.customer });
      const setCookie = response.headers()["set-cookie"] ?? "";
      expect(setCookie).toContain("shopsure_session=");
      expect(setCookie.toLowerCase()).toContain("httponly");
      expect(setCookie.toLowerCase()).toContain("samesite=lax");
    } finally {
      await session.dispose();
    }
  });

  test("admin session is recognised with the ADMIN role", async () => {
    const session = await sessionAs("admin");
    try {
      const me = await session.context.get("/api/auth/me");
      expect(me.status()).toBe(200);
      expect((await me.json()).user.role).toBe("ADMIN");
    } finally {
      await session.dispose();
    }
  });

  test("unauthenticated requests to admin endpoints return 401 (not 403)", async ({ request }) => {
    const response = await request.get("/api/admin/orders");
    expect(response.status()).toBe(401);
    expect(BASE_URL).toContain("http");
  });
});
