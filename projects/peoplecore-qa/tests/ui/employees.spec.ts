import { expect, test } from '@playwright/test';
import { isoDateOffset, loginViaUi } from './helpers.js';

test.describe('Employee list', () => {
  test('search, department filter and empty state all work @smoke', async ({ page }) => {
    await loginViaUi(page, 'admin');
    await page.getByTestId('nav-employees').click();
    await expect(page).toHaveURL(/\/employees$/);

    const allRows = page.getByTestId('employee-row');
    await expect(allRows.first()).toBeVisible();
    const initialCount = await allRows.count();
    expect(initialCount).toBeGreaterThanOrEqual(10);

    await page.getByTestId('employee-search').fill('Okafor');
    await page.getByTestId('employee-filter-submit').click();
    await expect(allRows).toHaveCount(1);
    await expect(allRows.first()).toHaveAttribute('data-employee-code', 'EMP-001');
    await expect(page.getByTestId('total-count')).toContainText('1 matching record');

    await page.getByTestId('employee-filter-reset').click();
    await page.getByTestId('employee-department-filter').selectOption({ label: 'Engineering' });
    await page.getByTestId('employee-filter-submit').click();
    const engineeringCount = await allRows.count();
    expect(engineeringCount).toBeGreaterThanOrEqual(6);
    for (const cell of await page.getByTestId('employee-department').allTextContents()) {
      expect(cell).toBe('Engineering');
    }

    await page.getByTestId('employee-search').fill('zzz-no-such-person');
    await page.getByTestId('employee-filter-submit').click();
    await expect(page.getByTestId('empty-state')).toBeVisible();
    await expect(allRows).toHaveCount(0);
    await page.getByTestId('empty-state-reset').click();
    await expect(allRows.first()).toBeVisible();
  });

  test('sorting and pagination navigate the list without losing filters', async ({ page }) => {
    await loginViaUi(page, 'admin');
    await page.goto('/employees?limit=5');

    await page.getByTestId('employee-sort').selectOption('employeeCode');
    await page.getByTestId('employee-order').selectOption('desc');
    await page.getByTestId('employee-filter-submit').click();

    const rows = page.getByTestId('employee-row');
    await expect(rows).toHaveCount(5);
    const codes = await page.getByTestId('employee-code').allTextContents();
    expect([...codes].sort().reverse()).toEqual(codes);

    await page.getByTestId('pagination-next').click();
    await expect(page).toHaveURL(/page=2/);
    await expect(rows).toHaveCount(5);
    await expect(page.getByTestId('pagination-current')).toHaveText('2');

    await page.getByTestId('pagination-prev').click();
    await expect(page).toHaveURL(/page=1/);
    await expect(page.getByTestId('pagination-current')).toHaveText('1');
  });

  test('creating an employee shows inline validation errors first and then succeeds @smoke', async ({ page }) => {
    await loginViaUi(page, 'admin');
    await page.goto('/employees/new');

    await page.getByTestId('employee-form-submit').click();
    await expect(page.getByTestId('form-error-employeeCode')).toBeVisible();
    await expect(page.getByTestId('form-error-firstName')).toBeVisible();
    await expect(page.getByTestId('form-error-email')).toBeVisible();
    await expect(page.getByTestId('form-error-password')).toBeVisible();
    await expect(page.getByTestId('form-error-salary')).toBeVisible();
    await expect(page).toHaveURL(/\/employees$/);
    expect(await page.getByTestId('employee-row').count()).toBe(0);

    const code = `EMP-${700 + Math.floor(Math.random() * 90)}`;
    const email = `ui.probe.${Date.now().toString(36)}@example.com`;
    await page.getByTestId('form-employeeCode').fill(code);
    await page.getByTestId('form-firstName').fill('Ursula');
    await page.getByTestId('form-lastName').fill('Ito');
    await page.getByTestId('form-email').fill(email);
    await page.getByTestId('form-phone').fill('+1 555 0199');
    await page.getByTestId('form-departmentId').selectOption({ label: 'Sales' });
    await page.getByTestId('form-position').fill('Account Manager');
    await page.getByTestId('form-salary').fill('58500.50');
    await page.getByTestId('form-password').fill('UiProbe#12345');
    await page.getByTestId('employee-form-submit').click();

    await expect(page).toHaveURL(/\/employees\/\d+\?created=1$/);
    await expect(page.getByTestId('employee-detail-code')).toHaveText(code);
    await expect(page.getByTestId('profile-email')).toHaveText(email);
    await expect(page.getByTestId('profile-department')).toHaveText('Sales');
    await expect(page.getByTestId('profile-salary')).toHaveText('58500.50');
    await expect(page.getByTestId('profile-status')).toHaveText('ACTIVE');
  });

  test('editing an employee updates the record and the detail page', async ({ page }) => {
    await loginViaUi(page, 'hr');
    await page.goto('/employees/4/edit');
    await expect(page.getByTestId('form-role')).toBeDisabled();
    await expect(page.getByTestId('form-role-disabled-note')).toBeVisible();
    await expect(page.getByTestId('form-employeeCode')).toBeDisabled();

    await page.getByTestId('form-position').fill('Backend Engineer III');
    await page.getByTestId('form-status').selectOption('ON_LEAVE');
    await page.getByTestId('employee-form-submit').click();

    await expect(page).toHaveURL(/\/employees\/4\?updated=1$/);
    await expect(page.getByTestId('flash-message')).toContainText('Saved successfully');
    await expect(page.getByTestId('profile-position')).toHaveText('Backend Engineer III');
    await expect(page.getByTestId('profile-status')).toHaveText('ON_LEAVE');

    // Restore the seeded state for the following tests.
    await page.goto('/employees/4/edit');
    await page.getByTestId('form-position').fill('Backend Engineer');
    await page.getByTestId('form-status').selectOption('ACTIVE');
    await page.getByTestId('employee-form-submit').click();
    await expect(page.getByTestId('profile-status')).toHaveText('ACTIVE');
  });

  test('employee detail exposes attendance and leave tabs with real rows', async ({ page }) => {
    await loginViaUi(page, 'manager');
    await page.goto('/employees/4');

    await expect(page.getByTestId('employee-detail-name')).toHaveText('Daniel Osei');
    await expect(page.getByTestId('profile-salary-redacted')).toBeVisible();
    await expect(page.getByTestId('attendance-row').first()).toBeVisible();
    const attendanceRows = await page.getByTestId('attendance-row').count();
    expect(attendanceRows).toBeGreaterThan(0);

    await page.getByTestId('tab-leave').click();
    await expect(page).toHaveURL(/tab=leave/);
    await expect(page.getByTestId('leave-row').first()).toBeVisible();
    for (const status of await page.getByTestId('leave-status').allTextContents()) {
      expect(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']).toContain(status);
    }
  });
});

test.describe('Attendance page', () => {
  test('a reviewer can record attendance and filter the grid result', async ({ page }) => {
    await loginViaUi(page, 'hr');
    await page.goto('/attendance');
    await expect(page.getByTestId('attendance-grid')).toBeVisible();

    const workDate = isoDateOffset(50);
    await page.getByTestId('attendance-form-employee').selectOption({ index: 1 });
    await page.getByTestId('attendance-form-date').fill(workDate);
    await page.getByTestId('attendance-form-status').selectOption('REMOTE');
    await page.getByTestId('attendance-form-checkin').fill('08:45');
    await page.getByTestId('attendance-form-checkout').fill('17:15');
    await page.getByTestId('attendance-form-notes').fill('UI automation probe');
    await page.getByTestId('attendance-form-submit').click();

    await expect(page).toHaveURL(/\/attendance\?created=1$/);
    await expect(page.getByTestId('flash-message')).toContainText('Created successfully');

    await page.getByTestId('attendance-filter-from').fill(workDate);
    await page.getByTestId('attendance-filter-to').fill(workDate);
    await page.getByTestId('attendance-filter-status').selectOption('REMOTE');
    await page.getByTestId('attendance-filter-submit').click();

    const rows = page.getByTestId('attendance-row');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('REMOTE');
    await expect(rows.first()).toContainText('08:45');
    await expect(page.getByTestId('attendance-total-count')).toContainText('1 record');

    await page.getByTestId('attendance-filter-reset').click();
    await expect(page.getByTestId('attendance-total-count')).toContainText(/6\d record/);
  });
});

test.describe('Audit page', () => {
  test('an administrator filters the audit log and reads the before/after payload', async ({ page }) => {
    await loginViaUi(page, 'admin');
    await page.getByTestId('nav-audit').click();
    await expect(page.getByTestId('audit-heading')).toBeVisible();

    await page.getByTestId('audit-filter-entity-type').selectOption('EMPLOYEE');
    await page.getByTestId('audit-filter-entity-id').fill('10');
    await page.getByTestId('audit-filter-submit').click();

    const rows = page.getByTestId('audit-row');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toHaveAttribute('data-action', 'EMPLOYEE_CREATE');

    await page.getByTestId('audit-details-toggle').first().click();
    const after = page.getByTestId('audit-after').first();
    await expect(after).toBeVisible();
    await expect(after).toContainText('salary');
    await expect(after).toContainText('EMP-010');
  });
});
