import { test, expect } from '@playwright/test';
import {
  SEEDED_TASK,
  createTaskViaApi,
  dateOffset,
  filterAndOpenTask,
  loginViaUi,
  openTask,
  reloadBoard,
  uiUnique,
} from './ui-helpers';

test.describe('TaskFlow console journeys', () => {
  test('TASK-TC-101 @smoke login with demo credentials opens the console and logout returns to the login view', async ({
    page,
  }) => {
    await loginViaUi(page);
    await expect(page.getByTestId('current-user')).toContainText('owner@example.com');
    await expect(page.getByTestId('login-view')).toBeHidden();

    await page.getByTestId('logout-button').click();
    await expect(page.getByTestId('login-view')).toBeVisible();
    await expect(page.getByTestId('board')).toBeHidden();
  });

  test('TASK-TC-102 @smoke the board renders all five status columns, seeded tasks and working pagination', async ({
    page,
  }) => {
    await loginViaUi(page);
    for (const status of ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELED']) {
      await expect(page.getByTestId(`column-${status}`)).toBeVisible();
    }

    // Column counters reflect the current page. Derive the expected numbers
    // from the exact same API query the board issues (newest first, limit 10).
    const apiRes = await page.request.get('/api/v1/projects/1/tasks?limit=10&sort=created_at&order=desc');
    expect(apiRes.status()).toBe(200);
    const apiBody = await apiRes.json();
    const expectedCounts: Record<string, number> = {
      TODO: 0,
      IN_PROGRESS: 0,
      IN_REVIEW: 0,
      DONE: 0,
      CANCELED: 0,
    };
    for (const task of apiBody.data) expectedCounts[task.status] += 1;
    for (const [status, count] of Object.entries(expectedCounts)) {
      await expect(page.getByTestId(`column-count-${status}`)).toHaveText(String(count));
    }
    await expect(
      page.getByTestId('column-TODO').getByTestId('task-card').filter({ hasText: SEEDED_TASK })
    ).toBeVisible();

    // 12 seed tasks at the console page size of 10 -> two pages
    await expect(page.getByTestId('pagination-info')).toHaveText('Page 1 of 2 (12 tasks)');
    await expect(page.getByTestId('pagination-prev')).toBeDisabled();
    await page.getByTestId('pagination-next').click();
    await expect(page.getByTestId('pagination-info')).toHaveText('Page 2 of 2 (12 tasks)');
    await expect(page.getByTestId('pagination-next')).toBeDisabled();
    await page.getByTestId('pagination-prev').click();
    await expect(page.getByTestId('pagination-info')).toHaveText('Page 1 of 2 (12 tasks)');
  });

  test('TASK-TC-103 @smoke a task created in the modal appears on the board with its details', async ({ page }) => {
    await loginViaUi(page);
    const title = uiUnique('UI created task');
    await page.getByTestId('task-create-button').click();
    await expect(page.getByTestId('task-modal')).toBeVisible();
    await expect(page.getByTestId('task-title')).toBeFocused();

    await page.getByTestId('task-title').fill(title);
    await page.getByTestId('task-description').fill('Created by the Playwright UI suite.');
    await page.getByTestId('task-priority').selectOption('HIGH');
    await page.getByTestId('task-assignee').selectOption({ label: 'Priya Sen' });
    await page.getByTestId('task-due').fill(dateOffset(3));
    await page.getByTestId('task-estimated').fill('2.5');
    await page.getByTestId('task-save').click();

    await expect(page.getByTestId('task-modal')).toBeHidden();
    const card = page.getByTestId('column-TODO').getByTestId('task-card').filter({ hasText: title });
    await expect(card).toBeVisible();
    await expect(card.getByTestId('task-priority-badge')).toHaveText('HIGH');
  });

  test('TASK-TC-104 changing the status select moves the card to the new column', async ({ page }) => {
    await loginViaUi(page);
    // hermetic: create the card through the API so it is the newest task on page 1
    const title = uiUnique('Status move task');
    await createTaskViaApi(page, title);
    await reloadBoard(page);
    await openTask(page, title);
    await page.getByTestId('task-status-select').selectOption('IN_PROGRESS');
    await expect(page.getByTestId('task-status-select')).toHaveValue('IN_PROGRESS');
    await page.getByTestId('modal-close').click();
    await expect(page.getByTestId('task-modal')).toBeHidden();
    await expect(
      page.getByTestId('column-IN_PROGRESS').getByTestId('task-card').filter({ hasText: title })
    ).toBeVisible();
  });

  test('TASK-TC-105 comments can be added from the task modal and render in the panel', async ({ page }) => {
    await loginViaUi(page);
    // open the seeded task through the status filter so its position on the
    // unfiltered pages never matters
    const seeded = await (await page.request.get('/api/v1/tasks/1')).json();
    await filterAndOpenTask(page, seeded.status, SEEDED_TASK);
    await expect(page.getByTestId('comment-list')).toContainText('Schema looks good');
    const body = uiUnique('UI comment');
    await page.getByTestId('comment-body').fill(body);
    await page.getByTestId('comment-submit').click();
    await expect(page.getByTestId('comment-list')).toContainText(body);
    await expect(page.getByTestId('comment-body')).toHaveValue('');
    await expect(page.getByTestId('comment-list').getByTestId('comment-item').last()).toContainText(body);
  });

  test('TASK-TC-106 @smoke a rejected create shows a clear validation error banner and keeps the modal open', async ({
    page,
  }) => {
    await loginViaUi(page);
    await page.getByTestId('task-create-button').click();
    await page.getByTestId('task-title').fill('ab');
    await page.getByTestId('task-save').click();

    const banner = page.getByTestId('error-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('Error 400');
    await expect(banner).toContainText('Title must be 3-120 characters');
    await expect(page.getByTestId('task-modal')).toBeVisible();

    await page.getByTestId('error-dismiss').click();
    await expect(banner).toBeHidden();
    await page.getByTestId('modal-close').click();
  });

  test('TASK-TC-108 @regression the overdue filter shows exactly the overdue tasks', async ({ page }) => {
    await loginViaUi(page);
    await page.getByTestId('filter-overdue').check();
    await page.getByTestId('filter-apply').click();

    // wait for the filtered board to render, then read the counters
    await expect(page.getByTestId('task-card').first()).toHaveAttribute('data-overdue', 'true');
    let shown = 0;
    let total = 0;
    await expect
      .poll(async () => {
        const text = (await page.getByTestId('board-status').textContent()) ?? '';
        const match = text.match(/Showing (\d+) of (\d+)/);
        if (!match) return false;
        shown = Number(match[1]);
        total = Number(match[2]);
        return shown === total && shown >= 3;
      })
      .toBe(true);

    const cards = page.getByTestId('task-card');
    await expect(cards).toHaveCount(shown);
    for (const card of await cards.all()) {
      await expect(card).toHaveAttribute('data-overdue', 'true');
    }
    await expect(
      page.getByTestId('column-TODO').getByTestId('task-card').filter({ hasText: 'Write validation' })
    ).toBeVisible();

    await page.getByTestId('filter-reset').click();
    await expect(page.getByTestId('filter-overdue')).not.toBeChecked();
    await expect(page.getByTestId('board-status')).toContainText('Showing 10 of');
  });
});
