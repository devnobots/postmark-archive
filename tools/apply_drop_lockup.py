#!/usr/bin/env python3
"""Standard Gauge homepage: the current-drop line and the past-drops link as ONE quiet line.

    第12便 公開中  ·  過去の便を見る →

11px, letter-spacing 0.16em, muted gray; the current drop in dark text; the link has a faint
hairline underline that darkens on hover. Replaces the earlier two-line version under the fan
if it is there. POSITION decides where the line sits:
  top    = directly under the STANDARD GAUGE masthead
  bottom = under the instruction line below the headline

Safe to run more than once.

Usage
  python3 tools/apply_drop_lockup.py index.html
"""
import re
import sys

POSITION = 'bottom'
CURRENT_DROP = '第12便'

LOCKUP = ('<div class="drop-status-lockup"><span class="drop-status-current">%s 公開中</span>'
          '<span class="drop-status-dot" aria-hidden="true">·</span>'
          '<a class="drop-status-link" href="#drops">過去の便を見る →</a></div>') % CURRENT_DROP
CSS = (
    "  .drop-status-lockup { display: flex; justify-content: center; align-items: center; gap: 12px; font-size: 11px; letter-spacing: 0.16em; color: #6b6e72; }\n"
    "  .drop-status-lockup.at-top { position: absolute; left: 0; right: 0; top: 82px; z-index: 70; }\n"
    "  .drop-status-lockup.at-bottom { margin-top: 2px; }\n"
    "  .drop-status-current { color: #1a2433; font-weight: 500; }\n"
    "  .drop-status-link { color: #6b6e72; text-decoration: none; border-bottom: 1px solid rgba(107, 110, 114, 0.35); padding-bottom: 2px; transition: color 150ms ease, border-color 150ms ease; }\n"
    "  .drop-status-link:hover { color: #1a2433; border-bottom-color: #1a2433; }\n"
)
OLD_HTML = re.compile(
    r'\n?[ \t]*<div class="drop-links"><div class="drop-current">[^<]*</div><a class="drop-more"[^>]*>[^<]*</a></div>'
    r'|\n?[ \t]*<div class="drop-status-lockup[^"]*"><span class="drop-status-current">[^<]*</span>'
    r'<span class="drop-status-dot"[^>]*>[^<]*</span><a class="drop-status-link"[^>]*>[^<]*</a></div>')
OLD_CSS = re.compile(r'^[ \t]*\.(drop-links|drop-current|drop-more|drop-status-[a-z-]+)[^\n]*\n', re.M)
HINT = re.compile(r'(<p class="hint" id="hint">[^<]*</p>)')
SITE_HEADER = re.compile(r'(<header class="site-header">.*?</header>)', re.S)


def main():
    path = sys.argv[1]
    src = open(path, encoding='utf-8').read()
    problems = []
    if src.count('</style>') != 1:
        problems.append('</style> found %d times (expected 1)' % src.count('</style>'))
    if POSITION == 'bottom' and len(HINT.findall(src)) != 1:
        problems.append('instruction line (id="hint") found %d times (expected 1)' % len(HINT.findall(src)))
    if POSITION == 'top' and len(SITE_HEADER.findall(src)) != 1:
        problems.append('masthead found %d times (expected 1)' % len(SITE_HEADER.findall(src)))
    if problems:
        print('ERROR: nothing changed. Problems:')
        for p in problems:
            print('  - ' + p)
        sys.exit(1)
    landmarks = ['id="hint"', 'class="copy"', 'class="site-header"', 'id="overlay"', 'id="hit"']
    before = [src.count(x) for x in landmarks]
    src = OLD_HTML.sub('', src)
    if [src.count(x) for x in landmarks] != before:
        sys.exit('ERROR: nothing changed. Removing the old drop line would also remove other page parts.')
    src = OLD_CSS.sub('', src)
    if POSITION == 'bottom':
        src = HINT.sub(lambda m: m.group(1) + '\n    ' + LOCKUP.replace('drop-status-lockup', 'drop-status-lockup at-bottom', 1), src, count=1)
    else:
        src = SITE_HEADER.sub(lambda m: m.group(1) + '\n  ' + LOCKUP.replace('drop-status-lockup', 'drop-status-lockup at-top', 1), src, count=1)
    src = src.replace('</style>', CSS + '</style>', 1)
    open(path, 'w', encoding='utf-8').write(src)
    print('drop line applied (%s)' % POSITION)


if __name__ == '__main__':
    main()
