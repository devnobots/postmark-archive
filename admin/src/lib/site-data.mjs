// Postmark Archive back office: convert between a database piece and the site's piece format.
// The site format is exactly what data/current.js holds (and what index.html has always used).
// Used by the back office (preview, publish) and by tools/seed_from_site.mjs. Plain JS, no imports.

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export function yen(n) { return '¥' + Number(n).toLocaleString('en-US'); }
export function parseYen(s) { return Number(String(s).replace(/[^0-9]/g, '')) || null; }

// '2026-08-14' -> { date: 'AUG 14', year: '2026' }
export function foundDate(iso) {
  if (!iso) return { date: '', year: '' };
  const [y, m, d] = iso.split('-').map(Number);
  return { date: MONTHS[m - 1] + ' ' + d, year: String(y) };
}
// ('AUG 14', '2026') -> '2026-08-14'
export function isoDate(date, year) {
  const [mon, day] = String(date).trim().split(/\s+/);
  const m = MONTHS.indexOf(mon.toUpperCase()) + 1;
  if (!m || !day || !year) return null;
  return year + '-' + String(m).padStart(2, '0') + '-' + String(day).padStart(2, '0');
}

// size line from the measurements: 着丈 70 · 身幅 54 (no units), using the category's two labels
export function sizeLine(measurements, labels) {
  const parts = [];
  for (const label of labels || []) {
    const row = (measurements || []).find(r => r[0] === label);
    if (row && String(row[1]).trim()) parts.push(label + ' ' + String(row[1]).replace(/\s*cm$/, ''));
  }
  return parts.join(' · ');
}

// database row (+ its drop) -> site piece
export function toSiteItem(p, drop) {
  const f = foundDate(p.found_on);
  const d = { bg: p.bg };
  if (p.ink) d.ink = p.ink;
  d.nameJa = p.name_ja;
  if (p.cap_ja) d.capJa = p.cap_ja;
  d.nameEn = p.name_en;
  if (p.status === 'sold') {
    d.sold = true;
    if (p.owner_handle) d.owner = p.owner_handle;
    if (p.owner_demo) d.demo = true;
  }
  d.size = p.size_line;
  d.price = p.price_jpy ? yen(p.price_jpy) : '';
  d.grade = p.grade || '';
  d.gradeNote = p.grade_note || '';
  d.city = [p.found_city, p.found_state].filter(Boolean).join(' ');
  d.date = f.date;
  d.year = f.year;
  d.meas = (p.measurements || []).filter(r => String(r[1] || '').trim());
  d.views = p.views || [];
  if (drop && drop.status === 'past') d.drop = { no: drop.no, date: siteDropDate(drop.release_date) };
  return d;
}

// '2026-10-09' -> '2026.10.09'
export function siteDropDate(iso) { return iso ? iso.replace(/-/g, '.') : ''; }

// the whole homepage file: window.SG_DATA = {...}
export function currentJs(drop, pieces) {
  const data = {
    drop: { no: drop.no, date: siteDropDate(drop.release_date) },
    items: pieces.filter(p => p.status !== 'draft').sort((a, b) => a.position - b.position).map(p => toSiteItem(p, drop)),
  };
  return '// Postmark Archive: the pieces on the homepage. Written by the back office; edit there, not here.\n' +
    '// Published ' + new Date().toISOString() + '\n' +
    'window.SG_DATA = ' + JSON.stringify(data, null, 1) + ';\n';
}

// the whole past-drops file: window.SG_PAST = { current, drops: [{ no, date, pieces }] }, newest drop first
export function pastJs(liveDrop, drops, pieces) {
  const past = drops.filter(d => d.status === 'past').sort((a, b) => b.no - a.no);
  const data = {
    current: liveDrop ? liveDrop.no : null,
    drops: past.map(d => ({
      no: d.no, date: siteDropDate(d.release_date),
      pieces: pieces.filter(p => String(p.drop_id) === String(d.id) && p.status !== 'draft').sort((a, b) => a.position - b.position)
        .map(p => toSiteItem(p, d)),
    })),
  };
  return '// Postmark Archive: the past drops (newest first). Written by the back office; edit there, not here.\n' +
    '// Published ' + new Date().toISOString() + '\n' +
    'window.SG_PAST = ' + JSON.stringify(data, null, 1) + ';\n';
}

// site piece -> database row (used once, to bring today's pieces into the database)
export function fromSiteItem(d, position) {
  const m = /^(.*) ([A-Z]{2})$/.exec(d.city || '');
  return {
    position,
    status: d.sold ? 'sold' : 'ready',
    category: guessCategory(d),
    name_ja: d.nameJa, name_en: d.nameEn, cap_ja: d.capJa || '',
    size_line: d.size || '',
    measurements: d.meas || [],
    price_jpy: parseYen(d.price),
    grade: d.grade || null, grade_note: d.gradeNote || '',
    found_city: m ? m[1] : (d.city || ''), found_state: m ? m[2] : '',
    found_on: isoDate(d.date, d.year),
    bg: d.bg, ink: d.ink || null,
    views: d.views || [],
    owner_handle: d.owner || '', owner_demo: !!d.demo,
  };
}

export function guessCategory(d) {
  const labels = (d.meas || []).map(r => r[0]);
  const en = String(d.nameEn || '');
  if (labels.includes('ウエスト')) return 'pants';
  if (labels.includes('頭囲')) return 'hat';
  if (labels.includes('対応サイズ')) return 'socks';
  if (labels.includes('全長')) return 'scarf';
  if (labels.includes('マチ') || /bag/i.test(en)) return 'bag';
  if (labels.includes('着丈')) return /jacket|coat/i.test(en) ? 'jacket' : /knit|sweater|cardigan/i.test(en) ? 'knit' : 'top';
  return 'other';
}
