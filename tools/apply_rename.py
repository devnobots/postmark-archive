#!/usr/bin/env python3
"""The site's name is now POSTMARK ARCHIVE (was Standard Gauge).

What changes on the public site
- the wordmark (desktop masthead, past-drops masthead, phone mastheads and footers): POSTMARK ARCHIVE,
  letter-spaced by the existing styles, exactly as STANDARD GAUGE was
- the access-code seal: POSTMARK / ARCHIVE on two lines
- browser tab titles: POSTMARK ARCHIVE (no katakana name)
- a sold piece whose buyer did not share a handle: PRIVATE COLLECTION (個人蔵 stays), instead of
  PRIVATE ARCHIVE, so it is not read as the shop's own archive
- the first-line comments of mobile.css and mobile.js
Nothing else moves. Fonts named "Old Standard TT" are untouched. Safe to run more than once.

Usage
  python3 tools/apply_rename.py index.html drops.html mobile.js mobile.css
"""
import sys

EDITS = {
    'index.html': [
        ('<title>Standard Gauge — スタンダードゲージ</title>', '<title>POSTMARK ARCHIVE</title>', 1),
        ('<div class="gate-seal">STANDARD<br>GAUGE</div>', '<div class="gate-seal">POSTMARK<br>ARCHIVE</div>', 1),
        ('<div class="brand-title">STANDARD GAUGE</div>', '<div class="brand-title">POSTMARK ARCHIVE</div>', 1),
        ("var who = !d.owner ? 'PRIVATE ARCHIVE'", "var who = !d.owner ? 'PRIVATE COLLECTION'", 1),
    ],
    'drops.html': [
        ('<title>過去の便 — Standard Gauge</title>', '<title>過去の便 — POSTMARK ARCHIVE</title>', 1),
        ('<div class="arch-masthead"><a href="index.html">STANDARD GAUGE</a></div>',
         '<div class="arch-masthead"><a href="index.html">POSTMARK ARCHIVE</a></div>', 1),
        ("var who = !d.owner ? 'PRIVATE ARCHIVE'", "var who = !d.owner ? 'PRIVATE COLLECTION'", 1),
    ],
    'mobile.js': [
        ('// Standard Gauge: phone layout', '// Postmark Archive: phone layout', 1),
        ('<a class="m-mast" href="index.html">STANDARD GAUGE</a>', '<a class="m-mast" href="index.html">POSTMARK ARCHIVE</a>', 3),
        ('<div class="m-brand">STANDARD GAUGE</div>', '<div class="m-brand">POSTMARK ARCHIVE</div>', 2),
        ('<span class="tag">(PRIVATE ARCHIVE)</span>', '<span class="tag">(PRIVATE COLLECTION)</span>', 1),
    ],
    'mobile.css': [
        ('/* Standard Gauge: phone layout', '/* Postmark Archive: phone layout', 1),
    ],
}
LEFTOVER = ['STANDARD GAUGE', 'STANDARD<br>GAUGE', 'Standard Gauge', 'スタンダードゲージ', 'PRIVATE ARCHIVE']


def main():
    files = sys.argv[1:]
    names = [f.split('/')[-1] for f in files]
    if sorted(names) != sorted(EDITS):
        sys.exit('Usage: python3 tools/apply_rename.py index.html drops.html mobile.js mobile.css')
    srcs = {f: open(f, encoding='utf-8').read() for f in files}
    if all('POSTMARK ARCHIVE' in s or 'Postmark Archive' in s for s in srcs.values()) and \
            not any(x in s for s in srcs.values() for x in LEFTOVER):
        print('already applied')
        return
    problems = []
    for f, s in srcs.items():
        for old, _, n in EDITS[f.split('/')[-1]]:
            if s.count(old) != n:
                problems.append('%s: found %d of %r (expected %d)' % (f, s.count(old), old[:60], n))
    if problems:
        print('ERROR: nothing changed. Problems:')
        for p in problems:
            print('  - ' + p)
        sys.exit(1)
    out = {}
    for f, s in srcs.items():
        for old, new, _ in EDITS[f.split('/')[-1]]:
            s = s.replace(old, new)
        left = [x for x in LEFTOVER if x in s]
        if left:
            sys.exit('ERROR: nothing changed. %s would still contain %s' % (f, left))
        out[f] = s
    for f, s in out.items():
        open(f, 'w', encoding='utf-8').write(s)
        print('renamed: ' + f)


if __name__ == '__main__':
    main()
