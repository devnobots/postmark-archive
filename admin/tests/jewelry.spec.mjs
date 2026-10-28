// A jewelry drop: ticked on the Drops page, the drop's stamps get the light neutral inks (option B), by the same
// colour rule; unticked, the nine stamp inks come back.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import vm from 'node:vm';

const NEUTRALS = ['#ECE5D6', '#DCD5C7', '#E0E2DB', '#E6DDCB', '#D8D6CF', '#E9E3D9', '#D9D2C3', '#E3E0D7', '#EFE8DA'];
const INKS = ['#E8B53A', '#F2D98A', '#D98C6A', '#C2412D', '#9DC3D9', '#6E9E8C', '#A9B79A', '#C9B3D6', '#EFE3C8'];

async function publish(page) {
  await expect(page.locator('main.list')).toHaveAttribute('data-meter', 'ready', { timeout: 15000 });
  const downloads = [];
  page.on('download', d => downloads.push(d));
  await page.getByRole('button', { name: 'Publish to site' }).click();
  await expect.poll(() => downloads.length, { timeout: 20000 }).toBe(2);
  const current = downloads.find(d => d.suggestedFilename() === 'current.js');
  const sb = { window: {} };
  vm.runInNewContext(fs.readFileSync(await current.path(), 'utf8'), sb);
  return sb.window.SG_DATA.items.map(d => d.bg);
}

test('the colour rule with the neutral inks: each piece a different neutral, the same every time', async ({ page }) => {
  await page.goto('/admin/');
  const run = () => page.evaluate(async () => {
    const m = await import('/admin/src/lib/colors.mjs');
    const urls = ['/assets/tee.webp', '/assets/bag.webp', '/assets/hat.webp'];
    const scores = await Promise.all(urls.map(u => m.scoresForImage(u, m.NEUTRAL_PALETTE)));
    return { pick: m.assignInks(scores, m.NEUTRAL_PALETTE), dflt: m.paletteFor({ jewelry: false }) === m.PALETTE, jewel: m.paletteFor({ jewelry: true }) === m.NEUTRAL_PALETTE };
  });
  const a = await run(), b = await run();
  expect(b).toEqual(a);
  expect(a.dflt).toBe(true);
  expect(a.jewel).toBe(true);
  for (const p of a.pick) { expect(NEUTRALS).toContain(p.bg); expect(p.ink).toBeNull(); }
  expect(new Set(a.pick.map(p => p.bg)).size).toBe(3);
});

test('back office: tick Jewelry on the live drop, publish, and every stamp is a neutral; untick and the inks come back', async ({ page }) => {
  await page.goto('/admin/drops');
  const box = page.getByTestId('jewelry-12');
  await expect(box).not.toBeChecked();
  await box.check();
  await expect(page.getByTestId('drops-msg')).toContainText('Drop 12: jewelry colours on');
  await expect(box).toBeChecked();
  const on = await publish(page);
  expect(on.length).toBeGreaterThan(0);
  for (const bg of on) expect(NEUTRALS).toContain(bg);
  expect(new Set(on).size).toBe(on.length);
  // the piece editor shows a neutral, named by the rule
  await page.goto('/admin/');
  await page.getByTestId('group-live').getByTestId('piece-row').first().locator('a.piece-main').click();
  await expect(page.getByTestId('rule-color')).toContainText('set by the color rule', { timeout: 15000 });
  expect(NEUTRALS).toContain(await page.getByTestId('rule-color').getAttribute('data-bg'));
  // off again
  await page.goto('/admin/drops');
  await page.getByTestId('jewelry-12').uncheck();
  await expect(page.getByTestId('drops-msg')).toContainText('Drop 12: jewelry colours off');
  const off = await publish(page);
  for (const bg of off) expect(INKS).toContain(bg);
});
