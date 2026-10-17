// Standard Gauge back office: the list of pieces, grouped by drop (live first, then drafts, then past).
import { useEffect, useMemo, useState } from 'react';
import { useList, useUpdate, useInvalidate } from '@refinedev/core';
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
      out.push({ key: 'd' + d.id, title: 'Drop ' + d.no, sub: 'in preparation', pieces: byDrop(d.id) });
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
        <PublishButton live={live} pieces={live ? rows.filter(p => String(p.drop_id) === String(live.id)) : []} meter={meter} />
      </div>
      {groups.map(g => g.past
        ? <details key={g.key} className="drop-group"><summary>{g.title}<small>{g.sub}</small></summary><Rows pieces={g.pieces} meter={meter} /></details>
        : <section key={g.key} className="drop-group"><h2>{g.title}<small>{g.sub}</small></h2><Rows pieces={g.pieces} meter={meter} /></section>)}
      {!groups.length && <p className="empty">No pieces yet</p>}
    </main>
  );
}

// one title meter per list load; closed when leaving the list
function useListMeter(rows, live) {
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
  if (!pieces.length) return <p className="note">No pieces</p>;
  // swap with the neighbor; positions are renumbered 1..n so gaps and ties never stick
  const move = async (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= pieces.length || busy) return;
    setBusy(true);
    const order = pieces.map(p => p.id);
    [order[i], order[j]] = [order[j], order[i]];
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
  return pieces.map((p, i) => {
    const long = meter && p.name_ja && !checkCached(meter, titlesOf(p)).ok;
    return (
      <div className="piece-row" key={p.id} data-testid="piece-row">
        <span className="swatch" style={{ background: p.bg }} />
        <Link className="piece-main" to={'/pieces/' + p.id}>
          <div className="cap">{p.cap_ja || p.name_ja || '(untitled)'}</div>
          <div className="title">{p.name_ja}</div>
          <div className="meta">
            <span className="price">{yenText(p.price_jpy) || 'no price yet'}</span>
            <span className={'chip ' + p.status}>{STATUS_LABEL[p.status] || p.status}</span>
            {long && <span className="chip long">Too long</span>}
          </div>
        </Link>
        <div className="move">
          <button aria-label="Move up" disabled={i === 0 || busy} onClick={() => move(i, -1)}>↑</button>
          <button aria-label="Move down" disabled={i === pieces.length - 1 || busy} onClick={() => move(i, 1)}>↓</button>
        </div>
      </div>
    );
  });
}
