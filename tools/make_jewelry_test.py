#!/usr/bin/env python3
"""Postmark Archive: a test page for a jewelry drop (option B: cut-out silver on light neutral stamps).

Reads the three jewelry photos in jewlery_test/ (shot on black), cuts each one out, and writes jewelry-test.html:
the real homepage (same fan, piece card, full photo view and phone layout) with seven stamps that rotate the three
pieces. The stamps use the jewelry colours in order (the back office picks them by the colour rule instead).
- The cutout: everything dark that touches the photo's edge is background. Dark grooves inside the silver stay.
  The chain above the bail is trimmed (the first row wider than 10% of the photo is where the piece starts).
- The mock-up (the one image much taller than wide) is skipped.
- Nothing here is published: jewelry-test.html and jewlery_test/ are not part of the site build.
Writes: jewlery_test/out/j1.png j2.png j3.png (stamp cutouts, 640px), j1-full.jpg ... (as shot, 2400px),
        jewelry-test.html (repo root). Same result on every run.

Usage
  .venv-tools/bin/python tools/make_jewelry_test.py      (needs numpy, scipy and Pillow, as tools/stamp_colors.py does)
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

FOLDERS = ['jewlery_test', 'jewelry_test']
EXTS = ('.png', '.jpg', '.jpeg', '.webp', '.avif')
# the jewelry colours (light neutrals), the same nine the back office uses for a jewelry drop
NEUTRALS = ['#ECE5D6', '#DCD5C7', '#E0E2DB', '#E6DDCB', '#D8D6CF', '#E9E3D9', '#D9D2C3', '#E3E0D7', '#EFE8DA']
SAMPLES = [  # sample text only (the three photos may come in any order)
    ('シルバー ペンダント', 'Silver and Turquoise Pendant', '縦 6.1 · 幅 4.4', '¥48,400', 'A', '目立つダメージなし'),
    ('ターコイズ ペンダント', 'Turquoise Pendant', '縦 7.6 · 幅 4.0', '¥96,800', 'S', '新品同様'),
    ('スタンプ ペンダント', 'Stamped Silver Pendant', '縦 5.2 · 幅 2.9', '¥38,500', 'B', 'わずかな小傷'),
]


def open_rgb(path):
    try:
        return Image.open(path).convert('RGB')
    except Exception as e:  # AVIF needs Pillow 11.3+ (or pillow-avif-plugin)
        sys.exit('ERROR: could not read %s (%s). For an .avif file: .venv-tools/bin/pip install -U pillow, then run again.' % (path, e))


def cut_out(im):
    a = np.asarray(im).astype(int)
    lum = a.max(axis=2)
    edge = np.concatenate([lum[0], lum[-1], lum[:, 0], lum[:, -1]])
    t = min(60, int(np.percentile(edge, 95)) + 14)           # the backdrop's darkness, plus a margin
    lab, _ = ndimage.label(lum < t)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    fg = ~np.isin(lab, list(border))
    parts, n = ndimage.label(fg)
    sizes = ndimage.sum(fg, parts, range(1, n + 1))
    keep = np.isin(parts, [i + 1 for i, s in enumerate(sizes) if s > 0.001 * fg.size])
    widths = keep.sum(axis=1)
    top = int(np.argmax(widths > 0.10 * im.width))            # below the chain: the bail
    keep[:top] = False
    ys, xs = np.where(keep)
    box = (int(xs.min()), top, int(xs.max()) + 1, int(ys.max()) + 1)
    alpha = Image.fromarray((keep * 255).astype('uint8')).filter(ImageFilter.GaussianBlur(1.2))
    out = im.copy()
    out.putalpha(alpha)
    return out.crop(box), box, t


def main():
    folder = next((f for f in FOLDERS if os.path.isdir(f)), None)
    if not folder or not os.path.exists('index.html'):
        sys.exit('ERROR: run from the site folder, with the photos in jewlery_test/')
    files = sorted(f for f in os.listdir(folder) if f.lower().endswith(EXTS) and not f.startswith('.'))
    photos = []
    for f in files:
        w, h = open_rgb(os.path.join(folder, f)).size
        if h > 1.6 * w:
            print('skipped (the mock-up): ' + f)
            continue
        photos.append(f)
    if len(photos) != 3:
        sys.exit('ERROR: expected 3 jewelry photos in %s/, found %d: %s' % (folder, len(photos), ', '.join(photos)))
    out_dir = os.path.join(folder, 'out')
    os.makedirs(out_dir, exist_ok=True)
    views = []
    for i, f in enumerate(photos, 1):
        im = open_rgb(os.path.join(folder, f))
        cut, box, t = cut_out(im)
        cut.thumbnail((640, 640))
        cut.save(os.path.join(out_dir, 'j%d.png' % i), optimize=True)
        full = im.copy()
        full.thumbnail((2400, 2400))
        full.save(os.path.join(out_dir, 'j%d-full.jpg' % i), quality=90)
        views.append({'img': '%s/out/j%d.png' % (folder, i), 'full': '%s/out/j%d-full.jpg' % (folder, i),
                      'ar': round(full.height / full.width, 3)})
        print('j%d: %s  backdrop under %d  piece %s  stamp photo %dx%d' % (i, f, t, box, cut.width, cut.height))
    items = []
    for k in range(7):
        n = k % 3
        ja, en, size, price, grade, note = SAMPLES[n]
        items.append({'bg': NEUTRALS[k], 'nameJa': ja, 'capJa': ja, 'nameEn': en, 'size': size, 'price': price,
                      'grade': grade, 'gradeNote': note, 'city': 'SANTA FE NM', 'date': 'OCT 3', 'year': '2026',
                      'meas': [['縦', '6.1 cm'], ['幅', '4.4 cm']], 'views': [views[n]]})
    data = {'drop': {'no': 13, 'date': '2026.10.30', 'story': 'サンタフェで見つけた、スタンプワークのシルバー。'}, 'items': items}
    src = open('index.html', encoding='utf-8').read()
    tag = '<script src="data/current.js"></script>'
    if src.count(tag) != 1:
        sys.exit('ERROR: index.html has %d of %s (expected 1)' % (src.count(tag), tag))
    page = src.replace(tag, '<!-- jewelry test page: made by tools/make_jewelry_test.py; not published -->\n'
                       '<script>window.SG_DATA = ' + json.dumps(data, ensure_ascii=False) + ';</script>', 1)
    page = page.replace('<title>', '<title>JEWELRY TEST — ', 1)
    open('jewelry-test.html', 'w', encoding='utf-8').write(page)
    print('written: jewelry-test.html (7 stamps: j1 j2 j3 j1 j2 j3 j1)')


if __name__ == '__main__':
    main()
