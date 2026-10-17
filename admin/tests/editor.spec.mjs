// C7 tests 2, 3 and 5: editing, saving, the fit checks, and the preview.
import { test, expect } from '@playwright/test';

const LONG = '1960年代 アメリカ空軍 USAF MA-1 フライトジャケット セージグリーン 前期型';

async function openFirst(page) {
  await page.goto('/admin/');
  await page.getByTestId('group-live').getByTestId('piece-row').first().locator('a.piece-main').click();
  await expect(page.locator('#f-price')).toHaveValue('13200');
}

test('2: edit the price, save, reload: kept, and the phone preview shows it', async ({ page }) => {
  await openFirst(page);
  await page.locator('#f-price').fill('15400');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByTestId('save-state')).toContainText('Saved');
  await page.reload();
  await expect(page.locator('#f-price')).toHaveValue('15400');
  const phone = page.frameLocator('iframe[data-frame="phone"]');
  await expect(phone.locator('.m-buy .p')).toHaveText('¥15,400', { timeout: 15000 });
});

test('3: a long title is flagged within a second; Ready is refused, Draft saves', async ({ page }) => {
  await openFirst(page);
  await expect(page.getByTestId('fit-line')).toBeVisible();
  const t0 = Date.now();
  await page.locator('#f-ja').fill(LONG);
  await expect(page.getByTestId('fit-problems')).toBeVisible({ timeout: 1000 });
  expect(Date.now() - t0).toBeLessThan(1000);
  await expect(page.getByTestId('fit-problems')).toContainText('Japanese title takes');
  await page.getByRole('button', { name: 'Save' }).click();             // the piece is 完成
  await expect(page.getByTestId('save-state')).toContainText('To mark it Ready');
  await page.reload();
  await expect(page.locator('#f-ja')).not.toHaveValue(LONG);              // nothing was saved
  await page.locator('#f-ja').fill(LONG);
  await page.getByRole('group', { name: 'Status' }).getByRole('button', { name: 'Draft' }).click();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByTestId('save-state')).toContainText('Saved');
  await page.reload();
  await expect(page.locator('#f-ja')).toHaveValue(LONG);
});

test('4: only title ideas that fit are shown, and Use puts one in the field', async ({ page }) => {
  const FITS = '60年代 MA-1 フライトジャケット';
  await page.route('**/api/suggest-titles', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ ja: [LONG, FITS], en: [], cap: [] }),
  }));
  await openFirst(page);
  await page.locator('#f-ja').fill(LONG);
  await expect(page.getByTestId('fit-problems')).toBeVisible();
  await page.getByRole('button', { name: 'Suggest shorter titles' }).click();
  await expect(page.getByTestId('idea-ja')).toHaveCount(1);
  await expect(page.getByTestId('idea-ja')).toContainText(FITS);
  await page.getByTestId('idea-ja').getByRole('button', { name: 'Use' }).click();
  await expect(page.locator('#f-ja')).toHaveValue(FITS);
  await expect(page.getByTestId('fit-problems')).toHaveCount(0);
});
