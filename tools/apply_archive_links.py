#!/usr/bin/env python3
"""Standard Gauge homepage: point 過去の便を見る at drops.html, and reword the subline
(the site no longer shows postmarks). Safe to run more than once.

Usage
  python3 tools/apply_archive_links.py index.html
"""
import sys

EDITS = [
    ('past-drops link', 'href="#drops"', 'href="drops.html"'),
    ('subline', '見つけた町の消印つきで、ひとつずつお届けします。', '見つけた町と日付を添えて、ひとつずつお届けします。'),
]


def main():
    path = sys.argv[1]
    src = open(path, encoding='utf-8').read()
    problems, todo = [], []
    for name, old, new in EDITS:
        if src.count(new) == 1 and src.count(old) == 0:
            print('already applied: ' + name)
        elif src.count(old) == 1:
            todo.append((old, new))
        else:
            problems.append('%s: old text found %d times, new text %d times' % (name, src.count(old), src.count(new)))
    if problems:
        print('ERROR: nothing changed. Problems:')
        for p in problems:
            print('  - ' + p)
        sys.exit(1)
    for old, new in todo:
        src = src.replace(old, new, 1)
    open(path, 'w', encoding='utf-8').write(src)
    print('archive links applied (%d changes)' % len(todo))


if __name__ == '__main__':
    main()
