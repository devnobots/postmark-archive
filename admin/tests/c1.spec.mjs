// C1: local mode starts without sign-in and shows its banner; routes exist under /admin/.
import { test, expect } from '@playwright/test';
test('local mode banner and routes', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto('/admin/');
  await expect(page.getByText('Local mode: saved in this browser only')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start over' })).toBeVisible();
  await page.goto('/admin/pieces/new');
  await expect(page.locator('.topbar .brand')).toBeVisible();
  expect(errors).toEqual([]);
});
