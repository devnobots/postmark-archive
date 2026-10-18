// Postmark Archive back office: a piece's photos. Upload from the phone, check the cutout's edges, reorder.
// The first photo is the stamp photo (its colors also pick the stamp color by the rule).
import { useEffect, useRef, useState } from 'react';
import { loadPhoto, rotated, pieceMask, cutoutBlob, fullBlob } from './lib/cutout.mjs';
import { savePhoto, photoUrl } from './photos.js';

// addresses the browser can show, for a list of stored photo paths
function useUrls(paths) {
  const [urls, setUrls] = useState({});
  const key = paths.join('|');
  useEffect(() => {
    let live = true;
    Promise.all(paths.map(async p => [p, await photoUrl(p)])).then(list => { if (live) setUrls(Object.fromEntries(list)); });
    return () => { live = false; };
  }, [key]);   // eslint-disable-line react-hooks/exhaustive-deps
  return urls;
}

export default function PhotoPanel({ views, onChange, stampColor, choices }) {
  const input = useRef(null);
  const [dialog, setDialog] = useState(null);       // { file }
  const [picking, setPicking] = useState(false);
  const urls = useUrls(views.map(v => v.img));
  const move = (i, d) => { const a = views.slice(); [a[i], a[i + d]] = [a[i + d], a[i]]; onChange(a); };
  return (
    <div data-testid="photos">
      {views.length > 0 && (
        <ol className="views">
          {views.map((v, i) => (
            <li key={v.img + i} className="view-row" data-testid="view-row">
              <span className="view-thumb">{urls[v.img] && <img src={urls[v.img]} alt="" />}</span>
              <span className="view-info">
                <b>{i === 0 ? 'Stamp photo' : 'Photo ' + (i + 1)}</b>
                <small>{v.bleed ? 'fills the stamp' : 'cut out'}</small>
              </span>
              <span className="view-move">
                <button type="button" aria-label="Move photo up" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                <button type="button" aria-label="Move photo down" disabled={i === views.length - 1} onClick={() => move(i, 1)}>↓</button>
                <button type="button" aria-label="Remove photo" onClick={() => onChange(views.filter((_, k) => k !== i))}>×</button>
              </span>
            </li>
          ))}
        </ol>
      )}
      <div className="photo-actions">
        <button type="button" className="btn primary small" onClick={() => input.current.click()}>+ Add photo</button>
        <button type="button" className="btn small" aria-expanded={picking} onClick={() => setPicking(!picking)}>Use a photo already on the site</button>
        <input ref={input} type="file" accept="image/*" hidden data-testid="photo-input"
          onChange={e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) setDialog({ file: f }); }} />
      </div>
      {picking && (
        <div className="photos">
          {choices.map(vw => (
            <button type="button" key={vw.img} aria-label="Add this photo" onClick={() => { onChange([...views, vw]); setPicking(false); }}>
              <img src={'/' + vw.img} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
      {dialog && <CutoutDialog file={dialog.file} stampColor={stampColor} onCancel={() => setDialog(null)}
        onDone={view => { setDialog(null); onChange([...views, view]); }} />}
    </div>
  );
}

// the edge review: the cutout on its stamp color, on a checkerboard, or zoomed in; adjust and rotate
function CutoutDialog({ file, stampColor, onCancel, onDone }) {
  const [photo, setPhoto] = useState(null);
  const [turns, setTurns] = useState(0);
  const [tol, setTol] = useState(14);
  const [cut, setCut] = useState(null);             // { url, blob, ar }
  const [bg, setBg] = useState('stamp');
  const [zoom, setZoom] = useState(false);
  const [busy, setBusy] = useState('Reading the photo…');
  const [error, setError] = useState('');

  useEffect(() => { loadPhoto(file).then(setPhoto).catch(() => setError('This file could not be read as a photo.')); }, [file]);
  useEffect(() => {
    if (!photo) return;
    let live = true;
    setBusy('Removing the background…');
    const t = setTimeout(async () => {
      try {
        const src = rotated(photo, turns);
        const r = await cutoutBlob(src, pieceMask(src, tol));
        if (!live) return;
        setCut(old => { if (old) URL.revokeObjectURL(old.url); return { url: URL.createObjectURL(r.blob), blob: r.blob, ar: r.ar }; });
        setError('');
      } catch (e) { if (live) setError('No piece was found. Try less background removal, or use the whole photo.'); }
      if (live) setBusy('');
    }, 30);
    return () => { live = false; clearTimeout(t); };
  }, [photo, turns, tol]);

  const keep = async bleed => {
    setBusy('Saving the photo…');
    try {
      const src = rotated(photo, turns);
      const full = await fullBlob(src);
      const fullPath = await savePhoto(full.blob, 'full');
      if (bleed) {                                   // the stamp shows a 900px copy; the large view uses the full one
        const small = await fullBlob(src, 900);
        return onDone({ img: await savePhoto(small.blob, 'stamp'), full: fullPath, ar: +full.ar.toFixed(3), bleed: true });
      }
      const cutPath = await savePhoto(cut.blob, 'cut');
      onDone({ img: cutPath, full: fullPath, ar: +cut.ar.toFixed(3) });
    } catch (e) { setError('The photo could not be saved: ' + (e && e.message || e)); setBusy(''); }
  };

  const backs = { stamp: stampColor || '#EFE3C8', check: 'repeating-conic-gradient(#ddd 0 25%, #fff 0 50%) 0 0 / 16px 16px', dark: '#1a2433' };
  return (
    <div className="dialog" role="dialog" aria-modal="true" aria-label="Check the cutout">
      <div className="dialog-box">
        <h2>Check the cutout</h2>
        <div className="seg" role="group" aria-label="Background behind the cutout">
          {[['stamp', 'Stamp color'], ['check', 'Checkerboard'], ['dark', 'Dark']].map(([k, l]) =>
            <button type="button" key={k} className={bg === k ? 'on' : ''} aria-pressed={bg === k} onClick={() => setBg(k)}>{l}</button>)}
        </div>
        <div className={'cut-view' + (zoom ? ' zoom' : '')} style={{ background: backs[bg] }} data-testid="cut-view">
          {cut && <img src={cut.url} alt="The cutout" onClick={() => setZoom(!zoom)} />}
          {busy && <p className="cut-busy">{busy}</p>}
        </div>
        <p className="note">Tap the photo to zoom in and check the edges.</p>
        {error && <p className="err">{error}</p>}
        <label htmlFor="cut-tol">Background removal: {tol}</label>
        <input id="cut-tol" type="range" min="4" max="40" step="1" value={tol} onChange={e => setTol(+e.target.value)} />
        <div className="note" style={{ display: 'flex', justifyContent: 'space-between' }}><span>less (keeps more)</span><span>more (removes more)</span></div>
        <div className="dialog-row">
          <button type="button" className="btn small" onClick={() => setTurns(t => t - 1)} aria-label="Rotate left">↺ Rotate</button>
          <button type="button" className="btn small" onClick={() => setTurns(t => t + 1)} aria-label="Rotate right">↻ Rotate</button>
        </div>
        <div className="dialog-row">
          <button type="button" className="btn" onClick={onCancel} disabled={busy === 'Saving the photo…'}>Cancel</button>
          <button type="button" className="btn" onClick={() => keep(true)} disabled={!photo || !!busy}>Use whole photo</button>
          <button type="button" className="btn primary" onClick={() => keep(false)} disabled={!cut || !!busy}>Use cutout</button>
        </div>
      </div>
    </div>
  );
}
