#!/usr/bin/env python3
"""Postmark Archive: deep zoom (OpenSeadragon) in the full-size photo view, on the homepage and past drops.

What changes
- index.html and drops.html load zoom.js just before mobile.js. zoom.js does the rest: it waits for a full photo
  view to open and puts the zoom viewer over the photo. Nothing else on the pages changes.
- tools/build_site.mjs copies zoom.js and zoom-test.html into the built site.
Needs zoom.js, zoom-test.html and assets/vendor/openseadragon-4.1.0.min.js in place first.
Safe to run more than once.

Usage
  python3 tools/apply_deep_zoom.py index.html drops.html tools/build_site.mjs
"""
import os
import sys

TAG = '<script src="zoom.js"></script>'
EDITS = {
    'index.html': [('<script src="mobile.js"></script>', TAG + '\n<script src="mobile.js"></script>')],
    'drops.html': [('<script src="mobile.js"></script>', TAG + '\n<script src="mobile.js"></script>')],
    'build_site.mjs': [("const SITE_FILES = ['index.html', 'drops.html', 'mobile.css', 'mobile.js', 'assets', 'data'];",
                        "const SITE_FILES = ['index.html', 'drops.html', 'mobile.css', 'mobile.js', 'zoom.js', 'zoom-test.html', 'assets', 'data'];")],
}
DONE = {'index.html': TAG, 'drops.html': TAG, 'build_site.mjs': "'zoom.js'"}
NEEDED = ['zoom.js', 'zoom-test.html', 'assets/vendor/openseadragon-4.1.0.min.js']


def main():
    files = sys.argv[1:]
    if sorted(os.path.basename(f) for f in files) != sorted(EDITS):
        sys.exit('Usage: python3 tools/apply_deep_zoom.py index.html drops.html tools/build_site.mjs')
    missing = [p for p in NEEDED if not os.path.exists(p)]
    if missing:
        sys.exit('ERROR: nothing changed. Missing: ' + ', '.join(missing))
    srcs = {f: open(f, encoding='utf-8').read() for f in files}
    todo = {f: s for f, s in srcs.items() if DONE[os.path.basename(f)] not in s}
    if not todo:
        print('already applied')
        return
    problems = []
    for f, s in todo.items():
        for old, _ in EDITS[os.path.basename(f)]:
            if s.count(old) != 1:
                problems.append('%s: found %d of %r (expected 1)' % (f, s.count(old), old[:70]))
    if problems:
        print('ERROR: nothing changed. Problems:')
        for p in problems:
            print('  - ' + p)
        sys.exit(1)
    for f, s in todo.items():
        for old, new in EDITS[os.path.basename(f)]:
            s = s.replace(old, new, 1)
        open(f, 'w', encoding='utf-8').write(s)
        print('deep zoom added: ' + f)


if __name__ == '__main__':
    main()
