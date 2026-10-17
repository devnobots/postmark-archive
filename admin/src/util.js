// Standard Gauge back office: small shared helpers (no React).

// the piece's address on the site: same rule as index.html and mobile.js
export function slug(nameEn) {
  return String(nameEn || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// the 50 states plus DC, sorted by code
export const STATES = ['AK', 'AL', 'AR', 'AZ', 'CA', 'CO', 'CT', 'DC', 'DE', 'FL', 'GA', 'HI', 'IA', 'ID', 'IL', 'IN', 'KS', 'KY',
  'LA', 'MA', 'MD', 'ME', 'MI', 'MN', 'MO', 'MS', 'MT', 'NC', 'ND', 'NE', 'NH', 'NJ', 'NM', 'NV', 'NY', 'OH', 'OK', 'OR', 'PA',
  'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VA', 'VT', 'WA', 'WI', 'WV', 'WY'];

// the nine stamp inks (same as tools/stamp_colors.py); brick prints the price in cream
export const INKS = [
  { name: 'mustard', hex: '#E8B53A' }, { name: 'butter', hex: '#F2D98A' }, { name: 'peach', hex: '#D98C6A' },
  { name: 'brick', hex: '#C2412D', ink: '#FFFDF6' }, { name: 'sky', hex: '#9DC3D9' }, { name: 'teal', hex: '#6E9E8C' },
  { name: 'sage', hex: '#A9B79A' }, { name: 'lilac', hex: '#C9B3D6' }, { name: 'cream', hex: '#EFE3C8' },
];

export const STATUS_LABEL = { draft: '下書き', ready: '完成', sold: '売約済' };

// today in the browser's time zone, YYYY-MM-DD
export function today() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export function yenText(n) { return n ? '¥' + Number(n).toLocaleString('en-US') : ''; }

// the site's data/current.js, evaluated the same way as selfcheck.html
export async function loadSiteData() {
  const w = {};
  new Function('window', await (await fetch('/data/current.js', { cache: 'no-store' })).text())(w);
  return w.SG_DATA;
}

// what a 完成 piece still needs (the fit check is separate); empty list = complete
export function missingFields(p) {
  const miss = [];
  if (!String(p.name_ja || '').trim()) miss.push('日本語タイトル');
  if (!String(p.name_en || '').trim()) miss.push('英語タイトル');
  if (!p.category) miss.push('カテゴリ');
  if (!(p.measurements || []).some(r => String(r[1] || '').trim())) miss.push('寸法');
  if (!p.price_jpy) miss.push('価格');
  if (!p.grade) miss.push('状態ランク');
  if (!String(p.found_city || '').trim()) miss.push('発見地（町）');
  if (!p.found_state) miss.push('発見地（州）');
  if (!p.found_on) miss.push('発見日');
  return miss;
}

// memory storage for browsers that refuse localStorage (private mode)
export function safeStorage() {
  try {
    const k = 'sg-storage-test';
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    return { storage: window.localStorage, persistent: true };
  } catch (e) {
    const mem = new Map();
    return { storage: { getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) }, persistent: false };
  }
}
