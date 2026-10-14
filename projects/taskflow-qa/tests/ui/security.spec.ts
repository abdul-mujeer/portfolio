import { test, expect } from '@playwright/test';
import { SEEDED_TASK, UI_USERS, loginViaUi, uiUnique } from './ui-helpers';

test.describe('Console permissions & injection safety', () => {
  test('TASK-TC-107 @smoke role-based UI hiding matches server-side authorization (member cannot archive)', async ({
    page,
  }) => {
    await loginViaUi(page, UI_USERS.member);

    // the archive action is only rendered for OWNER/ADMIN
    await expect(page.getByTestId('project-archive')).toBeHidden();
    // members may still create tasks
    await expect(page.getByTestId('task-create-button')).toBeVisible();

    // hiding the button does not protect the API - the server returns 403
    const response = await page.request.post('/api/v1/projects/1/archive');
    expect(response.status()).toBe(403);
    expect((await response.json()).error.code).toBe('FORBIDDEN');

    // ...and the project is not archived afterwards
    const project = await (await page.request.get('/api/v1/projects/1')).json();
    expect(project.archived).toBe(false);
  });

  test('TASK-TC-110 @regression stored markup in a task title renders as plain text and never executes', async ({ page }) => {
    await loginViaUi(page);
    const payload = `<script>alert('xss')</script> ${uiUnique('probe')}`;

    let dialogFired = false;
    page.on('dialog', async (dialog) => {
      dialogFired = true;
      await dialog.dismiss();
    });

    await page.getByTestId('task-create-button').click();
    await page.getByTestId('task-title').fill(payload);
    await page.getByTestId('task-save').click();
    await expect(page.getByTestId('task-modal')).toBeHidden();

    const card = page.getByTestId('task-card').filter({ hasText: 'probe' }).first();
    await expect(card).toBeVisible();
    await expect(card.getByTestId('task-card-title')).toHaveText(payload);

    // no script element was injected into the board and no dialog fired
    expect(await page.locator('#board script').count()).toBe(0);
    await expect(page.getByTestId('column-TODO')).toBeVisible();
    expect(dialogFired).toBe(false);
  });
});
