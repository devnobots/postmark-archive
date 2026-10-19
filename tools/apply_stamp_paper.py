#!/usr/bin/env python3
"""Postmark Archive: stamp paper with a real-looking edge and a fine paper grain (option C).

What changes, on the homepage and past drops (desktop and phone use the same stamp style):
- the perforated edge comes from assets/stamp/perf-*.svg: holes with tiny punch-press variation instead of identical
  perfect circles. Neighbouring stamps use one of three slightly different edges, so no two side by side match.
- the paper gets a fine cotton grain (assets/stamp/grain.png, a small image tile: nothing is computed in the browser)
- the paper colour is a touch lighter (#fdfcf9, was #faf8f5) so that, with the grain on it, it averages the same
  tone as before and the perforated edge keeps its contrast against the page
Needs tools/make_stamp_paper.py to have made assets/stamp/ first. Safe to run more than once.

Usage
  python3 tools/apply_stamp_paper.py index.html drops.html
"""
import os
import sys

OLD = """  .stamp-paper {
    width: 156px; padding: 6px; background: #faf8f5;
    -webkit-mask: radial-gradient(circle at 6px 6px, transparent 3.4px, #000 3.9px) -6px -6px / 12px 12px, linear-gradient(#000 0 0) content-box;
            mask: radial-gradient(circle at 6px 6px, transparent 3.4px, #000 3.9px) -6px -6px / 12px 12px, linear-gradient(#000 0 0) content-box;
  }"""
NEW = """  /* stamp paper: punch-press perforation (assets/stamp/perf-*.svg) and a fine cotton grain (grain.png) */
  .stamp-paper {
    width: 156px; padding: 6px; background: #fdfcf9 url(assets/stamp/grain.png) 0 0 / 192px 192px;
    -webkit-mask: url(assets/stamp/perf-192-1.svg) 0 0 / 100% 100% no-repeat;
            mask: url(assets/stamp/perf-192-1.svg) 0 0 / 100% 100% no-repeat;
  }
  :nth-child(3n+2) > .stamp .stamp-paper, :nth-child(3n+2) > .m-scale > .stamp .stamp-paper { -webkit-mask-image: url(assets/stamp/perf-192-2.svg); mask-image: url(assets/stamp/perf-192-2.svg); background-position: 61px 37px; }
  :nth-child(3n) > .stamp .stamp-paper, :nth-child(3n) > .m-scale > .stamp .stamp-paper { -webkit-mask-image: url(assets/stamp/perf-192-3.svg); mask-image: url(assets/stamp/perf-192-3.svg); background-position: 113px 89px; }
  .stamp.stamp[style*="height:240px"] .stamp-paper { -webkit-mask-image: url(assets/stamp/perf-240-1.svg); mask-image: url(assets/stamp/perf-240-1.svg); }"""
NEEDED = ['assets/stamp/perf-192-1.svg', 'assets/stamp/perf-192-2.svg', 'assets/stamp/perf-192-3.svg',
          'assets/stamp/perf-240-1.svg', 'assets/stamp/grain.png']


def main():
    files = sys.argv[1:]
    if sorted(os.path.basename(f) for f in files) != ['drops.html', 'index.html']:
        sys.exit('Usage: python3 tools/apply_stamp_paper.py index.html drops.html')
    missing = [p for p in NEEDED if not os.path.exists(p)]
    if missing:
        sys.exit('ERROR: nothing changed. Missing (run tools/make_stamp_paper.py first): ' + ', '.join(missing))
    srcs = {f: open(f, encoding='utf-8').read() for f in files}
    if all('assets/stamp/perf-192-1.svg' in s for s in srcs.values()):
        print('already applied')
        return
    bad = ['%s: found %d of the stamp paper style (expected 1)' % (f, s.count(OLD)) for f, s in srcs.items() if s.count(OLD) != 1]
    if bad:
        print('ERROR: nothing changed. Problems:')
        for b in bad:
            print('  - ' + b)
        sys.exit(1)
    for f, s in srcs.items():
        open(f, 'w', encoding='utf-8').write(s.replace(OLD, NEW, 1))
        print('stamp paper updated: ' + f)


if __name__ == '__main__':
    main()
