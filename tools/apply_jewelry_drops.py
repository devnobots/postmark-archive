#!/usr/bin/env python3
"""Postmark Archive: a "Jewelry" checkbox on a drop. Ticked, the whole drop's stamps use light neutral colours
(option B) instead of the nine stamp inks, so silver, turquoise and coral are not fighting a colour.

What changes
- Database: drops.jewelry (true/false, off by default): supabase/migrations/0004_drop_jewelry.sql.
- Colour rule (admin/src/lib/colors.mjs): a second set of nine inks, NEUTRAL_PALETTE (bone, oat, mist, linen, ash,
  shell, sand, fog, ivory), and paletteFor(drop). Same scoring and assignment as before; only the inks differ.
  scoresFor, assignInks and scoresForImage take the palette (the nine stamp inks when none is given).
- Back office:
  - Drops page: a "Jewelry: neutral stamp colours" checkbox on live and upcoming drops, saved when ticked.
  - Piece editor: the colour shown and saved follows the piece's drop (neutral for a jewelry drop).
  - Publish: colours the live drop with its own palette.
- The site itself does not change: each piece's colour is stored on the piece (bg), as before.
Safe to run more than once.

Usage
  python3 tools/apply_jewelry_drops.py
"""
import os
import sys

COLORS = [
    ('the neutral inks',
     "export const DARK_INKS = ['brick'];",
     "// a jewelry drop (drops.jewelry): light neutrals, so silver, turquoise and coral are not fighting a colour\n"
     "export const NEUTRAL_PALETTE = [\n"
     "  ['bone', '#ECE5D6'], ['oat', '#DCD5C7'], ['mist', '#E0E2DB'], ['linen', '#E6DDCB'], ['ash', '#D8D6CF'],\n"
     "  ['shell', '#E9E3D9'], ['sand', '#D9D2C3'], ['fog', '#E3E0D7'], ['ivory', '#EFE8DA'],\n"
     "];\n"
     "export function paletteFor(drop) { return drop && drop.jewelry ? NEUTRAL_PALETTE : PALETTE; }\n"
     "export const DARK_INKS = ['brick'];"),
    ('scoresFor takes the palette',
     "export function scoresFor(rgb) {\n  const doms = mainColors(rgb).filter(([, w]) => w > MIN_WEIGHT);\n  return PALETTE.map(",
     "export function scoresFor(rgb, palette = PALETTE) {\n  const doms = mainColors(rgb).filter(([, w]) => w > MIN_WEIGHT);\n  return palette.map("),
    ('assignInks takes the palette',
     "export function assignInks(scores) {\n  const n = scores.length, m = PALETTE.length;",
     "export function assignInks(scores, palette = PALETTE) {\n  const n = scores.length, m = palette.length;"),
    ('assignInks returns that palette',
     "return bestPick.map(c => ({ name: PALETTE[c][0], bg: PALETTE[c][1], ink: DARK_INKS.includes(PALETTE[c][0]) ? CREAM_TEXT : null }));",
     "return bestPick.map(c => ({ name: palette[c][0], bg: palette[c][1], ink: DARK_INKS.includes(palette[c][0]) ? CREAM_TEXT : null }));"),
    ('scoresForImage takes the palette',
     "export async function scoresForImage(url) {\n  if (cache.has(url)) return cache.get(url);",
     "export async function scoresForImage(url, palette = PALETTE) {\n  const key = palette[0][0] + ' ' + url;\n  if (cache.has(key)) return cache.get(key);"),
    ('scoresForImage scores with it',
     "    return scoresFor(itemPixels(g.getImageData(0, 0, w, h).data, w, h));\n  })();\n  cache.set(url, p);\n  p.catch(() => cache.delete(url));",
     "    return scoresFor(itemPixels(g.getImageData(0, 0, w, h).data, w, h), palette);\n  })();\n  cache.set(key, p);\n  p.catch(() => cache.delete(key));"),
]
PUBLISH = [
    ('import', "import { scoresForImage, assignInks, PALETTE } from './lib/colors.mjs';",
     "import { scoresForImage, assignInks, PALETTE, paletteFor } from './lib/colors.mjs';"),
    ('the live drop\'s palette',
     "      const scores = await Promise.all(onSite.map(async p => scoresForImage(await photoUrl(p.views[0].img))));\n      const pick = assignInks(scores);",
     "      const palette = paletteFor(live);                                   // neutral inks for a jewelry drop\n"
     "      const scores = await Promise.all(onSite.map(async p => scoresForImage(await photoUrl(p.views[0].img), palette)));\n"
     "      const pick = assignInks(scores, palette);"),
]
EDITOR = [
    ('import', "import { scoresForImage, assignInks, PALETTE } from './lib/colors.mjs';",
     "import { scoresForImage, assignInks, PALETTE, NEUTRAL_PALETTE, paletteFor } from './lib/colors.mjs';"),
    ('the rule takes the drop\'s palette', "function useRuleColors(piece, views, pieces, dropId) {",
     "function useRuleColors(piece, views, pieces, dropId, palette = PALETTE) {"),
    ('recheck when the palette changes',
     "  const key = JSON.stringify([first, others.map(p => [p.id, p.views[0].img, p.bg])]);",
     "  const key = JSON.stringify([palette[0][0], first, others.map(p => [p.id, p.views[0].img, p.bg])]);"),
    ('score with it',
     "        const scores = await Promise.all(all.map(async img => scoresForImage(await photoUrl(img))));\n        const pick = assignInks(scores);",
     "        const scores = await Promise.all(all.map(async img => scoresForImage(await photoUrl(img), palette)));\n        const pick = assignInks(scores, palette);"),
    ('the piece\'s drop decides',
     "  const rule = useRuleColors(piece, v.views, pieces, v.drop_id);",
     "  const rule = useRuleColors(piece, v.views, pieces, v.drop_id, paletteFor(drops.find(d => String(d.id) === String(v.drop_id))));"),
    ('ink names from both sets',
     "  const inkName = (PALETTE.find(([, hex]) => hex === color.bg) || [''])[0];",
     "  const inkName = ([...PALETTE, ...NEUTRAL_PALETTE].find(([, hex]) => hex === color.bg) || [''])[0];"),
]
DROPS = [
    ('save the checkbox',
     "  const setStory = async (d, story) => {",
     "  const setJewelry = async (d, jewelry) => {\n"
     "    try {\n"
     "      await update({ resource: 'drops', id: d.id, values: { jewelry }, successNotification: false, errorNotification: false });\n"
     "      await refresh();\n"
     "      setMsg({ text: 'Drop ' + d.no + ': jewelry colours ' + (jewelry ? 'on' : 'off') + '. The stamp colours change the next time this drop is published (Publish to site).' });\n"
     "    } catch (e) {\n"
     "      setMsg({ bad: true, text: 'Drop ' + d.no + ': not saved (' + ((e && e.message) || e) + '). If the database says the column jewelry does not exist, run supabase/migrations/0004_drop_jewelry.sql in the Supabase SQL editor.' });\n"
     "    }\n"
     "  };\n"
     "  const setStory = async (d, story) => {"),
    ('the checkbox on live and upcoming drops',
     "            {kind !== 'past' && <StoryField drop={d} onSave={v => setStory(d, v)} />}\n",
     "            {kind !== 'past' && <StoryField drop={d} onSave={v => setStory(d, v)} />}\n"
     "            {kind !== 'past' && (\n"
     "              <label className=\"inline\" style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center' }}>\n"
     "                <input type=\"checkbox\" data-testid={'jewelry-' + d.no} checked={!!d.jewelry} onChange={e => setJewelry(d, e.target.checked)} style={{ width: 22, height: 22 }} />\n"
     "                Jewelry: neutral stamp colours for the whole drop\n"
     "              </label>\n"
     "            )}\n"),
]
FILES = {
    'admin/src/lib/colors.mjs': (COLORS, 'NEUTRAL_PALETTE'),
    'admin/src/PublishButton.jsx': (PUBLISH, 'paletteFor'),
    'admin/src/PieceEditor.jsx': (EDITOR, 'paletteFor'),
    'admin/src/DropsPage.jsx': (DROPS, 'setJewelry'),
}
MIGRATION = 'supabase/migrations/0004_drop_jewelry.sql'
MIGRATION_SQL = """-- Postmark Archive: a jewelry drop. Ticked in the back office, the drop's stamps use light neutral colours.
-- Run once in the Supabase SQL editor (or with `supabase db push`). Safe to run again.
alter table public.drops add column if not exists jewelry boolean not null default false;
"""


def main():
    if len(sys.argv) != 1 or not os.path.exists('index.html'):
        sys.exit('Usage: python3 tools/apply_jewelry_drops.py   (from the site folder)')
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
