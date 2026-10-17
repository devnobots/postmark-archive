// Standard Gauge back office: サイトに公開. Checks every 完成 and 売約済 piece of the live drop first.
// Supabase mode asks the host to rebuild; local mode downloads the new data/current.js.
import { useState } from 'react';
import { Link } from 'react-router';
import { currentJs } from './lib/site-data.mjs';
import { MODE, authHeader } from './config.js';
import { missingFields } from './util.js';
import { checkCached, titlesOf } from './meter.js';

export default function PublishButton({ live, pieces, meter }) {
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const onSite = pieces.filter(p => p.status === 'ready' || p.status === 'sold');
  if (!live || !onSite.length) {
    return <><button className="btn" disabled>サイトに公開</button><span className="note">完成したピースがありません</span></>;
  }

  const publish = async () => {
    setMsg(null);
    if (!meter) return setMsg({ text: 'タイトルを測っています。少し待ってからもう一度押してください' });
    const bad = onSite.map(p => {
      const problems = [...missingFields(p).map(f => f + 'がありません'), ...checkCached(meter, titlesOf(p)).problems];
      return problems.length ? { p, problems } : null;
    }).filter(Boolean);
    if (bad.length) return setMsg({ bad });
    setBusy(true);
    try {
      if (MODE === 'local') {
        const blob = new Blob([currentJs(live, pieces)], { type: 'text/javascript' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'current.js';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        return setMsg({ text: 'この current.js で data/current.js を置き換えてコミットすると公開されます' });
      }
      const r = await fetch('/api/publish', { method: 'POST', headers: { ...(await authHeader()) } });
      const body = await r.json().catch(() => ({}));
      if (r.ok && body.ok) setMsg({ text: '公開しました。約1分でサイトに反映されます' });
      else if (body.error === 'no-hook') setMsg({ text: '公開の設定がまだです（最後の手順）' });
      else if (body.error === 'sign-in') setMsg({ text: 'もう一度ログインしてください' });
      else setMsg({ text: '公開できませんでした' });
    } finally { setBusy(false); }
  };

  return (
    <>
      <button className="btn" onClick={publish} disabled={busy}>サイトに公開</button>
      {msg && (
        <div className="publish-msg" data-testid="publish-msg" style={{ flexBasis: '100%' }}>
          {msg.text}
          {msg.bad && <>
            <span className="err">公開できません。次のピースを直してください：</span>
            <ul>{msg.bad.map(({ p, problems }) => <li key={p.id}><Link to={'/pieces/' + p.id}>{p.cap_ja || p.name_ja || '（無題）'}</Link>：{problems.join('・')}</li>)}</ul>
          </>}
        </div>
      )}
    </>
  );
}
