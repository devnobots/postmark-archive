// Deep zoom: a big upload also gets a zoom photo (at most 4000px on its long side) next to the 2400px full photo,
// for both "Use cutout" and "Use whole photo"; a small upload gets none (never enlarged).
import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ASSETS = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../assets');

async function openTee(page) {
  await page.goto('/admin/');
  await page.getByTestId('group-live').getByTestId('piece-row').first().locator('a.piece-main').click();
  await expect(page.locator('#f-price')).toHaveValue('13200');
}

// hand the file input a photo made in the browser (w x h), as a phone would
async function uploadMade(page, w, h) {
  await page.evaluate(async ([w, h]) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#24418A'; g.fillRect(w * 0.25, h * 0.22, w * 0.5, h * 0.55); g.fillStyle = '#C2412D'; g.fillRect(w * 0.37, h * 0.37, w * 0.2, h * 0.22);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9));
    const dt = new DataTransfer(); dt.items.add(new File([blob], 'IMG_0002.JPG', { type: 'image/jpeg' }));
    const input = document.querySelector('[data-testid="photo-input"]'); input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, [w, h]);
}

// the saved piece's last view, with the size of each stored photo
async function lastViewSizes(page) {
  return page.evaluate(async () => {
    const db = JSON.parse(localStorage.getItem('sg-local-db'));
    const tee = db.pieces.find(p => p.id === 'local-1');
    const v = tee.views[tee.views.length - 1];
    const idb = await new Promise(r => { const q = indexedDB.open('sg-photos', 1); q.onsuccess = () => r(q.result); });
    const size = async p => {
      if (!p || !p.startsWith('local:')) return null;
      const b = await new Promise(r => { const q = idb.transaction('files').objectStore('files').get(p.slice(6)); q.onsuccess = () => r(q.result); });
      const i = await createImageBitmap(b); return [b.type, i.width, i.height];
    };
    return { keys: Object.keys(v).sort(), full: await size(v.full), zoom: await size(v.zoom) };
  });
}

for (const [button, label] of [['Use cutout', 'cutout'], ['Use whole photo', 'whole photo']]) {
  test(`a big upload gets a zoom photo of at most 4000px (${label})`, async ({ page }) => {
    await openTee(page);
    await uploadMade(page, 6000, 4000);
    const dialog = page.getByRole('dialog', { name: 'Check the cutout' });
    await expect(dialog.getByAltText('The cutout')).toBeVisible({ timeout: 20000 });
    await dialog.getByRole('button', { name: button }).click();
    await expect(dialog).toHaveCount(0, { timeout: 30000 });
    await expect(page.getByTestId('view-row')).toHaveCount(2);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByTestId('save-state')).toContainText('Saved');
    const r = await lastViewSizes(page);
    expect(r.keys).toContain('zoom');
    expect(r.full).toEqual(['image/jpeg', 2400, 1600]);
    expect(r.zoom[0]).toBe('image/jpeg');
    expect(Math.max(r.zoom[1], r.zoom[2])).toBeLessThanOrEqual(4000);
    expect(r.zoom).toEqual(['image/jpeg', 4000, 2667]);
  });
}

test('a photo no bigger than the full photo gets no zoom photo (never enlarged)', async ({ page }) => {
  await openTee(page);
  await page.getByTestId('photo-input').setInputFiles(path.join(ASSETS, 'hat-full.jpg'));   // 900 x 1200
  const dialog = page.getByRole('dialog', { name: 'Check the cutout' });
  await expect(dialog.getByAltText('The cutout')).toBeVisible({ timeout: 15000 });
  await dialog.getByRole('button', { name: 'Use cutout' }).click();
  await expect(page.getByTestId('view-row')).toHaveCount(2);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByTestId('save-state')).toContainText('Saved');
  const r = await lastViewSizes(page);
  expect(r.keys).not.toContain('zoom');
  expect(r.full).toEqual(['image/jpeg', 900, 1200]);
});
