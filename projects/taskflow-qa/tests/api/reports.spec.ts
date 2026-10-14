import { test, expect } from '@playwright/test';
import { API, SEED, authedContext, expectedOverdueIds, today } from '../helpers/api';

const TASKS = SEED.projects.TASK;

async function ownerTaskList(ctx: Awaited<ReturnType<typeof authedContext>>) {
  const res = await ctx.get(`${API}/projects/${TASKS}/tasks?limit=100&sort=id&order=asc`);
  expect(res.status()).toBe(200);
  return (await res.json()).data as Array<{ id: number; status: string; due_date: string | null }>;
}

test.describe('Overdue report', () => {
  test('TASK-TC-042 @smoke the overdue report returns the right counts, task list and excludes archived projects', async () => {
    const owner = await authedContext(SEED.users.owner);

    // Derive the expected overdue ids from the API itself (the rule is
    // verified by the filter suite) so this test is immune to UTC day rollover
    // between the database reset and the assertions.
    const allTasks = await ownerTaskList(owner);
    const expectedIds = expectedOverdueIds(allTasks);
    expect(expectedIds.length).toBeGreaterThanOrEqual(3); // seeded: tasks 4, 3, 10
    expect(expectedIds).toEqual(expect.arrayContaining([3, 4, 10]));

    const res = await owner.get(`${API}/reports/overdue`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.count).toBe(expectedIds.length);
    expect(body.total).toBe(expectedIds.length);
    expect(res.headers()['x-total-count']).toBe(String(expectedIds.length));

    const ids = body.data.map((t: { id: number }) => t.id).sort((a: number, b: number) => a - b);
    expect(ids).toEqual(expectedIds);
    for (const task of body.data) {
      expect(task.project_key).toBe('TASK');
      expect(task.title).toBeTruthy();
      expect(['TODO', 'IN_PROGRESS', 'IN_REVIEW']).toContain(task.status);
      expect(task.due_date < today()).toBe(true);
    }

    expect(body.byProject).toEqual([
      expect.objectContaining({ project_id: TASKS, project_key: 'TASK', count: expectedIds.length }),
    ]);
    expect(body.byProject.some((p: { project_key: string }) => p.project_key === 'ARCH')).toBe(false);

    // boundary: the seeded due-today task is overdue only if its due date is
    // already in the past (i.e. the run crossed UTC midnight since seeding)
    const dueTodayTask = allTasks.find((t) => t.id === SEED.tasks.dueToday);
    expect(dueTodayTask).toBeTruthy();
    expect(ids.includes(SEED.tasks.dueToday)).toBe(dueTodayTask!.due_date! < today());

    // archived tasks 17/18 are overdue by date but excluded via the project flag
    const archivedOverdue = await owner.get(`${API}/projects/${SEED.projects.ARCH}/tasks?overdue=true&limit=100`);
    expect(archivedOverdue.status()).toBe(200);
    expect((await archivedOverdue.json()).total).toBeGreaterThanOrEqual(2); // they exist in the archived project...
    expect(ids).not.toContain(SEED.tasks.archived); // ...but never in the report

    // pagination is supported
    const page1 = await (await owner.get(`${API}/reports/overdue?limit=2&page=1`)).json();
    const page2 = await (await owner.get(`${API}/reports/overdue?limit=2&page=2`)).json();
    expect(page1.data).toHaveLength(2);
    expect(page2.data).toHaveLength(expectedIds.length - 2);
    expect(page2.total).toBe(expectedIds.length);
    await owner.dispose();
  });

  test('TASK-TC-043 the overdue report respects membership scope', async () => {
    const owner = await authedContext(SEED.users.owner);
    const expectedCount = expectedOverdueIds(await ownerTaskList(owner)).length;

    const admin = await authedContext(SEED.users.admin); // TASK + OPS
    expect((await (await admin.get(`${API}/reports/overdue`)).json()).count).toBe(expectedCount);

    const outsider = await authedContext(SEED.users.outsider); // OPS only, nothing overdue
    const outsiderBody = await (await outsider.get(`${API}/reports/overdue`)).json();
    expect(outsiderBody.count).toBe(0);
    expect(outsiderBody.byProject).toEqual([]);

    const member = await authedContext(SEED.users.member); // TASK + ARCH
    expect((await (await member.get(`${API}/reports/overdue`)).json()).count).toBe(expectedCount);

    for (const ctx of [owner, admin, outsider, member]) await ctx.dispose();
  });
});
