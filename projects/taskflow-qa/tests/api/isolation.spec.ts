import { test, expect } from '@playwright/test';
import { API, SEED, authedContext, expectError } from '../helpers/api';

const { TASK, OPS, ARCH } = SEED.projects;

test.describe('Cross-project isolation', () => {
  test('TASK-TC-039 @regression non-members cannot read anything from a project they do not belong to (404)', async () => {
    const outsider = await authedContext(SEED.users.outsider);
    const reads = await Promise.all([
      outsider.get(`${API}/projects/${TASK}`),
      outsider.get(`${API}/projects/${TASK}/tasks`),
      outsider.get(`${API}/projects/${TASK}/members`),
      outsider.get(`${API}/projects/${TASK}/activity`),
      outsider.get(`${API}/tasks/${SEED.tasks.ciPipeline}`),
      outsider.get(`${API}/tasks/${SEED.tasks.ciPipeline}/comments`),
      outsider.get(`${API}/tasks/${SEED.tasks.ciPipeline}/activity`),
    ]);
    for (const res of reads) {
      await expectError(res, 404, 'NOT_FOUND');
    }

    // user with no memberships sees nothing either - even for projects that exist
    const noprojects = await authedContext(SEED.users.noprojects);
    await expectError(await noprojects.get(`${API}/projects/${TASK}`), 404);
    await expectError(await noprojects.get(`${API}/projects/${OPS}`), 404);
    await expectError(await noprojects.get(`${API}/tasks/${SEED.tasks.archived}`), 404);

    await outsider.dispose();
    await noprojects.dispose();
  });

  test('TASK-TC-040 non-members cannot mutate anything from a project they do not belong to (404)', async () => {
    const outsider = await authedContext(SEED.users.outsider);
    const writes = await Promise.all([
      outsider.post(`${API}/projects/${TASK}/tasks`, { data: { title: 'Injected task' } }),
      outsider.patch(`${API}/tasks/${SEED.tasks.ciPipeline}`, { data: { title: 'Injected update' } }),
      outsider.patch(`${API}/tasks/${SEED.tasks.ciPipeline}/status`, { data: { status: 'DONE' } }),
      outsider.delete(`${API}/tasks/${SEED.tasks.ciPipeline}`),
      outsider.post(`${API}/tasks/${SEED.tasks.ciPipeline}/comments`, { data: { body: 'Injected comment' } }),
      outsider.patch(`${API}/projects/${TASK}`, { data: { name: 'Injected rename' } }),
      outsider.delete(`${API}/projects/${TASK}`),
      outsider.post(`${API}/projects/${TASK}/members`, {
        data: { email: SEED.users.noprojects.email, role: 'ADMIN' },
      }),
      outsider.post(`${API}/projects/${TASK}/archive`),
      outsider.post(`${API}/projects/${TASK}/transfer`, { data: { userId: SEED.users.outsider.id } }),
    ]);
    for (const res of writes) {
      await expectError(res, 404, 'NOT_FOUND');
    }

    // nothing was changed by the attempts
    const owner = await authedContext(SEED.users.owner);
    const task = await (await owner.get(`${API}/tasks/${SEED.tasks.ciPipeline}`)).json();
    expect(task.title).toBe('Set up CI pipeline for the API');
    expect(task.status).toBe('TODO');
    const project = await (await owner.get(`${API}/projects/${TASK}`)).json();
    expect(project.name).toBe('TaskFlow Platform');
    expect(project.archived).toBe(false);

    await outsider.dispose();
    await owner.dispose();
  });

  test('TASK-TC-041 every user sees exactly their own project scope', async () => {
    // outsider: member of OPS only
    const outsider = await authedContext(SEED.users.outsider);
    const ops = await outsider.get(`${API}/projects/${OPS}`);
    expect(ops.status()).toBe(200);
    expect((await ops.json()).my_role).toBe('MEMBER');
    const opsTasks = await (await outsider.get(`${API}/projects/${OPS}/tasks?limit=100`)).json();
    expect(opsTasks.total).toBe(4);
    await expectError(await outsider.get(`${API}/projects/${TASK}`), 404);

    // member: TASK + ARCH (archived reads still work)
    const member = await authedContext(SEED.users.member);
    expect((await member.get(`${API}/projects/${TASK}`)).status()).toBe(200);
    const arch = await member.get(`${API}/projects/${ARCH}`);
    expect(arch.status()).toBe(200);
    expect((await arch.json()).archived).toBe(true);
    await expectError(await member.get(`${API}/projects/${OPS}`), 404);

    // user without memberships has an empty list and an empty report
    const noprojects = await authedContext(SEED.users.noprojects);
    expect((await (await noprojects.get(`${API}/projects`)).json()).data).toEqual([]);
    const report = await noprojects.get(`${API}/reports/overdue`);
    expect(report.status()).toBe(200);
    expect((await report.json()).count).toBe(0);

    for (const ctx of [outsider, member, noprojects]) await ctx.dispose();
  });
});
