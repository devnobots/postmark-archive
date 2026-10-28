#!/usr/bin/env python3
"""Postmark Archive: a new seven every week; nothing is cut off after seven days.

The owner's decision (research: one-of-a-kind scarcity sells better than shop-set deadlines, and online time limits
often do no better than no limit; a fixed weekly rhythm is what builds return visits):
- A new drop of seven goes live every Friday (Japan time). When it does, the previous drop moves to past drops and
  its unsold pieces STAY ON SALE there, at the same price. They no longer go back to Draft.
- To take a piece off the site, set it to Draft in the back office (that already works).
- No sale countdown. The homepage shows when the next drop comes: 次の便 11月6日（金）, which is the live drop's
  release date + 7 days, shown during those seven days only.

What changes
- Homepage line under the headline: 金曜に、新しい七点。見つけた町と日付を添えてお届けします。
  (phone: two lines, one sentence each)
- Status line: 第12便 公開中 · 次の便 11月6日（金）   (the あと3日 countdown is removed). On the phone the next
  drop is its own line under the status line, so the line never wraps.
- Past drops (desktop and phone): the line under the title becomes
  これまでの便。残っている品は、今もお求めいただけます。
  each drop's header reads 7点 完売 when all are sold, otherwise 7点 · 残り5点, and unsold pieces open with
  their cart button (that part already worked). A past drop with no pieces left is not shown at all.
- Back office: making a drop live keeps the old drop's unsold pieces with it, on sale; the confirmation and the
  message say so.
- Tests: the countdown tests become next-drop tests, and phase 3's "unsold go back to Draft" checks become
  "unsold stay on sale in past drops". The story line is unchanged.
Safe to run more than once.

Usage
  python3 tools/apply_weekly_drops.py
"""
import os
import sys

SUB_OLD = '七点ずつ、七日間だけ。見つけた町と日付を添えてお届けします。'
SUB_NEW = '金曜に、新しい七点。見つけた町と日付を添えてお届けします。'
ARCH_SUB = 'これまでの便。残っている品は、今もお求めいただけます。'

INDEX = [
    ('line under the headline', '<p class="sub">' + SUB_OLD + '</p>', '<p class="sub">' + SUB_NEW + '</p>'),
    ('next drop instead of the countdown',
     """// homepage drop line reads from DROP. A drop is on sale for seven days from its release date (Japan time):
// dropLeft gives 'あと7日' on release day ... 'あと2日', then '本日まで' on the seventh day, and '' outside those days.
function dropLeft(date, now) {
  var m = /^(\\d{4})\\.(\\d{2})\\.(\\d{2})$/.exec(String(date || ''));
  if (!m) return '';
  var start = Date.UTC(+m[1], +m[2] - 1, +m[3]) - 9 * 3600 * 1000;           // midnight in Japan
  var day = Math.floor((now - start) / 86400000);                              // 0 on release day
  if (day < 0 || day > 6) return '';
  return day === 6 ? '本日まで' : 'あと' + (7 - day) + '日';
}""",
     """// homepage drop line reads from DROP. A new drop comes every week, on the same weekday as this one (Japan time):
// dropNext gives '次の便 11月6日（金）' (release date + 7 days) during the seven days after the release, and ''
// before the release date or once that day has come (until the next drop is published, the line just says 公開中).
function dropNext(date, now) {
  var m = /^(\\d{4})\\.(\\d{2})\\.(\\d{2})$/.exec(String(date || ''));
  if (!m) return '';
  var start = Date.UTC(+m[1], +m[2] - 1, +m[3]) - 9 * 3600 * 1000;           // midnight in Japan
  var day = Math.floor((now - start) / 86400000);                              // 0 on release day
  if (day < 0 || day > 6) return '';
  var next = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + 7));
  return '次の便 ' + (next.getUTCMonth() + 1) + '月' + next.getUTCDate() + '日（' + '日月火水木金土'.charAt(next.getUTCDay()) + '）';
}"""),
    ('status line shows the next drop',
     """    var left = dropLeft(DROP.date, Date.now());
    if (left) el.insertAdjacentHTML('afterend', '<span class="drop-status-dot" aria-hidden="true">·</span><span class="drop-status-left">' + left + '</span>');""",
     """    var next = dropNext(DROP.date, Date.now());
    if (next) el.insertAdjacentHTML('afterend', '<span class="drop-status-dot" aria-hidden="true">·</span><span class="drop-status-next">' + next + '</span>');"""),
]
MOBILE_JS = [
    ('phone line under the headline',
     "phraseHTML('七点ずつ、七日間だけ。') + '<br>'",
     "phraseHTML('金曜に、新しい七点。') + '<br>'"),
    ('phone status line',
     "' 公開中' + (dropLeft(DROP.date, Date.now()) ? ' · ' + dropLeft(DROP.date, Date.now()) : '') + '</b>",
     "' 公開中</b>"),
    ('phone next drop on its own line',
     "<a href=\"drops.html\">過去の便を見る →</a></div>' +\n        (DROP.story",
     "<a href=\"drops.html\">過去の便を見る →</a></div>' +\n"
     "        (dropNext(DROP.date, Date.now()) ? '<div class=\"m-next\">' + dropNext(DROP.date, Date.now()) + '</div>' : '') +\n"
     "        (DROP.story"),
    ('phone past drops line',
     "<div class=\"m-arch-sub\">すべて売約済。</div>",
     "<div class=\"m-arch-sub\">" + ARCH_SUB.replace('。', '。<br>', 1) + "</div>"),       # phone: two lines
    ('phone past drop header',
     "' 公開　·　' + g.ix.length + '点 完売</div>",
     "' 公開　·　' + dropCount(g.ix.map(function (i) { return ITEMS[i]; })) + '</div>"),
    ('dropCount for the phone',
     "  // ---------- the sheet ----------",
     "  // a past drop's count: 7点 完売 when every piece is sold, otherwise 7点 · 残り5点\n"
     "  function dropCount(list) {\n"
     "    var left = list.filter(function (d) { return !d.sold; }).length;\n"
     "    return list.length + '点' + (left ? '　·　残り' + left + '点' : ' 完売');\n"
     "  }\n\n"
     "  // ---------- the sheet ----------"),
]
DROPS = [
    ('past drops line', '<p class="arch-sub">すべて売約済。</p>', '<p class="arch-sub">' + ARCH_SUB + '</p>'),
    ('past drop header',
     "          drop.pieces.length + '点 完売</span></div><div class=\"drop-row\">';",
     "          (function (left) { return drop.pieces.length + '点' + (left ? '</span><span>·</span><span>残り' + left + '点' : ' 完売'); })(\n"
     "            drop.pieces.filter(function (p) { return !p.sold; }).length) + '</span></div><div class=\"drop-row\">';"),
    ('stamp label: price when still on sale',
     "esc(d.nameJa + ' ' + d.price + ' 売約済')",
     "esc(d.nameJa + ' ' + (d.sold ? '売約済' : d.price))"),
]
SITE_DATA = [
    ('a past drop with nothing left is not shown',
     """        .map(p => toSiteItem(p, d)),
    })),
  };
  return '// Postmark Archive: the past drops (newest first).""",
     """        .map(p => toSiteItem(p, d)),
    })).filter(d => d.pieces.length),                               // a past drop with nothing left is not shown
  };
  return '// Postmark Archive: the past drops (newest first)."""),
]
DROPS_PAGE = [
    ('header comment',
     """// (the current one moves to past drops in the same step; its unsold pieces leave the site and go back to Draft,
// one piece, one drop). Publish puts the change on the site.""",
     """// (the current one moves to past drops in the same step; its unsold pieces stay on sale there. To take a piece off
// the site, set it to Draft). Publish puts the change on the site."""),
    ('release keeps the unsold pieces on sale',
     """  // the next drop goes live; the current one becomes a past drop. Its sold pieces stay with it; its unsold pieces
  // leave the site and go back to Draft with no drop (they can be added to a later drop on purpose).
  const release = async d => {
    const ready = inDrop(d).filter(p => ON_SITE(p.status));
    if (!ready.length) return setMsg({ bad: true, text: 'Drop ' + d.no + ' has no Ready pieces yet.' });
    const unsold = live ? inDrop(live).filter(p => p.status === 'ready') : [];
    const text = 'Make Drop ' + d.no + ' the live drop?' + (live ? '\\n\\nDrop ' + live.no + ' moves to past drops.' : '') +
      (unsold.length ? '\\n' + unsold.length + ' unsold piece(s) from Drop ' + live.no + ' leave the site and go back to Draft (no drop). You can add one to a later drop.' : '') +
      '\\n\\nNothing changes on the site until you press Publish to site.';
    if (!window.confirm(text)) return;
    if (live) await update({ resource: 'drops', id: live.id, values: { status: 'past' }, successNotification: false });   // one live drop at a time
    await update({ resource: 'drops', id: d.id, values: { status: 'live', release_date: d.release_date || today() }, successNotification: false });
    for (const p of unsold) await update({ resource: 'pieces', id: p.id, values: { status: 'draft', drop_id: null }, successNotification: false });
    await refresh();
    setMsg({ text: 'Drop ' + d.no + ' is now the live drop' + (live ? ' and Drop ' + live.no + ' is a past drop' : '') +
      (unsold.length ? '. ' + unsold.length + ' unsold piece(s) went back to Draft (no drop)' : '') + '. Press Publish to site to put it on the site.' });
  };""",
     """  // the next drop goes live; the current one becomes a past drop. All its pieces stay with it: sold ones as sold,
  // unsold ones still on sale on the past drops page. To take a piece off the site, set it to Draft.
  const release = async d => {
    const ready = inDrop(d).filter(p => ON_SITE(p.status));
    if (!ready.length) return setMsg({ bad: true, text: 'Drop ' + d.no + ' has no Ready pieces yet.' });
    const unsold = live ? inDrop(live).filter(p => p.status === 'ready') : [];
    const text = 'Make Drop ' + d.no + ' the live drop?' + (live ? '\\n\\nDrop ' + live.no + ' moves to past drops.' : '') +
      (unsold.length ? '\\n' + unsold.length + ' unsold piece(s) from Drop ' + live.no + ' stay on sale on the past drops page. To take one off the site, set it to Draft.' : '') +
      '\\n\\nNothing changes on the site until you press Publish to site.';
    if (!window.confirm(text)) return;
    if (live) await update({ resource: 'drops', id: live.id, values: { status: 'past' }, successNotification: false });   // one live drop at a time
    await update({ resource: 'drops', id: d.id, values: { status: 'live', release_date: d.release_date || today() }, successNotification: false });
    await refresh();
    setMsg({ text: 'Drop ' + d.no + ' is now the live drop' + (live ? ' and Drop ' + live.no + ' is a past drop' : '') +
      (unsold.length ? '. ' + unsold.length + ' unsold piece(s) stay on sale in past drops' : '') + '. Press Publish to site to put it on the site.' });
  };"""),
]
PHASE3 = [
    ('header comment',
     "// Phase 3: drops and archive. Build a drop, preview it, make it live (the old one moves to past drops), publish",
     "// Phase 3: drops and archive. Build a drop, preview it, make it live (the old one moves to past drops, its unsold\n"
     "// pieces still on sale there), publish"),
    ('the message',
     "toContainText(UNSOLD.length + ' unsold piece(s) went back to Draft (no drop)');",
     "toContainText(UNSOLD.length + ' unsold piece(s) stay on sale in past drops');"),
    ('past drops show every piece of Drop 12',
     "  await expect(page.locator('.drop').first().locator('.past-stamp')).toHaveCount(1);   // its sold piece: the socks\n"
     "  // the unsold pieces are in neither file, and wait in the list as drafts with no drop\n",
     "  const ALL12 = SB.window.SG_DATA.items.length;\n"
     "  await expect(page.locator('.drop').first().locator('.past-stamp')).toHaveCount(ALL12);   // sold and unsold\n"
     "  await expect(page.locator('.drop').first().locator('.drop-head')).toContainText(ALL12 + '点·残り' + UNSOLD.length + '点');\n"
     "  await expect(page.locator('.arch-sub')).toHaveText('" + ARCH_SUB + "');\n"
     "  // an unsold piece in past drops opens with its cart button\n"
     "  await page.locator('.drop').first().locator('.past-stamp .stamp:not(.is-sold)').first().click();\n"
     "  await expect(page.locator('.buy .cart')).toHaveText('カートに入れる');\n"
     "  // the unsold pieces stay with Drop 12 in past.js, and none go back to Draft\n"),
    ('past.js keeps every piece',
     "  expect(drop12.pieces.map(d => d.nameEn)).toEqual(SB.window.SG_DATA.items.filter(d => d.sold).map(d => d.nameEn));   // only the sold socks",
     "  expect(drop12.pieces.map(d => d.nameEn)).toEqual(SB.window.SG_DATA.items.map(d => d.nameEn));   // every piece, in order\n"
     "  expect(drop12.pieces.filter(d => !d.sold).map(d => d.nameEn)).toEqual(UNSOLD);"),
    ('no loose drafts',
     """  const loose = page.getByTestId('group-loose').getByTestId('piece-row');
  await expect(loose).toHaveCount(UNSOLD.length);
  for (let i = 0; i < UNSOLD.length; i++) await expect(loose.nth(i).locator('.chip').first()).toHaveText('Draft');""",
     """  await expect(page.getByTestId('group-live').getByTestId('piece-row')).toHaveCount(1);   // the new drop's hat
  await expect(page.getByTestId('group-loose')).toHaveCount(0);                            // nothing went back to Draft"""),
]
STORY_OLD = "// The seven-day drop in words: the line under the headline, the countdown (Japan time) and the drop's story line.\nimport { test, expect } from '@playwright/test';\n\nconst SUB = '七点ずつ、七日間だけ。見つけた町と日付を添えてお届けします。';\nconst STORY = 'マウントドーラのハロルドさんが、四十年かけて集めた万年筆。';\n\n// Drop 12 (data/current.js) was released 2026.10.09, Japan time\nasync function home(page, when, width = 1280) {\n  await page.clock.setFixedTime(new Date(when));\n  await page.setViewportSize({ width, height: width < 760 ? 812 : 880 });\n  await page.addInitScript(() => localStorage.setItem('sg-access', '1234'));\n  await page.goto('/index.html');\n}\n\ntest('desktop: the line under the headline, and the countdown through the seven days', async ({ page }) => {\n  const cases = [\n    ['2026-10-08T23:59:00+09:00', null],          // before release: no countdown\n    ['2026-10-09T00:00:00+09:00', 'あと7日'],      // release day\n    ['2026-10-11T12:00:00+09:00', 'あと5日'],\n    ['2026-10-14T23:59:00+09:00', 'あと2日'],\n    ['2026-10-15T00:00:00+09:00', '本日まで'],     // the seventh day\n    ['2026-10-16T00:00:00+09:00', null],          // over: no countdown\n  ];\n  for (const [when, left] of cases) {\n    await home(page, when);\n    await expect(page.locator('p.sub')).toHaveText(SUB);\n    await expect(page.locator('.drop-status-current')).toHaveText('第12便 公開中');\n    if (left) await expect(page.locator('.drop-status-left')).toHaveText(left);\n    else await expect(page.locator('.drop-status-left')).toHaveCount(0);\n    await expect(page.locator('.drop-status-lockup .drop-status-dot')).toHaveCount(left ? 2 : 1);\n    await expect(page.locator('#dropStory')).toBeHidden();                       // Drop 12 has no story\n  }\n});\n\ntest('phone: the same line and countdown; 全N点 stays when there is no story', async ({ page }) => {\n  await home(page, '2026-10-11T12:00:00+09:00', 375);\n  await expect(page.locator('.m-sub')).toHaveText(SUB);\n  await expect(page.locator('.m-sub br')).toHaveCount(1);                          // two sentences, two lines\n  await expect(page.locator('.m-sub .ph')).toHaveText(['七点ずつ、', '七日間だけ。', '見つけた', '町と', '日付を', '添えて', 'お届けします。']);\n  await expect(page.locator('.m-dropline b')).toHaveText('第12便 公開中 · あと5日');\n  await expect(page.locator('.m-count')).toHaveText(/^全\\d+点$/);\n  await expect(page.locator('.m-story')).toHaveCount(0);\n  await home(page, '2026-10-20T12:00:00+09:00', 375);\n  await expect(page.locator('.m-dropline b')).toHaveText('第12便 公開中');\n});\n\n"
STORY_NEW = "// The weekly drop in words: the line under the headline, the next drop's date (Japan time) and the drop's story line.\nimport { test, expect } from '@playwright/test';\n\nconst SUB = '金曜に、新しい七点。見つけた町と日付を添えてお届けします。';\nconst STORY = 'マウントドーラのハロルドさんが、四十年かけて集めた万年筆。';\n\n// Drop 12 (data/current.js) was released 2026.10.09 (a Friday), Japan time; the next drop is 10月16日（金）\nasync function home(page, when, width = 1280) {\n  await page.clock.setFixedTime(new Date(when));\n  await page.setViewportSize({ width, height: width < 760 ? 812 : 880 });\n  await page.addInitScript(() => localStorage.setItem('sg-access', '1234'));\n  await page.goto('/index.html');\n}\n\ntest('desktop: the line under the headline, and the next drop during the seven days', async ({ page }) => {\n  const cases = [\n    ['2026-10-08T23:59:00+09:00', null],                   // before release: nothing\n    ['2026-10-09T00:00:00+09:00', '次の便 10月16日（金）'],  // release day\n    ['2026-10-11T12:00:00+09:00', '次の便 10月16日（金）'],\n    ['2026-10-15T23:59:00+09:00', '次の便 10月16日（金）'],  // the last day before it\n    ['2026-10-16T00:00:00+09:00', null],                   // the day has come: the line just says 公開中\n  ];\n  for (const [when, next] of cases) {\n    await home(page, when);\n    await expect(page.locator('p.sub')).toHaveText(SUB);\n    await expect(page.locator('.drop-status-current')).toHaveText('第12便 公開中');\n    if (next) await expect(page.locator('.drop-status-next')).toHaveText(next);\n    else await expect(page.locator('.drop-status-next')).toHaveCount(0);\n    await expect(page.locator('.drop-status-left')).toHaveCount(0);                // no sale countdown any more\n    await expect(page.locator('.drop-status-lockup .drop-status-dot')).toHaveCount(next ? 2 : 1);\n    await expect(page.locator('#dropStory')).toBeHidden();                       // Drop 12 has no story\n  }\n  // across a month end: released 2026.10.30 → next 11月6日（金）\n  expect(await page.evaluate(() => dropNext('2026.10.30', Date.parse('2026-10-31T12:00:00+09:00')))).toBe('次の便 11月6日（金）');\n});\n\ntest('phone: the same line and next drop; 全N点 stays when there is no story', async ({ page }) => {\n  await home(page, '2026-10-11T12:00:00+09:00', 375);\n  await expect(page.locator('.m-sub')).toHaveText(SUB);\n  await expect(page.locator('.m-sub br')).toHaveCount(1);                          // two sentences, two lines\n  await expect(page.locator('.m-sub .ph')).toHaveText(['金曜に、', '新しい', '七点。', '見つけた', '町と', '日付を', '添えて', 'お届けします。']);\n  await expect(page.locator('.m-dropline b')).toHaveText('第12便 公開中');\n  await expect(page.locator('.m-next')).toHaveText('次の便 10月16日（金）');\n  await expect(page.locator('.m-count')).toHaveText(/^全\\d+点$/);\n  await expect(page.locator('.m-story')).toHaveCount(0);\n  await home(page, '2026-10-20T12:00:00+09:00', 375);\n  await expect(page.locator('.m-dropline b')).toHaveText('第12便 公開中');\n  await expect(page.locator('.m-next')).toHaveCount(0);\n});\n\ntest('past drops: the new line, and a drop header counts what is left', async ({ page }) => {\n  await page.addInitScript(() => localStorage.setItem('sg-access', '1234'));\n  await page.goto('/drops.html');\n  await expect(page.locator('.arch-sub')).toHaveText('これまでの便。残っている品は、今もお求めいただけます。');\n  const heads = await page.locator('.drop-head').allTextContents();\n  for (const h of heads) expect(h).toMatch(/·\\d+点( 完売|·残り\\d+点)$/);\n  await page.setViewportSize({ width: 375, height: 812 });\n  await page.goto('/drops.html');\n  await expect(page.locator('.m-arch-sub')).toHaveText('これまでの便。残っている品は、今もお求めいただけます。');\n  for (const h of await page.locator('.m-drop-head').allTextContents()) expect(h).toMatch(/\\d+点( 完売|　·　残り\\d+点)$/);\n});\n\n"
STORY_SPEC = [('countdown tests become next-drop tests', STORY_OLD, STORY_NEW)]
MOBILE_CSS = [
    ('phone next-drop line',
     ".m-dropline b { color: #1a2433; font-weight: 600; }",
     ".m-dropline b { color: #1a2433; font-weight: 600; }\n"
     ".m-next { margin-top: 10px; font-family: 'Shippori Mincho', serif; font-size: 13px; letter-spacing: .16em; color: #1a2433; }"),
]
FILES = {
    'index.html': (INDEX, 'dropNext'),
    'mobile.js': (MOBILE_JS, 'dropCount'),
    'mobile.css': (MOBILE_CSS, '.m-next'),
    'drops.html': (DROPS, ARCH_SUB),
    'admin/src/lib/site-data.mjs': (SITE_DATA, 'a past drop with nothing left is not shown'),
    'admin/src/DropsPage.jsx': (DROPS_PAGE, 'stay on sale on the past drops page'),
    'admin/tests/phase3.spec.mjs': (PHASE3, 'stay on sale in past drops'),
    'admin/tests/story.spec.mjs': (STORY_SPEC, "dropNext('2026.10.30'"),
}


def main():
    if len(sys.argv) != 1 or not os.path.exists('index.html'):
        sys.exit('Usage: python3 tools/apply_weekly_drops.py   (from the site folder)')
    srcs = {f: open(f, encoding='utf-8').read() for f in FILES}
    done = [f for f, s in srcs.items() if FILES[f][1] in s]
    if len(done) == len(FILES):
        print('already applied')
        return
    if done:
        sys.exit('ERROR: nothing changed. Only some files have the change already: ' + ', '.join(done))
    problems = []
    for f, s in srcs.items():
        for label, old, _ in FILES[f][0]:
            if s.count(old) != 1:
                problems.append('%s, %s: found %d (expected 1)' % (f, label, s.count(old)))
    if problems:
        print('ERROR: nothing changed. Problems:')
        for p in problems:
            print('  - ' + p)
        sys.exit(1)
    for f, s in srcs.items():
        for _, old, new in FILES[f][0]:
            s = s.replace(old, new, 1)
        open(f, 'w', encoding='utf-8').write(s)
        print('updated: ' + f)


if __name__ == '__main__':
    main()
