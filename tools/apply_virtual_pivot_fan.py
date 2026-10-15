#!/usr/bin/env python3
"""Standard Gauge homepage: remove the badge; fan the stamps around a virtual pivot far below them.

- The pivot sits 480px below each stamp's top (transform-origin 78px 480px, i.e. 250% of the
  stamp height), so the arc is gentle and the stamp bases form a continuous scalloped arc.
- Stamps overlap in sequence, left to right. No cover graphic.
- The fan opens over a fixed total angle (SPREAD) divided evenly by the number of items.
- Hover still lifts the stamp outward along its own radius (1.25 s), chosen by the mouse's
  angle around the pivot (no flicker).
- The brand moves to the top bar, centered.

Usage
  python3 tools/apply_virtual_pivot_fan.py index.html
"""
import re
import sys

EDITS = [
    # buttons do not inherit the page font by default
    ("  * { box-sizing: border-box; }",
     "  * { box-sizing: border-box; }\n  button { font-family: inherit; }"),
    # stamp geometry: virtual pivot 480px below the stamp top
    ("position: absolute; left: 562px; top: 168px; width: 156px; height: 192px; padding: 0; border: 0; background: none;\n    pointer-events: none; transform-origin: 78px 352px;",
     "position: absolute; left: 562px; top: 200px; width: 156px; height: 192px; padding: 0; border: 0; background: none;\n    pointer-events: none; transform-origin: 78px 480px;"),
    # hover area covers the new fan
    ("#hit { position: absolute; left: 160px; top: 40px; width: 960px; height: 480px; z-index: 55; }",
     "#hit { position: absolute; left: 120px; top: 100px; width: 1040px; height: 460px; z-index: 55; }"),
    # headline moves up into the space the badge used
    (".copy { position: absolute; left: 0; right: 0; top: 640px;",
     ".copy { position: absolute; left: 0; right: 0; top: 590px;"),
    # brand in the top bar
    ('<div class="topbar"><div>今週の入荷 · 第12便</div><div>全品送料込み</div></div>',
     '<div class="topbar"><div>今週の入荷 · 第12便</div><div>全品送料込み</div></div>\n'
     '  <div class="brand">STANDARD GAUGE<span>スタンダードゲージ</span></div>'),
    ("  .topbar {",
     "  .brand { position: absolute; left: 0; right: 0; top: 22px; text-align: center; font-weight: 700; font-size: 18px; letter-spacing: 2px; color: var(--ink); }\n"
     "  .brand span { display: block; font-family: 'Shippori Mincho', serif; font-weight: 400; font-size: 10px; letter-spacing: 2px; color: var(--ink-3); margin-top: 2px; }\n"
     "  .topbar {"),
    # hint no longer mentions the logo
    ('<p class="hint" id="hint">ロゴにカーソルを合わせてください</p>',
     '<p class="hint" id="hint">切手にカーソル → 拡大　クリック → 詳細</p>'),
    ("document.getElementById('hint').textContent = state.fanned ? '切手にカーソル → 拡大　クリック → 詳細' : 'ロゴにカーソルを合わせてください';\n",
     ""),
    # hover lift: out along its own radius, growing from the stamp's center (not the far pivot)
    ("tf = 'rotate(' + a + 'deg) translateY(-70px) scale(1.24)';",
     "tf = 'rotate(' + a + 'deg) translateY(-34px) translateY(-384px) scale(1.15) translateY(384px)';"),
    # collapsed state: stacked at the center, slightly low, invisible
    ("tf = 'rotate(' + (a * 0.1) + 'deg) translateY(256px) scale(0.3)'; // tucked behind the seal",
     "tf = 'rotate(' + (a * 0.15) + 'deg) translateY(60px) scale(0.9)'; // stacked at the center before dealing"),
    # hover math around the new pivot (640, 680)
    ("var r = hit.getBoundingClientRect(), k = 960 / (r.width || 960);\n  var x = 160 + (e.clientX - r.left) * k, y = 40 + (e.clientY - r.top) * k;\n  var dx = x - 640, dy = 520 - y,",
     "var r = hit.getBoundingClientRect(), k = 1040 / (r.width || 1040);\n  var x = 120 + (e.clientX - r.left) * k, y = 100 + (e.clientY - r.top) * k;\n  var dx = x - 640, dy = 680 - y,"),
    ("if (rad > 105 && rad < 480 && dy > -20) {",
     "if (rad > 270 && rad < 620 && dy > 0) {"),
]

# the badge: markup and script
SEAL_HTML = re.compile(r'\n  <button id="seal".*?</button>\n', re.S)
SEAL_JS = [
    "var seal = document.getElementById('seal');\n",
    "seal.addEventListener('mouseenter', function () { if (!state.fanned) setFanned(true); });\n",
    "seal.addEventListener('click', function () { setFanned(!state.fanned); });\n",
    "setTimeout(function () { seal.classList.add('in'); }, 120);\n",
]
ANG = re.compile(r"var ANG = [^\n]*;\n")
NEW_ANG = ("var SPREAD = 78; // total opening of the fan, in degrees\n"
           "var ANG = ITEMS.map(function (d, i) { return ITEMS.length > 1 ? -SPREAD / 2 + i * SPREAD / (ITEMS.length - 1) : 0; });\n")


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(2)
    path = sys.argv[1]
    src = open(path, encoding='utf-8').read()
    if 'id="seal"' not in src and 'var SPREAD' in src:
        print('already applied: virtual-pivot fan')
        return
    problems = []
    for i, (old, _) in enumerate(EDITS, 1):
        if src.count(old) != 1:
            problems.append('edit %d: target found %d times: %s' % (i, src.count(old), old[:70].replace('\n', ' ')))
    if len(SEAL_HTML.findall(src)) != 1:
        problems.append('badge markup found %d times' % len(SEAL_HTML.findall(src)))
    for line in SEAL_JS:
        if src.count(line) != 1:
            problems.append('badge script line found %d times: %s' % (src.count(line), line.strip()))
    if len(ANG.findall(src)) != 1:
        problems.append('ANG line found %d times' % len(ANG.findall(src)))
    if problems:
        print('ERROR: nothing changed. Problems:')
        for p in problems:
            print('  - ' + p)
        sys.exit(1)
    for old, new in EDITS:
        src = src.replace(old, new)
    src = SEAL_HTML.sub('\n', src)
    for line in SEAL_JS:
        src = src.replace(line, '')
    src = ANG.sub(NEW_ANG, src)
    open(path, 'w', encoding='utf-8').write(src)
    print('virtual-pivot fan applied (%d edits, badge removed)' % (len(EDITS) + 3))


if __name__ == '__main__':
    main()
