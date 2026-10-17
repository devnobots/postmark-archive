// Standard Gauge back office: the list of pieces, grouped by drop (live first, then upcoming, then past).
// Drag a piece by its handle (or use the arrows) to change its place in the drop.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useList, useUpdate, useCreate, useInvalidate } from '@refinedev/core';
import { Link } from 'react-router';
import { STATUS_LABEL, yenText } from './util.js';
import { openMeter, checkCached, titlesOf } from './meter.js';
import PublishButton from './PublishButton.jsx';

export default function PieceList() {
  const pieces = useList({ resource: 'pieces', pagination: { mode: 'off' }, sorters: [{ field: 'position', order: 'asc' }] });
  const drops = useList({ resource: 'drops', pagination: { mode: 'off' } });
  const rows = pieces.result.data || [];
  const dropRows = drops.result.data || [];
  const live = dropRows.find(d => d.status === 'live');
  const meter = useListMeter(rows, live);

  const groups = useMemo(() => {
    const byDrop = id => rows.filter(p => String(p.drop_id) === String(id)).sort((a, b) => a.position - b.position);
    const out = [];
    if (live) out.push({ key: 'live', title: 'Drop ' + live.no, sub: live.release_date ? 'released ' + live.release_date.replace(/-/g, '.') : 'release date not set', pieces: byDrop(live.id) });
    for (const d of dropRows.filter(d => d.status === 'draft').sort((a, b) => b.no - a.no))
      out.push({ key: 'd' + d.id, title: 'Drop ' + d.no, sub: 'upcoming', pieces: byDrop(d.id) });
    const loose = rows.filter(p => !dropRows.some(d => String(d.id) === String(p.drop_id)));
    if (loose.length) out.push({ key: 'loose', title: 'Not in a drop', sub: '', pieces: loose });
    for (const d of dropRows.filter(d => d.status === 'past').sort((a, b) => b.no - a.no))
      out.push({ key: 'p' + d.id, title: 'Drop ' + d.no, sub: 'past drop', pieces: byDrop(d.id), past: true });
    return out;
  }, [rows, dropRows, live]);

  if (pieces.query.isLoading || drops.query.isLoading) return <p className="empty">Loading…</p>;
  if (pieces.query.isError) return <p className="empty">Could not load the pieces</p>;

  return (
    <main className="list" data-meter={meter ? 'ready' : 'loading'}>
      <div className="list-actions">
        <Link className="btn primary" to="/pieces/new" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>+ New piece</Link>
        <PublishButton drops={dropRows} pieces={rows} meter={meter} />
      </div>
      {groups.map(g => g.past
        ? <details key={g.key} className="drop-group"><summary>{g.title}<small>{g.sub}</small></summary><Rows pieces={g.pieces} meter={meter} /></details>
        : <section key={g.key} className="drop-group" data-testid={'group-' + g.key}><h2>{g.title}<small>{g.sub}</small></h2><Rows pieces={g.pieces} meter={meter} /></section>)}
      {!groups.length && <p className="empty">No pieces yet</p>}
      <RecentlyDeleted pieces={rows} />
    </main>
  );
}

// one title meter per list load; closed when leaving the list
export function useListMeter(rows, live) {
  const [meter, setMeter] = useState(null);
  const sample = rows.find(p => String(p.drop_id) === String(live && live.id) && p.name_en) || rows.find(p => p.name_en);
  const sampleId = sample && sample.id;
  useEffect(() => {
    if (!sample) return;
    let m = null, gone = false;
    openMeter(sample, live).then(x => { m = x; if (gone) x.close(); else setMeter(x); }).catch(() => {});
    return () => { gone = true; if (m) m.close(); setMeter(null); };
  }, [sampleId]);   // eslint-disable-line react-hooks/exhaustive-deps
  return meter;
}

function Rows({ pieces, meter }) {
  const { mutateAsync: update } = useUpdate();
  const invalidate = useInvalidate();
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(null);             // { from, to, dy, y0, tops }
  const list = useRef(null);
  if (!pieces.length) return <p className="note">No pieces</p>;

  // save a new order: positions are renumbered 1..n so gaps and ties never stick
  const saveOrder = async order => {
    setBusy(true);
    try {
      for (let k = 0; k < order.length; k++) {
        const p = pieces.find(x => x.id === order[k]);
        if (p.position !== k + 1) await update({ resource: 'pieces', id: p.id, values: { position: k + 1 }, successNotification: false });
      }
    } finally {
      await invalidate({ resource: 'pieces', invalidates: ['list'] });
      setBusy(false);
    }
  };
  const move = (i, j) => {
    if (j < 0 || j >= pieces.length || i === j || busy) return;
    const order = pieces.map(p => p.id);
    const [x] = order.splice(i, 1);
    order.splice(j, 0, x);
    saveOrder(order);
  };

  // dragging by the handle: works with a finger or a mouse
  const start = (i, e) => {
    if (busy) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const tops = [...list.current.querySelectorAll('[data-testid="piece-row"]')].map(el => el.getBoundingClientRect());
    setDrag({ from: i, to: i, dy: 0, y0: e.clientY, tops });
  };
  const moveDrag = e => {
    if (!drag) return;
    const dy = e.clientY - drag.y0, y = drag.tops[drag.from].top + drag.tops[drag.from].height / 2 + dy;
    // the new place: how many other rows have their middle above the dragged row's middle
    const to = drag.tops.filter((r, k) => k !== drag.from && r.top + r.height / 2 < y).length;
    setDrag({ ...drag, dy, to });
  };
  const end = () => { if (!drag) return; const { from, to } = drag; setDrag(null); move(from, to); };

  return (
    <div ref={list}>
      {pieces.map((p, i) => {
        const long = meter && p.name_ja && !checkCached(meter, titlesOf(p)).ok;
        let shift = 0;
        if (drag && i !== drag.from) {
          const h = drag.tops[drag.from].height;
          if (drag.from < drag.to && i > drag.from && i <= drag.to) shift = -h;
          if (drag.from > drag.to && i < drag.from && i >= drag.to) shift = h;
        }
        const style = drag && i === drag.from ? { transform: 'translateY(' + drag.dy + 'px)', position: 'relative', zIndex: 2, background: 'var(--paper)', boxShadow: '0 6px 16px rgba(26,36,51,.15)' }
          : shift ? { transform: 'translateY(' + shift + 'px)', transition: 'transform 120ms' } : undefined;
        return (
          <div className="piece-row" key={p.id} data-testid="piece-row" style={style}>
            <button className="handle" aria-label="Drag to reorder" onPointerDown={e => start(i, e)} onPointerMove={moveDrag}
              onPointerUp={end} onPointerCancel={() => setDrag(null)}>⠿</button>
            <Link className="piece-main" to={'/pieces/' + p.id} draggable={false}>
              <div className="cap"><span className="swatch" style={{ background: p.bg }} />{p.cap_ja || p.name_ja || '(untitled)'}</div>
              <div className="title">{p.name_ja}</div>
              <div className="meta">
                <span className="price">{yenText(p.price_jpy) || 'no price yet'}</span>
                <span className={'chip ' + p.status}>{STATUS_LABEL[p.status] || p.status}</span>
                {long && <span className="chip long">Too long</span>}
              </div>
            </Link>
            <div className="move">
              <button aria-label="Move up" disabled={i === 0 || busy} onClick={() => move(i, i - 1)}>↑</button>
              <button aria-label="Move down" disabled={i === pieces.length - 1 || busy} onClick={() => move(i, i + 1)}>↓</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// deleted pieces can be put back (their last version is kept in the history)
function RecentlyDeleted({ pieces }) {
  const h = useList({ resource: 'piece_history', filters: [{ field: 'action', operator: 'eq', value: 'delete' }],
    sorters: [{ field: 'created_at', order: 'desc' }], pagination: { mode: 'off' } });
  const { mutateAsync: create } = useCreate();
  const invalidate = useInvalidate();
  const gone = (h.result.data || []).filter(r => !pieces.some(p => String(p.id) === String(r.piece_id)));
  const seen = new Set();
  const list = gone.filter(r => (seen.has(r.piece_id) ? false : seen.add(r.piece_id)));
  if (!list.length) return null;
  const restore = async r => {
    const { created_at, updated_at, updated_by, ...row } = r.snapshot;   // eslint-disable-line no-unused-vars
    await create({ resource: 'pieces', values: { ...row, status: row.status === 'sold' ? 'sold' : 'draft' }, successNotification: false });
    await invalidate({ resource: 'pieces', invalidates: ['list'] });
    await invalidate({ resource: 'piece_history', invalidates: ['list'] });
  };
  return (
    <details className="drop-group" data-testid="deleted">
      <summary>Recently deleted<small>{list.length}</small></summary>
      {list.map(r => (
        <div className="piece-row" key={r.id} style={{ gridTemplateColumns: 'minmax(0,1fr) auto' }}>
          <div className="piece-main"><div className="cap">{r.snapshot.cap_ja || r.snapshot.name_ja || '(untitled)'}</div><div className="title">{r.snapshot.name_ja}</div></div>
          <button className="btn small" onClick={() => restore(r)}>Restore (as a draft)</button>
        </div>
      ))}
    </details>
  );
}
