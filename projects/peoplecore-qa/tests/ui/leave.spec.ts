import { expect, test } from '@playwright/test';
import { isoDateOffset, loginViaUi } from './helpers.js';

test.describe('Leave workflow', () => {
  test('an employee validates, submits and cancels their own leave request @smoke', async ({ page }) => {
    await loginViaUi(page, 'employee1');
    await page.getByTestId('nav-leave').click();
    await expect(page.getByTestId('leave-heading')).toBeVisible();

    const start = isoDateOffset(80);
    const end = isoDateOffset(82);
    await page.getByTestId('leave-form-type').selectOption('ANNUAL');
    await page.getByTestId('leave-form-start').fill(start);
    await page.getByTestId('leave-form-end').fill(end);
    await page.getByTestId('leave-form-reason').fill('short');
    await page.getByTestId('leave-form-submit').click();

    await expect(page.getByTestId('form-error-reason')).toBeVisible();
    await expect(page.getByTestId('form-error-reason')).toContainText(/at least 10 characters/);
    await expect(page.getByTestId('leave-form-reason')).toHaveValue('short');

    await page.getByTestId('leave-form-reason').fill('Annual leave booked through the UI automation suite.');
    await page.getByTestId('leave-form-submit').click();

    await expect(page).toHaveURL(/\/leave\?submitted=1$/);
    await expect(page.getByTestId('flash-message')).toContainText('Leave request submitted');

    const newRow = page.locator('[data-testid="leave-row"]', { hasText: start });
    await expect(newRow).toHaveCount(1);
    await expect(newRow.getByTestId('leave-status')).toHaveText('PENDING');
    const leaveId = await newRow.getAttribute('data-leave-id');
    expect(leaveId).toMatch(/^\d+$/);

    await page.getByTestId(`leave-cancel-${leaveId}`).click();
    await expect(page).toHaveURL(/\/leave\?cancelled=1$/);
    await expect(page.getByTestId('flash-message')).toContainText('Leave request cancelled');
    const cancelledRow = page.locator('[data-testid="leave-row"]', { hasText: start });
    await expect(cancelledRow.getByTestId('leave-status')).toHaveText('CANCELLED');
    await expect(page.getByTestId(`leave-cancel-${leaveId}`)).toHaveCount(0);
  });

  test('a manager rejects a request with a short comment, then reviews it properly @smoke', async ({ page }) => {
    await loginViaUi(page, 'manager');
    await page.goto('/leave');
    await expect(page.getByTestId('review-queue')).toBeVisible();

    const queueRows = page.getByTestId('review-row');
    await expect(queueRows.first()).toBeVisible();
    const firstRow = queueRows.first();
    const leaveId = await firstRow.getAttribute('data-leave-id');
    expect(leaveId).toMatch(/^\d+$/);

    await page.getByTestId(`review-comment-${leaveId}`).fill('no');
    await page.getByTestId(`review-reject-${leaveId}`).click();
    await expect(page.getByTestId('forbidden-page')).toBeVisible();
    await expect(page.getByTestId('forbidden-message')).toContainText(/at least 5 characters/i);

    await page.goto('/leave');
    await page.getByTestId(`review-comment-${leaveId}`).fill('Team is at capacity that week.');
    await page.getByTestId(`review-reject-${leaveId}`).click();
    await expect(page).toHaveURL(/\/leave\?rejected=1$/);
    await expect(page.getByTestId('flash-message')).toContainText('Leave request rejected');
    await expect(page.locator(`[data-testid="review-row"][data-leave-id="${leaveId}"]`)).toHaveCount(0);

    const nextRow = page.getByTestId('review-row').first();
    await expect(nextRow).toBeVisible();
    const approveId = await nextRow.getAttribute('data-leave-id');
    await page.getByTestId(`review-approve-${approveId}`).click();
    await expect(page).toHaveURL(/\/leave\?approved=1$/);
    await expect(page.getByTestId('flash-message')).toContainText('Leave request approved');
    await expect(page.locator(`[data-testid="review-row"][data-leave-id="${approveId}"]`)).toHaveCount(0);
  });

  test('an employee never sees the review queue and cannot review anything @regression', async ({ page }) => {
    await loginViaUi(page, 'employee6');
    await page.goto('/leave');
    await expect(page.getByTestId('review-queue')).toHaveCount(0);
    await expect(page.getByTestId('leave-form')).toBeVisible();
    await expect(page.getByTestId('my-leave-table')).toBeVisible();
  });
});
