// The weekly drop in words: the line under the headline, the next drop's date (Japan time) and the drop's story line.
import { test, expect } from '@playwright/test';

const SUB = '金曜に、新しい七点。見つけた町と日付を添えてお届けします。';
const STORY = 'マウントドーラのハロルドさんが、四十年かけて集めた万年筆。';

// Drop 12 (data/current.js) was released 2026.10.09 (a Friday), Japan time; the next drop is 10月16日（金）
async function home(page, when, width = 1280) {
  await page.clock.setFixedTime(new Date(when));
  await page.setViewportSize({ width, height: width < 760 ? 812 : 880 });
  await page.addInitScript(() => localStorage.setItem('sg-access', '1234'));
  await page.goto('/index.html');
}

test('desktop: the line under the headline, and the next drop during the seven days', async ({ page }) => {
  const cases = [
    ['2026-10-08T23:59:00+09:00', null],                   // before release: nothing
    ['2026-10-09T00:00:00+09:00', '次の便 10月16日（金）'],  // release day
    ['2026-10-11T12:00:00+09:00', '次の便 10月16日（金）'],
    ['2026-10-15T23:59:00+09:00', '次の便 10月16日（金）'],  // the last day before it
    ['2026-10-16T00:00:00+09:00', null],                   // the day has come: the line just says 公開中
  ];
  for (const [when, next] of cases) {
    await home(page, when);
    await expect(page.locator('p.sub')).toHaveText(SUB);
    await expect(page.locator('.drop-status-current')).toHaveText('第12便 公開中');
    if (next) await expect(page.locator('.drop-status-next')).toHaveText(next);
    else await expect(page.locator('.drop-status-next')).toHaveCount(0);
    await expect(page.locator('.drop-status-left')).toHaveCount(0);                // no sale countdown any more
    await expect(page.locator('.drop-status-lockup .drop-status-dot')).toHaveCount(next ? 2 : 1);
    await expect(page.locator('#dropStory')).toBeHidden();                       // Drop 12 has no story
  }
  // across a month end: released 2026.10.30 → next 11月6日（金）
  expect(await page.evaluate(() => dropNext('2026.10.30', Date.parse('2026-10-31T12:00:00+09:00')))).toBe('次の便 11月6日（金）');
});

test('phone: the same line and next drop; 全N点 stays when there is no story', async ({ page }) => {
  await home(page, '2026-10-11T12:00:00+09:00', 375);
  await expect(page.locator('.m-sub')).toHaveText(SUB);
  await expect(page.locator('.m-sub br')).toHaveCount(1);                          // two sentences, two lines
  await expect(page.locator('.m-sub .ph')).toHaveText(['金曜に、', '新しい', '七点。', '見つけた', '町と', '日付を', '添えて', 'お届けします。']);
  await expect(page.locator('.m-dropline b')).toHaveText('第12便 公開中');
  await expect(page.locator('.m-next')).toHaveText('次の便 10月16日（金）');
  await expect(page.locator('.m-count')).toHaveText(/^全\d+点$/);
  await expect(page.locator('.m-story')).toHaveCount(0);
  await home(page, '2026-10-20T12:00:00+09:00', 375);
  await expect(page.locator('.m-dropline b')).toHaveText('第12便 公開中');
  await expect(page.locator('.m-next')).toHaveCount(0);
});

test('past drops: the new line, and a drop header counts what is left', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('sg-access', '1234'));
  await page.goto('/drops.html');
  await expect(page.locator('.arch-sub')).toHaveText('これまでの便。残っている品は、今もお求めいただけます。');
  const heads = await page.locator('.drop-head').allTextContents();
  for (const h of heads) expect(h).toMatch(/·\d+点( 完売|·残り\d+点)$/);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/drops.html');
  await expect(page.locator('.m-arch-sub')).toHaveText('これまでの便。残っている品は、今もお求めいただけます。');
  for (const h of await page.locator('.m-drop-head').allTextContents()) expect(h).toMatch(/\d+点( 完売|　·　残り\d+点)$/);
});

test('back office: a story line, saved on the drop, shows in the preview and in the published file', async ({ page }) => {
  await page.goto('/admin/drops');
  const field = page.getByTestId('story-12');
  await expect(field).toHaveValue('');
  await field.fill(STORY);
  await field.blur();
  await expect(page.getByTestId('drops-msg')).toContainText('Drop 12: story line saved');
  await page.getByTestId('drop-12').getByRole('button', { name: 'Preview the drop' }).click();
  const homeFrame = page.frameLocator('[data-testid="drop-preview"] iframe[data-frame="home"]');
  await expect(homeFrame.locator('#dropStory')).toHaveText('今回の便：' + STORY, { timeout: 15000 });
  // phrases: 今回の|便：|マウントドーラの|ハロルドさんが、|四十年かけて|集めた|万年筆。
  await expect(homeFrame.locator('#dropStory .ph')).toHaveText(['今回の', '便：', 'マウントドーラの', 'ハロルドさんが、', '四十年かけて', '集めた', '万年筆。']);
  const sheet = page.frameLocator('[data-testid="drop-preview"] iframe[data-frame="sheet"]');
  await expect(sheet.locator('.m-story')).toHaveText('今回の便：' + STORY);
  await expect(sheet.locator('.m-count')).toHaveCount(0);
  // publish: data/current.js carries it
  await expect(page.locator('main.list')).toHaveAttribute('data-meter', 'ready', { timeout: 15000 });
  const downloads = [];
  page.on('download', d => downloads.push(d));
  await page.getByRole('button', { name: 'Publish to site' }).click();
  await expect.poll(() => downloads.length, { timeout: 15000 }).toBe(2);
  const current = downloads.find(d => d.suggestedFilename() === 'current.js');
  const fs = await import('node:fs');
  expect(fs.readFileSync(await current.path(), 'utf8')).toContain('"story": "' + STORY + '"');
  // empty again: the line goes away
  await field.fill('');
  await field.blur();
  await expect(page.getByTestId('drops-msg')).toContainText('Drop 12: story line saved');
});
