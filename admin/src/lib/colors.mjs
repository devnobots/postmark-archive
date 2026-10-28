// Postmark Archive: the stamp color rule, in the browser (same rule as tools/stamp_colors.py).
// 1. Only the 9 stamp inks.
// 2. For each piece, its stamp photo's item pixels (alpha > 128 where the photo has transparency) give 4 main
//    colors (k-means in Lab) with how much of the piece each covers.
// 3. Every ink is scored by its Lab distance to the closest main color covering at least 5%, the distance
//    divided by (0.5 + that color's coverage).
// 4. Every piece in the drop gets a different ink, choosing the combination with the highest total score.
// 5. On brick, the price is printed in cream.
// Plain JS; the pixel reading at the bottom needs a browser (canvas).

export const PALETTE = [
  ['mustard', '#E8B53A'], ['butter', '#F2D98A'], ['peach', '#D98C6A'], ['brick', '#C2412D'], ['sky', '#9DC3D9'],
  ['teal', '#6E9E8C'], ['sage', '#A9B79A'], ['lilac', '#C9B3D6'], ['cream', '#EFE3C8'],
];
// a jewelry drop (drops.jewelry): light neutrals, so silver, turquoise and coral are not fighting a colour
export const NEUTRAL_PALETTE = [
  ['bone', '#ECE5D6'], ['oat', '#DCD5C7'], ['mist', '#E0E2DB'], ['linen', '#E6DDCB'], ['ash', '#D8D6CF'],
  ['shell', '#E9E3D9'], ['sand', '#D9D2C3'], ['fog', '#E3E0D7'], ['ivory', '#EFE8DA'],
];
export function paletteFor(drop) { return drop && drop.jewelry ? NEUTRAL_PALETTE : PALETTE; }
export const DARK_INKS = ['brick'];
export const CREAM_TEXT = '#FFFDF6';
const MIN_WEIGHT = 0.05;

// sRGB 0..255 -> CIE Lab (D65), the same formulas as skimage.color.rgb2lab
function lin(c) { c /= 255; return c > 0.04045 ? Math.pow((c + 0.055) / 1.055, 2.4) : c / 12.92; }
function f(t) { return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116; }
export function rgbToLab(r, g, b) {
  const R = lin(r), G = lin(g), B = lin(b);
  const x = (0.412453 * R + 0.357580 * G + 0.180423 * B) / 0.95047;
  const y = (0.212671 * R + 0.715160 * G + 0.072169 * B) / 1.0;
  const z = (0.019334 * R + 0.119193 * G + 0.950227 * B) / 1.08883;
  const fx = f(x), fy = f(y), fz = f(z);
  return [y > 0.008856 ? 116 * fy - 16 : 903.3 * y, 500 * (fx - fy), 200 * (fy - fz)];
}
export function hexToLab(hex) {
  const h = hex.replace('#', '');
  return rgbToLab(parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16));
}

// a small seeded random generator, so the same photo always gives the same colors
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// the piece's pixels from RGBA data: transparent photos use their alpha; others drop the white border background
export function itemPixels(data, width, height) {
  const n = width * height;
  let transparent = false;
  for (let i = 3; i < data.length; i += 4) if (data[i] < 250) { transparent = true; break; }
  const out = [];
  if (transparent) {
    for (let i = 0; i < n; i++) if (data[i * 4 + 3] > 128) out.push(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
    return out;
  }
  // near-white connected to the border is background (same thresholds as the Python tool)
  const white = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    white[i] = Math.min(r, g, b) > 212 && Math.max(r, g, b) - Math.min(r, g, b) < 9 ? 1 : 0;
  }
  const bg = new Uint8Array(n), stack = [];
  for (let x = 0; x < width; x++) stack.push(x, (height - 1) * width + x);
  for (let y = 0; y < height; y++) stack.push(y * width, y * width + width - 1);
  while (stack.length) {
    const i = stack.pop();
    if (bg[i] || !white[i]) continue;
    bg[i] = 1;
    const x = i % width, y = (i / width) | 0;
    if (x > 0) stack.push(i - 1); if (x < width - 1) stack.push(i + 1);
    if (y > 0) stack.push(i - width); if (y < height - 1) stack.push(i + width);
  }
  for (let i = 0; i < n; i++) if (!bg[i]) out.push(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
  return out;
}

// 4 main colors in Lab with their coverage: k-means++ from several starting points, keeping the tightest result,
// so the same photo always gives the same colors
export function mainColors(rgb, k = 4, restarts = 8) {
  const total = rgb.length / 3;
  const take = Math.min(20000, total);
  const step = total / take;
  const pts = new Float64Array(take * 3);
  for (let i = 0; i < take; i++) {
    const j = Math.floor(i * step) * 3;
    const L = rgbToLab(rgb[j], rgb[j + 1], rgb[j + 2]);
    pts[i * 3] = L[0]; pts[i * 3 + 1] = L[1]; pts[i * 3 + 2] = L[2];
  }
  const d2 = (i, c) => { const a = pts[i * 3] - c[0], b = pts[i * 3 + 1] - c[1], e = pts[i * 3 + 2] - c[2]; return a * a + b * b + e * e; };
  let best = null;
  for (let run = 0; run < restarts; run++) {
    const rand = rng(1 + run);
    const centers = [];
    const first = Math.floor(rand() * take);
    centers.push([pts[first * 3], pts[first * 3 + 1], pts[first * 3 + 2]]);
    const dist = new Float64Array(take).fill(Infinity);
    while (centers.length < k) {
      const c = centers[centers.length - 1];
      let sum = 0;
      for (let i = 0; i < take; i++) { dist[i] = Math.min(dist[i], d2(i, c)); sum += dist[i]; }
      let r = rand() * sum, pick = take - 1;
      for (let i = 0; i < take; i++) { r -= dist[i]; if (r <= 0) { pick = i; break; } }
      centers.push([pts[pick * 3], pts[pick * 3 + 1], pts[pick * 3 + 2]]);
    }
    const label = new Int32Array(take).fill(-1);
    let inertia = 0;
    for (let it = 0; it < 50; it++) {
      let moved = 0; inertia = 0;
      for (let i = 0; i < take; i++) {
        let bc = 0, bd = Infinity;
        for (let c = 0; c < k; c++) { const v = d2(i, centers[c]); if (v < bd) { bd = v; bc = c; } }
        if (label[i] !== bc) { moved++; label[i] = bc; }
        inertia += bd;
      }
      const acc = Array.from({ length: k }, () => [0, 0, 0, 0]);
      for (let i = 0; i < take; i++) { const a = acc[label[i]]; a[0] += pts[i * 3]; a[1] += pts[i * 3 + 1]; a[2] += pts[i * 3 + 2]; a[3]++; }
      for (let c = 0; c < k; c++) if (acc[c][3]) centers[c] = [acc[c][0] / acc[c][3], acc[c][1] / acc[c][3], acc[c][2] / acc[c][3]];
      if (!moved) break;
    }
    if (!best || inertia < best.inertia) {
      const count = new Array(k).fill(0);
      for (let i = 0; i < take; i++) count[label[i]]++;
      best = { inertia, out: centers.map((c, i) => [c, count[i] / take]).filter(([, w]) => w > 0) };
    }
  }
  return best.out;
}

// one score per ink (PALETTE order); higher = the ink stands further from the piece's main colors
export function scoresFor(rgb, palette = PALETTE) {
  const doms = mainColors(rgb).filter(([, w]) => w > MIN_WEIGHT);
  return palette.map(([, hex]) => {
    const p = hexToLab(hex);
    const ds = doms.map(([c, w]) => Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]) / (0.5 + w));
    return ds.length ? Math.min(...ds) : 0;
  });
}

// every piece a different ink, with the highest total score (exact search; a drop has at most 9 pieces)
export function assignInks(scores, palette = PALETTE) {
  const n = scores.length, m = palette.length;
  if (n > m) throw new Error(n + ' pieces but only ' + m + ' inks');
  // upper bound for pruning: each remaining row's best score
  const rowBest = scores.map(r => Math.max(...r));
  const suffix = new Array(n + 1).fill(0);
  for (let i = n - 1; i >= 0; i--) suffix[i] = suffix[i + 1] + rowBest[i];
  let best = -Infinity, bestPick = null;
  const pick = new Array(n), used = new Array(m).fill(false);
  (function go(i, total) {
    if (total + suffix[i] <= best + 1e-9) return;
    if (i === n) { best = total; bestPick = pick.slice(); return; }
    const order = [...Array(m).keys()].sort((a, b) => scores[i][b] - scores[i][a]);
    for (const c of order) if (!used[c]) { used[c] = true; pick[i] = c; go(i + 1, total + scores[i][c]); used[c] = false; }
  })(0, 0);
  return bestPick.map(c => ({ name: palette[c][0], bg: palette[c][1], ink: DARK_INKS.includes(palette[c][0]) ? CREAM_TEXT : null }));
}

// ---------- browser only: read a photo's pixels ----------
const cache = new Map();
export async function scoresForImage(url, palette = PALETTE) {
  const key = palette[0][0] + ' ' + url;
  if (cache.has(key)) return cache.get(key);
  const p = (async () => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;
    await img.decode();
    const scale = Math.min(1, 640 / Math.max(img.naturalWidth, img.naturalHeight));   // stamp photos are 640px; bigger ones are read at 640
    const w = Math.max(1, Math.round(img.naturalWidth * scale)), h = Math.max(1, Math.round(img.naturalHeight * scale));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0, w, h);
    return scoresFor(itemPixels(g.getImageData(0, 0, w, h).data, w, h), palette);
  })();
  cache.set(key, p);
  p.catch(() => cache.delete(key));
  return p;
}
