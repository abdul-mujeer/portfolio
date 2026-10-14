import { test, expect } from '@playwright/test';
import {
  API,
  SEED,
  authedContext,
  dateOffset,
  expectError,
  uniqueKey,
  type SeedUser,
} from '../helpers/api';
import type { APIRequestContext } from '@playwright/test';

async function createProject(ctx: APIRequestContext, name = 'QA Tasks Project') {
  const key = uniqueKey();
  const res = await ctx.post(`${API}/projects`, { data: { key, name: `${name} ${key}` } });
  expect(res.status()).toBe(201);
  return res.json();
}

async function addMember(ctx: APIRequestContext, projectId: number, user: SeedUser, role = 'MEMBER') {
  const res = await ctx.post(`${API}/projects/${projectId}/members`, {
    data: { email: user.email, role },
  });
  expect(res.status()).toBe(201);
}

async function createTask(ctx: APIRequestContext, projectId: number, data: Record<string, unknown>) {
  return ctx.post(`${API}/projects/${projectId}/tasks`, { data: { title: 'QA task', ...data } });
}

test.describe('Task CRUD & validation', () => {
  test('TASK-TC-019 @smoke creating a task applies defaults, trims the title and computes derived fields', async () => {
    const owner = await authedContext(SEED.users.owner);
    const project = await createProject(owner);
    const res = await createTask(owner, project.id, { title: '   Ship the release   ' });
    expect(res.status()).toBe(201);
    const task = await res.json();
    expect(task.title).toBe('Ship the release');
    expect(task.status).toBe('TODO');
    expect(task.priority).toBe('MEDIUM');
    expect(task.assignee_id).toBeNull();
    expect(task.due_date).toBeNull();
    expect(task.estimated_hours).toBeNull();
    expect(task.reporter_id).toBe(SEED.users.owner.id);
    expect(task.reporter_name).toBe(SEED.users.owner.name);
    expect(task.project_key).toBe(project.key);
    expect(task.project_archived).toBe(false);
    expect(task.comment_count).toBe(0);
    expect(task.overdue).toBe(false);

    // strict schema on create: status is controlled by the workflow endpoint
    await expectError(
      await createTask(owner, project.id, { title: 'Sneaky status', status: 'DONE' }),
      400,
      'VALIDATION_ERROR'
    );
    await expectError(
      await createTask(owner, project.id, { title: 'Sneaky reporter', reporterId: 2 }),
      400,
      'VALIDATION_ERROR'
    );
    await owner.dispose();
  });

  test('TASK-TC-020 title and description boundaries are enforced after trimming', async () => {
    const owner = await authedContext(SEED.users.owner);
    const project = await createProject(owner);

    await expectError(await createTask(owner, project.id, { title: 'ab' }), 400);
    await expectError(await createTask(owner, project.id, { title: '  a  ' }), 400);

    const max = 'x'.repeat(120);
    const okMax = await createTask(owner, project.id, { title: max });
    expect(okMax.status()).toBe(201);
    expect((await okMax.json()).title).toBe(max);
    await expectError(await createTask(owner, project.id, { title: 'x'.repeat(121) }), 400);

    const desc2000 = await createTask(owner, project.id, {
      title: 'Description boundary ok',
      description: 'd'.repeat(2000),
    });
    expect(desc2000.status()).toBe(201);
    await expectError(
      await createTask(owner, project.id, { title: 'Description boundary too long', description: 'd'.repeat(2001) }),
      400
    );

    const trimmed = await createTask(owner, project.id, { title: '  spaced title  ' });
    expect((await trimmed.json()).title).toBe('spaced title');
    await owner.dispose();
  });

  test('TASK-TC-021 priority and estimated hours are strictly validated (enum, range, steps, types)', async () => {
    const owner = await authedContext(SEED.users.owner);
    const project = await createProject(owner);

    for (const priority of ['URGENT', 'low', 'High', '']) {
      await expectError(await createTask(owner, project.id, { title: 'Bad priority', priority }), 400);
    }
    for (const estimatedHours of [0.75, 0.25, 100.5, -1, '2', 0]) {
      await expectError(
        await createTask(owner, project.id, { title: 'Bad estimate', estimatedHours }),
        400
      );
    }
    for (const estimatedHours of [0.5, 100]) {
      const ok = await createTask(owner, project.id, { title: `Good estimate ${estimatedHours}`, estimatedHours });
      expect(ok.status()).toBe(201);
      expect((await ok.json()).estimated_hours).toBe(estimatedHours);
    }

    // invalid filter values on the list endpoint
    await expectError(await owner.get(`${API}/projects/${project.id}/tasks?priority=bogus`), 400);
    await expectError(await owner.get(`${API}/projects/${project.id}/tasks?status=BLOCKED`), 400);
    await expectError(await owner.get(`${API}/projects/${project.id}/tasks?priority=urgent`), 400);
    await owner.dispose();
  });

  test('TASK-TC-022 only project members can be assignees (422 otherwise), null unassigns', async () => {
    const owner = await authedContext(SEED.users.owner);
    const project = await createProject(owner);

    await expectError(
      await createTask(owner, project.id, { title: 'Non-member assignee', assigneeId: SEED.users.noprojects.id }),
      422,
      'ASSIGNEE_NOT_MEMBER'
    );
    await expectError(
      await createTask(owner, project.id, { title: 'Ghost assignee', assigneeId: 999999 }),
      422,
      'ASSIGNEE_NOT_MEMBER'
    );

    const ok = await createTask(owner, project.id, {
      title: 'Member assignee',
      assigneeId: SEED.users.owner.id,
    });
    const task = await ok.json();
    expect(task.assignee_id).toBe(SEED.users.owner.id);

    await expectError(
      await owner.patch(`${API}/tasks/${task.id}`, { data: { assigneeId: SEED.users.noprojects.id } }),
      422,
      'ASSIGNEE_NOT_MEMBER'
    );
    const cleared = await owner.patch(`${API}/tasks/${task.id}`, { data: { assigneeId: null } });
    expect(cleared.status()).toBe(200);
    expect((await cleared.json()).assignee_id).toBeNull();
    await owner.dispose();
  });

  test('TASK-TC-023 due dates must be real calendar dates (leap years included) and never before creation', async () => {
    const owner = await authedContext(SEED.users.owner);
    const project = await createProject(owner);

    for (const dueDate of ['2026-02-30', '2027-02-29', '2026-13-01', '14-10-2026', '2026/10/14']) {
      await expectError(await createTask(owner, project.id, { title: 'Bad date', dueDate }), 400);
    }
    const leap = await createTask(owner, project.id, { title: 'Leap year accepted', dueDate: '2028-02-29' });
    expect(leap.status()).toBe(201);

    await expectError(
      await createTask(owner, project.id, { title: 'Past due', dueDate: dateOffset(-1) }),
      422,
      'DUE_DATE_BEFORE_CREATION'
    );
    const dueToday = await createTask(owner, project.id, { title: 'Due today', dueDate: dateOffset(0) });
    expect(dueToday.status()).toBe(201);
    const task = await dueToday.json();
    expect(task.due_date).toBe(dateOffset(0));

    // update path applies the same rule against the task creation date
    await expectError(
      await owner.patch(`${API}/tasks/${task.id}`, { data: { dueDate: dateOffset(-3) } }),
      422,
      'DUE_DATE_BEFORE_CREATION'
    );
    const moved = await owner.patch(`${API}/tasks/${task.id}`, { data: { dueDate: dateOffset(30) } });
    expect(moved.status()).toBe(200);
    expect((await moved.json()).due_date).toBe(dateOffset(30));
    const cleared = await owner.patch(`${API}/tasks/${task.id}`, { data: { dueDate: null } });
    expect(cleared.status()).toBe(200);
    expect((await cleared.json()).due_date).toBeNull();
    await owner.dispose();
  });

  test('TASK-TC-024 unknown task/project/member ids return 404 across methods', async () => {
    const owner = await authedContext(SEED.users.owner);
    const missingId = 999999;
    const checks = await Promise.all([
      owner.get(`${API}/tasks/${missingId}`),
      owner.patch(`${API}/tasks/${missingId}`, { data: { title: 'Ghost update' } }),
      owner.delete(`${API}/tasks/${missingId}`),
      owner.patch(`${API}/tasks/${missingId}/status`, { data: { status: 'IN_PROGRESS' } }),
      owner.get(`${API}/tasks/${missingId}/comments`),
      owner.post(`${API}/tasks/${missingId}/comments`, { data: { body: 'Ghost comment' } }),
      owner.get(`${API}/tasks/${missingId}/activity`),
      owner.get(`${API}/tasks/abc`),
      owner.get(`${API}/projects/${missingId}/tasks`),
      owner.post(`${API}/projects/${missingId}/tasks`, { data: { title: 'Ghost task' } }),
      owner.get(`${API}/projects/${missingId}/members`),
      owner.patch(`${API}/projects/${missingId}/members/1`, { data: { role: 'MEMBER' } }),
    ]);
    for (const res of checks) {
      await expectError(res, 404, 'NOT_FOUND');
    }
    await owner.dispose();
  });

  test('TASK-TC-025 reporter and assignee can both update a task and every change is recorded in activity', async () => {
    const owner = await authedContext(SEED.users.owner);
    const project = await createProject(owner);
    await addMember(owner, project.id, SEED.users.member);
    const created = await createTask(owner, project.id, {
      title: 'Update me',
      assigneeId: SEED.users.member.id,
      priority: 'LOW',
    });
    const task = await created.json();
    expect(task.assignee_name).toBe(SEED.users.member.name);

    const member = await authedContext(SEED.users.member);
    const byAssignee = await member.patch(`${API}/tasks/${task.id}`, {
      data: { title: 'Updated by assignee', priority: 'HIGH', estimatedHours: 2.5 },
    });
    expect(byAssignee.status()).toBe(200);
    const updated = await byAssignee.json();
    expect(updated.title).toBe('Updated by assignee');
    expect(updated.priority).toBe('HIGH');
    expect(updated.estimated_hours).toBe(2.5);
    expect(updated.updated_at >= updated.created_at).toBe(true);

    const activity = await member.get(`${API}/tasks/${task.id}/activity`);
    const activityBody = await activity.json();
    const updateRow = activityBody.data.find((row: { action: string }) => row.action === 'TASK_UPDATED');
    expect(updateRow).toBeTruthy();
    expect(updateRow.actor_id).toBe(SEED.users.member.id);
    expect(updateRow.detail.changes.title).toEqual({ from: 'Update me', to: 'Updated by assignee' });
    expect(updateRow.detail.changes.priority).toEqual({ from: 'LOW', to: 'HIGH' });

    const byReporter = await owner.patch(`${API}/tasks/${task.id}`, { data: { description: 'Reporter touched this' } });
    expect(byReporter.status()).toBe(200);
    expect((await byReporter.json()).description).toBe('Reporter touched this');

    // a no-op update returns 200 without writing an activity row
    const activityBefore = (await (await owner.get(`${API}/tasks/${task.id}/activity`)).json()).total;
    const noop = await owner.patch(`${API}/tasks/${task.id}`, { data: { description: 'Reporter touched this' } });
    expect(noop.status()).toBe(200);
    const activityAfter = (await (await owner.get(`${API}/tasks/${task.id}/activity`)).json()).total;
    expect(activityAfter).toBe(activityBefore);

    await owner.dispose();
    await member.dispose();
  });

  test('TASK-TC-026 an unrelated member cannot update or delete; the reporter can delete', async () => {
    const owner = await authedContext(SEED.users.owner);
    const project = await createProject(owner);
    await addMember(owner, project.id, SEED.users.member);
    await addMember(owner, project.id, SEED.users.outsider);
    const created = await createTask(owner, project.id, {
      title: 'Guarded task',
      assigneeId: SEED.users.member.id,
    });
    const task = await created.json();

    const bystander = await authedContext(SEED.users.outsider);
    await expectError(await bystander.patch(`${API}/tasks/${task.id}`, { data: { title: 'Hijack' } }), 403, 'FORBIDDEN');
    await expectError(
      await bystander.patch(`${API}/tasks/${task.id}/status`, { data: { status: 'IN_PROGRESS' } }),
      403,
      'FORBIDDEN'
    );
    await expectError(await bystander.delete(`${API}/tasks/${task.id}`), 403, 'FORBIDDEN');

    // the assignee is not the reporter: no delete right
    const assignee = await authedContext(SEED.users.member);
    await expectError(await assignee.delete(`${API}/tasks/${task.id}`), 403, 'FORBIDDEN');

    const deleted = await owner.delete(`${API}/tasks/${task.id}`);
    expect(deleted.status()).toBe(204);
    await expectError(await owner.get(`${API}/tasks/${task.id}`), 404);

    for (const ctx of [owner, bystander, assignee]) await ctx.dispose();
  });
});
