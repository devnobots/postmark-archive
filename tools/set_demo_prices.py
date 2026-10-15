#!/usr/bin/env python3
"""Standard Gauge mockup: demo prices taken from real Japanese vintage-shop listings.
Applied to the items in page order (which price lands on which item does not matter).

Usage
  python3 tools/set_demo_prices.py index.html
"""
import re
import sys

PRICES = ['¥13,200', '¥43,780', '¥87,780', '¥171,230', '¥43,890', '¥151,800', '¥87,780']
RX = re.compile(r"price: '¥[0-9,]+'")


def main():
    path = sys.argv[1]
    src = open(path, encoding='utf-8').read()
    found = RX.findall(src)
    if len(found) != len(PRICES):
        sys.exit('ERROR: nothing changed. Expected %d prices, found %d' % (len(PRICES), len(found)))
    it = iter(PRICES)
    src = RX.sub(lambda m: "price: '%s'" % next(it), src)
    open(path, 'w', encoding='utf-8').write(src)
    print('prices set: ' + ', '.join(PRICES))


if __name__ == '__main__':
    main()
