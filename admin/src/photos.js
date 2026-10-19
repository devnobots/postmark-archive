// Postmark Archive back office: where uploaded photos are kept.
// Supabase mode: the database's photo storage (bucket "photos"); a view keeps the photo's public address,
// and the site build copies it into the site. Local mode: this browser's IndexedDB; a view keeps "local:<key>".
import { MODE, supabase } from './config.js';

const DB = 'sg-photos', STORE = 'files';

function idb() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function idbDo(mode, fn) {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode), req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req && req.result);
    tx.onerror = () => reject(tx.error);
  });
}

function newKey(ext) {
  const rnd = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2)).replace(/-/g, '').slice(0, 16);
  return rnd + '.' + ext;
}
const EXT = { 'image/webp': 'webp', 'image/png': 'png', 'image/jpeg': 'jpg' };

// keep one photo; returns what a view stores (an address, or local:<key>)
export async function savePhoto(blob, kind) {
  const key = kind + '-' + newKey(EXT[blob.type] || 'bin');
  if (MODE === 'supabase') {
    const path = 'p/' + key;
    const { error } = await supabase.storage.from('photos').upload(path, blob, { contentType: blob.type, cacheControl: '31536000', upsert: false });
    if (error) throw new Error(error.message);
    return supabase.storage.from('photos').getPublicUrl(path).data.publicUrl;
  }
  await idbDo('readwrite', s => s.put(blob, key));
  return 'local:' + key;
}

export const isLocal = p => typeof p === 'string' && p.startsWith('local:');

// an address the browser can show: site photos (assets/…), stored photos (https://…) and local ones (blob:)
const urls = new Map();
export async function photoUrl(p) {
  if (!p) return '';
  if (/^(https?:|blob:|data:)/.test(p)) return p;
  if (!isLocal(p)) return '/' + p.replace(/^\//, '');
  if (urls.has(p)) return urls.get(p);
  const blob = await idbDo('readonly', s => s.get(p.slice(6)));
  const u = blob ? URL.createObjectURL(blob) : '';
  urls.set(p, u);
  return u;
}

// the same views with addresses the preview frames can load
export async function resolveViews(views) {
  return Promise.all((views || []).map(async v => ({ ...v, img: await photoUrl(v.img), full: await photoUrl(v.full), ...(v.zoom ? { zoom: await photoUrl(v.zoom) } : {}) })));
}
