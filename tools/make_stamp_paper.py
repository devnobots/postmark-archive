#!/usr/bin/env python3
"""Postmark Archive: make the stamp paper files (perforated edges and paper grain). Same files on every run.

Writes, into assets/stamp/:
- perf-192-1.svg, perf-192-2.svg, perf-192-3.svg   edges for the small stamps (156 x 192), three slightly different
- perf-240-1.svg                                    edge for the tall listing stamp (156 x 240)
  Each is a mask: the paper is solid and the perforation holes are clear. The holes sit on the same 12px grid as
  before, each moved by up to 0.45px, its size varied by up to 0.35px and very slightly out of round, the way a
  real punch press leaves them.
- grain.png   a 384 x 384 tile of fine cotton-paper grain with long faint fibers, shown at 192 x 192 CSS px
  (sharp on high-resolution screens). Only see-through warm grey specks: it is laid over the paper colour.

Usage
  .venv-tools/bin/python tools/make_stamp_paper.py        (needs numpy, scipy and Pillow, as tools/stamp_colors.py does)
"""
import hashlib
import os

import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter

OUT = 'assets/stamp'
PITCH, R, JITTER, WOBBLE, ROUND = 12, 3.65, 0.45, 0.35, 0.08


def perf_svg(w, h, seed):
    rng = np.random.default_rng(seed)
    holes = []

    def hole(x, y):
        dx, dy = rng.uniform(-JITTER, JITTER, 2)
        r = R + rng.uniform(-WOBBLE, WOBBLE)
        e = 1 + rng.uniform(-ROUND, ROUND)
        holes.append('<ellipse cx="%.2f" cy="%.2f" rx="%.2f" ry="%.2f"/>' % (x + dx, y + dy, r * e, r / e))
    for x in range(0, w + 1, PITCH):
        hole(x, 0); hole(x, h)
    for y in range(PITCH, h, PITCH):
        hole(0, y); hole(w, y)
    return ('<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d" preserveAspectRatio="none">'
            '<defs><mask id="m" maskUnits="userSpaceOnUse" x="0" y="0" width="%d" height="%d">'
            '<rect width="%d" height="%d" fill="#fff"/><g fill="#000">%s</g></mask></defs>'
            '<rect width="%d" height="%d" mask="url(#m)"/></svg>\n') % (w, h, w, h, w, h, w, h, ''.join(holes), w, h)


def grain_png(size=384, seed=11):
    rng = np.random.default_rng(seed)
    n = np.zeros((size, size))
    for sigma, weight in [(0.5, 1.0), (1.2, 0.55), (3.0, 0.2), (7.0, 0.1)]:     # fine tooth plus softer mottling
        layer = gaussian_filter(rng.standard_normal((size, size)), sigma, mode='wrap')
        n += weight * layer / layer.std()
    fib = gaussian_filter(rng.standard_normal((size, size)), (0.5, 24), mode='wrap')  # long faint horizontal fibers
    n += 0.35 * fib / fib.std()
    n = (n - n.mean()) / n.std()
    alpha = np.clip(0.024 + 0.014 * n, 0, 0.09)                                # mostly 1-4% specks, never strong
    rgba = np.zeros((size, size, 4), np.uint8)
    rgba[..., 0], rgba[..., 1], rgba[..., 2] = 107, 94, 77                     # warm grey (the old mock-up's colour)
    rgba[..., 3] = np.round(alpha * 255).astype(np.uint8)
    return Image.fromarray(rgba, 'RGBA')


def main():
    os.makedirs(OUT, exist_ok=True)
    files = {}
    for name, (w, h, seed) in {'perf-192-1.svg': (156, 192, 101), 'perf-192-2.svg': (156, 192, 202),
                               'perf-192-3.svg': (156, 192, 303), 'perf-240-1.svg': (156, 240, 404)}.items():
        text = perf_svg(w, h, seed)
        open(os.path.join(OUT, name), 'w').write(text)
        files[name] = hashlib.sha256(text.encode()).hexdigest()[:12]
    img = grain_png()
    img.save(os.path.join(OUT, 'grain.png'), optimize=True)
    files['grain.png (pixels)'] = hashlib.sha256(img.tobytes()).hexdigest()[:12]
    for k, v in files.items():
        print('%-20s %s' % (k, v))


if __name__ == '__main__':
    main()
