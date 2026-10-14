import { expect, request as playwrightRequest, type APIRequestContext, type APIResponse } from '@playwright/test';

/** Base URL of the test server (Playwright webServer boots it on PORT, default 4300). */
export const BASE_URL = process.env.TF_BASE_URL ?? `http://127.0.0.1:${process.env.PORT ?? 4300}`;
export const API = '/api/v1';

/** Deterministic seeded fixtures (see test-data/seed/*.json and test-documentation/). */
export const SEED = {
  users: {
    owner: { id: 1, email: 'owner@example.com', password: 'Owner#12345', name: 'Nadia Rahman' },
    admin: { id: 2, email: 'admin@example.com', password: 'Admin#12345', name: 'Omar Faruk' },
    member: { id: 3, email: 'member@example.com', password: 'Member#12345', name: 'Priya Sen' },
    outsider: { id: 4, email: 'outsider@example.com', password: 'Outside#12345', name: 'Quentin Das' },
    noprojects: { id: 5, email: 'noprojects@example.com', password: 'Solo#12345', name: 'Nina Bose' },
  },
  projects: { TASK: 1, OPS: 2, ARCH: 3 },
  tasks: { ciPipeline: 1, sessionAuth: 3, overdueTodo: 4, overdueProgress: 10, dueToday: 12, archived: 17 },
  /** TASK project status distribution from the deterministic seed. */
  taskStatusCounts: {
    TODO: 5,
    IN_PROGRESS: 2,
    IN_REVIEW: 2,
    DONE: 2,
    CANCELED: 1,
    total: 12,
  },
} as const;

export type SeedUser = { id: number; email: string; password: string; name: string };

export async function newApiContext(): Promise<APIRequestContext> {
  return playwrightRequest.newContext({ baseURL: BASE_URL });
}

export async function login(ctx: APIRequestContext, user: SeedUser): Promise<APIResponse> {
  const res = await ctx.post(`${API}/auth/login`, {
    data: { email: user.email, password: user.password },
  });
  expect(res.status(), `login as ${user.email}`).toBe(200);
  return res;
}

/** Creates an isolated API context logged in as the given seed user. */
export async function authedContext(user: SeedUser = SEED.users.owner): Promise<APIRequestContext> {
  const ctx = await newApiContext();
  await login(ctx, user);
  return ctx;
}

let sequence = 0;
function nextSequence(): number {
  sequence += 1;
  return sequence;
}

/** Collision-proof suffix for emails/titles inside a run. */
export function uniqueSuffix(): string {
  return `${Date.now().toString(36)}${nextSequence().toString(36)}`;
}

/** Valid project key matching ^[A-Z]{2,6}$ (digits are mapped to letters). */
export function uniqueKey(): string {
  const base = `${Date.now().toString(36)}${nextSequence().toString(36)}`
    .toUpperCase()
    .replace(/[0-9]/g, (d) => 'ABCDEFGHIJ'[Number(d)]);
  return base.slice(-6).padStart(2, 'Q');
}

export const FRESH_PASSWORD = 'Fresh#Pass123';

/** Asserts the standard error envelope for a non-2xx response. */
export async function expectError(res: APIResponse, status: number, code?: string) {
  expect(res.status()).toBe(status);
  const body = await res.json();
  expect(body.error, `error envelope for ${res.url()}`).toBeTruthy();
  expect(typeof body.error.message).toBe('string');
  expect(body.error.message.length).toBeGreaterThan(0);
  if (code) expect(body.error.code).toBe(code);
  return body;
}

/**
 * Registers a fresh user. Uses its OWN API context on purpose: the register
 * endpoint sets a session cookie, and doing that on a caller-supplied context
 * would silently switch that context into the new user's session.
 */
export async function registerUser(
  _ctx: APIRequestContext,
  overrides: Record<string, unknown> = {}
): Promise<{ id: number; email: string; display_name: string }> {
  const email = `qa${uniqueSuffix()}@example.com`;
  const ctx = await newApiContext();
  try {
    const res = await ctx.post(`${API}/auth/register`, {
      data: { email, display_name: `QA ${uniqueSuffix()}`, password: FRESH_PASSWORD, ...overrides },
    });
    expect(res.status(), 'register fresh user').toBe(201);
    return res.json();
  } finally {
    await ctx.dispose();
  }
}

/** ISO date string N days from UTC today (negative = past). */
export function dateOffset(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const today = (): string => dateOffset(0);

export function isTerminalStatus(status: string): boolean {
  return status === 'DONE' || status === 'CANCELED';
}

/**
 * Derives the expected overdue task ids from a fetched task list using the
 * documented rule. Keeps suites correct even when a run crosses UTC midnight
 * between the database reset and the assertions.
 */
export function expectedOverdueIds(
  tasks: Array<{ id: number; status: string; due_date: string | null }>
): number[] {
  const todayIso = today();
  return tasks
    .filter((task) => task.due_date !== null && task.due_date < todayIso && !isTerminalStatus(task.status))
    .map((task) => task.id)
    .sort((a, b) => a - b);
}
