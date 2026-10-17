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
