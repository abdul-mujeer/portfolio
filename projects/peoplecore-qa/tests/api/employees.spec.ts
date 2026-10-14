import { expect, test } from '@playwright/test';
import { createEmployeeViaApi, employeePayload, isoDateOffset, login, SEEDED, uniqueEmail } from './helpers.js';

test.describe('Employees — list, paging, filtering, sorting', () => {
  test.beforeEach(async ({ request }) => {
    await login(request, 'admin');
  });

  test('scoped list returns the documented envelope plus X-Total-Count @smoke', async ({ request }) => {
    const response = await request.get('/api/employees?limit=5');
    expect(response.status()).toBe(200);
    expect(response.headers()['x-total-count']).toBeDefined();

    const body = await response.json();
    expect(body.data.length).toBe(5);
    expect(response.headers()['x-total-count']).toBe(String(body.total));
    expect(body.page).toBe(1);
    expect(body.limit).toBe(5);
    expect(body.totalPages).toBeGreaterThanOrEqual(2);

    const first = body.data[0];
    expect(first).toMatchObject({ id: expect.any(Number), employeeCode: expect.any(String), role: expect.any(String) });
    expect(first).not.toHaveProperty('password_hash');
    expect(first).not.toHaveProperty('salt');
    expect(first.salary).toBeGreaterThan(0);
  });

  test('page beyond the last page returns an empty page but keeps the real total', async ({ request }) => {
    const baseline = await (await request.get('/api/employees?limit=5')).json();
    const response = await request.get('/api/employees?page=999&limit=5');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data).toEqual([]);
    expect(body.total).toBe(baseline.total);
    expect(response.headers()['x-total-count']).toBe(String(baseline.total));
  });

  test('q filters by name or employee code', async ({ request }) => {
    const byName = await (await request.get('/api/employees?q=Okafor')).json();
    expect(byName.data).toHaveLength(1);
    expect(byName.data[0].employeeCode).toBe('EMP-001');

    const byCode = await (await request.get('/api/employees?q=EMP-003')).json();
    expect(byCode.data).toHaveLength(1);
    expect(byCode.data[0].role).toBe('MANAGER');

    const noMatch = await (await request.get('/api/employees?q=zzz-no-such-person')).json();
    expect(noMatch.data).toEqual([]);
    expect(noMatch.total).toBe(0);
  });

  test('departmentId, status and role filters are combined with AND', async ({ request }) => {
    const engineering = await (await request.get('/api/employees?departmentId=1&limit=100')).json();
    expect(engineering.data.length).toBeGreaterThan(0);
    for (const row of engineering.data) expect(row.departmentId).toBe(1);

    const salesEmployees = await (await request.get('/api/employees?departmentId=3&role=EMPLOYEE&limit=100')).json();
    for (const row of salesEmployees.data) {
      expect(row.departmentId).toBe(3);
      expect(row.role).toBe('EMPLOYEE');
    }
    expect(salesEmployees.data.map((row: { employeeCode: string }) => row.employeeCode)).toEqual(
      expect.arrayContaining(['EMP-009', 'EMP-010']),
    );

    const terminated = await (await request.get('/api/employees?status=TERMINATED&limit=100')).json();
    for (const row of terminated.data) expect(row.status).toBe('TERMINATED');
  });

  test('sort and order are honoured and unknown sort keys are rejected with 400', async ({ request }) => {
    const ascending = await (await request.get('/api/employees?sort=employeeCode&order=asc&limit=100')).json();
    const codes = ascending.data.map((row: { employeeCode: string }) => row.employeeCode);
    expect([...codes].sort()).toEqual(codes);

    const descending = await (await request.get('/api/employees?sort=employeeCode&order=desc&limit=100')).json();
    const reverseCodes = descending.data.map((row: { employeeCode: string }) => row.employeeCode);
    expect([...reverseCodes].sort().reverse()).toEqual(reverseCodes);

    const badSort = await request.get('/api/employees?sort=password_hash');
    expect(badSort.status()).toBe(400);
    const badOrder = await request.get('/api/employees?order=sideways');
    expect(badOrder.status()).toBe(400);
  });

  test('pagination boundaries: limit 100 is accepted, 0/101/non-numeric are rejected', async ({ request }) => {
    const maximum = await request.get('/api/employees?limit=100');
    expect(maximum.status()).toBe(200);
    expect((await maximum.json()).limit).toBe(100);

    for (const query of ['limit=0', 'limit=101', 'limit=abc', 'page=0', 'page=-3']) {
      const response = await request.get(`/api/employees?${query}`);
      expect(response.status(), query).toBe(400);
      const body = await response.json();
      expect(body.error.code, query).toBe('VALIDATION_ERROR');
      expect(body.error.details.length, query).toBeGreaterThan(0);
    }
  });
});

test.describe('Employees — create, update, delete', () => {
  test('ADMIN creates an employee and an EMPLOYEE_CREATE audit row is written @smoke', async ({ request }) => {
    await login(request, 'admin');
    const payload = employeePayload({ salary: 76543.21, position: 'Site Reliability Engineer' });
    const response = await request.post('/api/employees', { data: payload });
    expect(response.status()).toBe(201);

    const body = await response.json();
    expect(response.headers()['location']).toBe(`/api/employees/${body.data.id}`);
    expect(body.data.employeeCode).toBe(payload.employeeCode);
    expect(body.data.email).toBe(String(payload.email).toLowerCase());
    expect(body.data.salary).toBe(76543.21);
    expect(body.data.status).toBe('ACTIVE');

    const audit = await (await request.get(`/api/audit-logs?entityType=EMPLOYEE&entityId=${body.data.id}`)).json();
    expect(audit.data).toHaveLength(1);
    expect(audit.data[0].action).toBe('EMPLOYEE_CREATE');
    expect(audit.data[0].before).toBeNull();
    expect(audit.data[0].after.employeeCode).toBe(payload.employeeCode);
    expect(audit.data[0].after.salary).toBe(76543.21);

    const fetched = await request.get(`/api/employees/${body.data.id}`);
    expect(fetched.status()).toBe(200);
    expect((await fetched.json()).data.id).toBe(body.data.id);
  });

  test('PUT updates the record, keeps untouched fields and audits before/after', async ({ request }) => {
    await login(request, 'admin');
    const created = await createEmployeeViaApi(request, { salary: 50000 });

    const update = await request.put(`/api/employees/${created.id}`, {
      data: { firstName: 'Renamed', salary: 52500.75, position: 'Senior QA Engineer' },
    });
    expect(update.status()).toBe(200);
    const updated = (await update.json()).data;
    expect(updated.firstName).toBe('Renamed');
    expect(updated.salary).toBe(52500.75);
    expect(updated.email).toBe(created.email);
    expect(updated.employeeCode).toBe(created.employeeCode);

    const audit = await (await request.get(`/api/audit-logs?entityId=${created.id}`)).json();
    const updateRow = audit.data.find((row: { action: string }) => row.action === 'EMPLOYEE_UPDATE');
    expect(updateRow.before.salary).toBe(50000);
    expect(updateRow.after.salary).toBe(52500.75);
    expect(updateRow.before.firstName).toBe('Probe');
  });

  test('DELETE returns 204, removes the record and refuses self-deletion and managers with reports', async ({ request }) => {
    await login(request, 'admin');
    const created = await createEmployeeViaApi(request);

    const deleted = await request.delete(`/api/employees/${created.id}`);
    expect(deleted.status()).toBe(204);
    expect(await deleted.text()).toBe('');

    const afterwards = await request.get(`/api/employees/${created.id}`);
    expect(afterwards.status()).toBe(404);

    const selfDelete = await request.delete(`/api/employees/${SEEDED.adminId}`);
    expect(selfDelete.status()).toBe(422);
    expect((await selfDelete.json()).error.code).toBe('CANNOT_DELETE_SELF');

    const managerWithReports = await request.delete(`/api/employees/${SEEDED.managerId}`);
    expect(managerWithReports.status()).toBe(409);
    expect((await managerWithReports.json()).error.code).toBe('MANAGER_HAS_DIRECT_REPORTS');

    const unknown = await request.delete('/api/employees/999999');
    expect(unknown.status()).toBe(404);
  });

  test('DELETE removes an employee who already has attendance, leave and audit history (regression for HR-BUG-008)', async ({
    request,
    playwright,
    baseURL,
  }) => {
    await login(request, 'admin');
    const created = await createEmployeeViaApi(request, { managerId: 3 });

    const attendance = await request.post('/api/attendance', {
      data: { employeeId: created.id, workDate: '2027-03-01', status: 'PRESENT', checkIn: '09:00', checkOut: '17:00' },
    });
    expect(attendance.status()).toBe(201);

    const employee = await playwright.request.newContext({ baseURL });
    let leaveId = 0;
    try {
      await employee.post('/api/auth/login', { data: { email: created.email, password: 'Probe#12345' } });
      const submitted = await employee.post('/api/leave-requests', {
        data: {
          leaveType: 'ANNUAL',
          startDate: isoDateOffset(210),
          endDate: isoDateOffset(211),
          reason: 'Leave requested before the account was removed.',
        },
      });
      expect(submitted.status()).toBe(201);
      leaveId = (await submitted.json()).data.id;
    } finally {
      await employee.dispose();
    }

    const deleted = await request.delete(`/api/employees/${created.id}`);
    expect(deleted.status()).toBe(204);

    // Child rows that belong to the person are gone (an id that no longer exists simply
    // matches nothing for a privileged reader)…
    const attendanceAfter = await (await request.get(`/api/attendance?employeeId=${created.id}`)).json();
    expect(attendanceAfter.total).toBe(0);
    const adminScope = await (await request.get(`/api/leave-requests?employeeId=${created.id}`)).json();
    expect(adminScope.total).toBe(0);

    // …while the audit trail survives with a cleared actor reference.
    const audit = await (await request.get(`/api/audit-logs?entityId=${created.id}&limit=100`)).json();
    expect(audit.data.some((row: { action: string }) => row.action === 'EMPLOYEE_DELETE')).toBe(true);
    const leaveCreateRow = await (await request.get(`/api/audit-logs?entityType=LEAVE_REQUEST&entityId=${leaveId}`)).json();
    expect(leaveCreateRow.data).toHaveLength(1);
    expect(leaveCreateRow.data[0].actorId).toBeNull();
    expect(leaveCreateRow.data[0].action).toBe('LEAVE_CREATE');
  });

  test('HR may update but may not delete employees', async ({ request }) => {
    await login(request, 'hr');
    const update = await request.put(`/api/employees/${SEEDED.employee1Id}`, { data: { position: 'Backend Engineer II' } });
    expect(update.status()).toBe(200);
    expect((await update.json()).data.position).toBe('Backend Engineer II');

    const remove = await request.delete(`/api/employees/${SEEDED.employee1Id}`);
    expect(remove.status()).toBe(403);
    expect((await remove.json()).error.code).toBe('ROLE_FORBIDDEN');
  });
});

test.describe('Employees — validation boundaries', () => {
  test.beforeEach(async ({ request }) => {
    await login(request, 'admin');
  });

  test('duplicate employee code and duplicate email are conflicts (409), case-insensitively for email', async ({ request }) => {
    const first = await createEmployeeViaApi(request, { email: uniqueEmail('duplicate') });

    const duplicateCode = await request.post('/api/employees', {
      data: employeePayload({ employeeCode: first.employeeCode }),
    });
    expect(duplicateCode.status()).toBe(409);
    expect((await duplicateCode.json()).error.code).toBe('DUPLICATE_EMPLOYEE_CODE');

    const duplicateEmail = await request.post('/api/employees', {
      data: employeePayload({ email: first.email.toUpperCase() }),
    });
    expect(duplicateEmail.status()).toBe(409);
    expect((await duplicateEmail.json()).error.code).toBe('DUPLICATE_EMAIL');
  });

  test('employee code format is enforced (EMP-### / EMP-####)', async ({ request }) => {
    for (const employeeCode of ['EMP-12', 'emp-012', 'EMP-12345', 'XEMP-123', 'EMP-abc']) {
      const response = await request.post('/api/employees', { data: employeePayload({ employeeCode }) });
      expect(response.status(), employeeCode).toBe(400);
      const body = await response.json();
      expect(body.error.details.some((detail: { path: string }) => detail.path === 'employeeCode'), employeeCode).toBe(true);
    }
  });

  test('salary boundaries: 0, negative, above 1,000,000 and 3 decimals are rejected (422)', async ({ request }) => {
    for (const salary of [0, -1, 1_000_000.01, 100.123]) {
      const response = await request.post('/api/employees', { data: employeePayload({ salary }) });
      expect(response.status(), `salary ${salary}`).toBe(422);
      const body = await response.json();
      expect(body.error.code, `salary ${salary}`).toBe('INVALID_SALARY');
    }
    const upperBoundary = await request.post('/api/employees', { data: employeePayload({ salary: 1_000_000 }) });
    expect(upperBoundary.status()).toBe(201);
    const twoDecimals = await request.post('/api/employees', { data: employeePayload({ salary: 1234.56 }) });
    expect(twoDecimals.status()).toBe(201);
  });

  test('hire date: future dates and anything before 1990-01-01 are rejected (422)', async ({ request }) => {
    const future = await request.post('/api/employees', {
      data: employeePayload({ hireDate: isoDateInFuture(1) }),
    });
    expect(future.status()).toBe(422);
    expect((await future.json()).error.code).toBe('INVALID_HIRE_DATE');

    const ancient = await request.post('/api/employees', { data: employeePayload({ hireDate: '1989-12-31' }) });
    expect(ancient.status()).toBe(422);

    const impossibleCalendarDate = await request.post('/api/employees', {
      data: employeePayload({ hireDate: '2026-02-30' }),
    });
    expect(impossibleCalendarDate.status()).toBe(400);

    const boundary = await request.post('/api/employees', { data: employeePayload({ hireDate: '1990-01-01' }) });
    expect(boundary.status()).toBe(201);
  });

  test('wrong types, unknown enum values and unknown fields are rejected with 400', async ({ request }) => {
    const salaryAsString = await request.post('/api/employees', { data: employeePayload({ salary: '61000' }) });
    expect(salaryAsString.status()).toBe(400);

    const badRole = await request.post('/api/employees', { data: employeePayload({ role: 'SUPERUSER' }) });
    expect(badRole.status()).toBe(400);

    const badEmail = await request.post('/api/employees', { data: employeePayload({ email: 'not-an-email' }) });
    expect(badEmail.status()).toBe(400);

    const weakPassword = await request.post('/api/employees', { data: employeePayload({ password: 'password' }) });
    expect(weakPassword.status()).toBe(400);

    const unknownField = await request.post('/api/employees', {
      data: { ...employeePayload(), isSuperAdmin: true },
    });
    expect(unknownField.status()).toBe(400);

    const unknownDepartment = await request.post('/api/employees', { data: employeePayload({ departmentId: 999 }) });
    expect(unknownDepartment.status()).toBe(422);
    expect((await unknownDepartment.json()).error.code).toBe('UNKNOWN_DEPARTMENT');

    const unknownManager = await request.post('/api/employees', { data: employeePayload({ managerId: 999 }) });
    expect(unknownManager.status()).toBe(422);
    expect((await unknownManager.json()).error.code).toBe('UNKNOWN_MANAGER');

    const missingRequired = await request.post('/api/employees', { data: { firstName: 'Only' } });
    expect(missingRequired.status()).toBe(400);
    expect((await missingRequired.json()).error.details.length).toBeGreaterThan(5);
  });

  test('unknown ids in the path return 404 and non-numeric ids return 400', async ({ request }) => {
    expect((await request.get('/api/employees/999999')).status()).toBe(404);
    expect((await request.put('/api/employees/999999', { data: { position: 'Nope' } })).status()).toBe(404);
    expect((await request.get('/api/employees/not-a-number')).status()).toBe(400);
  });
});

function isoDateInFuture(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
