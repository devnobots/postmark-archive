#!/usr/bin/env python3
"""Standard Gauge: connect the phone layout (mobile.css + mobile.js) to a page.

Adds two lines in <head> (marks phones before anything draws, so there is no flash of the desktop
layout, then loads mobile.css) and one line before </body> (loads mobile.js). Desktop is unaffected:
every phone rule only applies when the screen is narrower than 760px. Safe to run more than once.

Usage
  python3 tools/apply_mobile.py index.html drops.html
"""
import sys

HEAD_ANCHOR = '<meta name="viewport" content="width=device-width, initial-scale=1">'
HEAD_ADD = ("\n<script>if (window.matchMedia('(max-width: 759px)').matches) document.documentElement.classList.add('m');</script>"
            "\n<link rel=\"stylesheet\" href=\"mobile.css\">")
BODY_ANCHOR = '</body>'
BODY_ADD = '<script src="mobile.js"></script>\n'
MARK = 'href="mobile.css"'


def main():
    todo, problems = {}, []
    for path in sys.argv[1:]:
        src = open(path, encoding='utf-8').read()
        if MARK in src:
            print('already applied: ' + path)
            continue
        for name, a in [('viewport line', HEAD_ANCHOR), ('</body>', BODY_ANCHOR)]:
            if src.count(a) != 1:
                problems.append('%s: %s found %d times (expected 1)' % (path, name, src.count(a)))
        todo[path] = src
    if problems:
        print('ERROR: nothing changed. Problems:')
        for p in problems:
            print('  - ' + p)
        sys.exit(1)
    for path, src in todo.items():
        src = src.replace(HEAD_ANCHOR, HEAD_ANCHOR + HEAD_ADD, 1).replace(BODY_ANCHOR, BODY_ADD + BODY_ANCHOR, 1)
        open(path, 'w', encoding='utf-8').write(src)
        print('phone layout connected: ' + path)


if __name__ == '__main__':
    main()
