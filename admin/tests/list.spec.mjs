// C7 test 1: the list shows today's pieces in order, with the right prices and status chips.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import vm from 'node:vm';

const sb = { window: {} };
vm.runInNewContext(fs.readFileSync(new URL('../../data/current.js', import.meta.url), 'utf8'), sb);
const ITEMS = sb.window.SG_DATA.items;

test('list shows today\'s pieces in order with prices and chips', async ({ page }) => {
  await page.goto('/admin/');
  const rows = page.getByTestId('group-live').getByTestId('piece-row');
  await expect(rows).toHaveCount(ITEMS.length);
  for (let i = 0; i < ITEMS.length; i++) {
    const d = ITEMS[i], r = rows.nth(i);
    await expect(r.locator('.title')).toHaveText(d.nameJa);
    await expect(r.locator('.price')).toHaveText(d.price);
    await expect(r.locator('.chip').first()).toHaveText(d.sold ? 'Sold' : 'Ready');
  }
  await expect(page.locator('main.list')).toHaveAttribute('data-meter', 'ready', { timeout: 15000 });
  await expect(page.locator('.chip.long')).toHaveCount(0);       // all of today's titles fit
});

test('arrows reorder pieces within the drop', async ({ page }) => {
  await page.goto('/admin/');
  const rows = page.getByTestId('group-live').getByTestId('piece-row');
  await expect(rows).toHaveCount(ITEMS.length);
  await rows.nth(0).getByRole('button', { name: 'Move down' }).click();
  await expect(rows.nth(0).locator('.title')).toHaveText(ITEMS[1].nameJa);
  await expect(rows.nth(1).locator('.title')).toHaveText(ITEMS[0].nameJa);
  await page.reload();
  await expect(rows.nth(0).locator('.title')).toHaveText(ITEMS[1].nameJa);
});
