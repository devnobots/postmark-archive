// C7 test 8: the site itself is unchanged by the back office.
// The baseline images in tests/baseline/ were taken before any part C code existed.
import { test, expect } from '@playwright/test';

const SIZES = [
  { name: 'desktop', width: 1280, height: 880 },
  { name: 'phone', width: 375, height: 812 },
];

for (const s of SIZES) {
  test(`site at ${s.name} still asks for the access code`, async ({ page }) => {
    await page.setViewportSize({ width: s.width, height: s.height });
    await page.goto('/index.html');
    await expect(page.locator('#gate')).toBeVisible();
    await expect(page.locator('body')).toHaveClass(/locked/);
  });

  test(`site at ${s.name} looks the same with the code saved`, async ({ page }) => {
    await page.setViewportSize({ width: s.width, height: s.height });
    await page.addInitScript(() => localStorage.setItem('sg-access', '1234'));
    await page.goto('/index.html');
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(4000);                      // the fan deals out after its images load
    await expect(page).toHaveScreenshot(`site-${s.name}.png`, { animations: 'disabled', maxDiffPixels: 0 });
  });
}

// the past-drops page (phase 3 moves its data to data/past.js; it must look exactly the same)
const DROPS = [
  { name: 'drops-desktop', width: 1280, height: 880, hash: '' },
  { name: 'drops-phone', width: 375, height: 812, hash: '' },
  { name: 'drops-sold-desktop', width: 1280, height: 880, hash: '#no9-1960s-usaf-ma-1-flight-jacket' },
  { name: 'drops-sold-phone', width: 375, height: 812, hash: '#no11-1970s-ringer-tee-with-concho-trim' },
];
for (const s of DROPS) {
  test(`past drops ${s.name} looks the same`, async ({ page }) => {
    await page.setViewportSize({ width: s.width, height: s.height });
    await page.goto('/drops.html' + s.hash);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1500);
    await expect(page).toHaveScreenshot(`${s.name}.png`, { animations: 'disabled', fullPage: !s.hash, maxDiffPixels: 0 });
  });
}
