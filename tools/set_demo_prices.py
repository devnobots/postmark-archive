import re, sys
PRICES = ['¥13,200', '¥43,780', '¥87,780', '¥107,800', '¥43,890', '¥151,800', '¥87,780']
path = sys.argv[1]
src = open(path, encoding='utf-8').read()
found = re.findall(r"price: '¥[0-9,]+'", src)
if len(found) != len(PRICES):
    sys.exit('ERROR: expected %d prices, found %d' % (len(PRICES), len(found)))
it = iter(PRICES)
src = re.sub(r"price: '¥[0-9,]+'", lambda m: "price: '%s'" % next(it), src)
open(path, 'w', encoding='utf-8').write(src)
print('prices updated')
