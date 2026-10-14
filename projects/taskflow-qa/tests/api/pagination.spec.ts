import { test, expect } from '@playwright/test';
import { API, SEED, authedContext, expectError, expectedOverdueIds, today } from '../helpers/api';

const TASKS = SEED.projects.TASK;

test.describe('Pagination, filtering and sorting', () => {
  test('TASK-TC-034 @smoke default pagination returns limit 20 with X-Total-Count and stable non-overlapping pages', async () => {
    const owner = await authedContext(SEED.users.owner);
    const first = await owner.get(`${API}/projects/${TASKS}/tasks`);
    expect(first.status()).toBe(200);
    const body = await first.json();
    expect(body.limit).toBe(20);
    expect(body.page).toBe(1);
    expect(body.total).toBe(SEED.taskStatusCounts.total);
    expect(body.data).toHaveLength(SEED.taskStatusCounts.total);
    expect(first.headers()['x-total-count']).toBe(String(SEED.taskStatusCounts.total));

    const ids: number[] = [];
    for (const page of [1, 2, 3]) {
      const res = await owner.get(`${API}/projects/${TASKS}/tasks?limit=5&page=${page}&sort=id&order=asc`);
      expect(res.status()).toBe(200);
      const pageBody = await res.json();
      expect(pageBody.data.length).toBe(page === 3 ? 2 : 5);
      ids.push(...pageBody.data.map((t: { id: number }) => t.id));
    }
    expect(ids).toHaveLength(12);
    expect(new Set(ids).size).toBe(12); // no duplicates across pages
    await owner.dispose();
  });

  test('TASK-TC-035 @regression invalid page/limit values are 400 and out-of-range pages return empty data with the real total', async () => {
    const owner = await authedContext(SEED.users.owner);
    for (const query of [
      'limit=101',
      'limit=0',
      'limit=-5',
      'limit=abc',
      'limit=1.5',
      'page=0',
      'page=-1',
      'page=abc',
      'limit=',
    ]) {
      const res = await owner.get(`${API}/projects/${TASKS}/tasks?${query}`);
      await expectError(res, 400, 'VALIDATION_ERROR');
    }
    const beyond = await owner.get(`${API}/projects/${TASKS}/tasks?page=99&limit=20`);
    expect(beyond.status()).toBe(200);
    const beyondBody = await beyond.json();
    expect(beyondBody.data).toEqual([]);
    expect(beyondBody.total).toBe(12);
    expect(beyond.headers()['x-total-count']).toBe('12');
    await owner.dispose();
  });

  test('TASK-TC-036 status, priority and assignee filters narrow the seeded task list', async () => {
    const owner = await authedContext(SEED.users.owner);
    const base = `${API}/projects/${TASKS}/tasks?sort=id&order=asc&limit=100`;

    const inProgress = await (await owner.get(`${base}&status=IN_PROGRESS`)).json();
    expect(inProgress.total).toBe(2);
    expect(inProgress.data.map((t: { id: number }) => t.id)).toEqual([3, 10]);

    const critical = await (await owner.get(`${base}&priority=CRITICAL`)).json();
    expect(critical.total).toBe(1);
    expect(critical.data[0].id).toBe(3);

    // TODO + LOW covers the two seeded low-priority todo tasks (4 and 11)
    const todoLow = await (await owner.get(`${base}&status=TODO&priority=LOW`)).json();
    expect(todoLow.data.map((t: { id: number }) => t.id)).toEqual([4, 11]);

    const highPriority = await (await owner.get(`${base}&priority=HIGH`)).json();
    expect(highPriority.total).toBe(3);

    const assignee = await (await owner.get(`${base}&assigneeId=${SEED.users.member.id}`)).json();
    expect(assignee.total).toBe(4);
    expect(assignee.data.every((t: { assignee_id: number }) => t.assignee_id === SEED.users.member.id)).toBe(true);

    // a valid user who is not a member simply matches nothing
    const nonMember = await (await owner.get(`${base}&assigneeId=${SEED.users.noprojects.id}`)).json();
    expect(nonMember.total).toBe(0);
    await expectError(await owner.get(`${base}&assigneeId=abc`), 400);
    await owner.dispose();
  });

  test('TASK-TC-037 text search is case-insensitive and escapes LIKE wildcards', async () => {
    const owner = await authedContext(SEED.users.owner);
    const base = `${API}/projects/${TASKS}/tasks?limit=100&sort=id&order=asc`;

    const lower = await (await owner.get(`${base}&q=authen`)).json();
    expect(lower.total).toBe(1);
    expect(lower.data[0].id).toBe(SEED.tasks.sessionAuth);

    const upper = await (await owner.get(`${base}&q=AUTHENTICATION`)).json();
    expect(upper.total).toBe(1);
    expect(upper.data[0].id).toBe(SEED.tasks.sessionAuth);

    const descriptionHit = await (await owner.get(`${base}&q=scrypt`)).json();
    expect(descriptionHit.total).toBe(1);

    const noHit = await (await owner.get(`${base}&q=zzz-nothing-matches`)).json();
    expect(noHit.total).toBe(0);

    // wildcard characters are escaped and matched literally: "%" appears in no
    // seeded text (0 hits), "_" appears once - in task 8's description
    // ("detail_json") - so a broken escape would match all 12 rows instead.
    expect((await (await owner.get(`${base}&q=%25`)).json()).total).toBe(0);
    const underscore = await (await owner.get(`${base}&q=_`)).json();
    expect(underscore.total).toBe(1);
    expect(underscore.data[0].id).toBe(8);

    await expectError(await owner.get(`${base}&q=${'x'.repeat(201)}`), 400);
    await owner.dispose();
  });

  test('TASK-TC-038 dueBefore and overdue filters follow the documented overdue rule, and sorting is validated', async () => {
    const owner = await authedContext(SEED.users.owner);
    const base = `${API}/projects/${TASKS}/tasks?limit=100`;

    // derive expectations from the actual seeded rows so the suite stays correct
    // even if the run crosses UTC midnight after the database reset
    const all = await (await owner.get(`${base}&sort=id&order=asc`)).json();
    const todayIso = today();
    const derivedOverdue = expectedOverdueIds(all.data);
    expect(derivedOverdue.length).toBeGreaterThanOrEqual(3); // the 3 seeded overdue tasks (4, 3, 10)
    expect(derivedOverdue).toEqual(expect.arrayContaining([3, 4, 10]));

    const overdue = await (await owner.get(`${base}&overdue=true&sort=id&order=asc`)).json();
    expect(overdue.total).toBe(derivedOverdue.length);
    expect(overdue.data.map((t: { id: number }) => t.id).sort((a: number, b: number) => a - b)).toEqual(
      derivedOverdue
    );
    expect(overdue.data.every((t: { overdue: boolean }) => t.overdue === true)).toBe(true);

    const derivedOverdueInProgress = all.data
      .filter(
        (t: { status: string; due_date: string | null }) =>
          t.status === 'IN_PROGRESS' && t.due_date !== null && t.due_date < todayIso
      )
      .map((t: { id: number }) => t.id)
      .sort((a: number, b: number) => a - b);
    const overdueInProgress = await (
      await owner.get(`${base}&overdue=true&status=IN_PROGRESS&sort=id&order=asc`)
    ).json();
    expect(overdueInProgress.data.map((t: { id: number }) => t.id)).toEqual(derivedOverdueInProgress);

    const derivedDueBefore = all.data
      .filter((t: { due_date: string | null }) => t.due_date !== null && t.due_date < todayIso)
      .map((t: { id: number }) => t.id)
      .sort((a: number, b: number) => a - b);
    const dueBeforeToday = await (await owner.get(`${base}&dueBefore=${todayIso}&sort=id&order=asc`)).json();
    expect(dueBeforeToday.data.map((t: { id: number }) => t.id)).toEqual(derivedDueBefore);

    const derivedDueBeforeTodo = all.data
      .filter(
        (t: { status: string; due_date: string | null }) =>
          t.status === 'TODO' && t.due_date !== null && t.due_date < todayIso
      )
      .map((t: { id: number }) => t.id)
      .sort((a: number, b: number) => a - b);
    const dueBeforeTodo = await (
      await owner.get(`${base}&dueBefore=${todayIso}&status=TODO&sort=id&order=asc`)
    ).json();
    expect(dueBeforeTodo.data.map((t: { id: number }) => t.id)).toEqual(derivedDueBeforeTodo);

    const byTitle = await (await owner.get(`${base}&sort=title&order=asc`)).json();
    const titles = byTitle.data.map((t: { title: string }) => t.title);
    expect(titles).toEqual(
      [...titles].sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : a.toLowerCase() > b.toLowerCase() ? 1 : 0))
    );

    // base URL already carries limit=100, so do not repeat query keys
    const byPriority = await (await owner.get(`${base}&sort=priority&order=desc`)).json();
    expect(byPriority.data[0].priority).toBe('CRITICAL');

    const byDueAsc = await (await owner.get(`${base}&sort=due_date&order=asc`)).json();
    const dues = byDueAsc.data
      .map((t: { due_date: string | null }) => t.due_date)
      .filter((d: string | null): d is string => d !== null);
    expect(dues).toEqual([...dues].sort());

    await expectError(await owner.get(`${base}&sort=bogus`), 400);
    await expectError(await owner.get(`${base}&order=sideways`), 400);
    await owner.dispose();
  });
});
