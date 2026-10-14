import { expect, test } from '@playwright/test';
import { CREDENTIALS, login } from './helpers.js';

test.describe('Authentication and sessions', () => {
  test('login issues an opaque token, an HttpOnly session cookie and the actor profile @smoke', async ({ request }) => {
    const response = await request.post('/api/auth/login', { data: CREDENTIALS.admin });
    expect(response.status()).toBe(200);

    const setCookie = response.headers()['set-cookie'] ?? '';
    expect(setCookie).toContain('pc_session=');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie.toLowerCase()).toContain('samesite=lax');

    const body = await response.json();
    expect(body.data.token).toMatch(/^[0-9a-f]{64}$/);
    expect(body.data.user.role).toBe('ADMIN');
    expect(body.data.user.email).toBe('admin@example.com');
    const ttlHours = (Date.parse(body.data.expiresAt) - Date.parse(body.data.issuedAt)) / 3_600_000;
    expect(ttlHours).toBeCloseTo(8, 1);
    expect(body.data).not.toHaveProperty('password_hash');
  });

  test('session endpoint returns the signed-in user and the 8 hour expiry', async ({ request }) => {
    await login(request, 'hr');
    const response = await request.get('/api/auth/session');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data.user.role).toBe('HR');
    expect(body.data.sessionTtlHours).toBe(8);
    expect(Date.parse(body.data.expiresAt)).toBeGreaterThan(Date.now());
  });

  test('a bearer token authenticates the same session as the cookie', async ({ request, baseURL }) => {
    const { token } = await login(request, 'manager');
    const response = await request.get(`${baseURL}/api/employees`, { headers: { Authorization: `Bearer ${token}` } });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data.length).toBeGreaterThan(0);
  });

  test('wrong password returns 401 INVALID_CREDENTIALS without leaking account existence', async ({ request }) => {
    const wrongPassword = await request.post('/api/auth/login', {
      data: { email: 'admin@example.com', password: 'TotallyWrong#1' },
    });
    const unknownUser = await request.post('/api/auth/login', {
      data: { email: 'ghost.user@example.com', password: 'TotallyWrong#1' },
    });
    expect(wrongPassword.status()).toBe(401);
    expect(unknownUser.status()).toBe(401);
    const a = await wrongPassword.json();
    const b = await unknownUser.json();
    expect(a.error.code).toBe('INVALID_CREDENTIALS');
    expect(b.error.code).toBe(a.error.code);
    expect(b.error.message).toBe(a.error.message);
  });

  test('payload validation: missing password and malformed email return 400 with field details', async ({ request }) => {
    const missing = await request.post('/api/auth/login', { data: { email: 'admin@example.com' } });
    expect(missing.status()).toBe(400);
    const missingBody = await missing.json();
    expect(missingBody.error.code).toBe('VALIDATION_ERROR');
    expect(missingBody.error.details.map((detail: { path: string }) => detail.path)).toContain('password');

    const malformed = await request.post('/api/auth/login', { data: { email: 'not-an-email', password: 'x' } });
    expect(malformed.status()).toBe(400);
  });

  test('five failed attempts lock the account for 15 minutes (423) and a correct password stays locked', async ({ request }) => {
    const target = CREDENTIALS.employee7;
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const response = await request.post('/api/auth/login', {
        data: { email: target.email, password: `Wrong#000${attempt}` },
      });
      expect([401, 423]).toContain(response.status());
    }
    const locked = await request.post('/api/auth/login', { data: target });
    expect(locked.status()).toBe(423);
    const body = await locked.json();
    expect(body.error.code).toBe('ACCOUNT_LOCKED');
    expect(body.error.message).toMatch(/locked/i);
  });

  test('logout deletes the server-side session so the cookie no longer authorizes', async ({ request }) => {
    await login(request, 'admin');
    const before = await request.get('/api/auth/session');
    expect(before.status()).toBe(200);

    const logout = await request.post('/api/auth/logout');
    expect(logout.status()).toBe(204);

    const after = await request.get('/api/auth/session');
    expect(after.status()).toBe(401);
  });
});
