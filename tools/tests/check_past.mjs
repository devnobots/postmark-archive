// Past drops convert both ways: data/past.js -> database rows -> data/past.js. Usage: node tools/tests/check_past.mjs
import fs from 'node:fs'; import vm from 'node:vm'; import assert from 'node:assert';
import { seedFromSite } from '../../admin/src/lib/local-provider.mjs';
import { pastJs } from '../../admin/src/lib/site-data.mjs';
const load = (f, k) => { const sb = { window: {} }; vm.runInNewContext(fs.readFileSync(f, 'utf8'), sb); return JSON.parse(JSON.stringify(sb.window[k])); };
const site = load('data/current.js', 'SG_DATA'), past = load('data/past.js', 'SG_PAST');
const db = await seedFromSite(site, past);
const live = db.drops.find(d => d.status === 'live');
const sb = { window: {} }; vm.runInNewContext(pastJs(live, db.drops, db.pieces), sb);
const back = JSON.parse(JSON.stringify(sb.window.SG_PAST));
// an empty owner and demo: false mean the same as leaving them out (the page checks !owner and demo)
const norm = p => ({ ...p, drops: p.drops.map(d => ({ ...d, pieces: d.pieces.map(x => { const y = { ...x }; if (!y.owner) delete y.owner; if (!y.demo) delete y.demo; return y; }) })) });
assert.deepStrictEqual(back, norm(past));
assert.equal(db.drops.filter(d => d.status === 'past').length, past.drops.length);
console.log('past ok: ' + past.drops.length + ' drops, ' + past.drops.reduce((n, d) => n + d.pieces.length, 0) + ' pieces convert both ways');
