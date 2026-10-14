import { test, expect } from '@playwright/test';
import { API, SEED, authedContext, expectError, uniqueKey } from '../helpers/api';

test.describe('Comments', () => {
  test('TASK-TC-030 @smoke posting comments returns 201, lists them in order and logs COMMENT_ADDED activity', async () => {
    const owner = await authedContext(SEED.users.owner);
    const key = uniqueKey();
    const project = await (
      await owner.post(`${API}/projects`, { data: { key, name: `Comments ${key}` } })
    ).json();
    const task = await (
      await owner.post(`${API}/projects/${project.id}/tasks`, { data: { title: 'Discuss this' } })
    ).json();

    const first = await owner.post(`${API}/tasks/${task.id}/comments`, { data: { body: 'First comment' } });
    expect(first.status()).toBe(201);
    const firstBody = await first.json();
    expect(firstBody.task_id).toBe(task.id);
    expect(firstBody.author_id).toBe(SEED.users.owner.id);
    expect(firstBody.author_name).toBe(SEED.users.owner.name);
    expect(firstBody.body).toBe('First comment');

    const second = await owner.post(`${API}/tasks/${task.id}/comments`, { data: { body: 'Second comment' } });
    expect(second.status()).toBe(201);
    const secondBody = await second.json();

    const list = await owner.get(`${API}/tasks/${task.id}/comments?limit=100`);
    expect(list.status()).toBe(200);
    const listBody = await list.json();
    expect(listBody.total).toBe(2);
    expect(list.headers()['x-total-count']).toBe('2');
    expect(listBody.data.map((c: { body: string }) => c.body)).toEqual(['First comment', 'Second comment']);

    // pagination on comments
    const page1 = await owner.get(`${API}/tasks/${task.id}/comments?limit=1&page=1`);
    const page2 = await owner.get(`${API}/tasks/${task.id}/comments?limit=1&page=2`);
    expect((await page1.json()).data).toHaveLength(1);
    expect((await page2.json()).data).toHaveLength(1);
    expect((await page1.json()).data[0].id).not.toBe((await page2.json()).data[0].id);

    // activity rows for both comments
    const activity = await (await owner.get(`${API}/tasks/${task.id}/activity`)).json();
    const commentRows = activity.data.filter((row: { action: string }) => row.action === 'COMMENT_ADDED');
    expect(commentRows).toHaveLength(2);
    const loggedIds = commentRows
      .map((row: { detail: { commentId: number } }) => row.detail.commentId)
      .sort((a: number, b: number) => a - b);
    expect(loggedIds).toEqual([firstBody.id, secondBody.id].sort((a, b) => a - b));

    // the project feed contains them too
    const projectActivity = await (await owner.get(`${API}/projects/${project.id}/activity?limit=50`)).json();
    expect(
      projectActivity.data.some(
        (row: { action: string; task_id: number }) => row.action === 'COMMENT_ADDED' && row.task_id === task.id
      )
    ).toBe(true);
    await owner.dispose();
  });

  test('TASK-TC-031 @regression comment body boundaries and archived/unknown tasks', async () => {
    const owner = await authedContext(SEED.users.owner);
    const key = uniqueKey();
    const project = await (
      await owner.post(`${API}/projects`, { data: { key, name: `Comments edge ${key}` } })
    ).json();
    const task = await (
      await owner.post(`${API}/projects/${project.id}/tasks`, { data: { title: 'Boundary comments' } })
    ).json();

    for (const body of ['', '   ', 'x'.repeat(1001)]) {
      await expectError(await owner.post(`${API}/tasks/${task.id}/comments`, { data: { body } }), 400);
    }
    const max = await owner.post(`${API}/tasks/${task.id}/comments`, { data: { body: 'y'.repeat(1000) } });
    expect(max.status()).toBe(201);
    const padded = await owner.post(`${API}/tasks/${task.id}/comments`, { data: { body: '  padded  ' } });
    expect(padded.status()).toBe(201);
    expect((await padded.json()).body).toBe('padded');

    // archived project: comments blocked (422) but reads stay 200
    await expectError(
      await owner.post(`${API}/tasks/${SEED.tasks.archived}/comments`, { data: { body: 'Archived comment' } }),
      422,
      'ARCHIVED_PROJECT'
    );
    const archivedRead = await owner.get(`${API}/tasks/${SEED.tasks.archived}/comments`);
    expect(archivedRead.status()).toBe(200);
    expect((await archivedRead.json()).total).toBeGreaterThanOrEqual(1);

    // unknown task ids
    await expectError(await owner.get(`${API}/tasks/999999/comments`), 404);
    await expectError(
      await owner.post(`${API}/tasks/999999/comments`, { data: { body: 'Ghost' } }),
      404
    );
    await owner.dispose();
  });
});
