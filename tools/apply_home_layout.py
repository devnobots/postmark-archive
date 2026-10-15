#!/usr/bin/env python3
"""Standard Gauge homepage: vertically center the fan + headline as one group, and remove the
bottom sample-photo note. Sets final values directly, whatever the current numbers are.

Layout (design is drawn at 1280 x 880; the top bar ends near y = 70):
  room for a lifted stamp ............ y 176
  fan at rest ........................ y 224 - 529   (stamp top 238, virtual pivot 480 below = y 718)
  headline group ..................... y 602 - 722
  the resting fan + headline group is centered between the top bar and the bottom edge.

Usage
  python3 tools/apply_home_layout.py index.html
"""
import re
import sys

STAMP_TOP = 238
PIVOT_Y = STAMP_TOP + 480          # transform-origin is 480px below the stamp top
HIT_LEFT, HIT_TOP, HIT_W, HIT_H = 120, 138, 1040, 470
COPY_TOP = 602

RULES = [
    ('fan stamp top', re.compile(r"(\.fan-stamp \{[^}]*?top: )\d+(px;)", re.S), r"\g<1>%d\g<2>" % STAMP_TOP),
    ('fan stamp pivot', re.compile(r"(\.fan-stamp \{[^}]*?transform-origin: 78px )\d+(px;)", re.S), r"\g<1>480\g<2>"),
    ('hover area', re.compile(r"#hit \{[^}]*\}"),
     "#hit { position: absolute; left: %dpx; top: %dpx; width: %dpx; height: %dpx; z-index: 55; }" % (HIT_LEFT, HIT_TOP, HIT_W, HIT_H)),
    ('headline position', re.compile(r"(\.copy \{ position: absolute; left: 0; right: 0; top: )\d+(px;)"), r"\g<1>%d\g<2>" % COPY_TOP),
    ('hover scale', re.compile(r"var r = hit\.getBoundingClientRect\(\), k = \d+ / \(r\.width \|\| \d+\);"),
     "var r = hit.getBoundingClientRect(), k = %d / (r.width || %d);" % (HIT_W, HIT_W)),
    ('hover x', re.compile(r"var x = \d+ \+ \(e\.clientX - r\.left\) \* k, y = \d+ \+ \(e\.clientY - r\.top\) \* k;"),
     "var x = %d + (e.clientX - r.left) * k, y = %d + (e.clientY - r.top) * k;" % (HIT_LEFT, HIT_TOP)),
    ('hover pivot', re.compile(r"var dx = x - 640, dy = \d+ - y,"), "var dx = x - 640, dy = %d - y," % PIVOT_Y),
    ('hover ring', re.compile(r"if \(rad > \d+ && rad < \d+ && dy > -?\d+\) \{"), "if (rad > 270 && rad < 620 && dy > 0) {"),
    ('lift', re.compile(r"(\} else if \(state\.lifted === i\) \{\s*)tf = [^;]*;"),
     r"\g<1>tf = 'rotate(' + a + 'deg) translateY(-34px) translateY(-384px) scale(1.15) translateY(384px)';"),
    ('resting stack', re.compile(r"(if \(!state\.fanned\) \{\s*)tf = [^;]*;"),
     r"\g<1>tf = 'rotate(' + (a * 0.15) + 'deg) translateY(60px) scale(0.9)';"),
    ('sample note', re.compile(r"\n?[ \t]*<div class=\"note\">[^<]*</div>"), ""),
]


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(2)
    path = sys.argv[1]
    src = open(path, encoding='utf-8').read()
    problems = []
    if 'id="seal"' in src:
        problems.append('the badge (id="seal") is still on the page; the virtual-pivot fan change must be applied first')
    if 'transform-origin: 78px' not in src:
        problems.append('fan stamp rule not found')
    for name, rx, _ in RULES:
        n = len(rx.findall(src))
        if name == 'sample note' and n == 0:
            continue
        if n != 1:
            problems.append('%s: matched %d times (expected 1)' % (name, n))
    if problems:
        print('ERROR: nothing changed. Problems:')
        for p in problems:
            print('  - ' + p)
        sys.exit(1)
    for _, rx, rep in RULES:
        src = rx.sub(rep, src, count=1)
    open(path, 'w', encoding='utf-8').write(src)
    print('home layout applied (%d rules)' % len(RULES))


if __name__ == '__main__':
    main()
