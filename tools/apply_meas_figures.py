#!/usr/bin/env python3
"""Standard Gauge listing: size table numbers in Old Standard TT regular (not bold),
sitting on the same baseline as the kanji labels, with even-width digits.

    着丈            64 cm      身幅            66 cm

Edits index.html and drops.html (the homepage and past-drops listings). Nothing else changes.
Safe to run more than once.

Usage
  python3 tools/apply_meas_figures.py index.html drops.html
"""
import sys

EDITS = [
    ('size table row',
     '  .meas div { display: flex; justify-content: space-between; font-size: 15px; }',
     '  .meas div { display: flex; justify-content: space-between; align-items: baseline; font-size: 15px; }'),
    ('size table number',
     '  .meas span:last-child { font-weight: 700; }',
     '  .meas span:last-child { font-weight: 400; color: var(--ink); font-variant-numeric: tabular-nums lining-nums; }'),
]


def main():
    paths = sys.argv[1:]
    srcs, problems = {}, []
    for path in paths:
        src = open(path, encoding='utf-8').read()
        srcs[path] = src
        for name, old, new in EDITS:
            if not (src.count(old) == 1 or (src.count(old) == 0 and src.count(new) == 1)):
                problems.append('%s, %s: old found %d, new found %d' % (path, name, src.count(old), src.count(new)))
    if problems:
        print('ERROR: nothing changed. Problems:')
        for p in problems:
            print('  - ' + p)
        sys.exit(1)
    for path, src in srcs.items():
        out = src
        for _, old, new in EDITS:
            out = out.replace(old, new, 1)
        if out == src:
            print('already applied: ' + path)
        else:
            open(path, 'w', encoding='utf-8').write(out)
            print('size table numbers updated: ' + path)


if __name__ == '__main__':
    main()
