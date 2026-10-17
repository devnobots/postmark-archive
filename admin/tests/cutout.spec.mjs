// Phase 2: background removal in the browser, checked against the cutouts already on the site.
import { test, expect } from '@playwright/test';

// photo on a plain background -> its cutout on the site (made earlier with the Python cutout)
const CASES = [['tee-full.jpg', 'tee.webp'], ['bag-full.jpg', 'bag.webp'], ['bomber-full.jpg', 'bomber.webp'], ['jacket-full.jpg', 'jacket.webp'],
  ['socks-full.jpg', 'socks.webp'], ['hat-full.jpg', 'hat.webp'], ['neck-full.jpg', 'neck.webp'], ['levis-full.jpg', 'levis.webp']];

test('cutouts from the original photos match the site\'s cutouts in shape', async ({ page }) => {
  await page.goto('/admin/');
  const got = await page.evaluate(async cases => {
    const c = await import('/admin/src/lib/cutout.mjs');
    const out = [];
    for (const [full, cut] of cases) {
      const blob = await (await fetch('/assets/' + full)).blob();
      const img = c.rotated(await c.loadPhoto(blob), 0);
      const m = c.pieceMask(img, 14);
      const r = await c.cutoutBlob(img, m);
      const ref = new Image(); ref.src = '/assets/' + cut; await ref.decode();
      // corners clear, middle solid
      const g = r.canvas.getContext('2d'), W = r.canvas.width, H = r.canvas.height;
      const a = (x, y) => g.getImageData(x, y, 1, 1).data[3];
      out.push({ full, ar: +r.ar.toFixed(3), refAr: +(ref.naturalHeight / ref.naturalWidth).toFixed(3), corners: [a(0, 0), a(W - 1, 0), a(0, H - 1), a(W - 1, H - 1)], type: r.blob.type, side: Math.max(W, H) });
    }
    return out;
  }, CASES);
  for (const r of got) console.log(r.full, 'ar', r.ar, 'site', r.refAr, 'corners', r.corners.join(','), r.type, r.side);
  for (const r of got) {
    expect(Math.abs(r.ar - r.refAr) / r.refAr, r.full).toBeLessThan(0.08);
    expect(Math.max(...r.corners), r.full).toBeLessThan(40);
    expect(r.side).toBeLessThanOrEqual(640);                           // small photos are not enlarged
    expect(r.type).toBe('image/webp');
  }
});
