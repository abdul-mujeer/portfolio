import { expect, test } from '@playwright/test';
import { createEmployeeViaApi, employeePayload, login, SEEDED } from './helpers.js';

async function createTerminatedEmployee(request: Parameters<typeof createEmployeeViaApi>[0]) {
  const created = await createEmployeeViaApi(request);
  const terminate = await request.put(`/api/employees/${created.id}`, { data: { status: 'TERMINATED' } });
  expect(terminate.status()).toBe(200);
  return created;
}

test.describe('Attendance API', () => {
  test('list is scoped, filterable by date range and exposes X-Total-Count', async ({ request }) => {
    await login(request, 'admin');
    const all = await request.get('/api/attendance?limit=100');
    expect(all.status()).toBe(200);
    expect(all.headers()['x-total-count']).toBe('60');
    const body = await all.json();
    expect(body.total).toBe(60);
    expect(body.data[0]).toMatchObject({
      id: expect.any(Number),
      employeeId: expect.any(Number),
      workDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      status: expect.stringMatching(/^(PRESENT|REMOTE|ABSENT|LEAVE)$/),
    });

    const remotes = await (await request.get('/api/attendance?status=REMOTE&limit=100')).json();
    expect(remotes.data.length).toBeGreaterThan(0);
    for (const row of remotes.data) expect(row.status).toBe('REMOTE');

    const swappedRange = await request.get('/api/attendance?from=2026-12-01&to=2026-01-01');
    expect(swappedRange.status()).toBe(400);

    const emptyRange = await (await request.get('/api/attendance?from=2001-01-01&to=2001-01-05')).json();
    expect(emptyRange.data).toEqual([]);
    expect(emptyRange.total).toBe(0);
  });

  test('rejects duplicate employee/day rows with 409 and invalid combinations with 422', async ({ request }) => {
    await login(request, 'admin');
    const workDate = '2026-05-04';
    const payload = { employeeId: SEEDED.employee1Id, workDate, status: 'PRESENT', checkIn: '09:00', checkOut: '17:30' };

    const created = await request.post('/api/attendance', { data: payload });
    expect(created.status()).toBe(201);
    const createdBody = (await created.json()).data;
    expect(createdBody.workDate).toBe(workDate);

    const duplicate = await request.post('/api/attendance', { data: payload });
    expect(duplicate.status()).toBe(409);
    expect((await duplicate.json()).error.code).toBe('DUPLICATE_ATTENDANCE');

    const checkOutBeforeCheckIn = await request.post('/api/attendance', {
      data: { ...payload, workDate: '2026-05-05', checkIn: '17:00', checkOut: '09:00' },
    });
    expect(checkOutBeforeCheckIn.status()).toBe(422);
    expect((await checkOutBeforeCheckIn.json()).error.code).toBe('INVALID_TIME_RANGE');

    const leaveWithTimes = await request.post('/api/attendance', {
      data: { ...payload, workDate: '2026-05-06', status: 'LEAVE' },
    });
    expect(leaveWithTimes.status()).toBe(422);
    expect((await leaveWithTimes.json()).error.code).toBe('INVALID_ATTENDANCE_PAYLOAD');

    const absentWithTimes = await request.post('/api/attendance', {
      data: { ...payload, workDate: '2026-05-07', status: 'ABSENT' },
    });
    expect(absentWithTimes.status()).toBe(422);

    const presentWithoutTimes = await request.post('/api/attendance', {
      data: { employeeId: SEEDED.employee1Id, workDate: '2026-05-08', status: 'PRESENT' },
    });
    expect(presentWithoutTimes.status()).toBe(422);

    const unknownEmployee = await request.post('/api/attendance', { data: { ...payload, employeeId: 999, workDate: '2026-05-09' } });
    expect(unknownEmployee.status()).toBe(422);
    expect((await unknownEmployee.json()).error.code).toBe('UNKNOWN_EMPLOYEE');

    const badTimeFormat = await request.post('/api/attendance', {
      data: { ...payload, workDate: '2026-05-10', checkIn: '9:00' },
    });
    expect(badTimeFormat.status()).toBe(400);
  });

  test('PATCH updates a record and writes an audit row, unknown ids return 404', async ({ request }) => {
    await login(request, 'hr');
    const created = await request.post('/api/attendance', {
      data: { employeeId: 5, workDate: '2026-06-01', status: 'PRESENT', checkIn: '09:15', checkOut: '17:45' },
    });
    expect([201, 409]).toContain(created.status());
    const id = (await created.json()).data.id;

    const patched = await request.patch(`/api/attendance/${id}`, {
      data: { status: 'REMOTE', checkOut: '18:00', notes: 'Worked from home in the afternoon.' },
    });
    expect(patched.status()).toBe(200);
    const body = (await patched.json()).data;
    expect(body.status).toBe('REMOTE');
    expect(body.checkOut).toBe('18:00');
    expect(body.notes).toContain('home');

    const audit = await (await request.get(`/api/audit-logs?entityType=ATTENDANCE&entityId=${id}`)).json();
    expect(audit.data.some((row: { action: string }) => row.action === 'ATTENDANCE_UPDATE')).toBe(true);

    expect((await request.patch('/api/attendance/999999', { data: { notes: 'nope' } })).status()).toBe(404);
    expect((await request.patch(`/api/attendance/${id}`, { data: {} })).status()).toBe(400);
  });

  test('a terminated employee cannot receive new attendance (422)', async ({ request }) => {
    await login(request, 'admin');
    const terminated = await createTerminatedEmployee(request);

    const response = await request.post('/api/attendance', {
      data: {
        employeeId: terminated.id,
        workDate: '2026-07-01',
        status: 'PRESENT',
        checkIn: '09:00',
        checkOut: '17:00',
      },
    });
    expect(response.status()).toBe(422);
    expect((await response.json()).error.code).toBe('EMPLOYEE_TERMINATED');
  });

  test('team scope: an EMPLOYEE gets 403 when filtering another employee and only sees own rows', async ({ request }) => {
    await login(request, 'employee6');
    const own = await (await request.get('/api/attendance?limit=100')).json();
    expect(own.total).toBeGreaterThan(0);
    for (const row of own.data) expect(row.employeeCode).toBe('EMP-009');

    expect((await request.get(`/api/attendance?employeeId=${SEEDED.employee1Id}`)).status()).toBe(403);
    expect(await (await request.get(`/api/attendance?date=2001-01-01`)).json()).toMatchObject({ total: 0 });
  });
});

test.describe('Departments API', () => {
  test('list, create, duplicate handling and rename with audit trail @smoke', async ({ request }) => {
    await login(request, 'hr');
    const list = await request.get('/api/departments');
    expect(list.status()).toBe(200);
    const body = await list.json();
    expect(body.data.map((row: { code: string }) => row.code)).toEqual(expect.arrayContaining(['ENG', 'HR', 'SLS']));

    const stamp = Date.now();
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const code = `Q${letters[stamp % 26]}${letters[Math.floor(stamp / 26) % 26]}${letters[Math.floor(stamp / 676) % 26]}`;
    const created = await request.post('/api/departments', { data: { name: `Quality Engineering ${code}`, code } });
    expect(created.status()).toBe(201);
    const department = (await created.json()).data;
    expect(department.name).toContain('Quality');

    const duplicateName = await request.post('/api/departments', { data: { name: 'Engineering', code: 'ENGX' } });
    expect(duplicateName.status()).toBe(409);
    expect((await duplicateName.json()).error.code).toBe('DUPLICATE_DEPARTMENT_NAME');

    const duplicateCode = await request.post('/api/departments', { data: { name: `Another ${code}`, code: 'ENG' } });
    expect(duplicateCode.status()).toBe(409);
    expect((await duplicateCode.json()).error.code).toBe('DUPLICATE_DEPARTMENT_CODE');

    const renamed = await request.put(`/api/departments/${department.id}`, { data: { name: `Quality Engineering ${code} (renamed)` } });
    expect(renamed.status()).toBe(200);
    expect((await renamed.json()).data.code).toBe(department.code);

    const audit = await (await request.get(`/api/audit-logs?entityType=DEPARTMENT&entityId=${department.id}`)).json();
    const actions = audit.data.map((row: { action: string }) => row.action);
    expect(actions).toEqual(expect.arrayContaining(['DEPARTMENT_CREATE', 'DEPARTMENT_UPDATE']));
    expect(audit.data.find((row: { action: string }) => row.action === 'DEPARTMENT_UPDATE').before.name).not.toBe(
      audit.data.find((row: { action: string }) => row.action === 'DEPARTMENT_UPDATE').after.name,
    );

    expect((await request.put('/api/departments/9999', { data: { name: 'Ghost department' } })).status()).toBe(404);
    expect((await request.post('/api/departments', { data: { name: 'x', code: 'toolongcode' } })).status()).toBe(400);
  });

  test('only ADMIN/HR may create or rename departments', async ({ request, playwright, baseURL }) => {
    await login(request, 'manager');
    expect((await request.post('/api/departments', { data: { name: 'Shadow Team', code: 'SHD' } })).status()).toBe(403);

    const employees = await playwright.request.newContext({ baseURL });
    try {
      await employees.post('/api/auth/login', { data: { email: 'employee6@example.com', password: 'Employee#1234' } });
      expect((await employees.put('/api/departments/1', { data: { name: 'Renamed by employee' } })).status()).toBe(403);
      expect((await employees.get('/api/departments')).status()).toBe(200);
    } finally {
      await employees.dispose();
    }
  });
});

test.describe('Reports API', () => {
  test('summary contains headcount, leave statuses and a 30 day attendance rate', async ({ request }) => {
    await login(request, 'admin');
    const response = await request.get('/api/reports/summary');
    expect(response.status()).toBe(200);
    const { data } = await response.json();

    expect(data.scope).toBe('ALL');
    expect(data.headcount.total).toBeGreaterThanOrEqual(10);
    expect(data.headcountByDepartment.length).toBeGreaterThanOrEqual(3);
    const engineering = data.headcountByDepartment.find((row: { code: string }) => row.code === 'ENG');
    expect(engineering.total).toBeGreaterThanOrEqual(6);

    expect(Object.keys(data.leaveByStatus)).toEqual(expect.arrayContaining(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']));
    expect(data.leaveByStatus.PENDING).toBeGreaterThanOrEqual(1);

    expect(data.attendance.records).toBeGreaterThan(0);
    expect(data.attendance.attendanceRate).toBeGreaterThan(0);
    expect(data.attendance.attendanceRate).toBeLessThanOrEqual(100);
    expect(data.attendance.from < data.attendance.to).toBe(true);
  });

  test('summary is scoped: an employee sees only their own numbers', async ({ request, playwright, baseURL }) => {
    await login(request, 'employee1');
    const { data } = await (await request.get('/api/reports/summary')).json();
    expect(data.scope).toBe('SELF');
    expect(data.scopeEmployeeIds).toEqual([SEEDED.employee1Id]);
    expect(data.headcount.total).toBe(1);
    const total = data.headcountByDepartment.reduce((sum: number, row: { total: number }) => sum + row.total, 0);
    expect(total).toBe(1);

    const managerScope = await playwright.request.newContext({ baseURL });
    try {
      await managerScope.post('/api/auth/login', { data: { email: 'manager@example.com', password: 'Manager#12345' } });
      const scoped = await (await managerScope.get('/api/reports/summary')).json();
      expect(scoped.data.scope).toBe('TEAM');
      expect(scoped.data.headcount.total).toBeGreaterThanOrEqual(8);
      expect(scoped.data.headcount.total).toBeLessThanOrEqual(9);
    } finally {
      await managerScope.dispose();
    }
  });
});
