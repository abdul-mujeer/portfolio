import { test, expect } from '@playwright/test';
import {
  API,
  SEED,
  FRESH_PASSWORD,
  expectError,
  newApiContext,
  uniqueSuffix,
} from '../helpers/api';

test.describe('Authentication & sessions', () => {
  test('TASK-TC-001 @smoke register creates an account, sets a session cookie and rejects extra fields', async ({
    request,
  }) => {
    const email = `qa${uniqueSuffix()}@example.com`;
    const res = await request.post(`${API}/auth/register`, {
      data: { email, display_name: 'QA Tester', password: FRESH_PASSWORD },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.email).toBe(email);
    expect(body.display_name).toBe('QA Tester');
    expect(body.id).toBeGreaterThan(0);
    expect(body.password_hash).toBeUndefined();
    expect(body.salt).toBeUndefined();

    const setCookie = res.headers()['set-cookie'] ?? '';
    expect(setCookie).toContain('tf_session=');
    expect(setCookie).toContain('HttpOnly');

    const me = await request.get(`${API}/auth/me`);
    expect(me.status()).toBe(200);
    expect((await me.json()).email).toBe(email);

    // strict schema: unknown/privileged fields are rejected (mass-assignment probe)
    const strict = await request.post(`${API}/auth/register`, {
      data: {
        email: `qa${uniqueSuffix()}@example.com`,
        display_name: 'QA Shadow',
        password: FRESH_PASSWORD,
        role: 'ADMIN',
      },
    });
    await expectError(strict, 400, 'VALIDATION_ERROR');
  });

  test('TASK-TC-002 duplicate email registration returns 409', async ({ request }) => {
    const email = `qa${uniqueSuffix()}@example.com`;
    const first = await request.post(`${API}/auth/register`, {
      data: { email, display_name: 'First', password: FRESH_PASSWORD },
    });
    expect(first.status()).toBe(201);
    const second = await request.post(`${API}/auth/register`, {
      data: { email, display_name: 'Second', password: FRESH_PASSWORD },
    });
    await expectError(second, 409, 'EMAIL_TAKEN');
  });

  test('TASK-TC-003 password policy: weak passwords are 400, a 10-char policy password is accepted', async ({
    request,
  }) => {
    const weak = [
      'Short#1', // too short
      'alllowercase123', // no uppercase
      'ALLUPPERCASE123', // no lowercase
      'NoDigitsHere!!', // no digit
      'Ab1', // too short despite classes
    ];
    for (const password of weak) {
      const res = await request.post(`${API}/auth/register`, {
        data: { email: `qa${uniqueSuffix()}@example.com`, display_name: 'Weak', password },
      });
      await expectError(res, 400, 'VALIDATION_ERROR');
    }
    const ok = await request.post(`${API}/auth/register`, {
      data: { email: `qa${uniqueSuffix()}@example.com`, display_name: 'Strong', password: 'Abcdefgh12' },
    });
    expect(ok.status()).toBe(201);
  });

  test('TASK-TC-004 login rejects wrong password and unknown email with 401', async ({ request }) => {
    const wrongPassword = await request.post(`${API}/auth/login`, {
      data: { email: SEED.users.owner.email, password: 'Wrong#Pass123' },
    });
    await expectError(wrongPassword, 401, 'INVALID_CREDENTIALS');

    const unknownEmail = await request.post(`${API}/auth/login`, {
      data: { email: `ghost${uniqueSuffix()}@example.com`, password: FRESH_PASSWORD },
    });
    await expectError(unknownEmail, 401, 'INVALID_CREDENTIALS');

    const malformed = await request.post(`${API}/auth/login`, { data: { email: SEED.users.owner.email } });
    await expectError(malformed, 400, 'VALIDATION_ERROR');
  });

  test('TASK-TC-005 @regression session security: 401 sweep, logout invalidation, cookie flags and tampered tokens', async ({
    request,
  }) => {
    // unauthenticated sweep across protected resources
    for (const path of ['/auth/me', '/projects', '/tasks/1', '/tasks/1/comments', '/reports/overdue']) {
      const res = await request.get(`${API}${path}`);
      await expectError(res, 401, 'UNAUTHENTICATED');
    }

    // cookie flags on login
    const ctx = await newApiContext();
    const loginRes = await ctx.post(`${API}/auth/login`, {
      data: { email: SEED.users.owner.email, password: SEED.users.owner.password },
    });
    expect(loginRes.status()).toBe(200);
    const setCookie = loginRes.headers()['set-cookie'] ?? '';
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Lax');
    expect(setCookie).toContain('Path=/');
    expect(setCookie).not.toContain('Secure'); // NODE_ENV=test -> no Secure flag

    // valid session works
    expect((await ctx.get(`${API}/auth/me`)).status()).toBe(200);

    // logout invalidates the session server-side
    expect((await ctx.post(`${API}/auth/logout`)).status()).toBe(204);
    await expectError(await ctx.get(`${API}/auth/me`), 401, 'UNAUTHENTICATED');

    // tampered/garbage tokens are rejected without touching the database session
    const rawToken = setCookie.split(';')[0].replace('tf_session=', '');
    const [raw, signature] = rawToken.split('.');
    const flipped = signature.startsWith('A') ? `B${signature.slice(1)}` : `A${signature.slice(1)}`;
    const tampered = await ctx.get(`${API}/auth/me`, {
      headers: { cookie: `tf_session=${raw}.${flipped}` },
    });
    await expectError(tampered, 401);
    const garbage = await ctx.get(`${API}/auth/me`, { headers: { cookie: 'tf_session=not-a-token' } });
    await expectError(garbage, 401);

    // wrong credentials never reveal which input failed: identical messages
    const bad = await ctx.post(`${API}/auth/login`, {
      data: { email: SEED.users.owner.email, password: 'Nope#123456' },
    });
    const badBody = await expectError(bad, 401, 'INVALID_CREDENTIALS');
    const badUnknown = await ctx.post(`${API}/auth/login`, {
      data: { email: `ghost${uniqueSuffix()}@example.com`, password: FRESH_PASSWORD },
    });
    const badUnknownBody = await expectError(badUnknown, 401, 'INVALID_CREDENTIALS');
    expect(badBody.error.message).toBe(badUnknownBody.error.message);
    expect(badBody.error.message).toMatch(/incorrect/i);
    await ctx.dispose();
  });
});
