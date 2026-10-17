// Screenshots of the back office for the owner (not a test). With the dev server running:
//   cd admin && node tests/take-screenshots.mjs
import { chromium } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'screenshots');
const BASE = 'http://localhost:5173';
const LONG = '1960年代 アメリカ空軍 USAF MA-1 フライトジャケット セージグリーン 前期型';
const b = await chromium.launch();
const shot = async (p, name) => p.screenshot({ path: path.join(OUT, name + '.png') });
const page = async (w, h) => b.newPage({ viewport: { width: w, height: h } });

for (const [w, h, s] of [[375, 812, '375'], [1280, 880, '1280']]) {
  const p = await page(w, h);
  await p.goto(BASE + '/admin/');
  await p.waitForSelector('main.list[data-meter="ready"]');
  await shot(p, 'list-' + s);
  await p.goto(BASE + '/admin/pieces/local-3');
  await p.waitForSelector('[data-testid="fit-line"]');
  await p.waitForTimeout(2500);
  if (s === '375') {
    await shot(p, 'editor-375-input');
    await p.getByRole('tab', { name: 'Preview' }).click();
    await p.waitForTimeout(2500);
    await shot(p, 'editor-375-preview');
  } else {
    await shot(p, 'editor-1280');
    await p.locator('#f-ja').fill(LONG);
    await p.waitForSelector('[data-testid="fit-problems"]');
    await p.waitForTimeout(1500);
    await shot(p, 'editor-long-title');
    await p.route('**/api/suggest-titles', r => r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ ja: [LONG, '60年代 MA-1 フライトジャケット', '60年代 USAF MA-1 フライトジャケット'], en: ['1960s MA-1 Flight Jacket'], cap: ['MA-1'] }) }));
    await p.getByRole('button', { name: 'Suggest shorter titles' }).click();
    await p.waitForSelector('[data-testid="ideas"]');
    await shot(p, 'editor-title-ideas');
  }
  await p.close();
}
// phases 2-3: the drops page, the cutout check and a sold piece, at phone size
{
  const p = await page(375, 812);
  await p.goto(BASE + '/admin/drops');
  await p.getByRole('button', { name: '+ New drop' }).click();
  await p.waitForSelector('[data-testid="drop-13"]');
  await shot(p, 'drops-375');
  await p.goto(BASE + '/admin/pieces/local-3');
  await p.waitForSelector('[data-testid="photo-input"]', { state: 'attached' });
  await p.getByTestId('photo-input').setInputFiles(path.join(path.dirname(fileURLToPath(import.meta.url)), '../../assets/jacket-full.jpg'));
  await p.getByRole('dialog').getByAltText('The cutout').waitFor();
  await p.waitForTimeout(500);
  await shot(p, 'cutout-check-375');
  await p.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
  await p.getByRole('group', { name: 'Status' }).getByRole('button', { name: 'Sold' }).click();
  await p.getByLabel('The buyer shared their Instagram').check();
  await p.getByLabel("Buyer's Instagram handle").fill('tsubasa.1987');
  await p.locator('.sold-box').scrollIntoViewIfNeeded();
  await shot(p, 'editor-sold-375');
  await p.close();
}
{
  const p = await page(1280, 880);
  await p.goto(BASE + '/admin/drops');
  await p.getByTestId('drop-12').getByRole('button', { name: 'Preview the drop' }).click();
  await p.waitForSelector('[data-testid="drop-preview"] iframe');
  await p.waitForTimeout(4000);
  await shot(p, 'drops-preview-1280');
  await p.close();
}
await b.close();
console.log('screenshots saved to ' + OUT);
