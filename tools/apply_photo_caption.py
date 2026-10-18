#!/usr/bin/env python3
"""Postmark Archive: one caption under every full-size photo, on desktop and phone.

    細部や素材の質感まで、鮮明に。

Desktop (homepage and past drops): the white photo box keeps its size (576 x 768). The photo now fills the top
712px and the caption sits centered in the 56px below it, in the site's muted Mincho, so it never covers a photo.
The hover loupe is moved to match (it measured the photo against the full 768px height).

Phone (both pages): the line under the full-screen photos shows the caption only. The old gesture hint
(ダブルタップで拡大 · スワイプで次の写真) is removed; double-tap zoom and swiping still work as before.

Nothing else on the pages changes. Safe to run more than once.

Usage
  python3 tools/apply_photo_caption.py index.html drops.html mobile.js mobile.css
"""
import sys

CAPTION = '細部や素材の質感まで、鮮明に。'
MARK = 'full-caption'

DESK_EDITS = [
    ('photo area leaves room for the caption',
     '  .full-box img { display: block; width: 100%; height: 100%; object-fit: contain; }',
     '  .full-box img { display: block; width: 100%; height: 712px; object-fit: contain; }\n'
     '  .full-caption { position: absolute; left: 0; right: 0; bottom: 21px; text-align: center; font-family: \'Shippori Mincho\', serif;\n'
     '    font-size: 13px; letter-spacing: 0.14em; color: #6b6e72; pointer-events: none; }'),
    ('caption under the photo',
     '<div class="full-box"><img id="fullImg" alt=""><div id="fullLoupe"></div></div>',
     '<div class="full-box"><img id="fullImg" alt=""><div class="full-caption">' + CAPTION + '</div><div id="fullLoupe"></div></div>'),
    ('loupe measures the 712px photo area',
     'var s = Math.min(576 / nw, 768 / nh), w = nw * s, h = nh * s, ox = (576 - w) / 2, oy = (768 - h) / 2; // object-fit: contain',
     'var s = Math.min(576 / nw, 712 / nh), w = nw * s, h = nh * s, ox = (576 - w) / 2, oy = (712 - h) / 2; // object-fit: contain, in the 712px photo area above the caption'),
]
EDITS = {
    'index.html': DESK_EDITS,
    'drops.html': DESK_EDITS,
    'mobile.js': [
        ('phone line under the photos',
         "<div class=\"m-help\">ダブルタップで拡大' + (d.views.length > 1 ? '　·　スワイプで次の写真' : '') + '</div></div>'",
         "<div class=\"m-help\">" + CAPTION + "</div></div>'"),
    ],
    'mobile.css': [
        ('phone caption type',
         "  font-size: 12px; letter-spacing: .1em; color: #6b6e72; }",
         "  font-size: 13px; letter-spacing: .14em; color: #6b6e72; }"),
    ],
}


def main():
    files = sys.argv[1:]
    names = [f.split('/')[-1] for f in files]
    if sorted(names) != sorted(EDITS):
        sys.exit('Usage: python3 tools/apply_photo_caption.py index.html drops.html mobile.js mobile.css')
    srcs = {f: open(f, encoding='utf-8').read() for f in files}
    done = [f for f, s in srcs.items() if (MARK in s if f.endswith('.html') else CAPTION in s or 'font-size: 13px; letter-spacing: .14em; color: #6b6e72; }' in s or '.m-pinch' in s)]
    if len(done) == len(files):
        print('already applied')
        return
    if done:
        sys.exit('ERROR: nothing changed. Only some files have the caption already: ' + ', '.join(done))
    problems = []
    for f, s in srcs.items():
        for label, old, _ in EDITS[f.split('/')[-1]]:
            if s.count(old) != 1:
                problems.append('%s, %s: found %d (expected 1)' % (f, label, s.count(old)))
    if problems:
        print('ERROR: nothing changed. Problems:')
        for p in problems:
            print('  - ' + p)
        sys.exit(1)
    for f, s in srcs.items():
        for _, old, new in EDITS[f.split('/')[-1]]:
            s = s.replace(old, new, 1)
        open(f, 'w', encoding='utf-8').write(s)
        print('caption added: ' + f)


if __name__ == '__main__':
    main()
