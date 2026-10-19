// The site build with a database: writes data/current.js and data/past.js from it and copies uploaded photos
// into the site. Runs on a scratch copy of the site against a stand-in database. Usage: node tools/tests/check_build.mjs
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import http from 'node:http';
import vm from 'node:vm'; import assert from 'node:assert'; import { execFile } from 'node:child_process'; import { promisify } from 'node:util';
import { seedFromSite } from '../../admin/src/lib/local-provider.mjs';

const ROOT = process.cwd();
const load = (f, k) => { const sb = { window: {} }; vm.runInNewContext(fs.readFileSync(f, 'utf8'), sb); return JSON.parse(JSON.stringify(sb.window[k])); };
const db = await seedFromSite(load('data/current.js', 'SG_DATA'), load('data/past.js', 'SG_PAST'));
const PHOTO = fs.readFileSync('assets/hat.webp');
let base;
// the stand-in: just enough of Supabase's REST and storage addresses for the build
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname.startsWith('/storage/v1/object/public/photos/')) { res.setHeader('content-type', 'image/webp'); return res.end(PHOTO); }
  assert.equal(req.headers.apikey, 'secret');
  const q = Object.fromEntries(u.searchParams);
  let rows = u.pathname === '/rest/v1/drops' ? db.drops : db.pieces;
  if (q.status) { const [op, v] = q.status.split('.'); rows = rows.filter(r => (op === 'eq' ? r.status === v : v.slice(1, -1).split(',').includes(r.status))); }
  if (q.drop_id) { const [op, v] = q.drop_id.split('.'); const ids = op === 'eq' ? [v] : v.slice(1, -1).split(','); rows = rows.filter(r => ids.includes(String(r.drop_id))); }
  res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(rows.sort((a, b) => a.position - b.position)));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
base = 'http://127.0.0.1:' + server.address().port;
// one live piece uses an uploaded photo
db.pieces[0].views = [{ img: base + '/storage/v1/object/public/photos/p/abc-cut.webp', full: base + '/storage/v1/object/public/photos/p/abc-full.jpg',
  zoom: base + '/storage/v1/object/public/photos/p/abc-zoom.jpg', ar: 1 }];   // the deep-zoom copy travels the same way

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sg-build-'));
for (const f of ['index.html', 'drops.html', 'mobile.css', 'mobile.js', 'zoom.js', 'zoom-test.html', 'assets', 'data', 'tools/build_site.mjs', 'admin/src/lib/site-data.mjs'])
  fs.cpSync(path.join(ROOT, f), path.join(tmp, f), { recursive: true });
// run the build as a separate process without blocking, so the stand-in above can answer it
const { stdout: out } = await promisify(execFile)('node', ['tools/build_site.mjs'], { cwd: tmp, env: { ...process.env, SUPABASE_URL: base, SUPABASE_SECRET_KEY: 'secret' }, encoding: 'utf8', timeout: 60000 });
server.close();
console.log(out.trim());
const cur = load(path.join(tmp, 'dist/data/current.js'), 'SG_DATA'), past = load(path.join(tmp, 'dist/data/past.js'), 'SG_PAST');
assert.equal(cur.items.length, 7); assert.equal(past.drops.length, 3); assert.equal(past.current, 12);
assert.equal(cur.items[0].views[0].img, 'assets/u/p-abc-cut.webp');
assert.ok(fs.existsSync(path.join(tmp, 'dist/assets/u/p-abc-cut.webp')) && fs.existsSync(path.join(tmp, 'dist/assets/u/p-abc-full.jpg')));
assert.equal(cur.items[0].views[0].zoom, 'assets/u/p-abc-zoom.jpg', 'zoom address rewritten');
assert.ok(fs.existsSync(path.join(tmp, 'dist/assets/u/p-abc-zoom.jpg')), 'zoom photo copied');
for (const f of ['zoom.js', 'zoom-test.html', 'assets/vendor/openseadragon-4.1.0.min.js', 'assets/test/some-girls-zoom.jpg'])
  assert.ok(fs.existsSync(path.join(tmp, 'dist', f)), 'in the built site: ' + f);
assert.ok(!fs.readFileSync(path.join(tmp, 'dist/data/current.js'), 'utf8').includes('127.0.0.1'), 'no database address left in the site');
fs.rmSync(tmp, { recursive: true, force: true });
console.log('build ok: both data files from the database; uploaded photos (including the zoom copy) copied into the site; zoom files built');
