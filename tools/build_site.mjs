// Postmark Archive: build the site for hosting (Vercel runs this; you can run it too).
// 1. When the database settings are present (SUPABASE_URL and the server-only SUPABASE_SECRET_KEY, set in
//    Vercel only), write data/current.js from the live drop's pieces (status ready or sold, in their order)
//    and data/past.js from the past drops. Without them, the committed files are used as is.
// 2. Copy the site into dist/ (the back office is built into dist/admin by `npm run build`).
// 3. Photos uploaded in the back office live in the database's photo storage; every one the site uses is
//    copied into dist/assets/u/ and the data points there, so visitors only ever load the site's own files.
// Usage: node tools/build_site.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { currentJs, pastJs } from '../admin/src/lib/site-data.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');   // fileURLToPath: folders with spaces
const SITE_FILES = ['index.html', 'drops.html', 'mobile.css', 'mobile.js', 'zoom.js', 'exit.js', 'zoom-test.html', 'favicon.ico', 'favicon.svg', 'apple-touch-icon.png', 'assets', 'data'];
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
  const past = await get('drops?status=eq.past&select=*');
  const pastPieces = past.length ? await get('pieces?drop_id=in.(' + past.map(d => d.id).join(',') + ')&status=in.(ready,sold)&order=position.asc&select=*') : [];
  fs.writeFileSync(path.join(ROOT, 'data/past.js'), pastJs(drops[0], past, pastPieces));
  console.log('data/past.js: ' + past.length + ' past drops, ' + pastPieces.length + ' pieces from the database');
} else {
  console.log('data/current.js, data/past.js: no database settings, using the committed files');
}

const DIST = path.join(ROOT, 'dist');
fs.mkdirSync(DIST, { recursive: true });
for (const f of SITE_FILES) {
  const src = path.join(ROOT, f);
  if (!fs.existsSync(src)) { console.error('STOP: missing ' + f); process.exit(1); }
  fs.cpSync(src, path.join(DIST, f), { recursive: true });
}
console.log('site copied to dist/');

// uploaded photos -> dist/assets/u/ (only addresses in this project's photo storage are copied)
if (SUPABASE_URL) {
  const store = SUPABASE_URL.replace(/\/$/, '') + '/storage/v1/object/public/photos/';
  const esc = store.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
  const rx = new RegExp(esc + '[A-Za-z0-9._/-]+', 'g');
  let copied = 0;
  for (const f of ['data/current.js', 'data/past.js']) {
    const file = path.join(DIST, f);
    if (!fs.existsSync(file)) continue;
    let text = fs.readFileSync(file, 'utf8');
    for (const url of new Set(text.match(rx) || [])) {
      const local = 'assets/u/' + url.slice(store.length).replace(/\//g, '-');
      if (!fs.existsSync(path.join(DIST, local))) {
        const r = await fetch(url);
        if (!r.ok) { console.error('STOP: photo ' + r.status + ' ' + url); process.exit(1); }
        fs.mkdirSync(path.join(DIST, 'assets/u'), { recursive: true });
        fs.writeFileSync(path.join(DIST, local), Buffer.from(await r.arrayBuffer()));
        copied++;
      }
      text = text.split(url).join(local);
    }
    fs.writeFileSync(file, text);
  }
  console.log('photos: ' + copied + ' uploaded photos copied into the site');
}
