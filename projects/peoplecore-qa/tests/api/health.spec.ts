import { expect, test } from '@playwright/test';
import { CREDENTIALS, login } from './helpers.js';

test.describe('Health and error envelope', () => {
  test('health endpoint reports service, database and seeded employee count @smoke', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(body.service).toBe('peoplecore-hrms');
    expect(body.database).toBe('ok');
    expect(body.employees).toBeGreaterThanOrEqual(10);
    expect(body.seedDefects).toBe(false);
    expect(typeof body.uptimeSeconds).toBe('number');
  });

  test('unknown API route returns the documented 404 envelope', async ({ request }) => {
    const response = await request.get('/api/does-not-exist');
    expect(response.status()).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.message).toContain('/api/does-not-exist');
    expect(body.error).not.toHaveProperty('stack');
  });

  test('protected endpoints reject anonymous callers with 401 and no data', async ({ request }) => {
    for (const path of ['/api/employees', '/api/attendance', '/api/leave-requests', '/api/audit-logs', '/api/reports/summary']) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(401);
      const body = await response.json();
      expect(body.error.code, path).toBe('UNAUTHENTICATED');
      expect(body.data).toBeUndefined();
    }
  });

  test('malformed JSON body is rejected with 400 INVALID_JSON', async ({ request }) => {
    const response = await request.post('/api/auth/login', {
      headers: { 'Content-Type': 'application/json' },
      data: '{"email": "broken",,}',
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('INVALID_JSON');
  });

  test('an expired or forged session token is rejected', async ({ request }) => {
    const response = await request.get('/api/auth/session', {
      headers: { Authorization: `Bearer ${'f'.repeat(64)}` },
    });
    expect(response.status()).toBe(401);
    const loginResponse = await request.post('/api/auth/login', { data: CREDENTIALS.admin });
    expect(loginResponse.status()).toBe(200);
    const session = await request.get('/api/auth/session');
    expect(session.status()).toBe(200);
    const entry = await login(request, 'admin');
    expect(entry.user.role).toBe('ADMIN');
  });
});
