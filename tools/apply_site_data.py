#!/usr/bin/env python3
"""Standard Gauge: the homepage reads its pieces from data/current.js (written by the back office).

What changes
- The drop number/date and the ITEMS list move out of index.html into data/current.js, unchanged:
      window.SG_DATA = { drop: { no: 12, date: '2026.10.09' }, items: [ ...same pieces... ] };
- index.html loads data/current.js just before its main script and reads DROP and ITEMS from it.
- Preview mode, used only by the back office: index.html?preview=edit shows the draft the back office
  put in this browser's storage (key 'sg-preview-edit'; ?preview alone reads 'sg-preview') and skips the
  access code. Without that stored draft, ?preview does nothing and the page behaves normally.
The page looks and works exactly as before. drops.html is not touched (past drops move in phase 3).
Safe to run more than once.

Usage
  python3 tools/apply_site_data.py index.html
"""
import os
import sys

MARK = '<script src="data/current.js"></script>'
PREVIEW = """<script>
// preview: the back office shows a draft here (index.html?preview). Visitors never have one stored.
(function () {
  var m = /[?&]preview(?:=([a-z0-9-]+))?(?:&|$)/.exec(location.search);
  if (!m) return;
  try {
    var p = JSON.parse(localStorage.getItem('sg-preview' + (m[1] ? '-' + m[1] : '')) || 'null');
    if (p && p.drop && p.items && p.items.length) { window.SG_DATA = p; window.SG_PREVIEW = true; }
  } catch (e) {}
})();
</script>
"""
MAIN_OPEN = '</div>\n\n<script>\n// ---------------- access code'
DROP_OLD_PREFIX = "var DROP = { no: "
ITEMS_START = 'var ITEMS = [\n'
ITEMS_END = '\n];\nvar SPREAD'
GATE_OLD = "  if (saved === ACCESS_CODE) { unlock(false); return; }"
GATE_NEW = "  if (saved === ACCESS_CODE || window.SG_PREVIEW) { unlock(false); return; }   // preview: no code"
HEADER = ("// Standard Gauge: the pieces on the homepage. Written by the back office; edit there, not here.\n"
          "// drop.date is the release date (Japan time). Prices, sizes and towns in the samples are samples.\n")


def main():
    if len(sys.argv) != 2 or not sys.argv[1].endswith('index.html'):
        sys.exit('Usage: python3 tools/apply_site_data.py index.html')
    path = sys.argv[1]
    src = open(path, encoding='utf-8').read()
    if MARK in src:
        print('already applied: ' + path)
        return
    problems = []
    for label, s in [('start of the main script', MAIN_OPEN), ('drop line', DROP_OLD_PREFIX),
                     ('start of ITEMS', ITEMS_START), ('end of ITEMS', ITEMS_END), ('access gate check', GATE_OLD)]:
        if src.count(s) != 1:
            problems.append('%s: found %d (expected 1)' % (label, src.count(s)))
    out_dir = os.path.join(os.path.dirname(os.path.abspath(path)), 'data')
    out_js = os.path.join(out_dir, 'current.js')
    if os.path.exists(out_js):
        problems.append('data/current.js already exists; remove it or restore index.html first')
    if problems:
        print('ERROR: nothing changed. Problems:')
        for p in problems:
            print('  - ' + p)
        sys.exit(1)

    a = src.index(DROP_OLD_PREFIX)
    drop_line = src[a:src.index('\n', a)]                       # var DROP = { no: 12, date: '2026.10.09' };
    drop_obj = drop_line[len('var DROP = '):].rstrip(';').strip()
    s = src.index(ITEMS_START)
    e = src.index(ITEMS_END)
    items_body = src[s + len(ITEMS_START):e]                    # the pieces, exactly as written

    out = src.replace(drop_line, 'var DROP = SG_DATA.drop;', 1)
    out = out.replace(src[s:e + len('\n];')], 'var ITEMS = SG_DATA.items;', 1)
    out = out.replace(GATE_OLD, GATE_NEW, 1)
    out = out.replace(MAIN_OPEN, '</div>\n\n' + MARK + '\n' + PREVIEW + '<script>\n// ---------------- access code', 1)

    os.makedirs(out_dir, exist_ok=True)
    data = HEADER + 'window.SG_DATA = {\n  drop: ' + drop_obj + ',\n  items: [\n' + items_body + '\n  ]\n};\n'
    open(out_js, 'w', encoding='utf-8').write(data)
    open(path, 'w', encoding='utf-8').write(out)
    print('homepage now reads data/current.js: ' + path)


if __name__ == '__main__':
    main()
