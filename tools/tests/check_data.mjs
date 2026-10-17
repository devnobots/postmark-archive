// The back office writes exactly what the site uses today. Usage: node tools/tests/check_data.mjs
import fs from 'node:fs'; import vm from 'node:vm'; import assert from 'node:assert';
import { fromSiteItem, toSiteItem, currentJs } from '../../admin/src/lib/site-data.mjs';
const sb = { window: {} }; vm.runInNewContext(fs.readFileSync('data/current.js', 'utf8'), sb);
const { drop, items } = JSON.parse(JSON.stringify(sb.window.SG_DATA));
const dbDrop = { no: drop.no, release_date: drop.date.replace(/\./g, '-'), status: 'live' };
const rows = items.map((d, i) => fromSiteItem(d, i + 1));
items.forEach((d, i) => assert.deepStrictEqual(toSiteItem(rows[i], dbDrop), d, d.nameEn));
const sb2 = { window: {} }; vm.runInNewContext(currentJs(dbDrop, rows.concat([{ ...rows[0], status: 'draft', position: 99 }])), sb2);
assert.deepStrictEqual(JSON.parse(JSON.stringify(sb2.window.SG_DATA)), { drop, items });
console.log('data ok: ' + items.length + ' pieces convert both ways; drafts stay off the site');
