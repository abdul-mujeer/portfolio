import { test, expect } from '@playwright/test';
import { API, SEED, authedContext, expectError, uniqueKey } from '../helpers/api';

async function freshTask(ctx: Awaited<ReturnType<typeof authedContext>>, title = 'Workflow task') {
  const key = uniqueKey();
  const project = await (
    await ctx.post(`${API}/projects`, { data: { key, name: `Workflow ${key}` } })
  ).json();
  const task = await (
    await ctx.post(`${API}/projects/${project.id}/tasks`, { data: { title } })
  ).json();
  return { project, task };
}

test.describe('Status workflow', () => {
  test('TASK-TC-027 @smoke happy path TODO -> IN_PROGRESS -> IN_REVIEW -> DONE with activity per step', async () => {
    const owner = await authedContext(SEED.users.owner);
    const { task } = await freshTask(owner, 'Walk the workflow');

    for (const status of ['IN_PROGRESS', 'IN_REVIEW', 'DONE']) {
      const res = await owner.patch(`${API}/tasks/${task.id}/status`, { data: { status } });
      expect(res.status(), `transition to ${status}`).toBe(200);
      expect((await res.json()).status).toBe(status);
    }

    const activity = await (await owner.get(`${API}/tasks/${task.id}/activity`)).json();
    const transitions = activity.data.filter((row: { action: string }) => row.action === 'TASK_STATUS_CHANGED');
    expect(transitions).toHaveLength(3);
    // newest first
    expect(transitions[0].detail).toEqual({ from: 'IN_REVIEW', to: 'DONE' });
    expect(transitions[2].detail).toEqual({ from: 'TODO', to: 'IN_PROGRESS' });
    await owner.dispose();
  });

  test('TASK-TC-028 @regression DONE and CANCELED are terminal: every further transition is 422', async () => {
    const owner = await authedContext(SEED.users.owner);
    const { task } = await freshTask(owner, 'Terminal task');
    for (const status of ['IN_PROGRESS', 'IN_REVIEW', 'DONE']) {
      expect((await owner.patch(`${API}/tasks/${task.id}/status`, { data: { status } })).status()).toBe(200);
    }
    for (const status of ['TODO', 'IN_PROGRESS', 'CANCELED']) {
      const res = await owner.patch(`${API}/tasks/${task.id}/status`, { data: { status } });
      await expectError(res, 422, 'INVALID_STATUS_TRANSITION');
    }

    const { task: cancelable } = await freshTask(owner, 'Cancel me');
    expect(
      (await owner.patch(`${API}/tasks/${cancelable.id}/status`, { data: { status: 'CANCELED' } })).status()
    ).toBe(200);
    for (const status of ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE']) {
      await expectError(
        await owner.patch(`${API}/tasks/${cancelable.id}/status`, { data: { status } }),
        422,
        'INVALID_STATUS_TRANSITION'
      );
    }
    await owner.dispose();
  });

  test('TASK-TC-029 skipped jumps are 422, unknown statuses are 400 and a same-status update is a 200 no-op', async () => {
    const owner = await authedContext(SEED.users.owner);
    const { task } = await freshTask(owner, 'No shortcuts');
    await expectError(
      await owner.patch(`${API}/tasks/${task.id}/status`, { data: { status: 'DONE' } }),
      422,
      'INVALID_STATUS_TRANSITION'
    );
    await expectError(
      await owner.patch(`${API}/tasks/${task.id}/status`, { data: { status: 'IN_REVIEW' } }),
      422
    );
    await expectError(
      await owner.patch(`${API}/tasks/${task.id}/status`, { data: { status: 'BLOCKED' } }),
      400,
      'VALIDATION_ERROR'
    );

    const before = (await (await owner.get(`${API}/tasks/${task.id}/activity`)).json()).total;
    const noop = await owner.patch(`${API}/tasks/${task.id}/status`, { data: { status: 'TODO' } });
    expect(noop.status()).toBe(200);
    expect((await noop.json()).status).toBe('TODO');
    const after = (await (await owner.get(`${API}/tasks/${task.id}/activity`)).json()).total;
    expect(after).toBe(before);
    await owner.dispose();
  });
});
