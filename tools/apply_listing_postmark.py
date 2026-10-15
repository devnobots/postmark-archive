#!/usr/bin/env python3
"""Standard Gauge: no postmark on the big stamp in the opened listing.

Usage
  python3 tools/apply_listing_postmark.py index.html
"""
import sys

OLD = "stampHTML(d, v, { tall: true })"
NEW = "stampHTML(d, v, { tall: true, postmark: false })"


def main():
    path = sys.argv[1]
    src = open(path, encoding='utf-8').read()
    if src.count(NEW) == 1:
        print('already applied: listing postmark removed')
        return
    if src.count(OLD) != 1:
        sys.exit('ERROR: nothing changed. Listing stamp call found %d times (expected 1): %s' % (src.count(OLD), OLD))
    open(path, 'w', encoding='utf-8').write(src.replace(OLD, NEW))
    print('listing postmark removed')


if __name__ == '__main__':
    main()
