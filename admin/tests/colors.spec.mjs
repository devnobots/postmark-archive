// Phase 2: the stamp color rule runs in the browser (admin/src/lib/colors.mjs, the reference since 2026-10-17).
// It uses the same inks, scoring and assignment as tools/stamp_colors.py, with a stable clustering (best of 8 starts)
// so the same photos always give the same colors. The Python tool's clustering starts at random; for today's pieces
// it agrees on 5 of 7. The bag and the bucket hat are a near-tie (143.8 vs 142.2 points in Python) and swap
// mustard/peach; Python's own first run on these photos made the same choice the browser makes.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import vm from 'node:vm';

const sb = { window: {} };
vm.runInNewContext(fs.readFileSync(new URL('../../data/current.js', import.meta.url), 'utf8'), sb);
const ITEMS = JSON.parse(JSON.stringify(sb.window.SG_DATA.items));
const EXPECTED = ['cream', 'peach', 'lilac', 'butter', 'sky', 'mustard', 'brick'];
const NEAR_TIE = [1, 5];                                  // bag, bucket hat

async function run(page) {
  return page.evaluate(async items => {
    const m = await import('/admin/src/lib/colors.mjs');
    const scores = [];
    for (const d of items) scores.push(await m.scoresFor(await (async () => {
      const img = new Image(); img.src = '/' + d.views[0].img; await img.decode();
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
      const g = c.getContext('2d'); g.drawImage(img, 0, 0);
      return m.itemPixels(g.getImageData(0, 0, c.width, c.height).data, c.width, c.height);
    })()));
    return m.assignInks(scores);
  }, ITEMS);
}

test('the browser color rule is stable, uses each ink once, and agrees with the Python tool on clear choices', async ({ page }) => {
  await page.goto('/admin/');
  const a = await run(page), b = await run(page);
  expect(b).toEqual(a);                                                  // same photos, same colors
  expect(a.map(p => p.name)).toEqual(EXPECTED);
  expect(new Set(a.map(p => p.bg)).size).toBe(a.length);                 // every piece a different ink
  for (const p of a) expect(p.ink).toBe(p.name === 'brick' ? '#FFFDF6' : null);
  ITEMS.forEach((d, i) => { if (!NEAR_TIE.includes(i)) expect(a[i].bg, d.nameEn).toBe(d.bg); });
});
