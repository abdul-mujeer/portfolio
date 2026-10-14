import { test, expect } from '@playwright/test';
import { loginViaUi } from './ui-helpers';

test.describe('Console accessibility & keyboard support', () => {
  test('TASK-TC-109 @regression labels, ARIA wiring and a keyboard-operable modal (Escape closes, focus returns)', async ({
    page,
  }) => {
    // Login form: labels are wired to inputs and the banner is a live region.
    await page.goto('/');
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByTestId('error-banner')).toHaveAttribute('role', 'alert');
    await expect(page.getByTestId('error-banner')).toHaveAttribute('aria-live', 'assertive');

    await loginViaUi(page);
    await expect(page.getByLabel('Project', { exact: true })).toBeVisible();
    await expect(page.locator('#filters').getByLabel('Status', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Overdue only', { exact: true })).toBeVisible();

    // Modal: dialog semantics + focus management + Escape
    const trigger = page.getByTestId('task-create-button');
    await trigger.click();
    const modal = page.getByTestId('task-modal');
    await expect(modal).toHaveAttribute('role', 'dialog');
    await expect(modal).toHaveAttribute('aria-modal', 'true');
    await expect(page.getByTestId('task-title')).toBeFocused();

    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    await expect(page.getByTestId('task-title')).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();
    await expect(trigger).toBeFocused();
  });
});
