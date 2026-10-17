// Local mode keeps edits in browser storage. Usage: node tools/tests/check_local.mjs
import fs from 'node:fs'; import vm from 'node:vm'; import assert from 'node:assert';
import { localDataProvider, seedFromSite } from '../../admin/src/lib/local-provider.mjs';
import { CATEGORIES } from '../../admin/src/lib/categories.mjs';
import { currentJs } from '../../admin/src/lib/site-data.mjs';
const mem = new Map(); const storage = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: k => mem.delete(k) };
const sb = { window: {} }; vm.runInNewContext(fs.readFileSync('data/current.js', 'utf8'), sb);
const site = JSON.parse(JSON.stringify(sb.window.SG_DATA)), n = site.items.length;
let dp = localDataProvider(storage, await seedFromSite(site));
const l = await dp.getList({ resource: 'pieces', filters: [{ field: 'drop_id', operator: 'eq', value: 1 }], sorters: [{ field: 'position', order: 'asc' }], pagination: { mode: 'off' } });
assert.equal(l.total, n);
await dp.update({ resource: 'pieces', id: l.data[0].id, variables: { price_jpy: 15400 } });
const c = await dp.create({ resource: 'pieces', variables: { drop_id: 1, position: n + 1, status: 'draft', name_ja: '下書き', name_en: 'Draft' } });
dp = localDataProvider(storage, null);
assert.equal((await dp.getOne({ resource: 'pieces', id: l.data[0].id })).data.price_jpy, 15400);
assert.equal((await dp.getList({ resource: 'pieces', filters: [{ field: 'status', operator: 'eq', value: 'draft' }] })).total, 1);
const js = currentJs((await dp.getOne({ resource: 'drops', id: 1 })).data, (await dp.getList({ resource: 'pieces', pagination: { mode: 'off' } })).data);
assert.ok(js.includes('¥15,400') && !js.includes('"Draft"'));
await dp.deleteOne({ resource: 'pieces', id: c.data.id });
await assert.rejects(dp.deleteOne({ resource: 'pieces', id: 'nope' }));   // a missing id deletes nothing
assert.equal((await dp.getList({ resource: 'pieces', pagination: { currentPage: 2, pageSize: 5 } })).data.length, n - 5);
const sql = fs.readFileSync('supabase/migrations/0001_init.sql', 'utf8');
for (const k of CATEGORIES) assert.ok(sql.includes(`('${k.code}',`) && sql.includes(`'{${k.measurements.join(',')}}'`) && sql.includes(`'${k.label_ja}'`), 'category ' + k.code);
assert.equal((sql.match(/^\s+\('[a-z]+',/gm) || []).length, CATEGORIES.length);
console.log('local mode ok; categories match the database file');
