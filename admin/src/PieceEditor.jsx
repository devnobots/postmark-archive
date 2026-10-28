// Postmark Archive back office: the piece editor (/pieces/:id and /pieces/new).
// Form on the left (or the Edit tab on a phone), live preview on the right (or the Preview tab).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useList, useOne, useCreate, useUpdate, useDelete, useInvalidate } from '@refinedev/core';
import { useForm, useWatch, useFieldArray } from 'react-hook-form';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router';
import { sizeLine, toSiteItem } from './lib/site-data.mjs';
import { scoresForImage, assignInks, PALETTE, NEUTRAL_PALETTE, paletteFor } from './lib/colors.mjs';
import { STATES, STATUS_LABEL, CATEGORY_EN, MEAS_EN, today, yenText, missingFields, slug, loadSiteData, dropName } from './util.js';
import { openMeter } from './meter.js';
import { photoUrl, resolveViews } from './photos.js';
import Preview from './Preview.jsx';
import Fit from './Fit.jsx';
import PhotoPanel from './PhotoPanel.jsx';
import HistoryPanel from './HistoryPanel.jsx';

const FREE_TEXT = ['対応サイズ'];           // stored as typed (23–27 cm); every other measurement is a number in cm
const ON_SITE = s => s === 'ready' || s === 'sold';

export default function PieceEditor() {
  const { id } = useParams();
  const isNew = !id;
  const pieces = useList({ resource: 'pieces', pagination: { mode: 'off' }, sorters: [{ field: 'position', order: 'asc' }] });
  const drops = useList({ resource: 'drops', pagination: { mode: 'off' } });
  const cats = useList({ resource: 'categories', pagination: { mode: 'off' }, sorters: [{ field: 'sort', order: 'asc' }], meta: { idColumnName: 'code' } });
  const one = useOne({ resource: 'pieces', id, queryOptions: { enabled: !isNew } });
  const [site, setSite] = useState(null);
  const [gen, setGen] = useState(0);                   // bumped after a restore, to reload the form
  useEffect(() => { loadSiteData().then(setSite).catch(() => setSite({ items: [] })); }, []);

  const loading = pieces.query.isLoading || drops.query.isLoading || cats.query.isLoading || (!isNew && one.query.isLoading) || !site;
  if (loading) return <p className="empty">Loading…</p>;
  if (!isNew && !one.result) return <p className="empty">This piece was not found. <Link to="/">Back to the list</Link></p>;
  return <EditorForm key={(id || 'new') + ':' + gen} piece={isNew ? null : one.result} pieces={pieces.result.data || []}
    drops={drops.result.data || []} categories={cats.result.data || []} site={site}
    reload={async () => { await one.query.refetch(); await pieces.query.refetch(); setGen(g => g + 1); }} />;
}

// ---------- form <-> database ----------
function toForm(p, categories, dropId) {
  const cat = categories.find(c => c.code === p.category);
  const meas = (p.measurements || []).map(([label, value]) => ({ label, value: FREE_TEXT.includes(label) ? String(value || '') : String(value || '').replace(/\s*cm$/, '') }));
  const auto = !p.size_line || p.size_line === sizeLine(p.measurements, cat ? cat.size_line : []);
  return {
    category: p.category || '', name_ja: p.name_ja || '', name_en: p.name_en || '', cap_ja: p.cap_ja || '',
    meas, size_line: p.size_line || '', size_auto: auto,
    price: p.price_jpy ? String(p.price_jpy) : '', grade: p.grade || '', grade_note: p.grade_note || '',
    found_city: p.found_city || '', found_state: p.found_state || '', found_on: p.found_on || today(),
    views: p.views || [], status: p.status || 'draft', drop_id: p.drop_id != null ? String(p.drop_id) : String(dropId || ''),
    owner_kind: p.owner_handle ? 'handle' : 'private', owner_handle: p.owner_handle || '',
  };
}

export function measurementsOf(meas) {
  return (meas || []).filter(r => String(r.label || '').trim()).map(r => {
    const v = String(r.value || '').trim();
    return [r.label.trim(), !v ? '' : FREE_TEXT.includes(r.label) || /cm$/.test(v) ? v : v + ' cm'];
  });
}

// soldAt: the time to record when a piece becomes sold (only passed when saving; the preview must not change every moment)
function toRow(v, piece, soldAt = null) {
  const digits = String(v.price || '').replace(/[^0-9]/g, '');
  const sold = v.status === 'sold';
  const handle = sold && v.owner_kind === 'handle' ? String(v.owner_handle || '').trim().replace(/^@+/, '') : '';
  return {
    category: v.category || null, name_ja: v.name_ja.trim(), name_en: v.name_en.trim(), cap_ja: v.cap_ja.trim(),
    measurements: measurementsOf(v.meas), size_line: v.size_line.trim(),
    price_jpy: digits && Number(digits) > 0 ? Number(digits) : null,
    grade: v.grade || null, grade_note: v.grade_note.trim(),
    found_city: v.found_city.trim().toUpperCase(), found_state: v.found_state || '', found_on: v.found_on || null,
    views: v.views || [], status: v.status, drop_id: v.drop_id ? (/^\d+$/.test(v.drop_id) ? Number(v.drop_id) : v.drop_id) : null,
    owner_handle: handle,
    owner_demo: !!(piece && piece.owner_demo && handle && handle === piece.owner_handle),   // a made-up handle stays plain text
    sold_at: sold ? (piece && piece.sold_at) || soldAt : null,
  };
}

// ---------- the stamp color rule (same inks and scoring as tools/stamp_colors.py) ----------
// The edited piece and every other finished piece in its drop with a photo: each gets a different ink.
function useRuleColors(piece, views, pieces, dropId, palette = PALETTE) {
  const [rule, setRule] = useState(null);         // { mine, changes: [{ p, to }] } or { error }
  const others = pieces.filter(p => String(p.drop_id) === String(dropId) && ON_SITE(p.status) && (!piece || p.id !== piece.id) && (p.views || []).length);
  const first = views && views[0] && views[0].img;
  const key = JSON.stringify([palette[0][0], first, others.map(p => [p.id, p.views[0].img, p.bg])]);
  useEffect(() => {
    if (!first) { setRule(null); return; }
    if (others.length + 1 > PALETTE.length) { setRule({ error: 'This drop has more pieces than stamp inks (' + PALETTE.length + '). Move a piece to another drop.' }); return; }
    let live = true;
    const t = setTimeout(async () => {
      try {
        const all = [...others.map(p => p.views[0].img), first];
        const scores = await Promise.all(all.map(async img => scoresForImage(await photoUrl(img), palette)));
        const pick = assignInks(scores, palette);
        if (live) setRule({ mine: pick[pick.length - 1], changes: others.map((p, i) => ({ p, to: pick[i] })).filter(x => x.to.bg !== x.p.bg || (x.to.ink || null) !== (x.p.ink || null)) });
      } catch (e) { if (live) setRule({ error: 'The stamp photo could not be read for its colors.' }); }
    }, 250);
    return () => { live = false; clearTimeout(t); };
  }, [key]);   // eslint-disable-line react-hooks/exhaustive-deps
  return rule;
}

function EditorForm({ piece, pieces, drops, categories, site, reload }) {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const invalidate = useInvalidate();
  const { mutateAsync: create } = useCreate();
  const { mutateAsync: update } = useUpdate();
  const { mutateAsync: remove } = useDelete();
  const live = drops.find(d => d.status === 'live');
  const form = useForm({ defaultValues: toForm(piece || {}, categories, search.get('drop') || (live && live.id)) });
  const { register, control, setValue, getValues, handleSubmit, reset, formState } = form;
  const meas = useFieldArray({ control, name: 'meas' });
  const v = useWatch({ control });
  const cat = categories.find(c => c.code === v.category);
  const drop = drops.find(d => String(d.id) === String(v.drop_id)) || live;
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [fit, setFit] = useState(null);                 // the latest fit result for the current titles
  const [tab, setTab] = useState('form');
  const wide = useWide();
  const rule = useRuleColors(piece, v.views, pieces, v.drop_id, paletteFor(drops.find(d => String(d.id) === String(v.drop_id))));

  // ---------- the title meter opens before the preview frames ----------
  const [meter, setMeter] = useState(null);
  useEffect(() => {
    const inDrop = pieces.filter(p => live && String(p.drop_id) === String(live.id));
    const sample = (piece && piece.name_en ? piece : null) || inDrop.find(p => p.name_en) || pieces.find(p => p.name_en);
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

  // the size line follows the measurements while Auto is on
  const autoLine = sizeLine(measurementsOf(v.meas), cat ? cat.size_line : []);
  useEffect(() => {
    if (v.size_auto && getValues('size_line') !== autoLine) setValue('size_line', autoLine, { shouldDirty: true });
  }, [v.size_auto, autoLine]);   // eslint-disable-line react-hooks/exhaustive-deps

  const row = toRow({ ...getValues(), ...v }, piece);
  const color = rule && rule.mine ? rule.mine : { bg: (piece && piece.bg) || '#EFE3C8', ink: (piece && piece.ink) || null };
  const missing = missingFields(row);
  if (ON_SITE(row.status) && rule && rule.error) missing.push('a drop with room for it');
  if (row.status === 'sold' && v.owner_kind === 'handle' && !row.owner_handle) missing.push("buyer's Instagram handle");
  const fitOk = !fit || fit.ok;
  const canBeOnSite = missing.length === 0 && fitOk;
  const mySlug = slug(v.name_en);
  const dupe = mySlug && pieces.some(p => (!piece || p.id !== piece.id) && String(p.drop_id) === String(v.drop_id) && slug(p.name_en) === mySlug);

  // ---------- save ----------
  const onSave = useCallback(async values => {
    const data = { ...toRow(values, piece, new Date().toISOString()), bg: color.bg, ink: color.ink || null };
    if (ON_SITE(data.status) && !canBeOnSite) {
      setMsg({ bad: true, text: 'To mark it ' + STATUS_LABEL[data.status] + ', fill in what is missing' });
      return;
    }
    if (String(values.price || '').trim() && !data.price_jpy) { setMsg({ bad: true, text: 'Enter the price as a whole number of yen (1 or more)' }); return; }
    setSaving(true); setMsg(null);
    try {
      const moved = !piece || String(piece.drop_id) !== String(data.drop_id);
      if (moved) data.position = pieces.filter(p => String(p.drop_id) === String(data.drop_id)).reduce((m, p) => Math.max(m, p.position || 0), 0) + 1;
      let id = piece && piece.id;
      if (piece) await update({ resource: 'pieces', id, values: data, successNotification: false });
      else id = (await create({ resource: 'pieces', values: data, successNotification: false })).data.id;
      // the rule gives every finished piece in the drop a different ink: other pieces may change too
      const recolored = [];
      if (ON_SITE(data.status) && rule && rule.changes) {
        for (const { p, to } of rule.changes) {
          await update({ resource: 'pieces', id: p.id, values: { bg: to.bg, ink: to.ink || null }, successNotification: false });
          recolored.push((p.cap_ja || p.name_ja) + ' → ' + to.name);
        }
      }
      reset(values);
      await invalidate({ resource: 'pieces', invalidates: ['list', 'detail'] });
      await invalidate({ resource: 'piece_history', invalidates: ['list'] });
      setMsg({ text: 'Saved' + (recolored.length ? '. Stamp colors also updated by the rule: ' + recolored.join(', ') : '') });
      if (!piece) navigate('/pieces/' + id, { replace: true });
    } catch (e) {
      setMsg({ bad: true, text: 'Could not save: ' + (e && e.message || e) });
    } finally { setSaving(false); }
  }, [piece, pieces, canBeOnSite, color, rule]);   // eslint-disable-line react-hooks/exhaustive-deps
  const submit = handleSubmit(onSave);

  // Ctrl/Cmd+S saves; leaving with unsaved changes asks first
  const dirty = formState.isDirty;
  useEffect(() => {
    const key = e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); submit(); } };
    const leave = e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
    const click = e => {
      const a = e.target.closest && e.target.closest('a[href]');
      if (!dirty || !a || a.target === '_blank' || a.closest('.preview')) return;
      if (!window.confirm('You have unsaved changes. Leave this page anyway?')) { e.preventDefault(); e.stopPropagation(); }
    };
    window.addEventListener('keydown', key);
    window.addEventListener('beforeunload', leave);
    document.addEventListener('click', click, true);
    return () => { window.removeEventListener('keydown', key); window.removeEventListener('beforeunload', leave); document.removeEventListener('click', click, true); };
  }, [dirty, submit]);

  const deletePiece = async () => {
    if (!window.confirm('Delete this piece? You can restore it later from the list (Recently deleted).')) return;
    await remove({ resource: 'pieces', id: piece.id, successNotification: false });
    reset(getValues());
    await invalidate({ resource: 'pieces', invalidates: ['list'] });
    navigate('/');
  };

  // photos already on the site (site files and other pieces' photos)
  const photoChoices = useMemo(() => {
    const seen = new Map();
    for (const vw of [...pieces.flatMap(p => p.views || []), ...(site.items || []).flatMap(d => d.views || [])])
      if (vw && vw.img && !/^(local:|https?:)/.test(vw.img) && !seen.has(vw.img)) seen.set(vw.img, vw);
    return [...seen.values()];
  }, [pieces, site]);

  // ---------- preview data: the piece's drop as the homepage would show it ----------
  const placeholderViews = !(v.views || []).length;
  const editedSite = useMemo(() => {
    const r = { ...row, bg: color.bg, ink: color.ink };
    if (placeholderViews) r.views = (pieces.find(p => (p.views || []).length) || { views: [] }).views;
    return toSiteItem(r, { ...drop, status: 'live' });
  }, [JSON.stringify(row), JSON.stringify(color), placeholderViews]);   // eslint-disable-line react-hooks/exhaustive-deps
  const [previewItems, setPreviewItems] = useState(null);
  useEffect(() => {
    let alive = true;
    const inDrop = pieces.filter(p => drop && String(p.drop_id) === String(drop.id) && (ON_SITE(p.status) || (piece && p.id === piece.id))).sort((a, b) => a.position - b.position);
    const items = inDrop.map(p => (piece && p.id === piece.id ? editedSite : toSiteItem(p, { ...drop, status: 'live' })));
    if (!piece || !inDrop.some(p => p.id === piece.id)) items.push(editedSite);
    Promise.all(items.map(async d => ({ ...d, views: await resolveViews(d.views) }))).then(r => { if (alive) setPreviewItems(r); });
    return () => { alive = false; };
  }, [pieces, editedSite, drop && drop.id]);   // eslint-disable-line react-hooks/exhaustive-deps

  const lastWord = String(v.name_ja || '').trim().split(' ').pop() || '';
  const dropChoices = drops.filter(d => d.status !== 'past' || (piece && String(piece.drop_id) === String(d.id))).sort((a, b) => b.no - a.no);
  const inkName = ([...PALETTE, ...NEUTRAL_PALETTE].find(([, hex]) => hex === color.bg) || [''])[0];
  const formPane = (
    <form className="form" onSubmit={e => { e.preventDefault(); submit(); }} noValidate>
      <div className="field">
        <label htmlFor="f-drop">Drop</label>
        <select id="f-drop" {...register('drop_id')}>
          {dropChoices.map(d => <option key={d.id} value={String(d.id)}>{dropName(d)}</option>)}
        </select>
      </div>

      <div className="field">
        <label htmlFor="f-cat">Category</label>
        <select id="f-cat" {...register('category')}>
          <option value="">Choose…</option>
          {categories.map(c => <option key={c.code} value={c.code}>{CATEGORY_EN[c.code] || c.label_ja}</option>)}
        </select>
      </div>

      <div className="field">
        <label htmlFor="f-ja">Japanese title (shown to shoppers)</label>
        <input id="f-ja" {...register('name_ja')} autoComplete="off" />
        <Fit meter={meter} values={{ nameJa: v.name_ja, nameEn: v.name_en, capJa: v.cap_ja }} category={v.category}
          onResult={setFit} setField={(name, val) => setValue(name, val, { shouldDirty: true })} />
      </div>

      <div className="field">
        <label htmlFor="f-en">English title (also makes the page address)</label>
        <input id="f-en" {...register('name_en')} autoComplete="off" />
        <div className="slug">{mySlug ? 'Address on the site: #' + mySlug : 'The address is made from the English title'}</div>
        {dupe && <p className="err">Another piece already has this address</p>}
      </div>

      <div className="field">
        <label htmlFor="f-cap">Stamp label, Japanese (empty = the Japanese title)</label>
        <input id="f-cap" {...register('cap_ja')} placeholder={lastWord} autoComplete="off" />
      </div>

      <div className="field">
        <h3>Photos</h3>
        <PhotoPanel views={v.views || []} stampColor={color.bg} choices={photoChoices}
          onChange={views => setValue('views', views, { shouldDirty: true })} />
        {placeholderViews && <p className="note">No photo yet (the preview uses a stand-in photo)</p>}
      </div>

      <div className="field">
        <h3>Stamp color</h3>
        <div className="rule-color" data-testid="rule-color" data-bg={color.bg}>
          <span className="swatch" style={{ background: color.bg }} />
          <span>{rule && rule.mine ? inkName + ' — set by the color rule from the stamp photo' : placeholderViews ? 'Set by the color rule once there is a photo' : rule && rule.error ? '' : 'Working it out…'}</span>
        </div>
        {rule && rule.error && <p className="err">{rule.error}</p>}
        {rule && rule.changes && rule.changes.length > 0 && ON_SITE(v.status) &&
          <p className="note">Saving also changes: {rule.changes.map(({ p, to }) => (p.cap_ja || p.name_ja) + ' → ' + to.name).join(', ')}</p>}
      </div>

      <div className="field">
        <h3>Measurements</h3>
        {meas.fields.map((f, i) => (
          <div className="meas-row" key={f.id}>
            {f.custom ? <input aria-label="Measurement name (Japanese)" {...register(`meas.${i}.label`)} placeholder="Name (Japanese)" />
              : <span className="lbl">{f.label}{MEAS_EN[f.label] && <small> · {MEAS_EN[f.label]}</small>}</span>}
            <span className="unit">
              <input aria-label={(v.meas && v.meas[i] && v.meas[i].label) || 'Measurement'} {...register(`meas.${i}.value`)}
                inputMode={FREE_TEXT.includes(f.label) ? 'text' : 'decimal'} autoComplete="off" />
              {!FREE_TEXT.includes(f.label) && <span>cm</span>}
            </span>
            <button type="button" className="x" aria-label="Remove this measurement" onClick={() => meas.remove(i)}>×</button>
          </div>
        ))}
        <button type="button" className="btn small" onClick={() => meas.append({ label: '', value: '', custom: true })}>+ Add a measurement</button>
      </div>

      <div className="field">
        <label htmlFor="f-size">Size line on the stamp</label>
        <div className="inline">
          <input id="f-size" {...register('size_line')} readOnly={v.size_auto} />
          <button type="button" className={'btn small auto' + (v.size_auto ? ' on' : '')} aria-pressed={!!v.size_auto}
            onClick={() => setValue('size_auto', !v.size_auto, { shouldDirty: true })}>Auto</button>
        </div>
      </div>

      <div className="field">
        <label htmlFor="f-price">Price (yen)</label>
        <div className="inline">
          <input id="f-price" {...register('price', { onChange: e => setValue('price', e.target.value.replace(/[^0-9]/g, '')) })}
            inputMode="numeric" autoComplete="off" />
          <span className="price-show">{yenText(row.price_jpy)}</span>
        </div>
      </div>

      <div className="field">
        <h3>Condition grade</h3>
        <div className="grades" role="group" aria-label="Condition grade">
          {['A', 'B', 'C'].map(g => <button type="button" key={g} className={v.grade === g ? 'on' : ''} aria-pressed={v.grade === g}
            onClick={() => setValue('grade', g, { shouldDirty: true })}>{g}</button>)}
        </div>
        <input aria-label="Condition note (Japanese)" {...register('grade_note')} placeholder="Condition note in Japanese, e.g. 袖リブにほつれ" autoComplete="off" />
      </div>

      <div className="field">
        <h3>Where and when it was found</h3>
        <div className="row3">
          <input aria-label="City" {...register('found_city')} placeholder="TUCSON" style={{ textTransform: 'uppercase' }} autoComplete="off" />
          <select aria-label="State" {...register('found_state')}>
            <option value="">State</option>
            {STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <input aria-label="Date found" type="date" {...register('found_on')} style={{ marginTop: 8 }} />
      </div>

      <div className="field">
        <h3>Status</h3>
        <div className="status-seg" role="group" aria-label="Status">
          {['draft', 'ready', 'sold'].map(s => <button type="button" key={s} className={v.status === s ? 'on' : ''} aria-pressed={v.status === s}
            onClick={() => setValue('status', s, { shouldDirty: true })}>{STATUS_LABEL[s]}</button>)}
        </div>
        <p className="note">{v.status === 'draft' ? 'Drafts are never on the site.' : v.status === 'ready' ? 'Goes on the site at the next Publish.' : 'Shown as sold (black and white, 売約済); its page says who has it now.'}</p>
        {v.status === 'sold' && (
          <div className="sold-box" role="group" aria-label="Who has it now">
            <label className="choice"><input type="radio" value="handle" {...register('owner_kind')} /> The buyer shared their Instagram</label>
            {v.owner_kind === 'handle' && <input aria-label="Buyer's Instagram handle" {...register('owner_handle')} placeholder="handle (without @)" autoComplete="off" autoCapitalize="none" />}
            <label className="choice"><input type="radio" value="private" {...register('owner_kind')} /> Private collection (個人蔵)</label>
          </div>
        )}
      </div>

      {piece && <HistoryPanel piece={piece} onRestored={reload} />}
      {piece && <div className="field"><button type="button" className="btn danger" onClick={deletePiece}>Delete this piece</button></div>}
    </form>
  );

  const previewPane = (
    <Preview items={previewItems || []} drop={drop} slug={slug(editedSite.nameEn)} ready={meter !== null && !!previewItems} visible={wide || tab === 'preview'}
      placeholderPhoto={placeholderViews} />
  );

  return (
    <main className={'editor' + (wide ? ' wide' : '')}>
      <div className="tabs" role="tablist">
        <button role="tab" type="button" className={tab === 'form' ? 'on' : ''} aria-selected={tab === 'form'} onClick={() => setTab('form')}>Edit</button>
        <button role="tab" type="button" className={tab === 'preview' ? 'on' : ''} aria-selected={tab === 'preview'} onClick={() => setTab('preview')}>Preview</button>
      </div>
      <div style={{ display: wide || tab === 'form' ? 'block' : 'none', minWidth: 0 }}>{formPane}</div>
      <div style={{ display: wide || tab === 'preview' ? 'block' : 'none', minWidth: 0 }}>{previewPane}</div>
      <div className="savebar">
        <div className="state" data-testid="save-state">
          {msg ? <span className={msg.bad ? 'bad' : ''}>{msg.text}</span> : dirty ? 'Unsaved changes' : piece ? 'Saved' : 'New piece'}
          {ON_SITE(v.status) && !canBeOnSite && (
            <div className="bad">Needed for {STATUS_LABEL[v.status]}: {[...missing, ...(fitOk ? [] : ['shorter titles'])].join(', ')}</div>
          )}
        </div>
        <Link className="btn small" to="/" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>List</Link>
        <button type="button" className="btn primary" onClick={submit} disabled={saving}>Save</button>
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
