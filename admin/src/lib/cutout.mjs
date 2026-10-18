// Postmark Archive back office: photo cutout and web sizes, in the browser (works on a phone, nothing to install).
// - The background's colors are read from the photo's border; everything joined to the border that is close to
//   them (within the tolerance) is background. That handles white paper, a plain wall or a table top.
// - The piece is the largest remaining area, plus any other large area (a pair of socks is two). Small holes inside it are kept (a polar bear on a sweater);
//   large background-colored holes are removed (the inside of a bag's strap).
// - Stamp photo: trimmed to the piece, 640px on its long side, transparent background (WebP, or PNG where the
//   browser cannot write WebP). Full photo: up to 2400px on its long side (enough for the 3x loupe), JPEG.
import { rgbToLab } from './colors.mjs';

export const STAMP_SIDE = 640, FULL_SIDE = 2400, WORK_SIDE = 900;
const ROUGH = 2.5;                 // lightness change per pixel above which a pixel counts as texture, not backdrop

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

// a photo file as a drawable image, never bigger than maxSide (24MP phone photos are scaled down while decoding)
export async function loadPhoto(file, maxSide = FULL_SIDE) {
  const probe = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const s = Math.min(1, maxSide / Math.max(probe.width, probe.height));
  if (s === 1) return probe;
  const w = Math.round(probe.width * s), h = Math.round(probe.height * s);
  probe.close && probe.close();
  return createImageBitmap(file, { imageOrientation: 'from-image', resizeWidth: w, resizeHeight: h, resizeQuality: 'high' });
}

// turn an image a quarter at a time (turns = 0..3), returning a canvas
export function rotated(img, turns = 0) {
  const t = ((turns % 4) + 4) % 4, w = img.width, h = img.height;
  const c = canvas(t % 2 ? h : w, t % 2 ? w : h), g = c.getContext('2d');
  g.translate(c.width / 2, c.height / 2);
  g.rotate(t * Math.PI / 2);
  g.drawImage(img, -w / 2, -h / 2);
  return c;
}

function scaled(src, maxSide) {
  const s = Math.min(1, maxSide / Math.max(src.width, src.height));
  const c = canvas(Math.max(1, Math.round(src.width * s)), Math.max(1, Math.round(src.height * s)));
  const g = c.getContext('2d', { willReadFrequently: true });
  g.imageSmoothingQuality = 'high';
  g.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

// the background's main colors: k-means (k=3) on the outer band of pixels, in Lab
function borderColors(lab, w, h) {
  const band = Math.max(2, Math.round(Math.min(w, h) * 0.02)), pts = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (x >= band && x < w - band && y >= band && y < h - band) continue;
    if ((x + y) % 2) continue;
    const i = (y * w + x) * 3; pts.push([lab[i], lab[i + 1], lab[i + 2]]);
  }
  let centers = [pts[0], pts[Math.floor(pts.length / 3)], pts[Math.floor(2 * pts.length / 3)]];
  for (let it = 0; it < 12; it++) {
    const acc = centers.map(() => [0, 0, 0, 0]);
    for (const p of pts) {
      let best = 0, bd = Infinity;
      centers.forEach((c, k) => { const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2; if (d < bd) { bd = d; best = k; } });
      const a = acc[best]; a[0] += p[0]; a[1] += p[1]; a[2] += p[2]; a[3]++;
    }
    centers = acc.map((a, k) => (a[3] ? [a[0] / a[3], a[1] / a[3], a[2] / a[3]] : centers[k]));
  }
  return centers;
}

// 4-neighbour fill from the given starting pixels over pixels where ok[i] is set
function flood(ok, w, h, starts) {
  const seen = new Uint8Array(w * h), stack = [...starts];
  while (stack.length) {
    const i = stack.pop();
    if (i < 0 || seen[i] || !ok[i]) continue;
    seen[i] = 1;
    const x = i % w;
    if (x > 0) stack.push(i - 1); if (x < w - 1) stack.push(i + 1);
    stack.push(i - w, i + w);
  }
  return seen;
}
function borderStarts(w, h) {
  const s = [];
  for (let x = 0; x < w; x++) s.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) s.push(y * w, y * w + w - 1);
  return s;
}
function components(on, w, h) {
  const label = new Int32Array(w * h).fill(-1), sizes = [];
  for (let i = 0; i < w * h; i++) {
    if (!on[i] || label[i] >= 0) continue;
    const id = sizes.length, stack = [i]; let n = 0;
    label[i] = id;
    while (stack.length) {
      const j = stack.pop(); n++;
      const x = j % w, nb = [x > 0 ? j - 1 : -1, x < w - 1 ? j + 1 : -1, j - w, j + w];
      for (const k of nb) if (k >= 0 && k < w * h && on[k] && label[k] < 0) { label[k] = id; stack.push(k); }
    }
    sizes.push(n);
  }
  return { label, sizes };
}
function erode(m, w, h) {
  const o = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    o[i] = m[i] && m[i - 1] && m[i + 1] && m[i - w] && m[i + w] ? 1 : 0;
  }
  return o;
}
function dilate(m, w, h) {
  const o = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    o[i] = m[i] || (x > 0 && m[i - 1]) || (x < w - 1 && m[i + 1]) || (y > 0 && m[i - w]) || (y < h - 1 && m[i + w]) ? 1 : 0;
  }
  return o;
}

// the piece's mask at working size: 1 = piece, 0 = background. tolerance: Lab distance from the background colors
export function pieceMask(img, tolerance = 14) {
  const work = scaled(img, WORK_SIDE), w = work.width, h = work.height;
  const px = work.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
  const lab = new Float32Array(w * h * 3);
  for (let i = 0; i < w * h; i++) { const L = rgbToLab(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]); lab[i * 3] = L[0]; lab[i * 3 + 1] = L[1]; lab[i * 3 + 2] = L[2]; }
  const bgc = borderColors(lab, w, h);
  // texture: how much the lightness changes around each pixel. A backdrop is smooth; fabric, ribbing and stitching
  // are not, so the background can only spread over smooth pixels (it stops at white cuffs and white patches)
  const rough = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const L = (dx, dy) => lab[((y + dy) * w + x + dx) * 3];
    const gx = L(1, -1) + 2 * L(1, 0) + L(1, 1) - L(-1, -1) - 2 * L(-1, 0) - L(-1, 1);
    const gy = L(-1, 1) + 2 * L(0, 1) + L(1, 1) - L(-1, -1) - 2 * L(0, -1) - L(1, -1);
    rough[y * w + x] = Math.hypot(gx, gy) / 8;
  }
  const like = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    let d = Infinity;
    // lightness counts half: a soft shadow on the backdrop is the backdrop's color, only darker
    for (const c of bgc) d = Math.min(d, Math.hypot((lab[i * 3] - c[0]) * 0.5, lab[i * 3 + 1] - c[1], lab[i * 3 + 2] - c[2]));
    like[i] = d < tolerance && rough[i] < ROUGH ? 1 : 0;
  }
  const bg = flood(like, w, h, borderStarts(w, h));
  let fg = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) fg[i] = bg[i] ? 0 : 1;
  fg = dilate(erode(fg, w, h), w, h);                                     // remove specks and thin noise
  const { label, sizes } = components(fg, w, h);
  if (!sizes.length) return { mask: fg, w, h, empty: true };
  const biggest = Math.max(...sizes);
  const keepIds = new Set(sizes.map((n, id) => (n >= biggest * 0.15 ? id : -1)).filter(id => id >= 0));   // a pair: both
  for (let i = 0; i < w * h; i++) fg[i] = keepIds.has(label[i]) ? 1 : 0;
  // holes: small ones belong to the piece; large background-colored ones are background
  const outside = flood(fg.map(v => 1 - v), w, h, borderStarts(w, h));
  const hole = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) hole[i] = !fg[i] && !outside[i] ? 1 : 0;
  const holes = components(hole, w, h), pieceSize = [...keepIds].reduce((n, id) => n + sizes[id], 0);
  for (let i = 0; i < w * h; i++) {
    if (!hole[i]) continue;
    const id = holes.label[i];
    let bgLike = like[i];
    fg[i] = holes.sizes[id] > pieceSize * 0.015 && bgLike ? 0 : 1;
  }
  return { mask: fg, w, h, empty: false };
}

async function toBlob(c, type, q) { return new Promise(r => c.toBlob(r, type, q)); }

// the stamp photo: the piece on a transparent background, trimmed, at most 640px on its long side
export async function cutoutBlob(img, m) {
  const { mask, w, h } = m;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (mask[y * w + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) throw new Error('no piece found in the photo');
  const pad = 2; x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad);
  // mask as an alpha image (soft edge from scaling and a slight blur)
  const mc = canvas(w, h), mg = mc.getContext('2d'), md = mg.createImageData(w, h);
  for (let i = 0; i < w * h; i++) { md.data[i * 4 + 3] = mask[i] ? 255 : 0; }
  mg.putImageData(md, 0, 0);
  const sx = img.width / w, sy = img.height / h;                         // working size -> photo size
  const cw = (x1 - x0 + 1) * sx, ch = (y1 - y0 + 1) * sy;
  const s = Math.min(1, STAMP_SIDE / Math.max(cw, ch));
  const out = canvas(Math.max(1, Math.round(cw * s)), Math.max(1, Math.round(ch * s))), g = out.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, x0 * sx, y0 * sy, cw, ch, 0, 0, out.width, out.height);
  g.globalCompositeOperation = 'destination-in';
  g.filter = 'blur(0.6px)';
  g.drawImage(mc, x0, y0, x1 - x0 + 1, y1 - y0 + 1, 0, 0, out.width, out.height);
  let blob = await toBlob(out, 'image/webp', 0.88);
  if (!blob || blob.type !== 'image/webp') blob = await toBlob(out, 'image/png');   // browsers that cannot write WebP
  return { blob, ar: out.height / out.width, canvas: out };
}

// the full photo for the large view and the loupe: at most 2400px on its long side
export async function fullBlob(img, maxSide = FULL_SIDE) {
  const c = scaled(img, maxSide);
  return { blob: await toBlob(c, 'image/jpeg', 0.86), ar: c.height / c.width, canvas: c };
}
