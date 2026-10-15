#!/usr/bin/env python3
"""Standard Gauge: how a sold piece looks, on the homepage and the past-drops page.

- The stamp's photo turns black-and-white (deeper blacks, brighter whites).
- The price in the stamp corner becomes 売約済.
- Mouse over: the color comes back (on the homepage, while the stamp is lifted).
- A sold piece never opens its listing (click, Back/Forward, or a shared link).

A piece is sold when its record has  sold: true.
- Past-drops page: every piece there is sold, so all of them get it automatically.
- Homepage: add  sold: true  to that item in ITEMS when it sells (none are marked now).
Edits index.html and drops.html. Nothing else changes. Safe to run more than once.

Usage
  python3 tools/apply_sold_stamps.py index.html drops.html
"""
import sys

MARK = '/* sold pieces: black-and-white, 売約済, color on mouse over, never open */'
BASE_CSS = (
    "  " + MARK + "\n"
    "  .stamp.is-sold .stamp-art { filter: grayscale(1) contrast(1.25) brightness(1.04); transition: filter 0.5s ease; }\n"
    "  .stamp.is-sold .stamp-price { font-family: 'Shippori Mincho', serif; font-weight: 600; font-size: 11px; letter-spacing: 0.18em; }\n"
)
PAGE_CSS = {
    'index.html': "  .fan-stamp.up .stamp.is-sold .stamp-art { filter: none; }\n",
    'drops.html': ("  .past-stamp:hover .stamp.is-sold .stamp-art, .past-stamp:focus-visible .stamp.is-sold .stamp-art { filter: none; }\n"
                   "  .past-stamp { cursor: default; }\n"),
}
COMMON = [
    ('stamp outline', "'<div class=\"stamp\" style=\"height:'",
     "'<div class=\"stamp' + (d.sold ? ' is-sold' : '') + '\" style=\"height:'"),
    ('stamp price', "esc(d.price) + '</div></div>' +",
     "esc(d.sold ? '売約済' : d.price) + '</div></div>' +"),
    ('open a listing', "function openItem(i) {",
     "function openItem(i) { if (ITEMS[i] && ITEMS[i].sold) return; /* sold pieces never open */"),
    ('listing address', "  openItem = function (i) {\n    baseOpen(i);",
     "  openItem = function (i) {\n    if (ITEMS[i] && ITEMS[i].sold) return;                          // sold: no listing, no address\n    baseOpen(i);"),
]
PAGE_EDITS = {
    'index.html': [],
    'drops.html': [('past pieces are sold', "city: p.city, date: p.date, year: '2026',",
                    "city: p.city, date: p.date, year: '2026', sold: true,")],
}
STYLE_END = "</style>\n</head>"
LANDMARKS = ['id="overlay"', 'id="found"', 'id="thumbs"', 'function stampHTML(', 'id="closeBtn"']


def main():
    paths = sys.argv[1:]
    todo, problems = {}, []
    for path in paths:
        name = path.split('/')[-1]
        if name not in PAGE_CSS:
            problems.append('%s: expected index.html or drops.html' % path)
            continue
        src = open(path, encoding='utf-8').read()
        if MARK in src:
            print('already applied: ' + path)
            continue
        edits = COMMON + PAGE_EDITS[name]
        for label, old, _ in edits + [('end of the page styles', STYLE_END, None)]:
            if src.count(old) != 1:
                problems.append('%s, %s: found %d (expected 1)' % (path, label, src.count(old)))
        todo[path] = (src, edits, name)
    if problems:
        print('ERROR: nothing changed. Problems:')
        for p in problems:
            print('  - ' + p)
        sys.exit(1)
    for path, (src, edits, name) in todo.items():
        before = [src.count(x) for x in LANDMARKS]
        out = src
        for _, old, new in edits:
            out = out.replace(old, new, 1)
        out = out.replace(STYLE_END, BASE_CSS + PAGE_CSS[name] + STYLE_END, 1)
        if [out.count(x) for x in LANDMARKS] != before:
            sys.exit('ERROR: nothing changed. The edit would have altered other page parts (%s).' % path)
        open(path, 'w', encoding='utf-8').write(out)
        print('sold pieces updated: ' + path)


if __name__ == '__main__':
    main()
