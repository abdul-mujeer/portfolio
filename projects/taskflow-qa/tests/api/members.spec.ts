import { test, expect } from '@playwright/test';
import {
  API,
  SEED,
  FRESH_PASSWORD,
  authedContext,
  expectError,
  registerUser,
  uniqueKey,
} from '../helpers/api';

async function createProject(ctx: Awaited<ReturnType<typeof authedContext>>) {
  const key = uniqueKey();
  const res = await ctx.post(`${API}/projects`, {
    data: { key, name: `Members Project ${key}` },
  });
  expect(res.status()).toBe(201);
  return res.json();
}

test.describe('Project members & roles', () => {
  test('TASK-TC-013 adding an existing user by email returns 201 and shows up in the roster', async () => {
    const owner = await authedContext(SEED.users.owner);
    const project = await createProject(owner);
    const fresh = await registerUser(owner);

    const added = await owner.post(`${API}/projects/${project.id}/members`, {
      data: { email: fresh.email, role: 'MEMBER' },
    });
    expect(added.status()).toBe(201);
    const member = await added.json();
    expect(member.role).toBe('MEMBER');
    expect(member.email).toBe(fresh.email);
    expect(member.user_id).toBe(fresh.id);

    const list = await owner.get(`${API}/projects/${project.id}/members`);
    expect(list.status()).toBe(200);
    expect((await list.json()).data).toEqual(
      expect.arrayContaining([expect.objectContaining({ email: fresh.email, role: 'MEMBER' })])
    );
    await owner.dispose();
  });

  test('TASK-TC-014 adding a duplicate member is 409 and an unknown email is 404', async () => {
    const owner = await authedContext(SEED.users.owner);
    const project = await createProject(owner);
    const fresh = await registerUser(owner);

    await owner.post(`${API}/projects/${project.id}/members`, {
      data: { email: fresh.email, role: 'MEMBER' },
    });
    const duplicate = await owner.post(`${API}/projects/${project.id}/members`, {
      data: { email: fresh.email, role: 'ADMIN' },
    });
    await expectError(duplicate, 409, 'MEMBER_ALREADY_EXISTS');

    const unknown = await owner.post(`${API}/projects/${project.id}/members`, {
      data: { email: 'nobody-here@example.com', role: 'MEMBER' },
    });
    await expectError(unknown, 404, 'NOT_FOUND');
    await owner.dispose();
  });

  test('TASK-TC-015 the OWNER role cannot be assigned via add or role change (400)', async () => {
    const owner = await authedContext(SEED.users.owner);
    const project = await createProject(owner);
    const fresh = await registerUser(owner);

    const addOwner = await owner.post(`${API}/projects/${project.id}/members`, {
      data: { email: fresh.email, role: 'OWNER' },
    });
    await expectError(addOwner, 400, 'VALIDATION_ERROR');

    await owner.post(`${API}/projects/${project.id}/members`, {
      data: { email: fresh.email, role: 'MEMBER' },
    });
    const patchOwner = await owner.patch(`${API}/projects/${project.id}/members/${fresh.id}`, {
      data: { role: 'OWNER' },
    });
    await expectError(patchOwner, 400, 'VALIDATION_ERROR');
    await owner.dispose();
  });

  test('TASK-TC-016 member roster is readable by members and hidden from everyone else (404)', async () => {
    const owner = await authedContext(SEED.users.owner);
    const list = await owner.get(`${API}/projects/${SEED.projects.TASK}/members`);
    expect(list.status()).toBe(200);
    const body = await list.json();
    expect(body.data).toHaveLength(3);
    const byRole = Object.fromEntries(
      body.data.map((m: { role: string; email: string }) => [m.role, m.email])
    );
    expect(byRole.OWNER).toBe(SEED.users.owner.email);
    expect(byRole.ADMIN).toBe(SEED.users.admin.email);
    expect(byRole.MEMBER).toBe(SEED.users.member.email);
    expect(list.headers()['x-total-count']).toBe('3');

    const member = await authedContext(SEED.users.member);
    expect((await member.get(`${API}/projects/${SEED.projects.TASK}/members`)).status()).toBe(200);

    const outsider = await authedContext(SEED.users.outsider);
    await expectError(await outsider.get(`${API}/projects/${SEED.projects.TASK}/members`), 404);

    const noprojects = await authedContext(SEED.users.noprojects);
    await expectError(await noprojects.get(`${API}/projects/${SEED.projects.TASK}/members`), 404);

    for (const ctx of [owner, member, outsider, noprojects]) await ctx.dispose();
  });

  test('TASK-TC-017 the last ADMIN cannot be demoted (409); demotion succeeds when another ADMIN exists', async () => {
    const owner = await authedContext(SEED.users.owner);
    // TASK project has exactly one ADMIN (admin@example.com)
    const blocked = await owner.patch(`${API}/projects/${SEED.projects.TASK}/members/${SEED.users.admin.id}`, {
      data: { role: 'MEMBER' },
    });
    await expectError(blocked, 409, 'LAST_ADMIN');

    // with two admins the demotion is allowed
    const project = await createProject(owner);
    const second = await registerUser(owner);
    await owner.post(`${API}/projects/${project.id}/members`, {
      data: { email: SEED.users.admin.email, role: 'ADMIN' },
    });
    await owner.post(`${API}/projects/${project.id}/members`, {
      data: { email: second.email, role: 'ADMIN' },
    });
    const ok = await owner.patch(`${API}/projects/${project.id}/members/${second.id}`, {
      data: { role: 'MEMBER' },
    });
    expect(ok.status()).toBe(200);
    expect((await ok.json()).role).toBe('MEMBER');
    await owner.dispose();
  });

  test('TASK-TC-018 @regression the OWNER cannot demote or remove themselves (409) until ownership is transferred', async () => {
    const owner = await authedContext(SEED.users.owner);
    const project = await createProject(owner);
    const successor = await registerUser(owner);
    await owner.post(`${API}/projects/${project.id}/members`, {
      data: { email: successor.email, role: 'MEMBER' },
    });

    const demoteSelf = await owner.patch(`${API}/projects/${project.id}/members/${SEED.users.owner.id}`, {
      data: { role: 'MEMBER' },
    });
    await expectError(demoteSelf, 409, 'OWNER_ROLE_LOCKED');

    const removeSelf = await owner.delete(`${API}/projects/${project.id}/members/${SEED.users.owner.id}`);
    await expectError(removeSelf, 409, 'CANNOT_REMOVE_OWNER');

    // transfer to a non-member is 404; to the member it succeeds
    await expectError(
      await owner.post(`${API}/projects/${project.id}/transfer`, { data: { userId: 999999 } }),
      404
    );
    const transfer = await owner.post(`${API}/projects/${project.id}/transfer`, {
      data: { userId: successor.id },
    });
    expect(transfer.status()).toBe(200);
    const transferBody = await transfer.json();
    expect(transferBody.transferredTo.email).toBe(successor.email);

    // the previous owner is now ADMIN and may leave; the successor owns the project
    const leave = await owner.delete(`${API}/projects/${project.id}/members/${SEED.users.owner.id}`);
    expect(leave.status()).toBe(204);

    const newOwner = await authedContext();
    // log in as the successor using the documented fresh password
    const loginRes = await newOwner.post(`${API}/auth/login`, {
      data: { email: successor.email, password: FRESH_PASSWORD },
    });
    expect(loginRes.status()).toBe(200);
    const roster = await newOwner.get(`${API}/projects/${project.id}/members`);
    expect(roster.status()).toBe(200);
    const roles = (await roster.json()).data.map((m: { role: string }) => m.role);
    expect(roles).toEqual(['OWNER']);

    await owner.dispose();
    await newOwner.dispose();
  });
});
