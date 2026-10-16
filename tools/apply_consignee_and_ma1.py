#!/usr/bin/env python3
"""Standard Gauge: two wording changes.

1. Stamp label for the MA-1: 'MA-1 フライト' becomes 'MA-1' (no clipped-looking word).
2. CUSTODIAN becomes CONSIGNEE everywhere (sold-page top line, plus the internal class and
   comment names and tools/apply_sold_pages.py, so nothing says "custodian" anymore):
       第9便  ·  FOUND: DULUTH, MN  ·  CONSIGNEE: @tsubasa.1987
Safe to run more than once.

Usage
  python3 tools/apply_consignee_and_ma1.py index.html drops.html tools/apply_sold_pages.py
"""
import sys

LABEL_OLD, LABEL_NEW = "capJa: 'MA-1 フライト'", "capJa: 'MA-1'"


def main():
    problems, out = [], {}
    for path in sys.argv[1:]:
        src = open(path, encoding='utf-8').read()
        new = src.replace('CUSTODIAN', 'CONSIGNEE').replace('custodian', 'consignee').replace('Custodian', 'Consignee')
        if path.endswith('.html'):
            n = src.count(LABEL_OLD)
            if n == 1:
                new = new.replace(LABEL_OLD, LABEL_NEW, 1)
            elif not (n == 0 and src.count(LABEL_NEW) == 1):
                problems.append('%s: MA-1 label found %d times (expected 1)' % (path, n))
            if src.lower().count('custodian') == 0 and 'CONSIGNEE' not in src:
                problems.append('%s: neither CUSTODIAN nor CONSIGNEE found (sold pages missing?)' % path)
        elif src.lower().count('custodian') == 0 and 'CONSIGNEE' not in src:
            problems.append('%s: neither CUSTODIAN nor CONSIGNEE found' % path)
        out[path] = (src, new)
    if problems:
        print('ERROR: nothing changed. Problems:')
        for p in problems:
            print('  - ' + p)
        sys.exit(1)
    for path, (src, new) in out.items():
        if new == src:
            print('already applied: ' + path)
        else:
            open(path, 'w', encoding='utf-8').write(new)
            print('updated: ' + path)


if __name__ == '__main__':
    main()
