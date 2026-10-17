// C7 tests 5, 6 and 7: a new sock piece's size line, local-mode 公開, and the phone layout of the editor.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';

test('5: a new sock piece with 自動 off previews its own size line on the stamp', async ({ page }) => {
  await page.goto('/admin/pieces/new');
  await page.locator('#f-cat').selectOption('socks');
  await page.locator('#f-ja').fill('80年代 テスト ソックス');
  await page.locator('#f-en').fill('1980s Test Socks');
  await page.getByRole('button', { name: 'Auto' }).click();               // 自動 off
  await page.locator('#f-size').fill('フリー · 23–27 cm');
  const phone = page.frameLocator('iframe[data-frame="phone"]');
  await expect(phone.locator('.m-view .cap-size').first()).toHaveText('フリー · 23–27 cm', { timeout: 15000 });
  const sheet = page.frameLocator('iframe[data-frame="sheet"]');
  await expect(sheet.locator('.m-cell').last().locator('.cap-size')).toHaveText('フリー · 23–27 cm');
});

test('6: local-mode 公開 downloads a current.js that makes the site show the edited price', async ({ page }) => {
  await page.goto('/admin/');
  await page.getByTestId('piece-row').first().locator('a.piece-main').click();
  await page.locator('#f-price').fill('15400');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByTestId('save-state')).toContainText('Saved');
  await page.getByRole('link', { name: 'List', exact: true }).click();
  await expect(page.locator('main.list')).toHaveAttribute('data-meter', 'ready', { timeout: 15000 });
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Publish to site' }).click()]);
  expect(dl.suggestedFilename()).toBe('current.js');
  await expect(page.getByTestId('publish-msg')).toContainText('Replace data/current.js');
  const js = fs.readFileSync(await dl.path(), 'utf8');
  expect(js).toContain('window.SG_DATA');
  await page.route('**/data/current.js', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: js }));
  await page.addInitScript(() => localStorage.setItem('sg-access', '1234'));
  await page.goto('/index.html#1970s-ringer-tee-with-concho-trim');
  await expect(page.locator('#price')).toHaveText('¥15,400');
});

test('7: at 375x812 the editor has no sideways scroll and every control is at least 44px tall', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  for (const url of ['/admin/pieces/local-3', '/admin/pieces/new']) {
    await page.goto(url);
    await expect(page.locator('#f-ja')).toBeVisible();
    await page.locator('#f-cat').selectOption('jacket');
    await page.waitForTimeout(800);
    for (const tab of ['Edit', 'Preview']) {
      await page.getByRole('tab', { name: tab }).click();
      await page.waitForTimeout(600);
      const wide = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(wide, url + ' ' + tab).toBeLessThanOrEqual(375);
      const small = await page.evaluate(() => [...document.querySelectorAll('button, input, select, textarea, a.btn')]
        .filter(el => el.offsetParent !== null && getComputedStyle(el).visibility !== 'hidden')
        .map(el => ({ t: el.tagName + ' ' + (el.textContent || el.getAttribute('aria-label') || el.id).trim().slice(0, 20), h: el.getBoundingClientRect().height }))
        .filter(x => x.h < 44));
      expect(small, url + ' ' + tab).toEqual([]);
    }
  }
});
