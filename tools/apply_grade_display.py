#!/usr/bin/env python3
"""Standard Gauge mockup: show each item's real condition grade and a one-line S–D legend
in the listing panel (replaces the [S–D] [状態メモ] placeholder). Run once.

Usage
  python3 tools/apply_grade_display.py index.html
"""
import sys

EDITS = [
    # 1. markup: placeholder -> real grade + note, plus the legend line
    ('<div class="cond"><span>状態ランク</span><b>[S–D]</b><span>[状態メモ]</span></div>',
     '<div class="cond"><span>状態ランク</span><b id="grade"></b><span id="gradeNote"></span></div>\n'
     '        <div class="legend">S 新品同様 · A 目立つダメージなし · B 使用感あり · C 目立つダメージあり · D 難あり</div>'),
    # 2. style for the legend
    ('</style>',
     '  .legend { font-size: 11px; color: var(--ink-3); margin-top: -12px; letter-spacing: 0.3px; }\n'
     '  .title h2 { word-break: keep-all; } /* long names wrap at their spaces, never mid-word */\n</style>'),
    # 3. script: fill grade and note when a listing opens
    ("document.getElementById('price').textContent = d.price;",
     "document.getElementById('price').textContent = d.price;\n"
     "  document.getElementById('grade').textContent = d.grade || '';\n"
     "  document.getElementById('gradeNote').textContent = d.gradeNote || '';"),
]


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(2)
    path = sys.argv[1]
    src = open(path, encoding='utf-8').read()
    for i, (old, new) in enumerate(EDITS, 1):
        n = src.count(old)
        if n != 1:
            sys.exit('ERROR: edit %d: expected the target text once, found it %d times:\n%s' % (i, n, old))
    for old, new in EDITS:
        src = src.replace(old, new)
    open(path, 'w', encoding='utf-8').write(src)
    print('grade display applied (3 edits)')


if __name__ == '__main__':
    main()
