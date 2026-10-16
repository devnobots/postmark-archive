#!/usr/bin/env python3
"""Standard Gauge: sold pieces open a sold version of their page.

- The small stamps stay as they are: black-and-white, 売約済 in the corner, color on mouse over.
- Clicking a sold stamp now opens its page again (with its own #link).
- On the sold page:
    big stamp      full color, original price in the corner
    top line       第9便  ·  FOUND: DULUTH, MN  ·  CONSIGNEE: @tsubasa.1987
                   第11便  ·  FOUND: TUCSON, AZ  ·  CONSIGNEE: PRIVATE ARCHIVE   (buyer did not share)
                   (the found month/year is dropped on sold pages; the handle is the same color and
                   size as the line, no underline, fades to 0.55 on mouse over)
    purchase area  price stays; the cart button becomes the outlined 売約済 box
- A buyer's handle lives in the piece's record: owner: 'handle' (no @). demo: true = made-up handle,
  shown as plain text, not a link.
- Demo buyers on the past-drops page: 第9便 all three; 第11便 two of four; 第10便 one of three.
Needs tools/apply_sold_stamps.py applied first. Edits index.html and drops.html. Safe to run more than once.

Usage
  python3 tools/apply_sold_pages.py index.html drops.html
"""
import re
import sys

MARK = '/* sold pages: open again, consignee on the top line */'
CSS = {
    'index.html': (
        "  " + MARK + "\n"
        "  .cart.sold { background: none; color: #6b6e72; border: 1px solid rgba(107, 110, 114, 0.5); cursor: default; letter-spacing: 0.2em; }\n"
        "  .found .consignee-handle { color: inherit; text-decoration: none; border-bottom: none; font-weight: normal; font-size: calc(1em + 1px); transition: opacity 120ms ease; }\n"
        "  a.consignee-handle { cursor: pointer; }\n"
        "  a.consignee-handle:hover { opacity: 0.55; }\n"),
    'drops.html': (
        "  " + MARK + "\n"
        "  .past-stamp { cursor: pointer; }\n"
        "  .found .consignee-handle { color: inherit; text-decoration: none; border-bottom: none; font-weight: normal; font-size: calc(1em + 1px); transition: opacity 120ms ease; }\n"
        "  a.consignee-handle { cursor: pointer; }\n"
        "  a.consignee-handle:hover { opacity: 0.55; }\n"),
}
SOLD_JS = """  // sold piece: no cart; the top line ends with who has it now
  var cartBtn = document.querySelector('.buy .cart');
  if (cartBtn && d.sold) { cartBtn.className = 'cart sold'; cartBtn.disabled = true; cartBtn.textContent = '売約済'; }
  else if (cartBtn) { cartBtn.className = 'cart'; cartBtn.disabled = false; cartBtn.textContent = 'カートに入れる'; }
  if (d.sold) {
    var foundEl = document.getElementById('found');
    foundEl.textContent = foundEl.textContent.replace(/ \\([A-Z]{3} \\d{4}\\)$/, '');
    var who = !d.owner ? 'PRIVATE ARCHIVE'
      : d.demo ? '<span class="consignee-handle">@' + esc(d.owner) + '</span>'
      : '<a class="consignee-handle" href="https://www.instagram.com/' + encodeURIComponent(d.owner) + '/" target="_blank" rel="noopener">@' + esc(d.owner) + '</a>';
    foundEl.insertAdjacentHTML('beforeend', '\\u00a0 · \\u00a0CONSIGNEE: ' + who);
  }
"""
JS_ANCHOR = "  document.getElementById('nameJa').textContent = d.nameJa;"
COMMON = [
    ('sold stamps never open (removed)',
     "function openItem(i) { if (ITEMS[i] && ITEMS[i].sold) return; /* sold pieces never open */",
     "function openItem(i) {"),
    ('sold stamps have no address (removed)',
     "    if (ITEMS[i] && ITEMS[i].sold) return;                          // sold: no listing, no address\n", ""),
    ('small stamp only: black-and-white',
     "'<div class=\"stamp' + (d.sold ? ' is-sold' : '') + '\" style=\"height:'",
     "'<div class=\"stamp' + (d.sold && !tall ? ' is-sold' : '') + '\" style=\"height:'"),
    ('small stamp only: 売約済 in the corner',
     "esc(d.sold ? '売約済' : d.price)", "esc(d.sold && !tall ? '売約済' : d.price)"),
    ('sold page details', JS_ANCHOR, SOLD_JS + JS_ANCHOR),
]
DEMO = [  # (found city, found date) of a past piece -> its demo buyer
    ('DAYTON OH', 'AUG 21', 'kenji_wears'), ('SANTA FE NM', 'AUG 30', 'mio.furugi'),
    ('MACON GA', 'AUG 17', 'haru_and_denim'),
    ('DULUTH MN', 'JUL 11', 'tsubasa.1987'), ('SPOKANE WA', 'JUL 19', 'nao_ameka'), ('LUBBOCK TX', 'AUG 8', 'yuki.closet'),
]
PIECE_OLD = "city: p.city, date: p.date, year: '2026', sold: true,"
PIECE_NEW = "city: p.city, date: p.date, year: '2026', sold: true, owner: p.owner || '', demo: !!p.demo,"
STYLE_END = "</style>\n</head>"
LANDMARKS = ['id="overlay"', 'id="found"', 'id="thumbs"', 'function stampHTML(', 'id="closeBtn"', 'sold pieces: black-and-white']


def main():
    todo, problems = {}, []
    for path in sys.argv[1:]:
        name = path.split('/')[-1]
        if name not in CSS:
            problems.append('%s: expected index.html or drops.html' % path)
            continue
        src = open(path, encoding='utf-8').read()
        if MARK in src:
            print('already applied: ' + path)
            continue
        if 'sold pieces: black-and-white' not in src:
            problems.append('%s: sold stamps not found (tools/apply_sold_stamps.py must run first)' % path)
            continue
        edits = list(COMMON)
        for label, old, _ in edits + [('end of the page styles', STYLE_END, None)]:
            if src.count(old) != 1:
                problems.append('%s, %s: found %d (expected 1)' % (path, label, src.count(old)))
        if name == 'drops.html':
            if src.count(PIECE_OLD) != 1:
                problems.append('%s, piece record: found %d (expected 1)' % (path, src.count(PIECE_OLD)))
            for city, date, _ in DEMO:
                n = len(re.findall(r"city: '%s',\s+date: '%s' \}" % (city, date), src))
                if n != 1:
                    problems.append('%s, demo piece %s %s: found %d (expected 1)' % (path, city, date, n))
        todo[path] = (src, edits, name)
    if problems:
        print('ERROR: nothing changed. Problems:')
        for p in problems:
            print('  - ' + p)
        sys.exit(1)
    for path, (src, edits, name) in todo.items():
        before = [src.count(x) for x in LANDMARKS]
        out = src
        for _, old, new in edits:
            out = out.replace(old, new, 1)
        if name == 'drops.html':
            out = out.replace(PIECE_OLD, PIECE_NEW, 1)
            for city, date, owner in DEMO:
                rx = re.compile(r"(city: '%s',\s+date: '%s') \}" % (city, date))
                out = rx.sub(lambda m: m.group(1) + ", owner: '%s', demo: true }" % owner, out, count=1)
        out = out.replace(STYLE_END, CSS[name] + STYLE_END, 1)
        if [out.count(x) for x in LANDMARKS] != before:
            sys.exit('ERROR: nothing changed. The edit would have altered other page parts (%s).' % path)
        open(path, 'w', encoding='utf-8').write(out)
        print('sold pages updated: ' + path)


if __name__ == '__main__':
    main()
