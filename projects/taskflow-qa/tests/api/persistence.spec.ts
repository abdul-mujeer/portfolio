import { test, expect } from '@playwright/test';
import { API, SEED, authedContext, login, newApiContext, uniqueKey } from '../helpers/api';

test.describe('Health & persistence', () => {
  test('TASK-TC-047 health endpoints are public and report database connectivity', async ({ request }) => {
    const v1 = await request.get(`${API}/health`);
    expect(v1.status()).toBe(200);
    const body = await v1.json();
    expect(body.status).toBe('ok');
    expect(body.service).toBe('taskflow-api');
    expect(body.database).toBe('ok');
    expect(Number.isNaN(Date.parse(body.time))).toBe(false);

    // CI/orchestrator alias
    const alias = await request.get('/api/health');
    expect(alias.status()).toBe(200);
    expect((await alias.json()).status).toBe('ok');
  });

  test('TASK-TC-048 writes persist across sessions and logins (file-backed storage)', async () => {
    const owner = await authedContext(SEED.users.owner);
    const key = uniqueKey();
    const project = await (
      await owner.post(`${API}/projects`, { data: { key, name: `Persistence ${key}` } })
    ).json();
    const task = await (
      await owner.post(`${API}/projects/${project.id}/tasks`, {
        data: { title: 'Persisted task', priority: 'HIGH', estimatedHours: 3.5 },
      })
    ).json();
    await owner.post(`${API}/tasks/${task.id}/comments`, { data: { body: 'Persisted comment' } });
    await owner.post(`${API}/auth/logout`);
    await owner.dispose();

    // a completely new session sees the same data
    const second = await newApiContext();
    await login(second, SEED.users.owner);
    const projectAgain = await second.get(`${API}/projects/${project.id}`);
    expect(projectAgain.status()).toBe(200);
    expect((await projectAgain.json()).task_count).toBe(1);

    const taskAgain = await second.get(`${API}/tasks/${task.id}`);
    expect(taskAgain.status()).toBe(200);
    const taskBody = await taskAgain.json();
    expect(taskBody.title).toBe('Persisted task');
    expect(taskBody.priority).toBe('HIGH');
    expect(taskBody.estimated_hours).toBe(3.5);
    expect(taskBody.comment_count).toBe(1);

    const comments = await (await second.get(`${API}/tasks/${task.id}/comments`)).json();
    expect(comments.data.map((c: { body: string }) => c.body)).toEqual(['Persisted comment']);

    const list = await (await second.get(`${API}/projects?limit=100`)).json();
    expect(list.data.map((p: { id: number }) => p.id)).toContain(project.id);
    await second.dispose();
  });
});
