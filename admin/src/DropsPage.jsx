// Postmark Archive back office: drops. Build the next drop, preview it whole, and make it the live drop
// (the current one moves to past drops in the same step; its unsold pieces stay on sale there. To take a piece off
// the site, set it to Draft). Publish puts the change on the site.
import { useEffect, useState } from 'react';
import { useList, useCreate, useUpdate, useInvalidate } from '@refinedev/core';
import { Link } from 'react-router';
import { toSiteItem, siteDropDate } from './lib/site-data.mjs';
import { resolveViews } from './photos.js';
import { today } from './util.js';
import Preview from './Preview.jsx';
import PublishButton from './PublishButton.jsx';
import { useListMeter } from './PieceList.jsx';

const ON_SITE = s => s === 'ready' || s === 'sold';

export default function DropsPage() {
  const drops = useList({ resource: 'drops', pagination: { mode: 'off' } });
  const pieces = useList({ resource: 'pieces', pagination: { mode: 'off' }, sorters: [{ field: 'position', order: 'asc' }] });
  const { mutateAsync: create } = useCreate();
  const { mutateAsync: update } = useUpdate();
  const invalidate = useInvalidate();
  const [preview, setPreview] = useState(null);       // the drop being previewed
  const [msg, setMsg] = useState(null);
  const rows = pieces.result.data || [];
  const all = (drops.result.data || []).slice().sort((a, b) => b.no - a.no);
  const live = all.find(d => d.status === 'live');
  const meter = useListMeter(rows, live);
  if (drops.query.isLoading || pieces.query.isLoading) return <p className="empty">Loading…</p>;
  const inDrop = d => rows.filter(p => String(p.drop_id) === String(d.id));
  const refresh = () => Promise.all([invalidate({ resource: 'drops', invalidates: ['list'] }), invalidate({ resource: 'pieces', invalidates: ['list'] })]);

  const newDrop = async () => {
    const no = all.reduce((m, d) => Math.max(m, d.no), 0) + 1;
    await create({ resource: 'drops', values: { no, release_date: null, status: 'draft' }, successNotification: false });
    await refresh();
    setMsg({ text: 'Drop ' + no + ' added. Add pieces to it, then make it the live drop when it is ready.' });
  };
  const setStory = async (d, story) => {
    try {
      await update({ resource: 'drops', id: d.id, values: { story }, successNotification: false, errorNotification: false });
      await refresh();
      setMsg({ text: 'Drop ' + d.no + ': story line saved. Press Publish to site to put it on the site.' });
    } catch (e) {
      setMsg({ bad: true, text: 'Drop ' + d.no + ': the story line was not saved (' + ((e && e.message) || e) + '). If the database says the column story does not exist, run supabase/migrations/0003_drop_story.sql in the Supabase SQL editor.' });
    }
  };
  const setDate = async (d, date) => { await update({ resource: 'drops', id: d.id, values: { release_date: date || null }, successNotification: false }); await refresh(); };

  // the next drop goes live; the current one becomes a past drop. All its pieces stay with it: sold ones as sold,
  // unsold ones still on sale on the past drops page. To take a piece off the site, set it to Draft.
  const release = async d => {
    const ready = inDrop(d).filter(p => ON_SITE(p.status));
    if (!ready.length) return setMsg({ bad: true, text: 'Drop ' + d.no + ' has no Ready pieces yet.' });
    const unsold = live ? inDrop(live).filter(p => p.status === 'ready') : [];
    const text = 'Make Drop ' + d.no + ' the live drop?' + (live ? '\n\nDrop ' + live.no + ' moves to past drops.' : '') +
      (unsold.length ? '\n' + unsold.length + ' unsold piece(s) from Drop ' + live.no + ' stay on sale on the past drops page. To take one off the site, set it to Draft.' : '') +
      '\n\nNothing changes on the site until you press Publish to site.';
    if (!window.confirm(text)) return;
    if (live) await update({ resource: 'drops', id: live.id, values: { status: 'past' }, successNotification: false });   // one live drop at a time
    await update({ resource: 'drops', id: d.id, values: { status: 'live', release_date: d.release_date || today() }, successNotification: false });
    await refresh();
    setMsg({ text: 'Drop ' + d.no + ' is now the live drop' + (live ? ' and Drop ' + live.no + ' is a past drop' : '') +
      (unsold.length ? '. ' + unsold.length + ' unsold piece(s) stay on sale in past drops' : '') + '. Press Publish to site to put it on the site.' });
  };

  const group = (title, list, kind) => list.length > 0 && (
    <section className="drop-group" key={kind}>
      <h2>{title}</h2>
      {list.map(d => {
        const ps = inDrop(d), n = ps.filter(p => ON_SITE(p.status)).length, drafts = ps.filter(p => p.status === 'draft').length;
        return (
          <div className="drop-card" key={d.id} data-testid={'drop-' + d.no}>
            <div className="drop-title"><b>Drop {d.no}</b> <small>{kind === 'draft' ? 'upcoming' : kind}</small></div>
            <div className="note">{n} {n === 1 ? 'piece' : 'pieces'} on the site{drafts ? ', ' + drafts + ' draft' + (drafts > 1 ? 's' : '') : ''}</div>
            {kind === 'draft' ? (
              <label className="inline" style={{ marginTop: 6 }}>Release date
                <input type="date" value={d.release_date || ''} onChange={e => setDate(d, e.target.value)} style={{ maxWidth: 200 }} />
              </label>
            ) : <div className="note">Released {d.release_date ? siteDropDate(d.release_date) : '—'}</div>}
            {kind !== 'past' && <StoryField drop={d} onSave={v => setStory(d, v)} />}
            <div className="list-actions" style={{ margin: '8px 0 0' }}>
              {kind !== 'past' && <Link className="btn small" to={'/pieces/new?drop=' + d.id} style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>+ Add a piece</Link>}
              {kind !== 'past' && <button className="btn small" onClick={() => setPreview(preview && preview.id === d.id ? null : d)}>{preview && preview.id === d.id ? 'Hide preview' : 'Preview the drop'}</button>}
              {kind === 'draft' && <button className="btn small primary" onClick={() => release(d)}>Make this the live drop</button>}
            </div>
            {preview && preview.id === d.id && <DropPreview drop={d} pieces={ps} />}
          </div>
        );
      })}
    </section>
  );

  return (
    <main className="list" data-meter={meter ? 'ready' : 'loading'}>
      <div className="list-actions">
        <button className="btn primary" onClick={newDrop}>+ New drop</button>
        <PublishButton drops={all} pieces={rows} meter={meter} />
      </div>
      {msg && <p className={msg.bad ? 'err' : 'note'} data-testid="drops-msg" style={{ marginTop: -6 }}>{msg.text}</p>}
      {group('Live', all.filter(d => d.status === 'live'), 'live')}
      {group('Upcoming', all.filter(d => d.status === 'draft'), 'draft')}
      {group('Past', all.filter(d => d.status === 'past'), 'past')}
    </main>
  );
}

// the drop's story line: shown under the homepage headline as 今回の便：<story>. Saved when the field loses focus.
function StoryField({ drop, onSave }) {
  const [v, setV] = useState(drop.story || '');
  useEffect(() => { setV(drop.story || ''); }, [drop.story]);
  const n = [...v.trim()].length;
  return (
    <label className="inline" style={{ marginTop: 6, display: 'block' }}>Story line (Japanese, optional)
      <input type="text" data-testid={'story-' + drop.no} value={v} maxLength={60}
        placeholder="マウントドーラのハロルドさんが、四十年かけて集めた万年筆。"
        onChange={e => setV(e.target.value)}
        onBlur={() => { if (v.trim() !== (drop.story || '')) onSave(v.trim()); }} />
      <span className="note" style={{ display: 'block' }}>Shown under the headline as 今回の便：… Where the seven pieces were found, or whose collection they are. Leave it empty to hide the line.
        {' '}{n} characters{n > 40 ? ' (over 40: it takes two lines on desktop)' : ''}. The phone breaks lines only between phrases.</span>
    </label>
  );
}

// the whole drop as the homepage will show it (drafts included, so a drop can be checked while it is built)
function DropPreview({ drop, pieces }) {
  const [items, setItems] = useState(null);
  useEffect(() => {
    let alive = true;
    const list = pieces.slice().sort((a, b) => a.position - b.position).filter(p => (p.views || []).length && p.name_en);
    Promise.all(list.map(async p => { const d = toSiteItem(p, { ...drop, status: 'live' }); return { ...d, views: await resolveViews(d.views) }; }))
      .then(r => { if (alive) setItems(r); });
    return () => { alive = false; };
  }, [drop.id, pieces]);   // eslint-disable-line react-hooks/exhaustive-deps
  if (!items) return <p className="note">Loading the preview…</p>;
  if (!items.length) return <p className="note">Add pieces with a photo and an English title to preview this drop.</p>;
  return <div data-testid="drop-preview"><Preview items={items} drop={drop} slug="" ready visible only={['home', 'sheet']} /></div>;
}
