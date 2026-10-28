// Phase 3: drops and archive. Build a drop, preview it, make it live (the old one moves to past drops, its unsold
// pieces still on sale there), publish
// both data files; mark sold with a handle or 個人蔵; history and undo; delete and restore; drag to reorder.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const SB = { window: {} };
vm.runInNewContext(fs.readFileSync(new URL('../../data/current.js', import.meta.url), 'utf8'), SB);
const UNSOLD = SB.window.SG_DATA.items.filter(d => !d.sold).map(d => d.nameEn);       // Drop 12's unsold pieces

async function openPiece(page, n = 0) {
  await page.goto('/admin/');
  await page.getByTestId('group-live').getByTestId('piece-row').nth(n).locator('a.piece-main').click();
  await expect(page.locator('#f-price')).not.toHaveValue('');
}

test('a new drop: build it, preview it, make it live, publish both files; the site shows it and the past drop', async ({ page }) => {
  page.on('dialog', d => d.accept());                                          // the confirmation
  await page.goto('/admin/drops');
  await page.getByRole('button', { name: '+ New drop' }).click();
  const card = page.getByTestId('drop-13');
  await expect(card).toBeVisible();
  await card.locator('input[type=date]').fill('2026-11-06');
  await card.getByRole('link', { name: '+ Add a piece' }).click();
  // a new piece in Drop 13
  await expect(page.locator('#f-drop')).toHaveValue(/.+/);
  await expect(page.locator('#f-drop option:checked')).toHaveText('Drop 13 (upcoming)');
  await page.locator('#f-cat').selectOption('hat');
  await page.locator('#f-ja').fill('80年代 デニム バケットハット');
  await page.locator('#f-en').fill('1980s Denim Bucket Hat');
  await page.locator('#f-cap').fill('バケットハット');                                 // the whole title would not fit on the stamp
  await page.getByRole('button', { name: 'Use a photo already on the site' }).click();
  await page.locator('.photos button').filter({ has: page.locator('img[src="/assets/hat.webp"]') }).click();
  await page.getByLabel('頭囲').fill('57');
  await page.getByLabel('つば').fill('5');
  await page.locator('#f-price').fill('24200');
  await page.getByRole('group', { name: 'Condition grade' }).getByRole('button', { name: 'B' }).click();
  await page.getByLabel('Condition note (Japanese)').fill('使用感あり');
  await page.getByLabel('City').fill('reno');
  await page.getByLabel('State').selectOption('NV');
  await page.getByRole('group', { name: 'Status' }).getByRole('button', { name: 'Ready' }).click();
  await expect(page.getByTestId('rule-color')).toContainText('set by the color rule', { timeout: 10000 });
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByTestId('save-state')).toContainText('Saved');
  // preview the whole drop, then make it live
  await page.goto('/admin/drops');
  await page.getByTestId('drop-13').getByRole('button', { name: 'Preview the drop' }).click();
  const home = page.frameLocator('[data-testid="drop-preview"] iframe[data-frame="home"]');
  await expect(home.locator('.fan-stamp')).toHaveCount(1, { timeout: 15000 });
  await expect(home.locator('.drop-status-current')).toHaveText('第13便 公開中');
  await page.getByTestId('drop-13').getByRole('button', { name: 'Make this the live drop' }).click();
  await expect(page.getByTestId('drops-msg')).toContainText('Drop 13 is now the live drop and Drop 12 is a past drop');
  await expect(page.getByTestId('drops-msg')).toContainText(UNSOLD.length + ' unsold piece(s) stay on sale in past drops');
  await expect(page.getByText('Live').locator('..').getByTestId('drop-13')).toBeVisible();
  await expect(page.getByTestId('drop-12')).toContainText('past');
  // publish: two files
  await expect(page.locator('main.list')).toHaveAttribute('data-meter', 'ready', { timeout: 15000 });
  const downloads = [];
  page.on('download', d => downloads.push(d));
  await page.getByRole('button', { name: 'Publish to site' }).click();
  await expect(page.getByTestId('publish-msg')).toContainText('data/current.js and data/past.js', { timeout: 15000 });
  await expect.poll(() => downloads.length).toBe(2);
  const files = Object.fromEntries(await Promise.all(downloads.map(async d => [d.suggestedFilename(), fs.readFileSync(await d.path(), 'utf8')])));
  expect(Object.keys(files).sort()).toEqual(['current.js', 'past.js']);
  // the site with those two files
  await page.route('**/data/current.js', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: files['current.js'] }));
  await page.route('**/data/past.js', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: files['past.js'] }));
  await page.addInitScript(() => localStorage.setItem('sg-access', '1234'));
  await page.goto('/index.html');
  await expect(page.locator('.drop-status-current')).toHaveText('第13便 公開中');
  await expect(page.locator('.fan-stamp')).toHaveCount(1);                       // only the new drop's own piece
  await page.goto('/drops.html');
  await expect(page.locator('.drop-head b').first()).toHaveText('第12便');          // Drop 12 is now a past drop
  await expect(page.locator('#backLink')).toHaveText('← 第13便 公開中');
  const ALL12 = SB.window.SG_DATA.items.length;
  await expect(page.locator('.drop').first().locator('.past-stamp')).toHaveCount(ALL12);   // sold and unsold
  await expect(page.locator('.drop').first().locator('.drop-head')).toContainText(ALL12 + '点·残り' + UNSOLD.length + '点');
  await expect(page.locator('.arch-sub')).toHaveText('これまでの便。残っている品は、今もお求めいただけます。');
  // an unsold piece in past drops opens with its cart button
  await page.locator('.drop').first().locator('.past-stamp .stamp:not(.is-sold)').first().click();
  await expect(page.locator('.buy .cart')).toHaveText('カートに入れる');
  // the unsold pieces stay with Drop 12 in past.js, and none go back to Draft
  const built = { window: {} }; vm.runInNewContext(files['current.js'] + files['past.js'], built);
  expect(built.window.SG_DATA.items.map(d => d.nameEn)).toEqual(['1980s Denim Bucket Hat']);
  const drop12 = built.window.SG_PAST.drops.find(d => d.no === 12);
  expect(drop12.pieces.map(d => d.nameEn)).toEqual(SB.window.SG_DATA.items.map(d => d.nameEn));   // every piece, in order
  expect(drop12.pieces.filter(d => !d.sold).map(d => d.nameEn)).toEqual(UNSOLD);
  await page.unrouteAll();
  await page.goto('/admin/');
  await expect(page.getByTestId('group-live').getByTestId('piece-row')).toHaveCount(1);   // the new drop's hat
  await expect(page.getByTestId('group-loose')).toHaveCount(0);                            // nothing went back to Draft
});

test('mark sold with the buyer\'s handle, or as a private collection', async ({ page }) => {
  await openPiece(page, 0);
  await page.getByRole('group', { name: 'Status' }).getByRole('button', { name: 'Sold' }).click();
  await page.getByLabel('The buyer shared their Instagram').check();
  await page.getByLabel("Buyer's Instagram handle").fill('@test.buyer');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByTestId('save-state')).toContainText('Saved');
  const desk = page.frameLocator('iframe[data-frame="desk"]');
  await expect(desk.locator('#found')).toContainText('CONSIGNEE: @test.buyer', { timeout: 15000 });
  const phone = page.frameLocator('iframe[data-frame="phone"]');
  await expect(phone.locator('.m-row').last()).toContainText('@test.buyer (CONSIGNEE)');
  await expect(phone.locator('.m-buy button')).toHaveText('売約済');
  await page.getByLabel('Private collection (個人蔵)').check();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByTestId('save-state')).toContainText('Saved');
  await expect(phone.locator('.m-row').last()).toContainText('個人蔵 (PRIVATE COLLECTION)', { timeout: 15000 });
  await page.goto('/admin/');
  await expect(page.getByTestId('group-live').getByTestId('piece-row').first().locator('.chip').first()).toHaveText('Sold');
});

test('history: every save keeps the version before it, and Restore puts it back', async ({ page }) => {
  await openPiece(page, 0);
  for (const price of ['15400', '16500']) {
    await page.locator('#f-price').fill(price);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByTestId('save-state')).toContainText('Saved');
  }
  page.on('dialog', d => d.accept());
  const history = page.getByTestId('history');
  await history.locator('summary').click();
  await expect(history.getByTestId('history-row')).toHaveCount(2);
  await expect(history.getByTestId('history-row').last()).toContainText('was ¥13,200');
  await history.getByTestId('history-row').last().getByRole('button', { name: 'Restore' }).click();
  await expect(page.locator('#f-price')).toHaveValue('13200');
  await page.reload();
  await expect(page.locator('#f-price')).toHaveValue('13200');
  await page.getByTestId('history').locator('summary').click();
  await expect(page.getByTestId('history').getByTestId('history-row')).toHaveCount(3);    // the restore can be undone too
});

test('delete a piece, then restore it from Recently deleted', async ({ page }) => {
  await openPiece(page, 6);
  const name = await page.locator('#f-ja').inputValue();
  page.on('dialog', d => d.accept());
  await page.getByRole('button', { name: 'Delete this piece' }).click();
  await expect(page).toHaveURL(/\/admin\/?$/);
  await expect(page.getByTestId('group-live').getByTestId('piece-row')).toHaveCount(6);
  const deleted = page.getByTestId('deleted');
  await deleted.locator('summary').click();
  await expect(deleted).toContainText(name);
  await deleted.getByRole('button', { name: 'Restore (as a draft)' }).click();
  await expect(page.getByTestId('group-live').getByTestId('piece-row')).toHaveCount(7);
  await expect(page.getByTestId('group-live').getByTestId('piece-row').last().locator('.chip').first()).toHaveText('Draft');
});

test('drag a piece by its handle to a new place', async ({ page }) => {
  await page.goto('/admin/');
  const rows = page.getByTestId('group-live').getByTestId('piece-row');
  const first = await rows.nth(0).locator('.title').textContent();
  const handle = rows.nth(0).getByRole('button', { name: 'Drag to reorder' });
  const target = await rows.nth(2).boundingBox();
  const box = await handle.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, target.y + target.height * 0.75, { steps: 8 });
  await page.mouse.up();
  await expect(rows.nth(2).locator('.title')).toHaveText(first);
  await page.reload();
  await expect(rows.nth(2).locator('.title')).toHaveText(first);
});

test('at 375x812 the list, the drops page and the cutout check fit the phone: no sideways scroll, controls at least 44px', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const check = async where => {
    expect(await page.evaluate(() => document.documentElement.scrollWidth), where).toBeLessThanOrEqual(375);
    const small = await page.evaluate(() => [...document.querySelectorAll('button, input:not([type=radio]):not([type=file]), select, textarea, a.btn')]
      .filter(el => el.offsetParent !== null && getComputedStyle(el).visibility !== 'hidden')
      .map(el => ({ t: el.tagName + ' ' + (el.textContent || el.getAttribute('aria-label') || el.id).trim().slice(0, 24), h: el.getBoundingClientRect().height }))
      .filter(x => x.h < 44));
    expect(small, where).toEqual([]);
  };
  await page.goto('/admin/');
  await expect(page.getByTestId('group-live').getByTestId('piece-row')).toHaveCount(7);
  await check('list');
  await page.goto('/admin/drops');
  await page.getByRole('button', { name: '+ New drop' }).click();
  await expect(page.getByTestId('drop-13')).toBeVisible();
  await page.getByTestId('drop-12').getByRole('button', { name: 'Preview the drop' }).click();
  await expect(page.getByTestId('drop-preview')).toBeVisible({ timeout: 15000 });
  await check('drops');
  await page.goto('/admin/pieces/local-1');
  await page.getByTestId('photo-input').setInputFiles(fileURLToPath(new URL('../../assets/hat-full.jpg', import.meta.url)));
  await expect(page.getByRole('dialog').getByAltText('The cutout')).toBeVisible({ timeout: 15000 });
  await check('cutout check');
  // the sold choices are 44px rows (the radio sits inside its label)
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('group', { name: 'Status' }).getByRole('button', { name: 'Sold' }).click();
  for (const box of await page.locator('.choice').all()) expect((await box.boundingBox()).height).toBeGreaterThanOrEqual(44);
});
