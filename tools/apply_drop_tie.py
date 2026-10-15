#!/usr/bin/env python3
"""Standard Gauge: tie everything to one drop record.

- DROP = { no: 12, date: '2026.10.09' } is the single source. Change it once for the next drop.
- Homepage stamps print the drop in tiny type in their bottom border: 第12便 · 2026.10.09
  (not on the big listing stamp).
- Listing: one line, 第12便  ·  FOUND: PORTLAND, ME (SEP 2026)
- Homepage drop line (第12便 公開中) reads from DROP.
- Demo found dates move to Aug-Sep 2026, before the drop's release.
Nothing else on the page is touched. Safe to run more than once.

Usage
  python3 tools/apply_drop_tie.py index.html
"""
import re
import sys

DROP_JS = ("// the current drop: number and release date (Japan time). Everything else reads from here.\n"
           "var DROP = { no: 12, date: '2026.10.09' };\n"
           "var DROP_LABEL = '第' + DROP.no + '便';\n\n")
FOUND_DATES = ['AUG 14', 'AUG 22', 'SEP 3', 'SEP 6', 'SEP 12', 'SEP 19', 'SEP 27']
DATE_RX = re.compile(r"date: '[A-Z]{3} \d{1,2}', year: '\d{4}'")
CAP_RX = re.compile(r"('<div class=\"stamp-cap\"><div class=\"cap-name\">' \+ esc\(d\.capJa \|\| d\.nameJa\) \+ '</div>"
                    r"<div class=\"cap-size\">' \+ esc\(d\.size\) \+ '</div></div>') \+")
CAP_ADD = " +\n    (tall ? '' : '<div class=\"cap-issue\">' + DROP_LABEL + ' · ' + DROP.date + '</div>') +"
FOUND_OLD = "document.getElementById('found').textContent = 'FOUND · ' + d.city + ' · ' + d.date + ', ' + d.year;"
FOUND_NEW = ("document.getElementById('found').textContent = DROP_LABEL + '\\u00a0 · \\u00a0FOUND: ' +\n"
             "    d.city.replace(/ ([A-Z]{2})$/, ', $1') + ' (' + d.date.split(' ')[0] + ' ' + d.year + ')';")
LABEL_JS = ("\n// homepage drop line reads from DROP\n"
            "(function () { var el = document.querySelector('.drop-status-current'); if (el) el.textContent = DROP_LABEL + ' 公開中'; })();\n")
CSS = ("  .cap-issue { margin-top: auto; padding: 0 2px 1px; font-size: 6.5px; letter-spacing: 0.08em; color: var(--ink-3); text-align: right; }\n"
)
LANDMARKS = ['ルーペ', 'id="hint"', 'class="copy"', 'class="site-header"', 'id="overlay"', 'id="hit"',
             'class="drop-status-lockup', 'id="stampBtn"']


def main():
    path = sys.argv[1]
    src = open(path, encoding='utf-8').read()
    if 'var DROP = {' in src:
        print('already applied: drop tie')
        return
    problems = []
    checks = [
        ('item list start', src.count('var ITEMS = ['), 1),
        ('demo found dates', len(DATE_RX.findall(src)), 7),
        ('stamp caption code', len(CAP_RX.findall(src)), 1),
        ('stamp size variable (var tall = opts && opts.tall)', src.count('var tall = opts && opts.tall'), 1),
        ('listing FOUND line code', src.count(FOUND_OLD), 1),
        ('</style>', src.count('</style>'), 1),
    ]
    for name, got, want in checks:
        if got != want:
            problems.append('%s: found %d (expected %d)' % (name, got, want))
    if problems:
        print('ERROR: nothing changed. Problems:')
        for p in problems:
            print('  - ' + p)
        sys.exit(1)
    before = [src.count(x) for x in LANDMARKS]
    src = src.replace('var ITEMS = [', DROP_JS + 'var ITEMS = [', 1)
    it = iter(FOUND_DATES)
    src = DATE_RX.sub(lambda m: "date: '%s', year: '2026'" % next(it), src)
    src = CAP_RX.sub(lambda m: m.group(1) + CAP_ADD, src, count=1)
    src = src.replace(FOUND_OLD, FOUND_NEW, 1)
    src = src.replace('</style>', CSS + '</style>', 1)
    i = src.rindex('</script>')
    src = src[:i] + LABEL_JS + src[i:]
    if [src.count(x) for x in LANDMARKS] != before:
        sys.exit('ERROR: nothing changed. The edit would have altered other page parts.')
    open(path, 'w', encoding='utf-8').write(src)
    print('drop tie applied')


if __name__ == '__main__':
    main()
