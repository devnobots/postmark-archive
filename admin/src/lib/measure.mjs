// Standard Gauge back office: measure titles in the real site, the way a visitor sees them.
// Loads the site's own index.html?preview=meter in hidden frames (same origin as the back office), so the
// fonts, sizes and wrapping rules are exactly the site's. Nothing here copies the site's CSS.

export const LIMITS = {
  phoneTitleLines: 2,      // Japanese title on the phone piece page, at 320px and 375px wide
  desktopTitleLines: 2,    // Japanese title on the desktop listing
  phoneEnLines: 1,         // English subtitle on the phone piece page, at 375px
  maxRun: 12,              // longest stretch of Japanese without a space (same rule as tools/check_titles.py)
};

const FRAMES = [
  { key: 'p320', w: 320, h: 640 },
  { key: 'p375', w: 375, h: 812 },
  { key: 'desk', w: 1280, h: 880 },
];

function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
// same as the phone page: words with a hyphen (MA-1) are never split
function phoneTitleHTML(t) {
  return String(t).split(' ').map(w => /-/.test(w) ? '<span class="nb">' + esc(w) + '</span>' : esc(w)).join(' ');
}
function lines(el) {
  const cs = el.ownerDocument.defaultView.getComputedStyle(el);
  const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
  return Math.max(1, Math.round(el.getBoundingClientRect().height / lh));
}
function cut(el) { return el.scrollWidth > el.clientWidth + 0.5; }

function slug(nameEn) { return String(nameEn || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

// sample = one site piece (site format) used as the page the titles are tried on
export class TitleMeter {
  constructor(siteRoot = '/') { this.root = siteRoot; this.frames = null; }

  async open(sample, drop = { no: 1, date: '' }) {
    localStorage.setItem('sg-preview-meter', JSON.stringify({ drop, items: [sample] }));
    const hash = '#' + slug(sample.nameEn);
    this.frames = await Promise.all(FRAMES.map(f => new Promise((resolve, reject) => {
      const fr = document.createElement('iframe');
      fr.setAttribute('aria-hidden', 'true');
      fr.style.cssText = 'position:fixed;left:-20000px;top:0;border:0;visibility:hidden;width:' + f.w + 'px;height:' + f.h + 'px';
      fr.onload = async () => {
        try {
          const doc = fr.contentDocument;
          // phones have no scrollbar gutter; without this, a desktop browser with classic scrollbars measures 15px too narrow
          doc.documentElement.style.scrollbarWidth = 'none';
          await doc.fonts.ready;
          await new Promise(r => setTimeout(r, 50));
          resolve({ ...f, fr, doc });
        } catch (e) { reject(e); }
      };
      fr.src = this.root + 'index.html?preview=meter' + hash;
      document.body.appendChild(fr);
    })));
    return this;
  }

  close() { (this.frames || []).forEach(f => f.fr.remove()); this.frames = null; }

  // check one set of texts; returns { ok, parts: {ja, en, cap}, problems[], detail{} }
  // parts judges each text on its own, so an English or label idea can be judged while the Japanese title is still long
  check({ nameJa, nameEn, capJa }) {
    const detail = {}, problems = [];
    for (const f of this.frames) {
      const d = f.doc;
      if (f.key === 'desk') {
        const h2 = d.getElementById('nameJa');
        h2.textContent = nameJa;
        detail.deskTitleLines = lines(h2);
        const cap = d.querySelector('.fan-stamp .cap-name');
        if (cap) { cap.textContent = capJa || nameJa; detail.labelCut = cut(cap); }
      } else {
        const t = d.querySelector('.m-title'), en = d.querySelector('.m-en');
        t.innerHTML = phoneTitleHTML(nameJa);
        detail[f.key + 'TitleLines'] = lines(t);
        if (f.key === 'p375') { en.textContent = nameEn; detail.p375EnLines = lines(en); }
      }
    }
    // the stamp label is the same 156px stamp on the desktop fan and the phone sheet
    const longest = String(nameJa).split(' ').reduce((m, w) => Math.max(m, [...w].length), 0);
    detail.longestRun = longest;
    if (longest > LIMITS.maxRun) problems.push('Add a space between Japanese words (' + longest + ' characters in a row)');
    if (detail.p320TitleLines > LIMITS.phoneTitleLines) problems.push('Japanese title takes ' + detail.p320TitleLines + ' lines on a small phone (320px)');
    else if (detail.p375TitleLines > LIMITS.phoneTitleLines) problems.push('Japanese title takes ' + detail.p375TitleLines + ' lines on a phone (375px)');
    if (detail.deskTitleLines > LIMITS.desktopTitleLines) problems.push('Japanese title takes ' + detail.deskTitleLines + ' lines on desktop');
    if (detail.p375EnLines > LIMITS.phoneEnLines) problems.push('English title takes ' + detail.p375EnLines + ' lines on a phone');
    if (detail.labelCut) problems.push('Stamp label does not fit (it gets cut off with …)');
    const parts = {
      ja: longest <= LIMITS.maxRun && detail.p320TitleLines <= LIMITS.phoneTitleLines &&
          detail.p375TitleLines <= LIMITS.phoneTitleLines && detail.deskTitleLines <= LIMITS.desktopTitleLines,
      en: detail.p375EnLines <= LIMITS.phoneEnLines,
      cap: !detail.labelCut,
    };
    return { ok: problems.length === 0, parts, problems, detail };
  }
}
