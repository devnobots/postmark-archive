// Standard Gauge back office: the piece editor (/pieces/:id and /pieces/new).
// Form on the left (or the 入力 tab on a phone), live preview on the right (or the プレビュー tab).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useList, useOne, useCreate, useUpdate, useInvalidate } from '@refinedev/core';
import { useForm, useWatch, useFieldArray } from 'react-hook-form';
import { useNavigate, useParams, Link } from 'react-router';
import { sizeLine, toSiteItem } from './lib/site-data.mjs';
import { STATES, INKS, STATUS_LABEL, today, yenText, missingFields, slug, loadSiteData } from './util.js';
import { openMeter } from './meter.js';
import Preview from './Preview.jsx';
import Fit from './Fit.jsx';

const FREE_TEXT = ['対応サイズ'];           // stored as typed (23–27 cm); every other measurement is a number in cm

export default function PieceEditor() {
  const { id } = useParams();
  const isNew = !id;
  const pieces = useList({ resource: 'pieces', pagination: { mode: 'off' }, sorters: [{ field: 'position', order: 'asc' }] });
  const drops = useList({ resource: 'drops', pagination: { mode: 'off' } });
  const cats = useList({ resource: 'categories', pagination: { mode: 'off' }, sorters: [{ field: 'sort', order: 'asc' }], meta: { idColumnName: 'code' } });
  const one = useOne({ resource: 'pieces', id, queryOptions: { enabled: !isNew } });
  const [site, setSite] = useState(null);
  useEffect(() => { loadSiteData().then(setSite).catch(() => setSite({ items: [] })); }, []);

  const loading = pieces.query.isLoading || drops.query.isLoading || cats.query.isLoading || (!isNew && one.query.isLoading) || !site;
  if (loading) return <p className="empty">読み込んでいます…</p>;
  if (!isNew && !one.result) return <p className="empty">このピースは見つかりません。<Link to="/">一覧へ</Link></p>;
  const live = (drops.result.data || []).find(d => d.status === 'live');
  return <EditorForm key={id || 'new'} piece={isNew ? null : one.result} pieces={pieces.result.data || []}
    live={live} categories={cats.result.data || []} site={site} />;
}

// ---------- form <-> database ----------
function toForm(p, categories) {
  const cat = categories.find(c => c.code === p.category);
  const meas = (p.measurements || []).map(([label, value]) => ({ label, value: FREE_TEXT.includes(label) ? String(value || '') : String(value || '').replace(/\s*cm$/, '') }));
  const auto = !p.size_line || p.size_line === sizeLine(p.measurements, cat ? cat.size_line : []);
  return {
    category: p.category || '', name_ja: p.name_ja || '', name_en: p.name_en || '', cap_ja: p.cap_ja || '',
    meas, size_line: p.size_line || '', size_auto: auto,
    price: p.price_jpy ? String(p.price_jpy) : '', grade: p.grade || '', grade_note: p.grade_note || '',
    found_city: p.found_city || '', found_state: p.found_state || '', found_on: p.found_on || today(),
    bg: p.bg || '#EFE3C8', ink: p.ink || null, views: p.views || [], status: p.status || 'draft',
  };
}

export function measurementsOf(meas) {
  return (meas || []).filter(r => String(r.label || '').trim()).map(r => {
    const v = String(r.value || '').trim();
    return [r.label.trim(), !v ? '' : FREE_TEXT.includes(r.label) || /cm$/.test(v) ? v : v + ' cm'];
  });
}

function toRow(v) {
  const digits = String(v.price || '').replace(/[^0-9]/g, '');
  return {
    category: v.category || null, name_ja: v.name_ja.trim(), name_en: v.name_en.trim(), cap_ja: v.cap_ja.trim(),
    measurements: measurementsOf(v.meas), size_line: v.size_line.trim(),
    price_jpy: digits && Number(digits) > 0 ? Number(digits) : null,
    grade: v.grade || null, grade_note: v.grade_note.trim(),
    found_city: v.found_city.trim().toUpperCase(), found_state: v.found_state || '', found_on: v.found_on || null,
    bg: v.bg, ink: v.ink || null, views: v.views || [], status: v.status,
  };
}

function EditorForm({ piece, pieces, live, categories, site }) {
  const navigate = useNavigate();
  const invalidate = useInvalidate();
  const { mutateAsync: create } = useCreate();
  const { mutateAsync: update } = useUpdate();
  const form = useForm({ defaultValues: toForm(piece || {}, categories) });
  const { register, control, setValue, getValues, handleSubmit, reset, formState } = form;
  const meas = useFieldArray({ control, name: 'meas' });
  const v = useWatch({ control });
  const cat = categories.find(c => c.code === v.category);
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [fit, setFit] = useState(null);                 // the latest C5 result for the current titles
  const [tab, setTab] = useState('form');
  const wide = useWide();
  const sold = piece && piece.status === 'sold';

  // ---------- the title meter opens before the preview frames (C5) ----------
  const [meter, setMeter] = useState(null);
  useEffect(() => {
    const livePieces = pieces.filter(p => live && String(p.drop_id) === String(live.id));
    const sample = (piece && piece.name_en ? piece : null) || livePieces.find(p => p.name_en) || pieces.find(p => p.name_en);
    if (!sample) { setMeter('none'); return; }
    let m = null, gone = false;
    openMeter(sample, live).then(x => { m = x; if (gone) x.close(); else setMeter(x); }).catch(() => setMeter('none'));
    return () => { gone = true; if (m) m.close(); };
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  // category change: rebuild the measurement rows, keeping values whose label already exists
  const prevCat = useRef(v.category);
  useEffect(() => {
    if (prevCat.current === v.category) return;
    prevCat.current = v.category;
    if (!cat) return;
    const old = getValues('meas');
    meas.replace(cat.measurements.map(label => ({ label, value: (old.find(r => r.label === label) || {}).value || '' })));
  }, [v.category]);   // eslint-disable-line react-hooks/exhaustive-deps

  // サイズ表記 follows the measurements while 自動 is on
  const autoLine = sizeLine(measurementsOf(v.meas), cat ? cat.size_line : []);
  useEffect(() => {
    if (v.size_auto && getValues('size_line') !== autoLine) setValue('size_line', autoLine, { shouldDirty: true });
  }, [v.size_auto, autoLine]);   // eslint-disable-line react-hooks/exhaustive-deps

  const row = toRow({ ...getValues(), ...v });
  const missing = missingFields(row);
  const fitOk = !fit || fit.ok;
  const canBeReady = missing.length === 0 && fitOk;
  const mySlug = slug(v.name_en);
  const dupe = mySlug && pieces.some(p => (!piece || p.id !== piece.id) && String(p.drop_id) === String(piece ? piece.drop_id : live && live.id) && slug(p.name_en) === mySlug);

  // ---------- save ----------
  const onSave = useCallback(async values => {
    const data = toRow(values);
    if (data.status === 'ready' && !(missingFields(data).length === 0 && fitOk)) {
      setMsg({ bad: true, text: '完成にするには、足りない項目を入れてください' });
      return;
    }
    if (String(values.price || '').trim() && !data.price_jpy) { setMsg({ bad: true, text: '価格は1円以上の数字で入れてください' }); return; }
    setSaving(true); setMsg(null);
    try {
      if (piece) {
        await update({ resource: 'pieces', id: piece.id, values: data, successNotification: false });
        reset(values);
      } else {
        const inDrop = pieces.filter(p => live && String(p.drop_id) === String(live.id));
        const position = inDrop.reduce((m, p) => Math.max(m, p.position || 0), 0) + 1;
        const r = await create({ resource: 'pieces', values: { ...data, drop_id: live ? live.id : null, position }, successNotification: false });
        reset(values);
        navigate('/pieces/' + r.data.id, { replace: true });
      }
      await invalidate({ resource: 'pieces', invalidates: ['list', 'detail'] });
      setMsg({ text: '保存しました' });
    } catch (e) {
      setMsg({ bad: true, text: '保存できませんでした：' + (e && e.message || e) });
    } finally { setSaving(false); }
  }, [piece, pieces, live, fitOk]);   // eslint-disable-line react-hooks/exhaustive-deps
  const submit = handleSubmit(onSave);

  // Ctrl/Cmd+S saves; leaving with unsaved changes asks first
  const dirty = formState.isDirty;
  useEffect(() => {
    const key = e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); submit(); } };
    const leave = e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
    const click = e => {
      const a = e.target.closest && e.target.closest('a[href]');
      if (!dirty || !a || a.target === '_blank' || a.closest('.preview')) return;
      if (!window.confirm('保存していない変更があります。このページを離れますか？')) { e.preventDefault(); e.stopPropagation(); }
    };
    window.addEventListener('keydown', key);
    window.addEventListener('beforeunload', leave);
    document.addEventListener('click', click, true);
    return () => { window.removeEventListener('keydown', key); window.removeEventListener('beforeunload', leave); document.removeEventListener('click', click, true); };
  }, [dirty, submit]);

  // photo choices: every distinct view on the pieces and on the site today
  const photoChoices = useMemo(() => {
    const seen = new Map();
    for (const vw of [...pieces.flatMap(p => p.views || []), ...(site.items || []).flatMap(d => d.views || [])])
      if (vw && vw.img && !seen.has(vw.img)) seen.set(vw.img, vw);
    return [...seen.values()];
  }, [pieces, site]);
  const toggleView = vw => {
    const cur = getValues('views') || [];
    const has = cur.some(x => x.img === vw.img);
    setValue('views', has ? cur.filter(x => x.img !== vw.img) : [...cur, vw], { shouldDirty: true });
  };

  // ---------- preview data (C4) ----------
  const placeholderViews = !(v.views || []).length;
  const editedSite = useMemo(() => {
    const r = { ...row, status: sold ? 'sold' : row.status };
    if (placeholderViews) r.views = (pieces.find(p => (p.views || []).length) || { views: [] }).views;
    return toSiteItem(r, live);
  }, [JSON.stringify(row), placeholderViews]);   // eslint-disable-line react-hooks/exhaustive-deps
  const previewItems = useMemo(() => {
    const inLive = pieces.filter(p => live && String(p.drop_id) === String(live.id) && p.status !== 'draft').sort((a, b) => a.position - b.position);
    const items = inLive.map(p => (piece && p.id === piece.id ? editedSite : toSiteItem(p, live)));
    if (!piece || !inLive.some(p => p.id === piece.id)) items.push(editedSite);
    return items;
  }, [pieces, editedSite]);   // eslint-disable-line react-hooks/exhaustive-deps

  const lastWord = String(v.name_ja || '').trim().split(' ').pop() || '';
  const formPane = (
    <form className="form" onSubmit={e => { e.preventDefault(); submit(); }} noValidate>
      <div className="field">
        <label htmlFor="f-cat">カテゴリ</label>
        <select id="f-cat" {...register('category')}>
          <option value="">選んでください</option>
          {categories.map(c => <option key={c.code} value={c.code}>{c.label_ja}</option>)}
        </select>
      </div>

      <div className="field">
        <label htmlFor="f-ja">日本語タイトル</label>
        <input id="f-ja" {...register('name_ja')} autoComplete="off" />
        <Fit meter={meter} values={{ nameJa: v.name_ja, nameEn: v.name_en, capJa: v.cap_ja }} category={v.category}
          onResult={setFit} setField={(name, val) => setValue(name, val, { shouldDirty: true })} />
      </div>

      <div className="field">
        <label htmlFor="f-en">英語タイトル</label>
        <input id="f-en" {...register('name_en')} autoComplete="off" />
        <div className="slug">{mySlug ? 'サイトのアドレス：#' + mySlug : 'アドレスは英語タイトルから作られます'}</div>
        {dupe && <p className="err">同じアドレスのピースがあります</p>}
      </div>

      <div className="field">
        <label htmlFor="f-cap">切手ラベル（空なら日本語タイトル）</label>
        <input id="f-cap" {...register('cap_ja')} placeholder={lastWord} autoComplete="off" />
      </div>

      <div className="field">
        <h3>寸法</h3>
        {meas.fields.map((f, i) => (
          <div className="meas-row" key={f.id}>
            {f.custom ? <input aria-label="寸法の名前" {...register(`meas.${i}.label`)} placeholder="名前" />
              : <span className="lbl">{f.label}</span>}
            <span className="unit">
              <input aria-label={(v.meas && v.meas[i] && v.meas[i].label) || '寸法'} {...register(`meas.${i}.value`)}
                inputMode={FREE_TEXT.includes(f.label) ? 'text' : 'decimal'} autoComplete="off" />
              {!FREE_TEXT.includes(f.label) && <span>cm</span>}
            </span>
            <button type="button" className="x" aria-label="この寸法を消す" onClick={() => meas.remove(i)}>×</button>
          </div>
        ))}
        <button type="button" className="btn small" onClick={() => meas.append({ label: '', value: '', custom: true })}>＋ 寸法を追加</button>
      </div>

      <div className="field">
        <label htmlFor="f-size">サイズ表記</label>
        <div className="inline">
          <input id="f-size" {...register('size_line')} readOnly={v.size_auto} />
          <button type="button" className={'btn small auto' + (v.size_auto ? ' on' : '')} aria-pressed={!!v.size_auto}
            onClick={() => setValue('size_auto', !v.size_auto, { shouldDirty: true })}>自動</button>
        </div>
      </div>

      <div className="field">
        <label htmlFor="f-price">価格（円）</label>
        <div className="inline">
          <input id="f-price" {...register('price', { onChange: e => setValue('price', e.target.value.replace(/[^0-9]/g, '')) })}
            inputMode="numeric" autoComplete="off" />
          <span className="price-show">{yenText(row.price_jpy)}</span>
        </div>
      </div>

      <div className="field">
        <h3>状態ランク</h3>
        <div className="grades" role="group" aria-label="状態ランク">
          {['A', 'B', 'C'].map(g => <button type="button" key={g} className={v.grade === g ? 'on' : ''} aria-pressed={v.grade === g}
            onClick={() => setValue('grade', g, { shouldDirty: true })}>{g}</button>)}
        </div>
        <input aria-label="状態メモ" {...register('grade_note')} placeholder="例：袖リブにほつれ" autoComplete="off" />
      </div>

      <div className="field">
        <h3>発見地</h3>
        <div className="row3">
          <input aria-label="町" {...register('found_city')} placeholder="TUCSON" style={{ textTransform: 'uppercase' }} autoComplete="off" />
          <select aria-label="州" {...register('found_state')}>
            <option value="">州</option>
            {STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <input aria-label="発見日" type="date" {...register('found_on')} style={{ marginTop: 8 }} />
      </div>

      <div className="field">
        <h3>切手の色</h3>
        <div className="inks">
          {INKS.map(k => <button type="button" key={k.hex} title={k.name} aria-label={k.name} className={v.bg === k.hex ? 'on' : ''}
            style={{ background: k.hex }} onClick={() => { setValue('bg', k.hex, { shouldDirty: true }); setValue('ink', k.ink || null, { shouldDirty: true }); }} />)}
        </div>
      </div>

      <div className="field">
        <h3>写真（今サイトにある写真から選ぶ）</h3>
        <div className="photos">
          {photoChoices.map(vw => {
            const n = (v.views || []).findIndex(x => x.img === vw.img);
            return <button type="button" key={vw.img} className={n >= 0 ? 'on' : ''} aria-pressed={n >= 0} onClick={() => toggleView(vw)}>
              <img src={'/' + vw.img} alt="" loading="lazy" />{n >= 0 && <b>{n + 1}</b>}</button>;
          })}
        </div>
        {placeholderViews && <p className="note">写真が未選択です（プレビューでは仮の写真を使います）</p>}
      </div>

      <div className="field">
        <h3>状態</h3>
        {sold ? <p>売約済（売約は第3段階で設定します）</p> : (
          <div className="status-seg" role="group" aria-label="状態">
            {['draft', 'ready'].map(s => <button type="button" key={s} className={v.status === s ? 'on' : ''} aria-pressed={v.status === s}
              onClick={() => setValue('status', s, { shouldDirty: true })}>{STATUS_LABEL[s]}</button>)}
          </div>
        )}
      </div>
    </form>
  );

  const previewPane = (
    <Preview items={previewItems} drop={live} slug={slug(editedSite.nameEn)} ready={meter !== null} visible={wide || tab === 'preview'}
      placeholderPhoto={placeholderViews} />
  );

  return (
    <main className={'editor' + (wide ? ' wide' : '')}>
      <div className="tabs" role="tablist">
        <button role="tab" type="button" className={tab === 'form' ? 'on' : ''} aria-selected={tab === 'form'} onClick={() => setTab('form')}>入力</button>
        <button role="tab" type="button" className={tab === 'preview' ? 'on' : ''} aria-selected={tab === 'preview'} onClick={() => setTab('preview')}>プレビュー</button>
      </div>
      <div style={{ display: wide || tab === 'form' ? 'block' : 'none', minWidth: 0 }}>{formPane}</div>
      <div style={{ display: wide || tab === 'preview' ? 'block' : 'none', minWidth: 0 }}>{previewPane}</div>
      <div className="savebar">
        <div className="state" data-testid="save-state">
          {msg ? <span className={msg.bad ? 'bad' : ''}>{msg.text}</span> : dirty ? '未保存の変更があります' : piece ? '保存済み' : '新しいピース'}
          {v.status === 'ready' && !canBeReady && (
            <div className="bad">完成に必要：{[...missing, ...(fitOk ? [] : ['タイトルを短く'])].join('・')}</div>
          )}
        </div>
        <Link className="btn small" to="/" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>一覧</Link>
        <button type="button" className="btn primary" onClick={submit} disabled={saving}>保存</button>
      </div>
    </main>
  );
}

function useWide() {
  const q = '(min-width: 1000px)';
  const [wide, setWide] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q), on = () => setWide(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return wide;
}
