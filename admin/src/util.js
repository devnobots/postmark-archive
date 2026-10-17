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

export const STATUS_LABEL = { draft: 'Draft', ready: 'Ready', sold: 'Sold' };

// the back office is run in English; categories and measurement names keep their Japanese (shown to shoppers)
export const CATEGORY_EN = { top: 'Tops / T-shirts', jacket: 'Jacket', knit: 'Knitwear', pants: 'Pants', bag: 'Bag', hat: 'Hat',
  socks: 'Socks', scarf: 'Scarf / neckwear', other: 'Other' };
export const MEAS_EN = { 着丈: 'length', 身幅: 'chest width', 肩幅: 'shoulder', 袖丈: 'sleeve', ウエスト: 'waist', 股下: 'inseam',
  総丈: 'total length', わたり: 'thigh', 裾幅: 'hem', 幅: 'width', 高さ: 'height', マチ: 'depth', ショルダー: 'strap',
  頭囲: 'head', つば: 'brim', 対応サイズ: 'fits sizes', 全長: 'total length' };

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
  if (!String(p.name_ja || '').trim()) miss.push('Japanese title');
  if (!String(p.name_en || '').trim()) miss.push('English title');
  if (!p.category) miss.push('category');
  if (!(p.measurements || []).some(r => String(r[1] || '').trim())) miss.push('measurements');
  if (!p.price_jpy) miss.push('price');
  if (!p.grade) miss.push('condition grade');
  if (!String(p.found_city || '').trim()) miss.push('city');
  if (!p.found_state) miss.push('state');
  if (!p.found_on) miss.push('date found');
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
