#!/usr/bin/env python3
"""Postmark Archive: a sample drop page, "1944, the American home front", at /test1940/ (local only, never published).

The real homepage (same fan, lift on hover, piece card, full photo view, phone layout) with seven stamps:
  1 Red Cross sewing kit   2 sweetheart bracelet (full-bleed photo)   3 magazine pouches   4 Uncle Sam pin
  5 Red Cross sewing kit   6 sweetheart bracelet                       7 Ike jacket (the hero, far right)
On the light neutral stamp colours used for archival drops, with the story line
  今回の便：1944年、アメリカの銃後。同時代の品を、ひとつずつ集めました。
Names, sizes and prices are samples. The photos are other sellers' shop photos: never commit or publish them.

Reads  1940/  (ike.png kit.png pouches.png sam.png cut-outs, bracelet.jpg, and *-full.jpg for each)
Writes test1940/index.html  (a copy of index.html with this drop's data inline; <base href="/"> so every link and
       file resolves from the site root, the same as the homepage)
Same result on every run.

Usage
  python3 tools/make_test1940.py
"""
import json
import os
import sys

IMG = '1940'
NEEDED = ['ike.png', 'kit.png', 'pouches.png', 'sam.png', 'bracelet.jpg',
          'ike-full.jpg', 'kit-full.jpg', 'pouches-full.jpg', 'sam-full.jpg', 'bracelet-full.jpg']
PIECES = {  # sample text
    'kit': dict(nameJa='40年代 アメリカ赤十字 ソーイングキット', capJa='赤十字の裁縫キット', nameEn='1940s American Red Cross Sewing Kit',
                size='幅 25 · 高さ 23', price='¥32,000', grade='A', gradeNote='針・ボタン・糸すべて揃う',
                city='MANSFIELD OH', date='OCT 12', year='2026', meas=[['幅', '25 cm'], ['高さ', '23 cm']]),
    'bracelet': dict(nameJa='1944年 スウィートハート ブレスレット ナポリ', capJa='恋人のブレスレット', nameEn='1944 Sweetheart Bracelet, Naples',
                     size='1944年 ナポリ', price='¥36,000', grade='B', gradeNote='刻印は鮮明、使用感あり',
                     city='PROVIDENCE RI', date='OCT 3', year='2026', meas=[['全長', '18 cm'], ['幅', '1.5 cm']]),
    'pouches': dict(nameJa='米軍 マガジンポーチ 2点', capJa='マガジンポーチ', nameEn='US Army Magazine Pouches, Pair',
                    size='幅 9 · 高さ 13', price='¥30,000', grade='B', gradeNote='使用感あり、スナップ良好',
                    city='DAYTON OH', date='SEP 28', year='2026', meas=[['幅', '9 cm'], ['高さ', '13 cm']]),
    'sam': dict(nameJa='40年代 アンクル・サム 木製ピン', capJa='アンクル・サム', nameEn='1940s Carved Wood Uncle Sam Pin',
                size='縦 6 · 幅 4', price='¥34,000', grade='A', gradeNote='塗装の欠けわずか',
                city='LANCASTER PA', date='OCT 19', year='2026', meas=[['縦', '6 cm'], ['幅', '4 cm']]),
    'ike': dict(nameJa='40年代 米陸軍 アイクジャケット', capJa='アイクジャケット', nameEn='1940s US Army Ike Jacket',
                size='着丈 56 · 身幅 50', price='¥128,000', grade='A', gradeNote='目立つダメージなし',
                city='ATHENS GA', date='SEP 21', year='2026', meas=[['着丈', '56 cm'], ['身幅', '50 cm'], ['肩幅', '44 cm'], ['袖丈', '60 cm']]),
}
AR = {'ike': 1.0, 'kit': 0.965, 'pouches': 1.0, 'sam': 1.33, 'bracelet': 1.251}   # full photo height / width
ORDER = ['kit', 'bracelet', 'pouches', 'sam', 'kit', 'bracelet', 'ike']
NEUTRALS = ['#DCD5C7', '#E0E2DB', '#E6DDCB', '#D9D2C3', '#D8D6CF', '#E9E3D9', '#ECE5D6']   # the archival neutrals
STORY = '1944年、アメリカの銃後。同時代の品を、ひとつずつ集めました。'


def main():
    if not os.path.exists('index.html'):
        sys.exit('ERROR: run from the site folder')
    missing = [f for f in NEEDED if not os.path.exists(os.path.join(IMG, f))]
    if missing:
        sys.exit('ERROR: missing in %s/: %s' % (IMG, ', '.join(missing)))
    items = []
    for i, k in enumerate(ORDER):
        d = dict(PIECES[k])
        d['bg'] = NEUTRALS[i]
        view = {'img': '%s/%s.%s' % (IMG, k, 'jpg' if k == 'bracelet' else 'png'), 'full': '%s/%s-full.jpg' % (IMG, k), 'ar': AR[k]}
        if k == 'bracelet':
            view['bleed'] = True
            d['ink'] = '#FFFDF6'
        d['views'] = [view]
        items.append(d)
    data = {'drop': {'no': 13, 'date': '2026.11.06', 'story': STORY}, 'items': items}
    src = open('index.html', encoding='utf-8').read()
    tag = '<script src="data/current.js"></script>'
    if src.count(tag) != 1 or src.count('<head>') != 1:
        sys.exit('ERROR: index.html is not as expected (data script or <head> not found exactly once)')
    page = src.replace('<head>', '<head>\n<base href="/">\n<meta name="robots" content="noindex">', 1)
    page = page.replace(tag, '<!-- sample drop: made by tools/make_test1940.py; local only, never published -->\n'
                        '<script>window.SG_DATA = ' + json.dumps(data, ensure_ascii=False) + ';</script>', 1)
    page = page.replace('<title>', '<title>TEST 1940 — ', 1)
    os.makedirs('test1940', exist_ok=True)
    open('test1940/index.html', 'w', encoding='utf-8').write(page)
    print('written: test1940/index.html (7 stamps: ' + ' '.join(ORDER) + ')')


if __name__ == '__main__':
    main()
