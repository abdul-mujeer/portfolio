import { expect, test } from '@playwright/test';
import { loginViaUi, UI_CREDENTIALS } from './helpers.js';

test.describe('Login page', () => {
  test('valid credentials land on the role-aware dashboard @smoke', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByTestId('login-form')).toBeVisible();
    await expect(page.getByTestId('demo-credentials')).toBeVisible();

    await page.getByTestId('login-email').fill(UI_CREDENTIALS.admin.email);
    await page.getByTestId('login-password').fill(UI_CREDENTIALS.admin.password);
    await page.getByTestId('login-submit').click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByTestId('role-badge')).toHaveText('ADMIN');
    await expect(page.getByTestId('current-user')).toHaveText('Amara Okafor');
    await expect(page.getByTestId('card-headcount')).toBeVisible();
    const headcount = Number(await page.getByTestId('metric-headcount').textContent());
    expect(headcount).toBeGreaterThanOrEqual(10);
    await expect(page.getByTestId('nav-audit')).toBeVisible();
  });

  test('invalid credentials show an inline error and keep the typed email', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-email').fill(UI_CREDENTIALS.admin.email);
    await page.getByTestId('login-password').fill('WrongPassword#9');
    await page.getByTestId('login-submit').click();

    await expect(page.getByTestId('login-error')).toBeVisible();
    await expect(page.getByTestId('login-error')).toContainText(/invalid email or password/i);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByTestId('login-email')).toHaveValue(UI_CREDENTIALS.admin.email);
  });

  test('account lockout is surfaced after five failed attempts @regression', async ({ page }) => {
    await page.goto('/login');
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await page.getByTestId('login-email').fill(UI_CREDENTIALS.employee7.email);
      await page.getByTestId('login-password').fill(`Wrong#000${attempt}`);
      await page.getByTestId('login-submit').click();
      await expect(page.getByTestId('login-error').or(page.getByTestId('login-locked'))).toBeVisible();
    }

    await expect(page.getByTestId('login-locked')).toBeVisible();
    await expect(page.getByTestId('login-locked')).toContainText(/locked/i);

    // Even the correct password is refused while the lock is active.
    await page.getByTestId('login-password').fill(UI_CREDENTIALS.employee7.password);
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('login-locked')).toBeVisible();
  });

  test('anonymous visitors are redirected to the login page and returned to the requested page @regression', async ({ page }) => {
    await page.goto('/employees');
    await expect(page).toHaveURL(/\/login\?next=%2Femployees$/);

    await page.getByTestId('login-email').fill(UI_CREDENTIALS.hr.email);
    await page.getByTestId('login-password').fill(UI_CREDENTIALS.hr.password);
    await page.getByTestId('login-submit').click();

    await expect(page).toHaveURL(/\/employees$/);
    await expect(page.getByTestId('employees-heading')).toBeVisible();
  });

  test('signing out returns to the login page and clears the session', async ({ page }) => {
    await loginViaUi(page, 'manager');
    await page.getByTestId('logout-link').click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login\?next=%2Fdashboard$/);
  });
});
