#!/usr/bin/env python3
"""Standard Gauge mockup: item names, measurements by category template, and condition grades.

Measurements are never chosen per item. Each item has a CATEGORY, and the labels come from
TEMPLATES; the item only supplies the numbers. To add an item later: give it a category that
exists in TEMPLATES (or add a new template), never invent labels inside the item.

The item names below are invented demo data: plausible finds in a US thrift store.
Prices, colors (bg/ink), towns, dates and photos are NOT touched by this script.

Usage
  python3 tools/apply_listing_data.py index.html --dry-run   # show matches, change nothing
  python3 tools/apply_listing_data.py index.html             # rewrite index.html
"""
import re
import sys

TEMPLATES = {
    'tops':     ['着丈', '身幅', '肩幅', '袖丈'],
    'bag':      ['幅', '高さ', 'マチ', 'ショルダー'],
    'neckwear': ['全長', '幅'],
    'hat':      ['頭囲', 'つば'],
    'socks':    ['対応サイズ'],
    'bottoms':  ['ウエスト', '股下'],
}

# key: a word that appears (case-insensitive) in the item's CURRENT nameEn; must match exactly one item
ITEMS = [
    {'key': 'tee', 'category': 'tops', 'values': ['70 cm', '54 cm', '47 cm', '21 cm'],
     'nameEn': '1970s Ringer Tee with Concho Trim', 'nameJa': '70年代 リンガーTシャツ コンチョ装飾',
     'capJa': 'リンガーTシャツ', 'size': '着丈 70 · 身幅 54', 'grade': 'B', 'gradeNote': 'わずかな色あせ'},
    {'key': 'bag', 'category': 'bag', 'values': ['50 cm', '30 cm', '12 cm', '62 cm'],
     'nameEn': '1970s Denim Newspaper Bag', 'nameJa': '70年代 デニム ニュースペーパーバッグ',
     'capJa': 'ニュースペーパーバッグ', 'size': '幅 50 · 高さ 30', 'grade': 'A', 'gradeNote': '目立つダメージなし'},
    {'key': 'flight', 'category': 'tops', 'values': ['66 cm', '64 cm', '55 cm', '62 cm'],
     'nameEn': '1960s USAF MA-1 Flight Jacket', 'nameJa': '60年代 USAF MA-1 フライトジャケット',
     'capJa': 'MA-1 フライト', 'size': '着丈 66 · 身幅 64', 'grade': 'B', 'gradeNote': '袖リブにほつれ'},
    {'key': 'levi', 'category': 'bottoms', 'values': ['66 cm', '77.5 cm'],
     'nameEn': '1990s Levi’s 611 Faded Black Denim', 'nameJa': '90年代 リーバイス 611 ブラックデニム',
     'capJa': 'リーバイス 611', 'size': 'ウエスト 66 · 股下 77.5', 'grade': 'B', 'gradeNote': 'ポケット下に小穴'},
    {'key': 'sock', 'category': 'socks', 'values': ['23–27 cm'],
     'nameEn': '1980s Hand-Knit Wool Socks', 'nameJa': '80年代 ハンドニット ウールソックス',
     'capJa': 'ウールソックス', 'size': 'フリー · 23–27 cm', 'grade': 'A', 'gradeNote': '使用感少なめ'},
    {'key': 'hat', 'category': 'hat', 'values': ['58 cm', '6 cm'],
     'nameEn': '1980s Canvas Bucket Hat', 'nameJa': '80年代 キャンバス バケットハット',
     'capJa': 'バケットハット', 'size': '頭囲 58 · つば 6', 'grade': 'B', 'gradeNote': '内側に汗じみ'},
    {'key': 'neck', 'category': 'neckwear', 'values': ['60 cm', '22 cm'],
     'nameEn': '1970s Nordic-Pattern Knit Neck Warmer', 'nameJa': '70年代 ノルディック柄 ニットネックウォーマー',
     'capJa': 'ネックウォーマー', 'size': '全長 60 · 幅 22', 'grade': 'B', 'gradeNote': '小さな毛玉あり'},
]

ENTRY_START = re.compile(r"bg: '#[0-9A-Fa-f]{6}'")


def q(s):
    return "'" + s.replace("\\", "\\\\").replace("'", "\\'") + "'"


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(2)
    path, dry = sys.argv[1], '--dry-run' in sys.argv
    src = open(path, encoding='utf-8').read()

    starts = [m.start() for m in ENTRY_START.finditer(src)]
    if len(starts) != len(ITEMS):
        sys.exit('ERROR: expected %d items, found %d' % (len(ITEMS), len(starts)))
    bounds = []
    for i, s in enumerate(starts):
        e = starts[i + 1] if i + 1 < len(starts) else src.index('];', s)
        bounds.append((s, e))

    # match each new item to exactly one existing entry by keyword in its current nameEn
    current = []
    for s, e in bounds:
        m = re.search(r"nameEn: '([^']*)'", src[s:e])
        if not m:
            sys.exit('ERROR: an item has no nameEn')
        current.append(m.group(1))
    plan = {}
    for it in ITEMS:
        hits = [i for i, n in enumerate(current) if it['key'] in n.lower()]
        if len(hits) != 1:
            sys.exit('ERROR: key "%s" matched %d items (current names: %s)' % (it['key'], len(hits), current))
        if hits[0] in plan:
            sys.exit('ERROR: two keys matched the same item: %s' % current[hits[0]])
        labels = TEMPLATES[it['category']]
        if len(labels) != len(it['values']):
            sys.exit('ERROR: %s has %d values for %d labels' % (it['key'], len(it['values']), len(labels)))
        plan[hits[0]] = it

    print('%-40s -> %-40s %s' % ('current nameEn', 'new nameEn', 'grade'))
    for i, n in enumerate(current):
        it = plan[i]
        print('%-40s -> %-40s %s %s' % (n[:40], it['nameEn'][:40], it['grade'], it['gradeNote']))
    if dry:
        print('dry run: index.html not changed')
        return

    out, last = [], 0
    for i, (s, e) in enumerate(bounds):
        it = plan[i]
        chunk = src[s:e]
        meas = '[' + ', '.join('[%s, %s]' % (q(l), q(v)) for l, v in zip(TEMPLATES[it['category']], it['values'])) + ']'
        for field, value in (('nameJa', it['nameJa']), ('nameEn', it['nameEn']), ('size', it['size'])):
            chunk, n = re.subn(r"%s: '[^']*'" % field, '%s: %s' % (field, q(value)), chunk, count=1)
            if n != 1:
                sys.exit('ERROR: %s missing in item %d' % (field, i + 1))
        chunk, n = re.subn(r"meas: \[\[.*?\]\]", 'meas: ' + meas, chunk, count=1, flags=re.S)
        if n != 1:
            sys.exit('ERROR: meas missing or not in [[label, value], ...] form in item %d' % (i + 1))
        chunk = re.sub(r"capJa: '[^']*',\s*", '', chunk)
        chunk = re.sub(r"(nameJa: '[^']*',)", lambda m: m.group(1) + ' capJa: ' + q(it['capJa']) + ',', chunk, count=1)
        chunk = re.sub(r"\s*grade: '[^']*', gradeNote: '[^']*',", '', chunk)
        chunk, n = re.subn(r"(price: '[^']*',)", lambda m: m.group(1) + ' grade: %s, gradeNote: %s,' % (q(it['grade']), q(it['gradeNote'])), chunk, count=1)
        if n != 1:
            sys.exit('ERROR: price missing in item %d' % (i + 1))
        out.append(src[last:s])
        out.append(chunk)
        last = e
    out.append(src[last:])
    open(path, 'w', encoding='utf-8').write(''.join(out))
    print('index.html updated')


if __name__ == '__main__':
    main()
