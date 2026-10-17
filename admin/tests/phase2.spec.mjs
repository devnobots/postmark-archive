// Phase 2: photos. Upload from the phone, check the cutout, reorder, big photos, stamp color by the rule.
import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ASSETS = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../assets');

async function openTee(page) {
  await page.goto('/admin/');
  await page.getByTestId('group-live').getByTestId('piece-row').first().locator('a.piece-main').click();
  await expect(page.locator('#f-price')).toHaveValue('13200');
}

test('upload a photo: cutout check, use it, it is kept, and it becomes the stamp photo when moved first', async ({ page }) => {
  await openTee(page);
  await expect(page.getByTestId('view-row')).toHaveCount(1);
  await page.getByTestId('photo-input').setInputFiles(path.join(ASSETS, 'hat-full.jpg'));
  const dialog = page.getByRole('dialog', { name: 'Check the cutout' });
  await expect(dialog.getByAltText('The cutout')).toBeVisible({ timeout: 15000 });
  await dialog.getByRole('button', { name: 'Checkerboard' }).click();
  await dialog.locator('#cut-tol').fill('20');                                       // adjust, the cutout is redone
  await expect(dialog.getByAltText('The cutout')).toBeVisible();
  await dialog.getByRole('button', { name: 'Use cutout' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByTestId('view-row')).toHaveCount(2);
  // move the new photo first: it is now the stamp photo, and the stamp color follows the rule
  const before = await page.getByTestId('rule-color').getAttribute('data-bg');
  await page.getByTestId('view-row').nth(1).getByRole('button', { name: 'Move photo up' }).click();
  await expect(page.getByTestId('view-row').first()).toContainText('Stamp photo');
  await expect.poll(() => page.getByTestId('rule-color').getAttribute('data-bg'), { timeout: 10000 }).not.toBe(before);
  const phone = page.frameLocator('iframe[data-frame="phone"]');
  await expect(phone.locator('.m-view img').first()).toHaveAttribute('src', /^blob:/, { timeout: 15000 });
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByTestId('save-state')).toContainText('Saved');
  await page.reload();
  await expect(page.getByTestId('view-row')).toHaveCount(2);
  await expect(page.getByTestId('view-row').first().locator('img')).toHaveAttribute('src', /^blob:/);
});

test('a 24-megapixel photo is made into web sizes (full photo at most 2400px)', async ({ page }) => {
  await openTee(page);
  // a 6000 x 4000 photo made in the browser, handed to the file input as a phone would
  await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 6000; c.height = 4000;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 6000, 4000);
    g.fillStyle = '#24418A'; g.fillRect(1500, 900, 3000, 2200); g.fillStyle = '#C2412D'; g.fillRect(2200, 1500, 1200, 900);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9));
    const dt = new DataTransfer(); dt.items.add(new File([blob], 'IMG_0001.JPG', { type: 'image/jpeg' }));
    const input = document.querySelector('[data-testid="photo-input"]'); input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  const dialog = page.getByRole('dialog', { name: 'Check the cutout' });
  await expect(dialog.getByAltText('The cutout')).toBeVisible({ timeout: 20000 });
  await dialog.getByRole('button', { name: 'Use cutout' }).click();
  await expect(page.getByTestId('view-row')).toHaveCount(2);
  const sizes = await page.evaluate(async () => {
    const db = await new Promise(r => { const q = indexedDB.open('sg-photos', 1); q.onsuccess = () => r(q.result); });
    const all = await new Promise(r => { const q = db.transaction('files').objectStore('files').getAll(); q.onsuccess = () => r(q.result); });
    return Promise.all(all.map(async b => { const i = await createImageBitmap(b); return [b.type, i.width, i.height]; }));
  });
  const full = sizes.find(s => s[0] === 'image/jpeg'), cut = sizes.find(s => s[0] !== 'image/jpeg');
  expect(full).toEqual(['image/jpeg', 2400, 1600]);
  expect(Math.max(cut[1], cut[2])).toBe(640);
  expect(cut[1] / cut[2]).toBeCloseTo(3000 / 2200, 1);                              // trimmed to the piece
});

test('use whole photo fills the stamp', async ({ page }) => {
  await openTee(page);
  await page.getByTestId('photo-input').setInputFiles(path.join(ASSETS, 'bomber2-full.jpg'));
  const dialog = page.getByRole('dialog', { name: 'Check the cutout' });
  await expect(dialog.getByAltText('The cutout')).toBeVisible({ timeout: 15000 });
  await dialog.getByRole('button', { name: 'Use whole photo' }).click();
  await expect(page.getByTestId('view-row').nth(1)).toContainText('fills the stamp');
  await page.getByTestId('view-row').nth(1).getByRole('button', { name: 'Remove photo' }).click();
  await expect(page.getByTestId('view-row')).toHaveCount(1);
});

test('stamp colors are set by the rule, and saving updates other pieces the rule changes', async ({ page }) => {
  await openTee(page);
  await expect(page.getByTestId('rule-color')).toContainText('set by the color rule', { timeout: 10000 });
  await expect(page.getByTestId('rule-color')).toHaveAttribute('data-bg', '#EFE3C8');     // the tee stays cream
  await page.locator('#f-price').fill('13300');
  await page.getByRole('button', { name: 'Save' }).click();
  // the browser rule settles the bag / bucket hat near-tie the other way (see colors.spec.mjs)
  await expect(page.getByTestId('save-state')).toContainText('Stamp colors also updated by the rule');
  await page.goto('/admin/');
  const rows = page.getByTestId('group-live').getByTestId('piece-row');
  await expect(rows.nth(1).locator('.swatch')).toHaveCSS('background-color', 'rgb(217, 140, 106)');   // bag: peach
  await expect(rows.nth(5).locator('.swatch')).toHaveCSS('background-color', 'rgb(232, 181, 58)');    // hat: mustard
});
