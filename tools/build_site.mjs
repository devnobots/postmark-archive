// Standard Gauge: build the site for hosting (Vercel runs this; you can run it too).
// 1. When the database settings are present (SUPABASE_URL and the server-only SUPABASE_SECRET_KEY, set in
//    Vercel only), write data/current.js from the live drop's pieces
//    (status ready or sold, in their order). Without them, the committed data/current.js is used as is.
// 2. Copy the site into dist/ (the back office is built into dist/admin by `npm run build`).
// Usage: node tools/build_site.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { currentJs } from '../admin/src/lib/site-data.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');   // fileURLToPath: folders with spaces
const SITE_FILES = ['index.html', 'drops.html', 'mobile.css', 'mobile.js', 'assets', 'data'];
const { SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;

async function get(p) {
  const r = await fetch(SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/' + p,
    { headers: { apikey: SUPABASE_SECRET_KEY } });   // works with sb_secret_ keys and the legacy service_role key
  if (!r.ok) throw new Error('database ' + r.status + ' for ' + p);
  return r.json();
}

if (SUPABASE_URL && SUPABASE_SECRET_KEY) {
  const drops = await get('drops?status=eq.live&select=*');
  if (drops.length !== 1) { console.error('STOP: expected 1 live drop in the database, found ' + drops.length + '. Site not built.'); process.exit(1); }
  const pieces = await get('pieces?drop_id=eq.' + drops[0].id + '&status=in.(ready,sold)&order=position.asc&select=*');
  if (!pieces.length) { console.error('STOP: the live drop has no finished pieces. Site not built.'); process.exit(1); }
  fs.mkdirSync(path.join(ROOT, 'data'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'data/current.js'), currentJs(drops[0], pieces));
  console.log('data/current.js: 第' + drops[0].no + '便, ' + pieces.length + ' pieces from the database');
} else {
  console.log('data/current.js: no database settings, using the committed file');
}

const DIST = path.join(ROOT, 'dist');
fs.mkdirSync(DIST, { recursive: true });
for (const f of SITE_FILES) {
  const src = path.join(ROOT, f);
  if (!fs.existsSync(src)) { console.error('STOP: missing ' + f); process.exit(1); }
  fs.cpSync(src, path.join(DIST, f), { recursive: true });
}
console.log('site copied to dist/');
