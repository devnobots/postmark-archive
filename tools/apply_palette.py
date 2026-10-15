#!/usr/bin/env python3
"""Standard Gauge: new palette and warm shadows.

- Page background #f5f2eb, stamp paper #faf8f5, dark text #1a2433, muted text #6b6e72.
- Stamp shadows are warm brown (hsla 28, 25%, 20%) and follow the perforated edge
  (drop-shadow, not box-shadow). A lifted fan stamp gets the stronger "lifted" shadow,
  easing in over the same 1.25 s as the rise; the big listing stamp always has it.
Sets final values directly; safe to run more than once.

Usage
  python3 tools/apply_palette.py index.html
"""
import re
import sys

REST = ("drop-shadow(0 10px 10px hsla(28, 25%, 20%, 0.07)) "
        "drop-shadow(0 2px 3px hsla(28, 25%, 20%, 0.04))")
LIFTED = ("drop-shadow(0 20px 16px hsla(28, 25%, 20%, 0.12)) "
          "drop-shadow(0 4px 5px hsla(28, 25%, 20%, 0.06))")

RULES = [
    ('page background', re.compile(r"--paper: #[0-9A-Fa-f]{6};"), "--paper: #f5f2eb;"),
    ('dark text', re.compile(r"--ink: #[0-9A-Fa-f]{6};"), "--ink: #1a2433;"),
    ('muted text', re.compile(r"--ink-3: #[0-9A-Fa-f]{6};"), "--ink-3: #6b6e72;"),
    ('stamp paper', re.compile(r"(\.stamp-paper \{[^}]*?background: )[^;]+;", re.S), r"\g<1>#faf8f5;"),
    ('resting shadow', re.compile(r"^[ \t]*\.stamp-shadow \{[^\n]*\}\n", re.M),
     "  .stamp-shadow { width: 156px; filter: %s; transition: filter 1.25s ease; }\n" % REST),
]
LIFT_RULE = ("  .fan-stamp.up .stamp-shadow { filter: %s; }\n"
             "  #stampBtn .stamp-shadow { filter: %s; } /* listing stamp: always the stronger shadow */\n") % (LIFTED, LIFTED)
LIFT_RULE_RX = re.compile(r"^[ \t]*(\.fan-stamp\.up|#stampBtn) \.stamp-shadow \{[^\n]*\n", re.M)
JS_ANCHOR = "b.style.transform = tf; b.style.opacity = op; b.style.zIndex = z;"
JS_TOGGLE = "b.classList.toggle('up', state.lifted === i);"


def main():
    path = sys.argv[1]
    src = open(path, encoding='utf-8').read()
    problems = []
    for name, rx, _ in RULES:
        n = len(rx.findall(src))
        if n != 1:
            problems.append('%s: matched %d times (expected 1)' % (name, n))
    if src.count(JS_ANCHOR) != 1:
        problems.append('fan render line found %d times (expected 1)' % src.count(JS_ANCHOR))
    if problems:
        print('ERROR: nothing changed. Problems:')
        for p in problems:
            print('  - ' + p)
        sys.exit(1)
    for _, rx, rep in RULES:
        src = rx.sub(rep, src, count=1)
    src = LIFT_RULE_RX.sub('', src)
    src = src.replace("  .stamp-shadow { width: 156px; filter: %s; transition: filter 1.25s ease; }\n" % REST,
                      "  .stamp-shadow { width: 156px; filter: %s; transition: filter 1.25s ease; }\n" % REST + LIFT_RULE, 1)
    if JS_TOGGLE not in src:
        src = src.replace(JS_ANCHOR, JS_ANCHOR + "\n    " + JS_TOGGLE, 1)
    open(path, 'w', encoding='utf-8').write(src)
    print('palette applied')


if __name__ == '__main__':
    main()
