// C7 tests 2, 3 and 5: editing, saving, the fit checks, and the preview.
import { test, expect } from '@playwright/test';

const LONG = '1960年代 アメリカ空軍 USAF MA-1 フライトジャケット セージグリーン 前期型';

async function openFirst(page) {
  await page.goto('/admin/');
  await page.getByTestId('piece-row').first().locator('a.piece-main').click();
  await expect(page.locator('#f-price')).toHaveValue('13200');
}

test('2: edit the price, save, reload: kept, and the phone preview shows it', async ({ page }) => {
  await openFirst(page);
  await page.locator('#f-price').fill('15400');
  await page.getByRole('button', { name: '保存' }).click();
  await expect(page.getByTestId('save-state')).toContainText('保存しました');
  await page.reload();
  await expect(page.locator('#f-price')).toHaveValue('15400');
  const phone = page.frameLocator('iframe[data-frame="phone"]');
  await expect(phone.locator('.m-buy .p')).toHaveText('¥15,400', { timeout: 15000 });
});
