// Postmark Archive back office, local mode: everything is saved in this browser only (no accounts needed).
// Same shape as refine's Supabase data provider, so the screens do not know which one they use.
// Starts with today's homepage pieces (data/current.js) the first time it opens.
import { fromSiteItem } from './site-data.mjs';
import { CATEGORIES } from './categories.mjs';

const KEY = 'sg-local-db';

function load(storage) { try { return JSON.parse(storage.getItem(KEY) || 'null'); } catch (e) { return null; } }

export async function seedFromSite(siteData, pastData) {
  const { drop, items } = siteData;
  const now = new Date().toISOString();
  const db = {
    drops: [{ id: 1, no: drop.no, release_date: drop.date.replace(/\./g, '-'), status: 'live', created_at: now, updated_at: now }],
    categories: CATEGORIES.map(c => ({ ...c, id: c.code })),
    pieces: items.map((d, i) => ({ id: 'local-' + (i + 1), drop_id: 1, ...fromSiteItem(d, i + 1), created_at: now, updated_at: now })),
  };
  // the past drops (data/past.js), when given: each becomes a past drop with its sold pieces
  ((pastData && pastData.drops) || []).forEach((pd, k) => {
    const id = 2 + k;
    db.drops.push({ id, no: pd.no, release_date: String(pd.date).replace(/\./g, '-'), status: 'past', created_at: now, updated_at: now });
    pd.pieces.forEach((d, i) => db.pieces.push({ id: 'local-p' + pd.no + '-' + (i + 1), drop_id: id, ...fromSiteItem(d, i + 1), created_at: now, updated_at: now }));
  });
  return db;
}

function matches(row, f) {
  if (!f || !f.field) return true;
  const v = row[f.field];
  switch (f.operator) {
    case 'eq': return v == f.value;
    case 'ne': return v != f.value;
    case 'in': return (f.value || []).includes(v);
    case 'contains': return String(v || '').toLowerCase().includes(String(f.value).toLowerCase());
    default: return true;
  }
}

export function localDataProvider(storage, initial) {
  let db = load(storage) || initial;
  const save = () => storage.setItem(KEY, JSON.stringify(db));
  save();
  const table = r => { if (!db[r]) db[r] = []; return db[r]; };
  return {
    getApiUrl: () => 'local',
    async getList({ resource, pagination, sorters, filters }) {
      let rows = table(resource).filter(r => (filters || []).every(f => matches(r, f)));
      for (const s of [...(sorters || [])].reverse()) {
        rows = [...rows].sort((a, b) => (a[s.field] > b[s.field] ? 1 : a[s.field] < b[s.field] ? -1 : 0) * (s.order === 'desc' ? -1 : 1));
      }
      const total = rows.length;
      if (pagination && pagination.mode !== 'off' && pagination.pageSize) {
        const start = ((pagination.currentPage || pagination.current || 1) - 1) * pagination.pageSize;
        rows = rows.slice(start, start + pagination.pageSize);
      }
      return { data: rows.map(r => ({ ...r })), total };
    },
    async getMany({ resource, ids }) { return { data: table(resource).filter(r => ids.includes(r.id)).map(r => ({ ...r })) }; },
    async getOne({ resource, id }) {
      const r = table(resource).find(x => String(x.id) === String(id));
      if (!r) throw { message: 'not found', statusCode: 404 };
      return { data: { ...r } };
    },
    async create({ resource, variables }) {
      const now = new Date().toISOString();
      const row = { id: resource === 'pieces' ? 'local-' + Date.now().toString(36) : Math.max(0, ...table(resource).map(r => +r.id || 0)) + 1,
        created_at: now, updated_at: now, ...variables };
      table(resource).push(row); save();
      return { data: { ...row } };
    },
    async update({ resource, id, variables }) {
      const rows = table(resource), i = rows.findIndex(x => String(x.id) === String(id));
      if (i < 0) throw { message: 'not found', statusCode: 404 };
      rows[i] = { ...rows[i], ...variables, id: rows[i].id, updated_at: new Date().toISOString() }; save();
      return { data: { ...rows[i] } };
    },
    async deleteOne({ resource, id }) {
      const rows = table(resource), i = rows.findIndex(x => String(x.id) === String(id));
      if (i < 0) throw { message: 'not found', statusCode: 404 };
      const [gone] = rows.splice(i, 1); save();
      return { data: gone };
    },
    reset() { storage.removeItem(KEY); },
  };
}
