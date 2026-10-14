import { expect, test } from '@playwright/test';
import { CREDENTIALS, createEmployeeViaApi, employeePayload, login, SEEDED, type RoleKey } from './helpers.js';

const ROLE_KEYS: RoleKey[] = ['admin', 'hr', 'manager', 'employee1'];
const ROLE_NAMES: Record<RoleKey, string> = { admin: 'ADMIN', hr: 'HR', manager: 'MANAGER', employee1: 'EMPLOYEE' };

test.describe('RBAC — direct API access by every role', () => {
  test('GET matrix: server-side authorization never depends on the UI @smoke', async ({ playwright, baseURL }) => {
    const matrix: Array<{ path: string; expected: Record<RoleKey, number> }> = [
      { path: '/api/employees', expected: { admin: 200, hr: 200, manager: 200, employee1: 200 } },
      { path: '/api/employees/1', expected: { admin: 200, hr: 200, manager: 403, employee1: 403 } },
      { path: '/api/employees/4', expected: { admin: 200, hr: 200, manager: 200, employee1: 200 } },
      { path: '/api/audit-logs', expected: { admin: 200, hr: 200, manager: 403, employee1: 403 } },
      { path: '/api/departments', expected: { admin: 200, hr: 200, manager: 200, employee1: 200 } },
      { path: '/api/reports/summary', expected: { admin: 200, hr: 200, manager: 200, employee1: 200 } },
      { path: '/api/attendance?employeeId=1', expected: { admin: 200, hr: 200, manager: 403, employee1: 403 } },
      { path: '/api/leave-requests?employeeId=1', expected: { admin: 200, hr: 200, manager: 403, employee1: 403 } },
    ];

    const failures: string[] = [];
    for (const role of ROLE_KEYS) {
      const isolated = await playwright.request.newContext({ baseURL });
      try {
        const loginResponse = await isolated.post('/api/auth/login', { data: CREDENTIALS[role] });
        expect(loginResponse.status(), `login ${role}`).toBe(200);
        for (const entry of matrix) {
          const response = await isolated.get(entry.path);
          const actual = response.status();
          const expected = entry.expected[role];
          if (actual !== expected) failures.push(`${ROLE_NAMES[role]} GET ${entry.path} → ${actual} (expected ${expected})`);
        }
      } finally {
        await isolated.dispose();
      }
    }
    expect(failures).toEqual([]);
  });

  test('EMPLOYEE sees only their own record and cannot reach anyone else', async ({ request }) => {
    await login(request, 'employee1');
    const list = await (await request.get('/api/employees')).json();
    expect(list.data).toHaveLength(1);
    expect(list.data[0].employeeCode).toBe('EMP-004');

    expect((await request.get('/api/employees/5')).status()).toBe(403);
    expect((await request.get('/api/attendance?employeeId=5')).status()).toBe(403);
    expect((await request.get(`/api/leave-requests?employeeId=${SEEDED.hrId}`)).status()).toBe(403);

    const ownAttendance = await request.get(`/api/attendance?employeeId=${SEEDED.employee1Id}`);
    expect(ownAttendance.status()).toBe(200);
    expect((await ownAttendance.json()).data.length).toBeGreaterThan(0);
  });

  test('EMPLOYEE cannot write employees, attendance or review decisions', async ({ request }) => {
    await login(request, 'employee1');

    expect((await request.post('/api/employees', { data: employeePayload() })).status()).toBe(403);
    expect((await request.put('/api/employees/4', { data: { position: 'Hacker' } })).status()).toBe(403);
    expect((await request.delete('/api/employees/4')).status()).toBe(403);

    const attendanceWrite = await request.post('/api/attendance', {
      data: { employeeId: SEEDED.employee1Id, workDate: '2026-01-05', status: 'PRESENT', checkIn: '09:00', checkOut: '17:00' },
    });
    expect(attendanceWrite.status()).toBe(403);

    const requestLeaveForSomeoneElse = await request.post('/api/leave-requests', {
      data: { employeeId: 5, leaveType: 'ANNUAL', startDate: '2026-01-05', endDate: '2026-01-06', reason: 'Trying to book leave for a colleague.' },
    });
    expect(requestLeaveForSomeoneElse.status()).toBe(403);

    expect((await request.patch(`/api/leave-requests/${SEEDED.pendingLeaveForDirectReport}/approve`, { data: {} })).status()).toBe(403);
  });

  test('MANAGER is limited to self plus direct reports, cannot edit employees or read audit', async ({ request }) => {
    await login(request, 'manager');

    const list = await (await request.get('/api/employees?limit=100')).json();
    expect(list.data.length).toBeGreaterThanOrEqual(8);
    for (const row of list.data) {
      expect(row.id === SEEDED.managerId || row.managerId === SEEDED.managerId, `employee ${row.employeeCode}`).toBe(true);
    }

    const directReport = await request.get(`/api/employees/${SEEDED.employee1Id}`);
    expect(directReport.status()).toBe(200);
    const directReportBody = (await directReport.json()).data;
    expect(directReportBody.salary).toBeUndefined();
    expect(directReportBody.salaryRedacted).toBe(true);

    expect((await request.get('/api/employees/1')).status()).toBe(403);
    expect((await request.put(`/api/employees/${SEEDED.employee1Id}`, { data: { salary: 999999 } })).status()).toBe(403);
    expect((await request.post('/api/employees', { data: employeePayload() })).status()).toBe(403);
    expect((await request.get('/api/audit-logs')).status()).toBe(403);
    expect((await request.get('/api/audit-logs?entityType=EMPLOYEE')).status()).toBe(403);
  });

  test('MANAGER can write attendance and review leave only for direct reports', async ({ request }) => {
    await login(request, 'manager');

    const ownScope = await request.post('/api/attendance', {
      data: { employeeId: SEEDED.employee1Id, workDate: '2026-03-02', status: 'REMOTE', checkIn: '09:00', checkOut: '17:00' },
    });
    expect([201, 409]).toContain(ownScope.status());

    const outOfScope = await request.post('/api/attendance', {
      data: { employeeId: SEEDED.adminId, workDate: '2026-03-02', status: 'PRESENT', checkIn: '09:00', checkOut: '17:00' },
    });
    expect(outOfScope.status()).toBe(403);

    const outsiderLeave = await request.post('/api/leave-requests', {
      data: { leaveType: 'ANNUAL', startDate: '2026-04-01', endDate: '2026-04-02', reason: 'Manager booking leave for themselves.' },
    });
    expect(outsiderLeave.status()).toBe(201);
    const createdLeaveId = (await outsiderLeave.json()).data.id;

    const approveOwn = await request.patch(`/api/leave-requests/${createdLeaveId}/approve`, { data: {} });
    expect(approveOwn.status()).toBe(403);
    expect((await approveOwn.json()).error.message).toMatch(/direct reports/i);

    const validReview = await request.patch(`/api/leave-requests/${SEEDED.pendingLeaveForDirectReport}/approve`, {
      data: { comment: 'Approved by manager during RBAC test.' },
    });
    expect([200, 422]).toContain(validReview.status());
  });

  test('HR may create and update but not delete, change roles or create administrators; audit exposes salary', async ({ request }) => {
    await login(request, 'hr');
    const created = await createEmployeeViaApi(request, { role: 'EMPLOYEE' });

    expect((await request.delete(`/api/employees/${created.id}`)).status()).toBe(403);

    const roleChange = await request.put(`/api/employees/${created.id}`, { data: { role: 'ADMIN' } });
    expect(roleChange.status()).toBe(403);
    expect((await roleChange.json()).error.code).toBe('ROLE_CHANGE_FORBIDDEN');

    const createAdmin = await request.post('/api/employees', { data: employeePayload({ role: 'ADMIN' }) });
    expect(createAdmin.status()).toBe(403);

    const modifyAdmin = await request.put(`/api/employees/${SEEDED.adminId}`, { data: { position: 'Definitely not allowed' } });
    expect(modifyAdmin.status()).toBe(403);

    const audit = await (await request.get('/api/audit-logs?entityType=EMPLOYEE&limit=100')).json();
    const createRow = audit.data.find((row: { entityId: string }) => Number(row.entityId) === created.id);
    expect(createRow.action).toBe('EMPLOYEE_CREATE');
    expect(createRow.after.salary).toBe(61000.5);

    const salaryUpdate = await request.put(`/api/employees/${created.id}`, { data: { salary: 62000 } });
    expect(salaryUpdate.status()).toBe(200);
  });

  test('ADMIN holds the full employee lifecycle including role changes and deletion', async ({ request }) => {
    await login(request, 'admin');
    const created = await createEmployeeViaApi(request, { role: 'EMPLOYEE' });

    const promotion = await request.put(`/api/employees/${created.id}`, { data: { role: 'MANAGER' } });
    expect(promotion.status()).toBe(200);
    expect((await promotion.json()).data.role).toBe('MANAGER');

    expect((await request.delete(`/api/employees/${created.id}`)).status()).toBe(204);
    const audit = await (await request.get(`/api/audit-logs?entityId=${created.id}&limit=100`)).json();
    const actions = audit.data.map((row: { action: string }) => row.action);
    expect(actions).toEqual(expect.arrayContaining(['EMPLOYEE_CREATE', 'EMPLOYEE_UPDATE', 'EMPLOYEE_DELETE']));
  });
});
