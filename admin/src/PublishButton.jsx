// Postmark Archive back office: Publish to site. Checks every Ready and Sold piece of the live drop, sets the stamp
// colors by the rule, then puts the live drop (data/current.js) and the past drops (data/past.js) on the site.
// Supabase mode asks the host to rebuild; local mode downloads the two files.
import { useState } from 'react';
import { Link } from 'react-router';
import { useUpdate, useInvalidate } from '@refinedev/core';
import { currentJs, pastJs } from './lib/site-data.mjs';
import { scoresForImage, assignInks, PALETTE, paletteFor } from './lib/colors.mjs';
import { MODE, authHeader } from './config.js';
import { missingFields } from './util.js';
import { checkCached, titlesOf } from './meter.js';
import { photoUrl, isLocal } from './photos.js';

const ON_SITE = s => s === 'ready' || s === 'sold';

function download(name, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/javascript' }));
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export default function PublishButton({ drops, pieces, meter }) {
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const { mutateAsync: update } = useUpdate();
  const invalidate = useInvalidate();
  const live = (drops || []).find(d => d.status === 'live');
  const onSite = live ? pieces.filter(p => String(p.drop_id) === String(live.id) && ON_SITE(p.status)) : [];
  if (!live || !onSite.length) {
    return <><button className="btn" disabled>Publish to site</button><span className="note">No Ready pieces yet</span></>;
  }

  const publish = async () => {
    setMsg(null);
    if (!meter) return setMsg({ text: 'Still measuring the titles. Wait a moment, then press again.' });
    const bad = onSite.map(p => {
      const problems = [...missingFields(p).map(f => f + ' missing'), ...checkCached(meter, titlesOf(p)).problems];
      if (!(p.views || []).length) problems.push('no photo');
      return problems.length ? { p, problems } : null;
    }).filter(Boolean);
    if (bad.length) return setMsg({ bad });
    const pastIds = new Set(drops.filter(d => d.status === 'past').map(d => String(d.id)));
    const shown = pieces.filter(p => ON_SITE(p.status) && (String(p.drop_id) === String(live.id) || pastIds.has(String(p.drop_id))));
    if (MODE === 'local' && shown.some(p => (p.views || []).some(v => isLocal(v.img) || isLocal(v.full) || isLocal(v.zoom)))) {
      return setMsg({ text: 'Photos added in local mode stay in this browser, so they cannot be published yet. They can once the database is connected (the last setup step).' });
    }
    if (onSite.length > PALETTE.length) return setMsg({ text: 'The live drop has more pieces than stamp inks (' + PALETTE.length + '). Move a piece to another drop.' });
    setBusy(true);
    try {
      // stamp colors by the rule, over the whole live drop
      const palette = paletteFor(live);                                   // neutral inks for a jewelry drop
      const scores = await Promise.all(onSite.map(async p => scoresForImage(await photoUrl(p.views[0].img), palette)));
      const pick = assignInks(scores, palette);
      const colored = onSite.map((p, i) => ({ ...p, bg: pick[i].bg, ink: pick[i].ink }));
      for (let i = 0; i < onSite.length; i++) {
        const p = onSite[i], to = pick[i];
        if (p.bg !== to.bg || (p.ink || null) !== (to.ink || null))
          await update({ resource: 'pieces', id: p.id, values: { bg: to.bg, ink: to.ink || null }, successNotification: false });
      }
      await invalidate({ resource: 'pieces', invalidates: ['list'] });
      const livePieces = pieces.filter(p => String(p.drop_id) === String(live.id)).map(p => colored.find(c => c.id === p.id) || p);
      if (MODE === 'local') {
        download('current.js', currentJs(live, livePieces));
        await new Promise(r => setTimeout(r, 400));
        download('past.js', pastJs(live, drops, pieces));
        return setMsg({ text: 'Replace data/current.js and data/past.js with these two files and commit them to publish' });
      }
      const r = await fetch('/api/publish', { method: 'POST', headers: { ...(await authHeader()) } });
      const body = await r.json().catch(() => ({}));
      if (r.ok && body.ok) setMsg({ text: 'Published. The site updates in about a minute.' });
      else if (body.error === 'no-hook') setMsg({ text: 'Publishing is not set up yet (the last setup step)' });
      else if (body.error === 'sign-in') setMsg({ text: 'Please sign in again' });
      else setMsg({ text: 'Could not publish' });
    } catch (e) {
      setMsg({ text: 'Could not publish: ' + (e && e.message || e) });
    } finally { setBusy(false); }
  };

  return (
    <>
      <button className="btn" onClick={publish} disabled={busy}>{busy ? 'Publishing…' : 'Publish to site'}</button>
      {msg && (
        <div className="publish-msg" data-testid="publish-msg" style={{ flexBasis: '100%' }}>
          {msg.text}
          {msg.bad && <>
            <span className="err">Not published. Fix these pieces first:</span>
            <ul>{msg.bad.map(({ p, problems }) => <li key={p.id}><Link to={'/pieces/' + p.id}>{p.cap_ja || p.name_ja || '(untitled)'}</Link>: {problems.join('; ')}</li>)}</ul>
          </>}
        </div>
      )}
    </>
  );
}
