import { expect, test } from '@playwright/test';
import { loginViaUi } from './helpers.js';

test.describe('Role-based visibility in the UI', () => {
  test('EMPLOYEE sees a single-row list, no admin nav and 403 pages for restricted routes @smoke', async ({ page }) => {
    await loginViaUi(page, 'employee1');
    await expect(page.getByTestId('nav-audit')).toHaveCount(0);
    await expect(page.getByTestId('nav-employees')).toBeVisible();

    await page.goto('/employees');
    await expect(page.getByTestId('employee-row')).toHaveCount(1);
    await expect(page.getByTestId('employee-code')).toHaveText('EMP-004');
    await expect(page.getByTestId('new-employee-link')).toHaveCount(0);

    await page.goto('/audit');
    await expect(page.getByTestId('forbidden-page')).toBeVisible();
    await expect(page.getByTestId('error-code')).toHaveText('ROLE_FORBIDDEN');
    await page.getByTestId('back-to-dashboard').click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goto('/employees/new');
    await expect(page.getByTestId('forbidden-page')).toBeVisible();

    await page.goto('/employees/1');
    await expect(page.getByTestId('forbidden-page')).toBeVisible();
    await expect(page.getByTestId('forbidden-message')).toContainText(/own record/i);
  });

  test('MANAGER only sees direct reports in the list and gets a 403 outside the team @smoke', async ({ page }) => {
    await loginViaUi(page, 'manager');
    await page.goto('/employees?limit=50');

    const rows = page.getByTestId('employee-row');
    await expect(rows.first()).toBeVisible();
    const codes = await page.getByTestId('employee-code').allTextContents();
    expect(codes).toContain('EMP-003');
    expect(codes).toContain('EMP-004');
    expect(codes).not.toContain('EMP-001');
    expect(codes).not.toContain('EMP-002');
    expect(codes.length).toBeLessThanOrEqual(8);

    await page.goto('/employees/1');
    await expect(page.getByTestId('forbidden-page')).toBeVisible();
    await expect(page.getByTestId('error-code')).toHaveText('FORBIDDEN');
  });

  test('HR can edit but cannot change role, change the employee code or delete', async ({ page }) => {
    await loginViaUi(page, 'hr');
    await page.goto('/employees/4');
    await expect(page.getByTestId('edit-employee-link')).toBeVisible();
    await expect(page.getByTestId('delete-employee-button')).toHaveCount(0);
    await expect(page.getByTestId('profile-salary')).toBeVisible();

    await page.getByTestId('edit-employee-link').click();
    await expect(page.getByTestId('form-role')).toBeDisabled();
    await expect(page.getByTestId('form-employeeCode')).toBeDisabled();
    await expect(page.getByTestId('form-role-disabled-note')).toContainText('HR cannot change roles');

    await page.goto('/employees/1/edit');
    await expect(page.getByTestId('forbidden-page')).toBeVisible();
    await expect(page.getByTestId('error-code')).toHaveText('ROLE_FORBIDDEN');

    await page.goto('/audit');
    await expect(page.getByTestId('audit-heading')).toBeVisible();
  });

  test('ADMIN sees delete, role editing and the audit navigation', async ({ page }) => {
    await loginViaUi(page, 'admin');
    await page.goto('/employees/4');
    await expect(page.getByTestId('delete-employee-button')).toBeVisible();

    await page.getByTestId('edit-employee-link').click();
    await expect(page.getByTestId('form-role')).toBeEnabled();
    await expect(page.getByTestId('form-employeeCode')).toBeEnabled();
    await expect(page.getByTestId('nav-audit')).toBeVisible();

    await page.goto('/attendance');
    await expect(page.getByTestId('attendance-form')).toBeVisible();
    await page.getByTestId('nav-attendance').click();
    await expect(page.getByTestId('attendance-grid')).toBeVisible();
  });

  test('an EMPLOYEE gets a read-only attendance page and a 404 page for unknown records @regression', async ({ page }) => {
    await loginViaUi(page, 'employee1');
    await page.goto('/attendance');
    await expect(page.getByTestId('attendance-readonly-notice')).toBeVisible();
    await expect(page.getByTestId('attendance-form')).toHaveCount(0);
    const rows = page.getByTestId('attendance-row');
    await expect(rows.first()).toBeVisible();
    for (const employeeCode of await rows.evaluateAll((elements) =>
      elements.map((element) => element.getAttribute('data-employee-code')),
    )) {
      expect(employeeCode).toBe('EMP-004');
    }

    await page.goto('/employees/999999');
    await expect(page.getByTestId('not-found-page')).toBeVisible();
    await expect(page.getByTestId('error-code')).toHaveText('NOT_FOUND');

    await page.goto('/this/route/does/not/exist');
    await expect(page.getByTestId('not-found-page')).toBeVisible();
  });
});
