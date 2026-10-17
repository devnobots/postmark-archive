// Standard Gauge (developer, run once): the past-drops page reads its drops from data/past.js.
// The pieces are written fully resolved, exactly as drops.html built them; after this the back office
// (or the site build) writes data/past.js from the database. The page looks and works exactly as before.
// Usage: node tools/apply_past_data.mjs drops.html
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const file = process.argv[2];
if (!file) { console.error('Usage: node tools/apply_past_data.mjs drops.html'); process.exit(2); }
let src = fs.readFileSync(file, 'utf8');
const MARK = '<script src="data/past.js"></script>';
if (src.includes(MARK)) { console.log('already applied: ' + file); process.exit(0); }

const cut = (start, end) => {
  const a = src.indexOf(start), b = src.indexOf(end, a);
  if (a < 0 || b < 0 || src.indexOf(start, a + 1) >= 0) throw new Error('not found exactly once: ' + start.slice(0, 40));
  return [a, b];
};
const [ia, ib] = cut('var ITEMS = [\n', '\n];\nvar DROP, DROP_LABEL;');
const [pa, pb] = cut('var PAST = [\n', '\n];\nvar PIECES = [];');
const items = vm.runInNewContext('(' + src.slice(ia + 'var ITEMS = '.length, ib + 2) + ')');
const past = vm.runInNewContext('(' + src.slice(pa + 'var PAST = '.length, pb + 2) + ')');
const current = Number((/var CURRENT_DROP_NO = (\d+);/.exec(src) || [])[1]);
if (!current) throw new Error('CURRENT_DROP_NO not found');

// exactly the object drops.html made for each sold piece
const drops = past.map(drop => ({
  no: drop.no, date: drop.date,
  pieces: drop.pieces.map(p => Object.assign({}, items[p.base], { price: p.price, grade: p.grade, gradeNote: p.gradeNote, city: p.city,
    date: p.date, year: '2026', sold: true, owner: p.owner || '', demo: !!p.demo, drop: { no: drop.no, date: drop.date } })),
}));
const data = '// Standard Gauge: the past drops (newest first). Written by the back office; edit there, not here.\n' +
  'window.SG_PAST = ' + JSON.stringify({ current, drops }, null, 1) + ';\n';

const LOOP_OLD = "    var d = Object.assign({}, ITEMS[p.base], { price: p.price, grade: p.grade, gradeNote: p.gradeNote, city: p.city, date: p.date, year: '2026', sold: true, owner: p.owner || '', demo: !!p.demo, drop: { no: drop.no, date: drop.date } });";
const MAIN_OPEN = '\n<script>\nfunction esc(s)';
for (const [label, s] of [['piece loop', LOOP_OLD], ['main script', MAIN_OPEN], ['current drop', 'var CURRENT_DROP_NO = ' + current + ';']])
  if (src.split(s).length !== 2) throw new Error(label + ' not found exactly once');

src = src.slice(0, pa) + 'var PAST = SG_PAST.drops;' + src.slice(pb + 3);
src = src.slice(0, ia) + 'var ITEMS = [];' + src.slice(ib + 3);
src = src.replace(LOOP_OLD, '    var d = p;                                                     // resolved in data/past.js');
src = src.replace('var CURRENT_DROP_NO = ' + current + ';', 'var CURRENT_DROP_NO = SG_PAST.current;');
src = src.replace(MAIN_OPEN, '\n' + MARK + MAIN_OPEN);
const out = path.join(path.dirname(path.resolve(file)), 'data', 'past.js');
fs.writeFileSync(out, data);
fs.writeFileSync(file, src);
console.log('past drops now read data/past.js: ' + drops.length + ' drops, ' + drops.reduce((n, d) => n + d.pieces.length, 0) + ' pieces');
