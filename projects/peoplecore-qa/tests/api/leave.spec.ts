import { expect, test } from '@playwright/test';
import { CREDENTIALS, createEmployeeViaApi, isoDateOffset, login } from './helpers.js';

const ANNUAL = { leaveType: 'ANNUAL', reason: 'Annual leave request submitted by the automation suite.' };

async function submitLeave(
  request: Parameters<typeof login>[0],
  overrides: Record<string, unknown> = {},
) {
  return request.post('/api/leave-requests', {
    data: { ...ANNUAL, startDate: isoDateOffset(40), endDate: isoDateOffset(42), ...overrides },
  });
}

test.describe('Leave requests — submit and validate', () => {
  test('an employee submits leave, days are computed inclusively and an audit row is written @smoke', async ({ request, playwright, baseURL }) => {
    await login(request, 'employee1');
    const response = await submitLeave(request, { startDate: isoDateOffset(40), endDate: isoDateOffset(42) });
    expect(response.status()).toBe(201);
    const body = (await response.json()).data;
    expect(body.employeeCode).toBe('EMP-004');
    expect(body.days).toBe(3);
    expect(body.status).toBe('PENDING');
    expect(body.reviewedBy).toBeNull();

    const admin = await playwright.request.newContext({ baseURL });
    try {
      await admin.post('/api/auth/login', { data: CREDENTIALS.admin });
      const audit = await (await admin.get(`/api/audit-logs?entityType=LEAVE_REQUEST&entityId=${body.id}`)).json();
      expect(audit.data[0].action).toBe('LEAVE_CREATE');
      expect(audit.data[0].after.days).toBe(3);
    } finally {
      await admin.dispose();
    }
  });

  test('validation boundaries: reason length, date order, maximum 30 days and calendar validity', async ({ request }) => {
    await login(request, 'employee1');

    const shortReason = await submitLeave(request, { reason: 'too short', startDate: isoDateOffset(60), endDate: isoDateOffset(60) });
    expect(shortReason.status()).toBe(400);
    expect((await shortReason.json()).error.details.map((detail: { path: string }) => detail.path)).toContain('reason');

    const longReason = await submitLeave(request, { reason: 'x'.repeat(501), startDate: isoDateOffset(60), endDate: isoDateOffset(60) });
    expect(longReason.status()).toBe(400);

    const reversed = await submitLeave(request, { startDate: isoDateOffset(70), endDate: isoDateOffset(65) });
    expect(reversed.status()).toBe(422);
    expect((await reversed.json()).error.code).toBe('INVALID_LEAVE_RANGE');

    const tooLong = await submitLeave(request, { startDate: isoDateOffset(100), endDate: isoDateOffset(130) });
    expect(tooLong.status()).toBe(422);
    expect((await tooLong.json()).error.code).toBe('LEAVE_TOO_LONG');

    const exactlyThirty = await submitLeave(request, { startDate: isoDateOffset(200), endDate: isoDateOffset(229) });
    expect(exactlyThirty.status()).toBe(201);
    expect((await exactlyThirty.json()).data.days).toBe(30);

    const impossibleDate = await submitLeave(request, { startDate: '2027-02-30', endDate: '2027-03-02' });
    expect(impossibleDate.status()).toBe(400);

    const unknownType = await submitLeave(request, { leaveType: 'SABBATICAL', startDate: isoDateOffset(80), endDate: isoDateOffset(81) });
    expect(unknownType.status()).toBe(400);
  });

  test('overlapping PENDING or APPROVED requests are rejected with 409 while adjacent dates are accepted', async ({ request }) => {
    await login(request, 'employee6'); // EMP-009 owns the seeded PENDING request LR-0005 (today+10 → today+12)

    const exactOverlap = await submitLeave(request, { startDate: isoDateOffset(10), endDate: isoDateOffset(12) });
    expect(exactOverlap.status()).toBe(409);
    const overlapBody = await exactOverlap.json();
    expect(overlapBody.error.code).toBe('LEAVE_OVERLAP');
    expect(overlapBody.error.message).toMatch(/overlaps/i);

    const partialOverlap = await submitLeave(request, { startDate: isoDateOffset(11), endDate: isoDateOffset(13) });
    expect(partialOverlap.status()).toBe(409);

    const singleDayOverlap = await submitLeave(request, { startDate: isoDateOffset(12), endDate: isoDateOffset(12) });
    expect(singleDayOverlap.status()).toBe(409);

    const adjacent = await submitLeave(request, { startDate: isoDateOffset(13), endDate: isoDateOffset(14) });
    expect(adjacent.status()).toBe(201);

    const approved = await login(request, 'employee2'); // EMP-005 owns the seeded APPROVED request (today-12 → today-11)
    const againstApproved = await request.post('/api/leave-requests', {
      data: { ...ANNUAL, startDate: isoDateOffset(-11), endDate: isoDateOffset(-10) },
    });
    expect(againstApproved.status()).toBe(409);
    expect((await againstApproved.json()).error.code).toBe('LEAVE_OVERLAP');
    expect(approved.user.role).toBe('EMPLOYEE');
  });

  test('scoping: employees read only their own requests, unknown ids return 404', async ({ request }) => {
    await login(request, 'employee6');
    const mine = await (await request.get('/api/leave-requests')).json();
    expect(mine.total).toBeGreaterThan(0);
    for (const row of mine.data) expect(row.employeeCode).toBe('EMP-009');

    const ownRequest = await request.get('/api/leave-requests/5');
    expect(ownRequest.status()).toBe(200);
    expect((await ownRequest.json()).data.id).toBe(5);

    expect((await request.get('/api/leave-requests/1')).status()).toBe(403);
    expect((await request.get('/api/leave-requests/99999')).status()).toBe(404);
    expect((await request.get('/api/leave-requests?employeeId=4')).status()).toBe(403);
  });

  test('status filter plus pagination work together and expose X-Total-Count', async ({ request }) => {
    await login(request, 'hr');
    const response = await request.get('/api/leave-requests?status=PENDING&limit=2&page=1');
    expect(response.status()).toBe(200);
    expect(Number(response.headers()['x-total-count'])).toBeGreaterThanOrEqual(1);
    const body = await response.json();
    expect(body.data.length).toBeLessThanOrEqual(2);
    for (const row of body.data) expect(row.status).toBe('PENDING');

    const badStatus = await request.get('/api/leave-requests?status=MAYBE');
    expect(badStatus.status()).toBe(400);
  });
});

test.describe('Leave requests — review workflow', () => {
  test('manager approves a direct report request, then further transitions are rejected with 422 @smoke', async ({ request, playwright, baseURL }) => {
    const employee = await playwright.request.newContext({ baseURL });
    let leaveId = 0;
    try {
      await employee.post('/api/auth/login', { data: CREDENTIALS.employee6 });
      const created = await employee.post('/api/leave-requests', {
        data: { ...ANNUAL, startDate: isoDateOffset(44), endDate: isoDateOffset(45) },
      });
      expect(created.status()).toBe(201);
      leaveId = (await created.json()).data.id;
    } finally {
      await employee.dispose();
    }

    await login(request, 'manager');
    const approve = await request.patch(`/api/leave-requests/${leaveId}/approve`, { data: { comment: 'Approved by the manager.' } });
    expect(approve.status()).toBe(200);
    const approved = (await approve.json()).data;
    expect(approved.status).toBe('APPROVED');
    expect(approved.reviewerName).toBe('Sofia Marchetti');
    expect(approved.reviewComment).toBe('Approved by the manager.');

    const approveAgain = await request.patch(`/api/leave-requests/${leaveId}/approve`, { data: {} });
    expect(approveAgain.status()).toBe(422);
    expect((await approveAgain.json()).error.code).toBe('INVALID_STATE_TRANSITION');

    const rejectApproved = await request.patch(`/api/leave-requests/${leaveId}/reject`, { data: { comment: 'Changed my mind.' } });
    expect(rejectApproved.status()).toBe(422);

    const cancelApproved = await request.delete(`/api/leave-requests/${leaveId}`);
    expect(cancelApproved.status()).toBe(403);
  });

  test('reject requires a comment of at least 5 characters', async ({ request, playwright, baseURL }) => {
    const employee = await playwright.request.newContext({ baseURL });
    let leaveId = 0;
    try {
      await employee.post('/api/auth/login', { data: CREDENTIALS.employee6 });
      const created = await employee.post('/api/leave-requests', {
        data: { ...ANNUAL, startDate: isoDateOffset(46), endDate: isoDateOffset(46) },
      });
      leaveId = (await created.json()).data.id;
    } finally {
      await employee.dispose();
    }

    await login(request, 'manager');
    const noComment = await request.patch(`/api/leave-requests/${leaveId}/reject`, { data: {} });
    expect(noComment.status()).toBe(400);
    expect((await noComment.json()).error.code).toBe('VALIDATION_ERROR');

    const shortComment = await request.patch(`/api/leave-requests/${leaveId}/reject`, { data: { comment: 'no' } });
    expect(shortComment.status()).toBe(400);

    const validComment = await request.patch(`/api/leave-requests/${leaveId}/reject`, { data: { comment: 'Team is at capacity.' } });
    expect(validComment.status()).toBe(200);
    const rejected = (await validComment.json()).data;
    expect(rejected.status).toBe('REJECTED');
    expect(rejected.reviewComment).toBe('Team is at capacity.');
    expect(rejected.reviewedAt).not.toBeNull();
  });

  test('an employee cancels their own PENDING request; a reviewed or foreign request cannot be cancelled', async ({ request }) => {
    await login(request, 'employee1');
    const created = await submitLeave(request, { startDate: isoDateOffset(52), endDate: isoDateOffset(53) });
    expect(created.status()).toBe(201);
    const leaveId = (await created.json()).data.id;

    const cancel = await request.delete(`/api/leave-requests/${leaveId}`);
    expect(cancel.status()).toBe(200);
    expect((await cancel.json()).data.status).toBe('CANCELLED');

    const cancelAgain = await request.delete(`/api/leave-requests/${leaveId}`);
    expect(cancelAgain.status()).toBe(422);
    expect((await cancelAgain.json()).error.code).toBe('INVALID_STATE_TRANSITION');

    const othersApproved = await request.delete('/api/leave-requests/2');
    expect(othersApproved.status()).toBe(403);

    const othersPending = await request.delete('/api/leave-requests/6');
    expect(othersPending.status()).toBe(403);
  });

  test('HR reviews any request but never their own', async ({ request }) => {
    await login(request, 'hr');
    const own = await request.post('/api/leave-requests', {
      data: { ...ANNUAL, startDate: isoDateOffset(120), endDate: isoDateOffset(121) },
    });
    expect(own.status()).toBe(201);
    const ownId = (await own.json()).data.id;

    const selfReview = await request.patch(`/api/leave-requests/${ownId}/approve`, { data: {} });
    expect(selfReview.status()).toBe(403);

    const cancel = await request.delete(`/api/leave-requests/${ownId}`);
    expect(cancel.status()).toBe(200);
  });

  test('a terminated employee cannot submit or receive a leave decision (422)', async ({ request, playwright, baseURL }) => {
    await login(request, 'admin');
    const created = await createEmployeeViaApi(request, { managerId: 3 });

    const employee = await playwright.request.newContext({ baseURL });
    const manager = await playwright.request.newContext({ baseURL });
    try {
      const loginAsProbe = await employee.post('/api/auth/login', {
        data: { email: created.email, password: 'Probe#12345' },
      });
      expect(loginAsProbe.status()).toBe(200);

      const submitted = await employee.post('/api/leave-requests', {
        data: { ...ANNUAL, startDate: isoDateOffset(150), endDate: isoDateOffset(150) },
      });
      expect(submitted.status()).toBe(201);
      const leaveId = (await submitted.json()).data.id;

      const terminated = await request.put(`/api/employees/${created.id}`, { data: { status: 'TERMINATED' } });
      expect(terminated.status()).toBe(200);

      const staleSession = await employee.post('/api/leave-requests', {
        data: { ...ANNUAL, startDate: isoDateOffset(160), endDate: isoDateOffset(160) },
      });
      // Defect HR-BUG-012: the session of a terminated account is revoked, so the stale
      // cookie is rejected before the leave business rule can even run.
      expect(staleSession.status()).toBe(401);
      expect((await staleSession.json()).error.code).toBe('UNAUTHENTICATED');

      await manager.post('/api/auth/login', { data: CREDENTIALS.manager });
      const approveTerminated = await manager.patch(`/api/leave-requests/${leaveId}/approve`, { data: {} });
      expect(approveTerminated.status()).toBe(422);
      expect((await approveTerminated.json()).error.code).toBe('EMPLOYEE_TERMINATED');
    } finally {
      await employee.dispose();
      await manager.dispose();
    }
  });
});
