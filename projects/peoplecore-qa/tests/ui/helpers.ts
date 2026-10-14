import { expect, type Page } from '@playwright/test';

export const UI_CREDENTIALS = {
  admin: { email: 'admin@example.com', password: 'Admin#12345' },
  hr: { email: 'hr@example.com', password: 'Hr#1234567' },
  manager: { email: 'manager@example.com', password: 'Manager#12345' },
  employee1: { email: 'employee1@example.com', password: 'Employee#1234' },
  employee6: { email: 'employee6@example.com', password: 'Employee#1234' },
  employee7: { email: 'employee7@example.com', password: 'Employee#1234' },
} as const;

export type UiRole = keyof typeof UI_CREDENTIALS;

/** Signs in through the real login form. */
export async function loginViaUi(page: Page, role: UiRole = 'admin') {
  await page.goto('/login');
  await page.getByTestId('login-email').fill(UI_CREDENTIALS[role].email);
  await page.getByTestId('login-password').fill(UI_CREDENTIALS[role].password);
  await page.getByTestId('login-submit').click();
  await expect(page).toHaveURL(/\/dashboard$/);
  return UI_CREDENTIALS[role];
}

/** Sign in on a fresh context (no shared cookies between roles). */
export async function newRolePage(context: import('@playwright/test').BrowserContext, role: UiRole) {
  const page = await context.newPage();
  await loginViaUi(page, role);
  return page;
}

export function isoDateOffset(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
