#!/usr/bin/env python3
"""Standard Gauge: check every Japanese title can wrap cleanly on a phone.

Japanese has no spaces, so a browser can only break a title cleanly where we put a space between
words. This fails if any title has an unbroken run longer than 12 characters (the longest real word
today, ニュースペーパーバッグ, is 11). Run before a drop goes live.

Usage
  python3 tools/check_titles.py index.html drops.html
"""
import re
import sys

LIMIT = 12


def main():
    bad = []
    for path in sys.argv[1:]:
        src = open(path, encoding='utf-8').read()
        for t in re.findall(r"nameJa: '([^']*)'", src):
            for w in t.split(' '):
                if len(w) > LIMIT:
                    bad.append('%s: "%s" has an unbroken run of %d characters: %s' % (path, t, len(w), w))
    if bad:
        print('TITLES NEED A SPACE BETWEEN WORDS:')
        for b in bad:
            print('  - ' + b)
        sys.exit(1)
    print('titles ok')


if __name__ == '__main__':
    main()
