#!/usr/bin/env python3
"""Standard Gauge: pick each stamp's background color by rule, not by eye.

Rule
1. Use only the 9 stamp inks in PALETTE (keeps every drop looking like one stamp series).
2. For each item, take its stamp photo (the first `img:` after its `bg:` in index.html),
   remove the background, and find the item's 4 main colors (k-means in Lab color space)
   with how much of the item each covers.
3. Score every ink by its distance (Lab) from the item's main colors, giving more weight to
   colors that cover more of the item; colors covering under 5% are ignored. The closest
   main color decides the score.
4. Give every item in the drop a different ink, choosing the combination with the highest
   total score (Hungarian assignment).
5. On dark inks (brick), the price is printed in cream (`ink: '#FFFDF6'`) so it stays readable.

Usage
  python3 tools/stamp_colors.py index.html --dry-run   # print the table, change nothing
  python3 tools/stamp_colors.py index.html             # rewrite bg/ink values in index.html
"""
import os
import re
import sys

import numpy as np
from PIL import Image
from scipy import ndimage
from scipy.cluster.vq import kmeans2
from scipy.optimize import linear_sum_assignment
from skimage.color import rgb2lab

PALETTE = {
    'mustard': '#E8B53A', 'butter': '#F2D98A', 'peach': '#D98C6A', 'brick': '#C2412D',
    'sky': '#9DC3D9', 'teal': '#6E9E8C', 'sage': '#A9B79A', 'lilac': '#C9B3D6', 'cream': '#EFE3C8',
}
DARK_INKS = {'brick'}
CREAM_TEXT = '#FFFDF6'
MIN_WEIGHT = 0.05


def hex_to_lab(h):
    h = h.lstrip('#')
    rgb = np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], float) / 255.0
    return rgb2lab(rgb[None, None])[0, 0]


def item_pixels(path):
    """Pixels belonging to the item. Uses the PNG's transparency when it has any;
    otherwise removes near-white background connected to the image border."""
    im = Image.open(path)
    if im.mode in ('RGBA', 'LA') or 'transparency' in im.info:
        rgba = np.asarray(im.convert('RGBA'))
        alpha = rgba[..., 3]
        if (alpha < 250).any():
            return rgba[..., :3][alpha > 128].astype(float)
    a = np.asarray(im.convert('RGB')).astype(int)
    white = (a.min(axis=2) > 212) & ((a.max(axis=2) - a.min(axis=2)) < 9)
    lab, _ = ndimage.label(white)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(border))
    return a[~bg].astype(float)


def main_colors(pixels, k=4):
    rng = np.random.default_rng(0)
    take = min(20000, len(pixels))
    px = pixels[rng.choice(len(pixels), take, replace=False)]
    lab = rgb2lab((px / 255.0)[None])[0]
    centers, labels = kmeans2(lab, k, minit='++', seed=1)
    weights = np.bincount(labels, minlength=k) / len(labels)
    return [(centers[i], weights[i]) for i in range(k) if weights[i] > 0]


def scores_for(pixels):
    doms = main_colors(pixels)
    out = []
    for name, hx in PALETTE.items():
        plab = hex_to_lab(hx)
        d = [np.linalg.norm(plab - c) / (0.5 + w) for c, w in doms if w > MIN_WEIGHT]
        out.append(min(d) if d else 0.0)
    return out


ITEM_RE = re.compile(r"bg: '(#[0-9A-Fa-f]{6})'(, ink: '#[0-9A-Fa-f]{6}')?")
IMG_RE = re.compile(r"img: '([^']+)'")
NAME_RE = re.compile(r"nameEn: '([^']*)'")


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(2)
    html_path = sys.argv[1]
    dry = '--dry-run' in sys.argv
    base = os.path.dirname(os.path.abspath(html_path))
    src = open(html_path, encoding='utf-8').read()

    matches = list(ITEM_RE.finditer(src))
    if not matches:
        print('ERROR: no "bg: \'#xxxxxx\'" entries found')
        sys.exit(1)
    items = []
    for i, m in enumerate(matches):
        end = matches[i + 1].start() if i + 1 < len(matches) else len(src)
        chunk = src[m.start():end]
        img = IMG_RE.search(chunk)
        name = NAME_RE.search(chunk)
        if not img:
            print('ERROR: item %d has no img' % (i + 1))
            sys.exit(1)
        path = os.path.join(base, img.group(1))
        if not os.path.exists(path):
            print('ERROR: image not found: %s' % path)
            sys.exit(1)
        items.append({'m': m, 'img': img.group(1), 'path': path, 'name': name.group(1) if name else '?', 'old': m.group(1)})

    if len(items) > len(PALETTE):
        print('ERROR: %d items but only %d inks; add inks to PALETTE' % (len(items), len(PALETTE)))
        sys.exit(1)

    names = list(PALETTE)
    S = np.array([scores_for(item_pixels(it['path'])) for it in items])
    rows, cols = linear_sum_assignment(-S)
    for r, c in zip(rows, cols):
        it = items[r]
        it['ink_name'] = names[c]
        it['new'] = PALETTE[names[c]]
        it['rank'] = int(sorted(S[r], reverse=True).index(S[r, c]) + 1)

    print('%-34s %-28s %-9s %-9s %-8s %s' % ('item', 'image', 'old', 'new', 'ink', 'its rank'))
    for it in items:
        print('%-34s %-28s %-9s %-9s %-8s %d' % (it['name'][:34], it['img'][:28], it['old'], it['new'], it['ink_name'], it['rank']))
    print('distinct colors: %d of %d items' % (len({it['new'] for it in items}), len(items)))

    if dry:
        print('dry run: index.html not changed')
        return
    out, last = [], 0
    for it in items:
        m = it['m']
        rep = "bg: '%s'" % it['new'] + (", ink: '%s'" % CREAM_TEXT if it['ink_name'] in DARK_INKS else '')
        out.append(src[last:m.start()])
        out.append(rep)
        last = m.end()
    out.append(src[last:])
    open(html_path, 'w', encoding='utf-8').write(''.join(out))
    print('index.html updated')


if __name__ == '__main__':
    main()
