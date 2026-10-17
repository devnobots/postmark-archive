// Standard Gauge back office: a piece's earlier versions. Restore puts one back (the restore itself is kept too,
// so it can be undone in the same way).
import { useList, useUpdate, useInvalidate } from '@refinedev/core';
import { yenText } from './util.js';

// the fields a restore puts back, and how a change to each is described
export const FIELDS = {
  name_ja: 'Japanese title', name_en: 'English title', cap_ja: 'stamp label', category: 'category', measurements: 'measurements',
  size_line: 'size line', price_jpy: 'price', grade: 'grade', grade_note: 'condition note', found_city: 'city', found_state: 'state',
  found_on: 'date found', bg: 'stamp color', ink: 'price color', views: 'photos', status: 'status', drop_id: 'drop',
  owner_handle: 'who has it', owner_demo: 'who has it', sold_at: 'sold date',
};
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
export function changedFields(older, newer) {
  return [...new Set(Object.keys(FIELDS).filter(k => !same(older[k], newer[k])).map(k => FIELDS[k]))];
}
export function restoreValues(snapshot) {
  const v = {};
  for (const k of Object.keys(FIELDS)) if (k in snapshot) v[k] = snapshot[k];
  return v;
}
function when(t) {
  const d = new Date(t);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export default function HistoryPanel({ piece, onRestored }) {
  const h = useList({ resource: 'piece_history', filters: [{ field: 'piece_id', operator: 'eq', value: piece.id }],
    sorters: [{ field: 'created_at', order: 'desc' }], pagination: { mode: 'off' } });
  const { mutateAsync: update } = useUpdate();
  const invalidate = useInvalidate();
  const rows = (h.result.data || []).filter(r => r.action === 'update');
  // each version is described by what changed after it (compared with the next newer version, or the piece now)
  const items = rows.map((r, i) => ({ r, changed: changedFields(r.snapshot, i === 0 ? piece : rows[i - 1].snapshot) })).filter(x => x.changed.length);
  const restore = async r => {
    if (!window.confirm('Put this piece back the way it was on ' + when(r.created_at) + '?')) return;
    await update({ resource: 'pieces', id: piece.id, values: restoreValues(r.snapshot), successNotification: false });
    await invalidate({ resource: 'pieces', invalidates: ['list', 'detail'] });
    await invalidate({ resource: 'piece_history', invalidates: ['list'] });
    onRestored();
  };
  return (
    <details className="panel field" data-testid="history">
      <summary>History ({items.length} earlier {items.length === 1 ? 'version' : 'versions'})</summary>
      {!items.length && <p className="note">No earlier versions yet. Each save keeps the version before it.</p>}
      <ol className="history">
        {items.map(({ r, changed }) => (
          <li key={r.id} data-testid="history-row">
            <span>{when(r.created_at)}<small>Before changing: {changed.join(', ')}{r.snapshot.price_jpy ? ' · was ' + yenText(r.snapshot.price_jpy) : ''}</small></span>
            <button type="button" className="btn small" onClick={() => restore(r)}>Restore</button>
          </li>
        ))}
      </ol>
    </details>
  );
}
