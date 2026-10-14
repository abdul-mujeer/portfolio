import { test, expect } from '@playwright/test';
import { API, SEED, authedContext, expectError, uniqueKey } from '../helpers/api';

test.describe('Security probes', () => {
  test('TASK-TC-044 @regression SQL injection payloads in query params and bodies are handled safely (no 500, data intact)', async () => {
    const owner = await authedContext(SEED.users.owner);
    const key = uniqueKey();
    const project = await (
      await owner.post(`${API}/projects`, { data: { key, name: `Injection ${key}` } })
    ).json();
    const base = `${API}/projects/${project.id}/tasks?limit=100`;

    const payloads = [
      "' OR 1=1 --",
      "%'; DROP TABLE tasks;--",
      "1; DELETE FROM tasks WHERE 1=1;--",
      "' UNION SELECT * FROM users --",
    ];
    for (const payload of payloads) {
      const res = await owner.get(`${base}&q=${encodeURIComponent(payload)}`);
      expect(res.status(), `payload: ${payload}`).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body.data)).toBe(true);
      // parameterized LIKE search matches nothing here and never returns the whole table
      expect(body.total).toBe(0);
    }

    // a SQL-looking *title* is legitimate data: stored verbatim with 201, never executed
    const injectTitle = await owner.post(`${API}/projects/${project.id}/tasks`, {
      data: { title: "x'); DROP TABLE tasks;--" },
    });
    expect(injectTitle.status()).toBe(201);
    expect((await injectTitle.json()).title).toBe("x'); DROP TABLE tasks;--");

    // injection attempts in structured fields are rejected by validation
    await expectError(
      await owner.post(`${API}/auth/login`, {
        data: { email: "' OR '1'='1", password: "' OR '1'='1" },
      }),
      400
    );
    await expectError(
      await owner.post(`${API}/projects`, { data: { key: "AB'--", name: 'Malformed key attempt' } }),
      400
    );

    // the schema survived and seeded data is unchanged
    const injected = await (await owner.get(`${base}&sort=id&order=asc`)).json();
    expect(injected.total).toBe(1);
    const seeded = await (await owner.get(`${API}/projects/${SEED.projects.TASK}/tasks?limit=100`)).json();
    expect(seeded.total).toBe(SEED.taskStatusCounts.total);
    expect((await owner.get(`${API}/health`)).status()).toBe(200);
    await owner.dispose();
  });

  test('TASK-TC-045 stored markup is returned verbatim as JSON text (no server-side rendering)', async () => {
    const owner = await authedContext(SEED.users.owner);
    const key = uniqueKey();
    const project = await (
      await owner.post(`${API}/projects`, { data: { key, name: `XSS ${key}` } })
    ).json();
    const payloadTitle = '<script>alert(1)</script>';
    const payloadDescription = '<img src=x onerror="alert(2)">';
    const created = await owner.post(`${API}/projects/${project.id}/tasks`, {
      data: { title: payloadTitle, description: payloadDescription },
    });
    expect(created.status()).toBe(201);
    const task = await created.json();
    expect(task.title).toBe(payloadTitle);
    expect(task.description).toBe(payloadDescription);

    const fetched = await (await owner.get(`${API}/tasks/${task.id}`)).json();
    expect(fetched.title).toBe(payloadTitle);
    expect(fetched.description).toBe(payloadDescription);

    const comment = await owner.post(`${API}/tasks/${task.id}/comments`, {
      data: { body: '<b>bold</b>' },
    });
    expect(comment.status()).toBe(201);
    expect((await comment.json()).body).toBe('<b>bold</b>');
    await owner.dispose();
  });

  test('TASK-TC-046 privileged fields cannot be mass-assigned through writes (400) and state is unchanged', async () => {
    const owner = await authedContext(SEED.users.owner);
    const key = uniqueKey();
    const project = await (
      await owner.post(`${API}/projects`, { data: { key, name: `Mass ${key}` } })
    ).json();

    await expectError(
      await owner.post(`${API}/projects`, {
        data: { key: uniqueKey(), name: 'Owner injection', ownerId: SEED.users.admin.id },
      }),
      400
    );
    await expectError(
      await owner.patch(`${API}/projects/${project.id}`, { data: { owner_id: SEED.users.admin.id } }),
      400
    );
    await expectError(
      await owner.post(`${API}/projects/${project.id}/members`, {
        data: { email: SEED.users.member.email, role: 'MEMBER', userId: SEED.users.member.id },
      }),
      400
    );
    await expectError(
      await owner.post(`${API}/projects/${project.id}/tasks`, {
        data: { title: 'Reporter injection', reporterId: SEED.users.admin.id },
      }),
      400
    );

    const task = await (
      await owner.post(`${API}/projects/${project.id}/tasks`, { data: { title: 'Immutable reporter' } })
    ).json();
    await expectError(
      await owner.patch(`${API}/tasks/${task.id}`, { data: { reporter_id: SEED.users.admin.id } }),
      400
    );
    await expectError(
      await owner.patch(`${API}/tasks/${task.id}`, { data: { project_id: SEED.projects.OPS } }),
      400
    );

    const after = await (await owner.get(`${API}/projects/${project.id}`)).json();
    expect(after.owner_id).toBe(SEED.users.owner.id);
    const taskAfter = await (await owner.get(`${API}/tasks/${task.id}`)).json();
    expect(taskAfter.reporter_id).toBe(SEED.users.owner.id);
    expect(taskAfter.project_id).toBe(project.id);
    await owner.dispose();
  });
});
