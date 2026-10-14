import { expect, test } from '@playwright/test';
import { CREDENTIALS, createEmployeeViaApi, isoDateOffset, login } from './helpers.js';

test.describe('Audit log API', () => {
  test('ADMIN reads the audit trail with before/after payloads including salary @smoke', async ({ request }) => {
    await login(request, 'admin');
    const response = await request.get('/api/audit-logs?limit=100');
    expect(response.status()).toBe(200);
    expect(Number(response.headers()['x-total-count'])).toBeGreaterThanOrEqual(2);

    const body = await response.json();
    expect(body.data[0]).toMatchObject({
      id: expect.any(Number),
      action: expect.any(String),
      entityType: expect.any(String),
      createdAt: expect.any(String),
    });
    const seedRow = body.data.find((row: { action: string; entityType: string }) => row.action === 'EMPLOYEE_CREATE' && row.entityType === 'EMPLOYEE');
    expect(seedRow.after.salary).toBeGreaterThan(0);
    expect(seedRow.before).toBeNull();
    expect(seedRow.actorEmail).toBe('admin@example.com');
  });

  test('entityType and entityId filters isolate a single record', async ({ request }) => {
    await login(request, 'admin');
    const created = await createEmployeeViaApi(request, { position: 'Audit Target Engineer' });

    const filtered = await (await request.get(`/api/audit-logs?entityType=EMPLOYEE&entityId=${created.id}`)).json();
    expect(filtered.data).toHaveLength(1);
    expect(filtered.data[0].after.position).toBe('Audit Target Engineer');

    const byType = await (await request.get('/api/audit-logs?entityType=DEPARTMENT&limit=100')).json();
    for (const row of byType.data) expect(row.entityType).toBe('DEPARTMENT');

    const noMatch = await (await request.get('/api/audit-logs?entityType=EMPLOYEE&entityId=424242')).json();
    expect(noMatch.data).toEqual([]);
    expect(noMatch.total).toBe(0);

    const badPaging = await request.get('/api/audit-logs?limit=1000');
    expect(badPaging.status()).toBe(400);
  });

  test('leave decisions and attendance writes are audited too', async ({ request, playwright, baseURL }) => {
    const employee = await playwright.request.newContext({ baseURL });
    let leaveId = 0;
    try {
      await employee.post('/api/auth/login', { data: CREDENTIALS.employee1 });
      const created = await employee.post('/api/leave-requests', {
        data: {
          leaveType: 'UNPAID',
          startDate: isoDateOffset(170),
          endDate: isoDateOffset(171),
          reason: 'Unpaid leave for an audit trail verification.',
        },
      });
      expect(created.status()).toBe(201);
      leaveId = (await created.json()).data.id;
    } finally {
      await employee.dispose();
    }

    await login(request, 'hr');
    const review = await request.patch(`/api/leave-requests/${leaveId}/approve`, { data: { comment: 'Approved for audit trail test.' } });
    expect(review.status()).toBe(200);

    const audit = await (await request.get(`/api/audit-logs?entityType=LEAVE_REQUEST&entityId=${leaveId}`)).json();
    const actions = audit.data.map((row: { action: string }) => row.action);
    expect(actions).toContain('LEAVE_CREATE');
    expect(actions).toContain('LEAVE_APPROVE');
    const approveRow = audit.data.find((row: { action: string }) => row.action === 'LEAVE_APPROVE');
    expect(approveRow.before.status).toBe('PENDING');
    expect(approveRow.after.status).toBe('APPROVED');
    expect(approveRow.actorEmail).toBe('hr@example.com');
  });
});
