import { test, expect } from '@playwright/test';
import {
  API,
  SEED,
  FRESH_PASSWORD,
  authedContext,
  expectError,
  newApiContext,
  registerUser,
  uniqueKey,
} from '../helpers/api';

async function createProject(ctx: Awaited<ReturnType<typeof authedContext>>, overrides = {}) {
  const key = uniqueKey();
  const res = await ctx.post(`${API}/projects`, {
    data: { key, name: `QA Project ${key}`, description: 'Created by the API suite', ...overrides },
  });
  expect(res.status(), 'create project').toBe(201);
  return res.json();
}

test.describe('Projects', () => {
  test('TASK-TC-006 @smoke creating a project returns 201, makes the caller OWNER and lists it for them only', async () => {
    const owner = await authedContext(SEED.users.owner);
    const project = await createProject(owner);
    expect(project.my_role).toBe('OWNER');
    expect(project.member_count).toBe(1);
    expect(project.task_count).toBe(0);
    expect(project.archived).toBe(false);

    const list = await owner.get(`${API}/projects?limit=100`);
    expect(list.status()).toBe(200);
    expect((await list.json()).data.map((p: { id: number }) => p.id)).toContain(project.id);

    // a genuinely fresh user becomes OWNER of their own project...
    const freshReg = await registerUser(owner);
    const fresh = await newApiContext();
    const freshLogin = await fresh.post(`${API}/auth/login`, {
      data: { email: freshReg.email, password: FRESH_PASSWORD },
    });
    expect(freshLogin.status()).toBe(200);
    const freshProject = await createProject(fresh);

    // ...and that project is invisible to the seed owner
    const outsiderView = await owner.get(`${API}/projects/${freshProject.id}`);
    await expectError(outsiderView, 404);

    await owner.dispose();
    await fresh.dispose();
  });

  test('TASK-TC-007 duplicate and malformed project keys are rejected (409 / 400)', async () => {
    const owner = await authedContext(SEED.users.owner);
    const duplicate = await owner.post(`${API}/projects`, {
      data: { key: 'TASK', name: 'Duplicate key attempt' },
    });
    await expectError(duplicate, 409, 'PROJECT_KEY_TAKEN');

    const existing = await createProject(owner);
    const duplicateOfOwn = await owner.post(`${API}/projects`, {
      data: { key: existing.key, name: 'Same key again' },
    });
    await expectError(duplicateOfOwn, 409, 'PROJECT_KEY_TAKEN');

    for (const key of ['task', 'A', 'ABCDEFG', 'AB1', 'A-B', '']) {
      const res = await owner.post(`${API}/projects`, { data: { key, name: 'Bad key' } });
      await expectError(res, 400, 'VALIDATION_ERROR');
    }
    await owner.dispose();
  });

  test('TASK-TC-008 project list is scoped to the caller, paginated and filterable by archived', async () => {
    const owner = await authedContext(SEED.users.owner);
    const all = await owner.get(`${API}/projects?limit=100`);
    expect(all.status()).toBe(200);
    const allBody = await all.json();
    const keys = allBody.data.map((p: { key: string }) => p.key);
    expect(keys).toEqual(expect.arrayContaining(['TASK', 'OPS', 'ARCH']));
    expect(all.headers()['x-total-count']).toBe(String(allBody.total));
    expect(allBody.data.find((p: { key: string }) => p.key === 'ARCH').archived).toBe(true);

    const active = await owner.get(`${API}/projects?archived=false&limit=100`);
    const activeKeys = (await active.json()).data.map((p: { key: string }) => p.key);
    expect(activeKeys).not.toContain('ARCH');
    expect(activeKeys).toEqual(expect.arrayContaining(['TASK', 'OPS']));

    const archived = await owner.get(`${API}/projects?archived=true&limit=100`);
    const archivedKeys = (await archived.json()).data.map((p: { key: string }) => p.key);
    expect(archivedKeys).toEqual(['ARCH']);

    // outsider sees only their own project; user without projects sees an empty scope
    const outsider = await authedContext(SEED.users.outsider);
    const outsiderBody = await (await outsider.get(`${API}/projects?limit=100`)).json();
    expect(outsiderBody.data.map((p: { key: string }) => p.key)).toEqual(['OPS']);

    const noprojects = await authedContext(SEED.users.noprojects);
    const emptyList = await noprojects.get(`${API}/projects?limit=100`);
    expect(emptyList.status()).toBe(200);
    expect(emptyList.headers()['x-total-count']).toBe('0');
    expect((await emptyList.json()).data).toEqual([]);

    for (const ctx of [owner, outsider, noprojects]) await ctx.dispose();
  });

  test('TASK-TC-009 project endpoints are hidden from non-members with 404 (not 403)', async () => {
    const outsider = await authedContext(SEED.users.outsider);
    const TASK = SEED.projects.TASK;
    const requests = [
      outsider.get(`${API}/projects/${TASK}`),
      outsider.patch(`${API}/projects/${TASK}`, { data: { name: 'Hijack attempt' } }),
      outsider.delete(`${API}/projects/${TASK}`),
      outsider.get(`${API}/projects/${TASK}/members`),
      outsider.get(`${API}/projects/${TASK}/tasks`),
      outsider.get(`${API}/projects/${TASK}/activity`),
      outsider.post(`${API}/projects/${TASK}/archive`),
      outsider.get(`${API}/projects/999999`),
    ];
    for (const res of await Promise.all(requests)) {
      await expectError(res, 404, 'NOT_FOUND');
    }
    await outsider.dispose();
  });

  test('TASK-TC-010 rename requires OWNER/ADMIN: MEMBER gets 403, ADMIN succeeds and updates updated_at', async () => {
    const owner = await authedContext(SEED.users.owner);
    const project = await createProject(owner);
    for (const [email, role] of [
      [SEED.users.admin.email, 'ADMIN'],
      [SEED.users.member.email, 'MEMBER'],
    ] as const) {
      const added = await owner.post(`${API}/projects/${project.id}/members`, { data: { email, role } });
      expect(added.status()).toBe(201);
    }

    const member = await authedContext(SEED.users.member);
    const denied = await member.patch(`${API}/projects/${project.id}`, { data: { name: 'Member rename' } });
    await expectError(denied, 403, 'FORBIDDEN');

    const admin = await authedContext(SEED.users.admin);
    const renamed = await admin.patch(`${API}/projects/${project.id}`, {
      data: { name: 'Renamed by admin' },
    });
    expect(renamed.status()).toBe(200);
    const renamedBody = await renamed.json();
    expect(renamedBody.name).toBe('Renamed by admin');
    expect(renamedBody.updated_at >= renamedBody.created_at).toBe(true);

    // empty payload and too-short names are validation errors
    await expectError(await admin.patch(`${API}/projects/${project.id}`, { data: {} }), 400);
    await expectError(
      await admin.patch(`${API}/projects/${project.id}`, { data: { name: 'ab' } }),
      400,
      'VALIDATION_ERROR'
    );

    for (const ctx of [owner, member, admin]) await ctx.dispose();
  });

  test('TASK-TC-011 delete is OWNER-only: ADMIN/MEMBER get 403, OWNER deletes and the project disappears', async () => {
    const owner = await authedContext(SEED.users.owner);
    const project = await createProject(owner);
    await owner.post(`${API}/projects/${project.id}/members`, {
      data: { email: SEED.users.admin.email, role: 'ADMIN' },
    });

    const admin = await authedContext(SEED.users.admin);
    await expectError(await admin.delete(`${API}/projects/${project.id}`), 403, 'FORBIDDEN');

    const del = await owner.delete(`${API}/projects/${project.id}`);
    expect(del.status()).toBe(204);
    await expectError(await owner.get(`${API}/projects/${project.id}`), 404);
    await expectError(await owner.get(`${API}/projects/${project.id}/tasks`), 404);
    await owner.dispose();
    await admin.dispose();
  });

  test('TASK-TC-012 @regression archive: ADMIN can archive, reads stay 200, mutations become 422 and re-archiving is 409', async () => {
    const owner = await authedContext(SEED.users.owner);
    const project = await createProject(owner);
    await owner.post(`${API}/projects/${project.id}/members`, {
      data: { email: SEED.users.admin.email, role: 'ADMIN' },
    });
    const task = await owner.post(`${API}/projects/${project.id}/tasks`, {
      data: { title: 'Task before archive' },
    });
    expect(task.status()).toBe(201);
    const taskId = (await task.json()).id;

    const admin = await authedContext(SEED.users.admin);
    const archived = await admin.post(`${API}/projects/${project.id}/archive`);
    expect(archived.status()).toBe(200);
    expect((await archived.json()).archived).toBe(true);

    // reads still work for members
    expect((await admin.get(`${API}/projects/${project.id}`)).status()).toBe(200);
    expect((await admin.get(`${API}/projects/${project.id}/tasks`)).status()).toBe(200);

    // mutations are rejected with 422 / 409
    const checks = await Promise.all([
      admin.post(`${API}/projects/${project.id}/tasks`, { data: { title: 'Blocked create' } }),
      admin.patch(`${API}/tasks/${taskId}`, { data: { title: 'Blocked update' } }),
      admin.patch(`${API}/tasks/${taskId}/status`, { data: { status: 'IN_PROGRESS' } }),
      admin.post(`${API}/tasks/${taskId}/comments`, { data: { body: 'Blocked comment' } }),
      admin.patch(`${API}/projects/${project.id}`, { data: { name: 'Blocked rename' } }),
      admin.post(`${API}/projects/${project.id}/archive`),
    ]);
    for (const res of checks.slice(0, 5)) {
      await expectError(res, 422, 'ARCHIVED_PROJECT');
    }
    await expectError(checks[5], 409, 'PROJECT_ALREADY_ARCHIVED');

    await owner.dispose();
    await admin.dispose();
  });
});
