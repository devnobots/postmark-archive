// Standard Gauge back office: title fit checks (measured in the real site) and shorter title ideas.
import { useEffect, useRef, useState } from 'react';
import { LIMITS } from './lib/measure.mjs';
import { authHeader } from './config.js';

const mark = ok => (ok ? ' ✓' : ' ✗');

export default function Fit({ meter, values, category, onResult, setField }) {
  const [res, setRes] = useState(null);
  const [ideas, setIdeas] = useState(null);        // { ja: [], en: [], cap: [] } that passed, or { message }
  const [asking, setAsking] = useState(false);
  const ready = meter && meter !== 'none';
  const { nameJa = '', nameEn = '', capJa = '' } = values;

  // measure about 150 ms after any title field changes
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      const r = nameJa.trim() ? meter.check({ nameJa, nameEn, capJa }) : null;
      setRes(r);
      onResult(r);
    }, 150);
    return () => clearTimeout(t);
  }, [ready, nameJa, nameEn, capJa]);   // eslint-disable-line react-hooks/exhaustive-deps

  // the stamp label's own idea: the title's last word, when it fits the stamp
  const lastWord = nameJa.trim().split(' ').pop() || '';
  const labelIdea = useRef(null);
  if (ready && res && !capJa.trim() && lastWord && lastWord !== nameJa.trim()) {
    labelIdea.current = meter.check({ nameJa, nameEn, capJa: lastWord }).parts.cap ? lastWord : null;
  } else labelIdea.current = null;

  const ask = async () => {
    setAsking(true); setIdeas(null);
    try {
      const era = (nameJa.match(/^\S*年代/) || [''])[0];
      const r = await fetch('/api/suggest-titles', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify({ nameJa, nameEn, capJa, problems: res ? res.problems : [], facts: { category, era } }),
      });
      const body = await r.json().catch(() => ({}));
      if (body.error === 'no-key') return setIdeas({ message: 'タイトル案は Anthropic のキー設定後に使えます（最後の手順）' });
      if (body.error === 'sign-in') return setIdeas({ message: 'もう一度ログインしてください' });
      if (!r.ok || body.error) return setIdeas({ message: 'タイトル案を取得できませんでした' });
      // measure every idea in the real site; each kind is judged only by its own part of the result
      const byLen = (a, b) => [...a].length - [...b].length;
      const ja = (body.ja || []).filter(t => meter.check({ nameJa: t, nameEn, capJa }).parts.ja).sort(byLen);
      const en = (body.en || []).filter(t => meter.check({ nameJa, nameEn: t, capJa }).parts.en).sort(byLen);
      const cap = (body.cap || []).filter(t => meter.check({ nameJa, nameEn, capJa: t }).parts.cap).sort(byLen);
      meter.check({ nameJa, nameEn, capJa });     // put the current texts back in the meter
      if (!ja.length && !en.length && !cap.length) return setIdeas({ message: '収まる案がありませんでした。もう一度試すか、手で短くしてください' });
      setIdeas({ ja, en, cap });
    } catch (e) {
      setIdeas({ message: 'タイトル案を取得できませんでした' });
    } finally { setAsking(false); }
  };

  if (!ready) return meter === 'none' ? null : <div className="fit">測っています…</div>;
  if (!res) return null;
  const d = res.detail;
  const phone = Math.max(d.p320TitleLines || 0, d.p375TitleLines || 0);
  const use = (field, text) => { setField(field, text); setIdeas(null); };
  return (
    <div className="fit" data-testid="fit">
      <div data-testid="fit-line">
        <span className={phone > LIMITS.phoneTitleLines ? 'bad' : ''}>スマホ {phone}行{mark(phone <= LIMITS.phoneTitleLines)}</span>{' · '}
        <span className={d.deskTitleLines > LIMITS.desktopTitleLines ? 'bad' : ''}>デスクトップ {d.deskTitleLines}行{mark(d.deskTitleLines <= LIMITS.desktopTitleLines)}</span>{' · '}
        <span className={d.p375EnLines > LIMITS.phoneEnLines ? 'bad' : ''}>英語 {d.p375EnLines}行{mark(d.p375EnLines <= LIMITS.phoneEnLines)}</span>{' · '}
        <span className={d.labelCut ? 'bad' : ''}>ラベル{mark(!d.labelCut)}</span>
      </div>
      {res.problems.length > 0 && <ul data-testid="fit-problems">{res.problems.map(p => <li key={p}>{p}</li>)}</ul>}
      {labelIdea.current && (
        <div className="idea"><span>ラベル案：{labelIdea.current}</span>
          <button type="button" className="btn small" onClick={() => use('cap_ja', labelIdea.current)}>使う</button></div>
      )}
      {res.problems.length > 0
        ? <button type="button" className="btn small" style={{ marginTop: 6 }} onClick={ask} disabled={asking}>{asking ? '考えています…' : '短い案を出す'}</button>
        : <button type="button" className="link" onClick={ask} disabled={asking}>{asking ? '考えています…' : '短い案を出す'}</button>}
      {ideas && ideas.message && <p className="note" data-testid="ideas-message">{ideas.message}</p>}
      {ideas && !ideas.message && (
        <div className="ideas" data-testid="ideas">
          {[['ja', 'name_ja', '日本語タイトル'], ['en', 'name_en', '英語タイトル'], ['cap', 'cap_ja', '切手ラベル']].map(([k, field, head]) =>
            ideas[k].length > 0 && (
              <div key={k}>
                <div className="idea-head">{head}</div>
                {ideas[k].map(t => (
                  <div className="idea" key={t} data-testid={'idea-' + k}><span>{t}</span>
                    <button type="button" className="btn small" onClick={() => use(field, t)}>使う</button></div>
                ))}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
