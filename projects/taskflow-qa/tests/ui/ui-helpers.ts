import { expect, type Page } from '@playwright/test';

export const UI_USERS = {
  owner: { email: 'owner@example.com', password: 'Owner#12345' },
  admin: { email: 'admin@example.com', password: 'Admin#12345' },
  member: { email: 'member@example.com', password: 'Member#12345' },
} as const;

export const SEEDED_TASK = 'Set up CI pipeline for the API';

let uiSequence = 0;
export function uiUnique(prefix: string): string {
  uiSequence += 1;
  return `${prefix} ${Date.now().toString(36)}-${uiSequence}`;
}

export function dateOffset(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Logs in through the real login form and waits for the board to be ready. */
export async function loginViaUi(page: Page, user: { email: string; password: string } = UI_USERS.owner) {
  await page.goto('/');
  await expect(page.getByTestId('login-email')).toBeVisible();
  await page.getByTestId('login-email').fill(user.email);
  await page.getByTestId('login-password').fill(user.password);
  await page.getByTestId('login-submit').click();
  await expect(page.getByTestId('board')).toBeVisible();
  await expect(page.getByTestId('board-status')).toContainText('task(s)');
}

export async function openTask(page: Page, title: string) {
  await page.getByTestId('task-card').filter({ hasText: title }).first().click();
  await expect(page.getByTestId('task-modal')).toBeVisible();
}

/**
 * Filters the board to a status, then opens the task with the given title.
 * Used for seeded tasks that may not be on unfiltered page 1 once other tests
 * have created newer tasks.
 */
export async function filterAndOpenTask(page: Page, status: string, title: string) {
  await page.getByTestId('filter-status').selectOption(status);
  await page.getByTestId('filter-apply').click();
  await openTask(page, title);
}

/** Creates a task through the API (used to make tests independent of page order). */
export async function createTaskViaApi(page: Page, title: string, extra: Record<string, unknown> = {}) {
  const res = await page.request.post('/api/v1/projects/1/tasks', { data: { title, ...extra } });
  expect(res.status(), 'task created via API').toBe(201);
  return res.json();
}

/** Reloads the console with the existing session and waits for the board. */
export async function reloadBoard(page: Page) {
  await page.reload();
  await expect(page.getByTestId('board')).toBeVisible();
  await expect(page.getByTestId('board-status')).toContainText('task(s)');
}
