#!/usr/bin/env python3
"""Standard Gauge: three desktop fixes. Safe to run more than once.

1. Readable text at laptop sizes (the page scales to the window height, so on most laptops
   it renders at 0.75-0.9x): larger stamp names, size lines, hint, drop line, listing header
   and grade legend. Homepage only (index.html).
2. Lighter images: every PNG in assets/ that index.html or drops.html uses is converted to
   WebP (transparency kept) and both pages point at the WebP. The PNGs stay on disk.
3. Each listing gets its own address (e.g. #1960s-usaf-ma-1-flight-jacket; on the past-drops
   page #no11-...). Opening a listing sets it, the browser Back button closes the listing,
   and a shared link opens straight to that piece. Both pages.

Needs Pillow with WebP support (run with .venv-tools/bin/python).

Usage
  .venv-tools/bin/python tools/apply_desktop_fixes.py
(run from the site folder; it edits index.html and drops.html)
"""
import os
import re
import sys

from PIL import Image, features

PAGES = ['index.html', 'drops.html']

SIZE_MARK = '/* desktop legibility */'
SIZE_CSS = (
    "  " + SIZE_MARK + "\n"
    "  .cap-name { font-size: 11.5px; letter-spacing: -0.01em; }\n"
    "  .cap-size { font-size: 10px; }\n"
    "  .hint { font-size: 14px; }\n"
    "  .drop-status-lockup { font-size: 13px; }\n"
    "  .found { font-size: 14px; }\n"
    "  .legend { font-size: 12.5px; }\n"
)

ROUTE_MARK = '// listing addresses: each piece has its own #link'
ROUTE_JS = ROUTE_MARK + r"""
(function () {
  function slug(d) {
    var s = String(d.nameEn || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return (d.drop ? 'no' + d.drop.no + '-' : '') + s;
  }
  function indexFor(hash) {
    var h = decodeURIComponent(String(hash || '').replace(/^#/, ''));
    for (var i = 0; i < ITEMS.length; i++) if (h && slug(ITEMS[i]) === h) return i;
    return -1;
  }
  var baseOpen = openItem, baseClose = closeItem, pushed = false;
  openItem = function (i) {
    baseOpen(i);
    var h = '#' + slug(ITEMS[i]);
    if (location.hash !== h) { history.pushState({ sg: 1 }, '', h); pushed = true; }
  };
  closeItem = function () {
    if (pushed) { pushed = false; history.back(); return; }       // Back closes it via popstate
    baseClose();
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  };
  var closeBtn = document.getElementById('closeBtn');
  closeBtn.removeEventListener('click', baseClose);
  closeBtn.addEventListener('click', function () { closeItem(); });
  window.addEventListener('popstate', function () {
    var i = indexFor(location.hash);
    if (i >= 0) { if (state.open !== i) baseOpen(i); }
    else { pushed = false; if (state.open >= 0) baseClose(); }
  });
  var first = indexFor(location.hash);
  if (first >= 0) baseOpen(first);                                    // a shared link opens that piece
})();
"""


def fail(problems):
    print('ERROR: nothing changed. Problems:')
    for p in problems:
        print('  - ' + p)
    sys.exit(1)


def main():
    problems = []
    if not features.check('webp'):
        problems.append('Pillow has no WebP support')
    srcs = {}
    for page in PAGES:
        if not os.path.exists(page):
            problems.append('%s not found (run from the site folder)' % page)
            continue
        s = open(page, encoding='utf-8').read()
        srcs[page] = s
        if ROUTE_MARK not in s:
            for need in ['function openItem(', 'function closeItem(', "getElementById('closeBtn').addEventListener('click', closeItem)", '</script>']:
                if need not in s:
                    problems.append('%s: missing %r' % (page, need))
    if 'index.html' in srcs and SIZE_MARK not in srcs['index.html'] and srcs['index.html'].count('</style>') != 1:
        problems.append('index.html: </style> not found exactly once')
    pngs = sorted(set(m for s in srcs.values() for m in re.findall(r"assets/[A-Za-z0-9_.-]+\.png", s)))
    for p in pngs:
        if not os.path.exists(p):
            problems.append('image missing: ' + p)
    if problems:
        fail(problems)

    # 2. WebP versions of every PNG the pages use
    made = 0
    for p in pngs:
        w = p[:-4] + '.webp'
        if not os.path.exists(w):
            Image.open(p).save(w, 'WEBP', quality=88, method=6)
            made += 1
    out = {}
    for page, s in srcs.items():
        for p in pngs:
            s = s.replace(p, p[:-4] + '.webp')
        # 3. listing addresses
        if ROUTE_MARK not in s:
            i = s.rindex('</script>')
            s = s[:i] + ROUTE_JS + s[i:]
        out[page] = s
    # 1. readable text (homepage)
    if SIZE_MARK not in out['index.html']:
        out['index.html'] = out['index.html'].replace('</style>', SIZE_CSS + '</style>', 1)
    for page, s in out.items():
        if s != srcs[page]:
            open(page, 'w', encoding='utf-8').write(s)
    print('desktop fixes applied: %d WebP files made, %d PNG references switched, text sizes + listing addresses in place'
          % (made, len(pngs)))


if __name__ == '__main__':
    main()
