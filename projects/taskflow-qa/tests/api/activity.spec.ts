import { test, expect } from '@playwright/test';
import { API, SEED, authedContext, expectError, uniqueKey } from '../helpers/api';

test.describe('Activity feeds', () => {
  test('TASK-TC-032 project activity is newest-first, paginated and carries actor names and JSON details', async () => {
    const owner = await authedContext(SEED.users.owner);
    const feed = await owner.get(`${API}/projects/${SEED.projects.TASK}/activity?limit=5`);
    expect(feed.status()).toBe(200);
    const body = await feed.json();
    expect(body.data).toHaveLength(5);
    expect(Number(feed.headers()['x-total-count'])).toBe(body.total);
    expect(body.total).toBeGreaterThan(20);
    for (const row of body.data) {
      expect(row.actor_name).toBeTruthy();
      expect(typeof row.detail).toBe('object');
      expect(typeof row.created_at).toBe('string');
    }
    const timestamps = body.data.map((row: { created_at: string }) => row.created_at);
    expect([...timestamps].sort().reverse()).toEqual(timestamps);

    const page2 = await (await owner.get(`${API}/projects/${SEED.projects.TASK}/activity?limit=5&page=2`)).json();
    const ids1 = body.data.map((row: { id: number }) => row.id);
    const ids2 = page2.data.map((row: { id: number }) => row.id);
    expect(ids1.some((id: number) => ids2.includes(id))).toBe(false);

    await expectError(await owner.get(`${API}/projects/${SEED.projects.TASK}/activity?limit=0`), 400);
    await owner.dispose();
  });

  test('TASK-TC-033 task activity records create, update, status change and comments with side-effect details', async () => {
    const owner = await authedContext(SEED.users.owner);
    const key = uniqueKey();
    const project = await (
      await owner.post(`${API}/projects`, { data: { key, name: `Activity ${key}` } })
    ).json();
    const task = await (
      await owner.post(`${API}/projects/${project.id}/tasks`, { data: { title: 'Audited task' } })
    ).json();
    await owner.patch(`${API}/tasks/${task.id}`, { data: { priority: 'HIGH' } });
    await owner.patch(`${API}/tasks/${task.id}/status`, { data: { status: 'IN_PROGRESS' } });
    await owner.post(`${API}/tasks/${task.id}/comments`, { data: { body: 'Audit me' } });

    const activity = await owner.get(`${API}/tasks/${task.id}/activity?limit=50`);
    expect(activity.status()).toBe(200);
    const rows = (await activity.json()).data;
    const actions = rows.map((row: { action: string }) => row.action);
    expect(actions).toEqual(
      expect.arrayContaining(['TASK_CREATED', 'TASK_UPDATED', 'TASK_STATUS_CHANGED', 'COMMENT_ADDED'])
    );
    const statusRow = rows.find((row: { action: string }) => row.action === 'TASK_STATUS_CHANGED');
    expect(statusRow.detail).toEqual({ from: 'TODO', to: 'IN_PROGRESS' });
    const updateRow = rows.find((row: { action: string }) => row.action === 'TASK_UPDATED');
    expect(updateRow.detail.changes.priority).toEqual({ from: 'MEDIUM', to: 'HIGH' });

    // non-members cannot read the task feed
    const outsider = await authedContext(SEED.users.outsider);
    await expectError(await outsider.get(`${API}/tasks/${task.id}/activity`), 404);
    await owner.dispose();
    await outsider.dispose();
  });
});
