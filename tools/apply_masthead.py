#!/usr/bin/env python3
"""Standard Gauge homepage: minimalist masthead.

- Removes the corner tags (今週の入荷 · 第12便 and 全品送料込み) and the katakana subtitle.
- Replaces them with one centered, single-line masthead: STANDARD GAUGE in Old Standard TT,
  16px, regular weight, letter-spacing 0.32em with a matching text-indent so the tracked word
  is optically centered.
- The fan, the 1.25 s hover rise and the headline are not touched. (Measured in a test copy:
  a lifted stamp's top stays more than 64px below the masthead.)

Usage
  python3 tools/apply_masthead.py index.html
"""
import re
import sys

NEW_HTML = '<header class="site-header"><div class="brand-title">STANDARD GAUGE</div></header>'
NEW_CSS = (
    "  .site-header { position: absolute; left: 0; right: 0; top: 0; display: flex; justify-content: center; align-items: center; padding: 48px 0 24px; z-index: 70; }\n"
    "  .brand-title { font-family: 'Old Standard TT', serif; font-size: 16px; font-weight: 400; letter-spacing: 0.32em; text-indent: 0.32em; text-transform: uppercase; color: #1a2433; margin: 0; }\n"
)

REMOVE = [
    ('top bar markup', re.compile(r'[ \t]*<div class="topbar">[^\n]*?</div></div>\n')),
    ('brand markup', re.compile(r'[ \t]*<div class="brand">STANDARD GAUGE<span>スタンダードゲージ</span></div>\n')),
    ('top bar style', re.compile(r'[ \t]*\.topbar \{[^\n]*\}\n')),
    ('brand style', re.compile(r'[ \t]*\.brand \{[^\n]*\}\n')),
    ('brand subtitle style', re.compile(r'[ \t]*\.brand span \{[^\n]*\}\n')),
]


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(2)
    path = sys.argv[1]
    src = open(path, encoding='utf-8').read()
    if 'class="site-header"' in src:
        print('already applied: masthead')
        return
    problems = []
    for name, rx in REMOVE:
        n = len(rx.findall(src))
        if n != 1:
            problems.append('%s: matched %d times (expected 1)' % (name, n))
    if src.count('</style>') != 1:
        problems.append('</style> found %d times (expected 1)' % src.count('</style>'))
    if problems:
        print('ERROR: nothing changed. Problems:')
        for p in problems:
            print('  - ' + p)
        sys.exit(1)
    m = REMOVE[0][1].search(src)
    src = src[:m.start()] + '  ' + NEW_HTML + '\n' + src[m.end():]
    for _, rx in REMOVE[1:]:
        src = rx.sub('', src, count=1)
    src = src.replace('</style>', NEW_CSS + '</style>')
    open(path, 'w', encoding='utf-8').write(src)
    print('masthead applied (corner tags and subtitle removed)')


if __name__ == '__main__':
    main()
