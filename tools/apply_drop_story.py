#!/usr/bin/env python3
"""Postmark Archive: the seven-day drop in words, for any kind of drop (clothes or a collection).

What changes
- Homepage line under the headline (desktop and phone):
      七点ずつ、七日間だけ。見つけた町と日付を添えてお届けします。
- Status line: a countdown after 第N便 公開中, worked out in the visitor's browser from the drop's release date (Japan
  time). A drop is on sale for seven days: release day shows あと7日, then あと6日 ... あと2日, the seventh day shows
  本日まで. Before the release date or after the seventh day, no countdown is shown (the line reads as before).
- A story line under it, when the drop has one:  今回の便：<story>
  Clothes: 今回の便：フロリダ州マウントドーラとオーランドで見つけた七点。
  A collection: 今回の便：マウントドーラのハロルドさんが、四十年かけて集めた万年筆。
  Empty story: no line (desktop), and the phone keeps 全N点.
  Lines break only between phrases (after 、 。 ： or where hiragana meets kanji or katakana), so a phone never
  splits a word.
- Back office: each live or upcoming drop gets a "Story line" field; the drop's story goes into data/current.js
  (only when not empty) and into the preview.
- supabase/migrations/0003_drop_story.sql adds the column.
Nothing else on the pages changes. Safe to run more than once.

Usage
  python3 tools/apply_drop_story.py
"""
import os
import sys

SUB = '七点ずつ、七日間だけ。見つけた町と日付を添えてお届けします。'
MARK = 'dropStory'

HOME_JS = r"""// homepage drop line reads from DROP. A drop is on sale for seven days from its release date (Japan time):
// dropLeft gives 'あと7日' on release day ... 'あと2日', then '本日まで' on the seventh day, and '' outside those days.
function dropLeft(date, now) {
  var m = /^(\d{4})\.(\d{2})\.(\d{2})$/.exec(String(date || ''));
  if (!m) return '';
  var start = Date.UTC(+m[1], +m[2] - 1, +m[3]) - 9 * 3600 * 1000;           // midnight in Japan
  var day = Math.floor((now - start) / 86400000);                              // 0 on release day
  if (day < 0 || day > 6) return '';
  return day === 6 ? '本日まで' : 'あと' + (7 - day) + '日';
}
// Japanese text that may only break between phrases, so a narrow phone never splits a word: after 、 。 ： and
// where hiragana meets kanji or katakana (マウントドーラと|オーランドで|見つけた|七点。). Each phrase is a span.
function phraseHTML(text) {
  var s = String(text), out = [], cur = '';
  for (var i = 0; i < s.length; i++) {
    var c = s.charAt(i), n = s.charAt(i + 1);
    cur += c;
    var nn = s.charAt(i + 2), kana = /[ぁ-ゖ]/, kanji = /[一-龯々ァ-ヺ]/;
    var prefix = /[おご]/.test(c) && kanji.test(n);                             // お届け, ご案内 stay whole
    var before = kana.test(c) && /[おご]/.test(n) && kanji.test(nn);           // 添えて|お届けします
    if ('、。：'.indexOf(c) >= 0 || before || (kana.test(c) && kanji.test(n) && !prefix)) { out.push(cur); cur = ''; }
  }
  if (cur) out.push(cur);
  return out.map(function (p) { return '<span class="ph">' + esc(p) + '</span>'; }).join('');
}
(function () {
  var el = document.querySelector('.drop-status-current');
  if (el) {
    el.textContent = DROP_LABEL + ' 公開中';
    var left = dropLeft(DROP.date, Date.now());
    if (left) el.insertAdjacentHTML('afterend', '<span class="drop-status-dot" aria-hidden="true">·</span><span class="drop-status-left">' + left + '</span>');
  }
  var st = document.getElementById('dropStory');
  if (st && DROP.story) { st.innerHTML = phraseHTML('今回の便：' + DROP.story); st.hidden = false; }
})();"""

INDEX = [
    ('story style',
     '  .hint { font-size: 12px; color: var(--ink-3); }',
     '  .hint { font-size: 12px; color: var(--ink-3); }\n'
     '  .story { font-size: 14px; color: var(--ink-2); letter-spacing: 0.06em; }\n'
     '  .ph { display: inline-block; }'),
    ('line under the headline, and the story line',
     '<p class="sub">見つけた町と日付を添えて、ひとつずつお届けします。</p>',
     '<p class="sub">' + SUB + '</p>\n    <p class="story" id="dropStory" hidden></p>'),
    ('countdown and story',
     "// homepage drop line reads from DROP\n(function () { var el = document.querySelector('.drop-status-current'); if (el) el.textContent = DROP_LABEL + ' 公開中'; })();",
     HOME_JS),
]
MOBILE_JS = [
    ('phone head',
     "'<div class=\"m-head\"><h1>アメリカから、一点もの。</h1>' +\n"
     "        '<div class=\"m-dropline\"><b>' + esc(DROP_LABEL) + ' 公開中</b>　·　<a href=\"drops.html\">過去の便を見る →</a></div>' +\n"
     "        '<div class=\"m-count\">全' + ITEMS.length + '点</div></div>' +",
     "'<div class=\"m-head\"><h1>アメリカから、一点もの。</h1>' +\n"
     "        '<div class=\"m-sub\">' + phraseHTML('七点ずつ、七日間だけ。') + '<br>' + phraseHTML('見つけた町と日付を添えてお届けします。') + '</div>' +\n"
     "        '<div class=\"m-dropline\"><b>' + esc(DROP_LABEL) + ' 公開中' + (dropLeft(DROP.date, Date.now()) ? ' · ' + dropLeft(DROP.date, Date.now()) : '') + '</b>　·　<a href=\"drops.html\">過去の便を見る →</a></div>' +\n"
     "        (DROP.story ? '<div class=\"m-story\">' + phraseHTML('今回の便：' + DROP.story) + '</div>' : '<div class=\"m-count\">全' + ITEMS.length + '点</div>') + '</div>' +"),
]
MOBILE_CSS = [
    ('phone sub and story lines',
     ".m-count { margin-top: 18px; font-family: 'Shippori Mincho', serif; font-size: 12px; letter-spacing: .2em; color: #6b6e72; }",
     ".m-count { margin-top: 18px; font-family: 'Shippori Mincho', serif; font-size: 12px; letter-spacing: .2em; color: #6b6e72; }\n"
     ".m-sub { margin-top: 10px; font-family: 'Shippori Mincho', serif; font-size: 13px; letter-spacing: .04em; line-height: 1.7; color: #4a4f57; }\n"
     ".m-story { margin-top: 18px; font-family: 'Shippori Mincho', serif; font-size: 13px; letter-spacing: .04em; line-height: 1.7; color: #6b6e72; }\n"
     ".m-sub .ph, .m-story .ph { display: inline-block; }"),
]
SITE_DATA = [
    ('current.js carries the story',
     "    drop: { no: drop.no, date: siteDropDate(drop.release_date) },\n    items: pieces",
     "    drop: siteDropData(drop),\n    items: pieces"),
    ('siteDropData',
     "// '2026-10-09' -> '2026.10.09'\nexport function siteDropDate(iso) { return iso ? iso.replace(/-/g, '.') : ''; }",
     "// '2026-10-09' -> '2026.10.09'\nexport function siteDropDate(iso) { return iso ? iso.replace(/-/g, '.') : ''; }\n\n"
     "// the homepage's drop: { no, date } plus story (今回の便：...) only when the drop has one\n"
     "export function siteDropData(drop) {\n"
     "  const d = { no: drop.no, date: siteDropDate(drop.release_date) };\n"
     "  const story = String(drop.story || '').trim();\n"
     "  if (story) d.story = story;\n"
     "  return d;\n"
     "}"),
]
METER = [
    ('preview carries the story',
     "import { toSiteItem, siteDropDate } from './lib/site-data.mjs';",
     "import { toSiteItem, siteDropData } from './lib/site-data.mjs';"),
    ('siteDrop',
     "export function siteDrop(drop) { return { no: drop ? drop.no : 1, date: drop ? siteDropDate(drop.release_date) : '' }; }",
     "export function siteDrop(drop) { return drop ? siteDropData(drop) : { no: 1, date: '' }; }"),
]
DROPS_PAGE = [
    ('save the story',
     "  const setDate = async (d, date) => {",
     "  const setStory = async (d, story) => {\n"
     "    try {\n"
     "      await update({ resource: 'drops', id: d.id, values: { story }, successNotification: false, errorNotification: false });\n"
     "      await refresh();\n"
     "      setMsg({ text: 'Drop ' + d.no + ': story line saved. Press Publish to site to put it on the site.' });\n"
     "    } catch (e) {\n"
     "      setMsg({ bad: true, text: 'Drop ' + d.no + ': the story line was not saved (' + ((e && e.message) || e) + '). If the database says the column story does not exist, run supabase/migrations/0003_drop_story.sql in the Supabase SQL editor.' });\n"
     "    }\n"
     "  };\n"
     "  const setDate = async (d, date) => {"),
    ('story field on live and upcoming drops',
     "            ) : <div className=\"note\">Released {d.release_date ? siteDropDate(d.release_date) : '—'}</div>}\n",
     "            ) : <div className=\"note\">Released {d.release_date ? siteDropDate(d.release_date) : '—'}</div>}\n"
     "            {kind !== 'past' && <StoryField drop={d} onSave={v => setStory(d, v)} />}\n"),
    ('StoryField',
     "// the whole drop as the homepage will show it",
     "// the drop's story line: shown under the homepage headline as 今回の便：<story>. Saved when the field loses focus.\n"
     "function StoryField({ drop, onSave }) {\n"
     "  const [v, setV] = useState(drop.story || '');\n"
     "  useEffect(() => { setV(drop.story || ''); }, [drop.story]);\n"
     "  const n = [...v.trim()].length;\n"
     "  return (\n"
     "    <label className=\"inline\" style={{ marginTop: 6, display: 'block' }}>Story line (Japanese, optional)\n"
     "      <input type=\"text\" data-testid={'story-' + drop.no} value={v} maxLength={60}\n"
     "        placeholder=\"マウントドーラのハロルドさんが、四十年かけて集めた万年筆。\"\n"
     "        onChange={e => setV(e.target.value)}\n"
     "        onBlur={() => { if (v.trim() !== (drop.story || '')) onSave(v.trim()); }} />\n"
     "      <span className=\"note\" style={{ display: 'block' }}>Shown under the headline as 今回の便：… Where the seven pieces were found, or whose collection they are. Leave it empty to hide the line.\n"
     "        {' '}{n} characters{n > 40 ? ' (over 40: it takes two lines on desktop)' : ''}. The phone breaks lines only between phrases.</span>\n"
     "    </label>\n"
     "  );\n"
     "}\n\n"
     "// the whole drop as the homepage will show it"),
]
FILES = {
    'index.html': (INDEX, MARK),
    'mobile.js': (MOBILE_JS, 'm-story'),
    'mobile.css': (MOBILE_CSS, '.m-story'),
    'admin/src/lib/site-data.mjs': (SITE_DATA, 'siteDropData'),
    'admin/src/meter.js': (METER, 'siteDropData'),
    'admin/src/DropsPage.jsx': (DROPS_PAGE, 'StoryField'),
}
MIGRATION = 'supabase/migrations/0003_drop_story.sql'
MIGRATION_SQL = """-- Postmark Archive: a drop's story line, shown under the homepage headline as 今回の便：<story>.
-- Where the seven pieces were found, or whose collection they are. Empty hides the line.
-- Run once in the Supabase SQL editor (or with `supabase db push`). Safe to run again.
alter table public.drops add column if not exists story text not null default '';
"""


def main():
    if len(sys.argv) != 1 or not os.path.exists('index.html'):
        sys.exit('Usage: python3 tools/apply_drop_story.py   (from the site folder)')
    srcs = {f: open(f, encoding='utf-8').read() for f in FILES}
    done = [f for f, s in srcs.items() if FILES[f][1] in s]
    if len(done) == len(FILES) and os.path.exists(MIGRATION):
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
    open(MIGRATION, 'w', encoding='utf-8').write(MIGRATION_SQL)
    print('written: ' + MIGRATION)


if __name__ == '__main__':
    main()
