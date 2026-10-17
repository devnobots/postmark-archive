// Standard Gauge back office: the live preview. The real site (index.html?preview=edit) in three frames,
// each at its real size and scaled down to fit, so the site lays out exactly as it will for visitors.
import { useEffect, useRef, useState } from 'react';
import { siteDrop } from './meter.js';

const FRAMES = [
  { key: 'desk', label: 'デスクトップ', w: 1280, h: 880, piece: true },
  { key: 'phone', label: 'スマホ', w: 375, h: 812, piece: true },
  { key: 'sheet', label: 'スマホ一覧', w: 375, h: 812, piece: false },
];
const KEY = 'sg-preview-edit';

function urlFor(f, slug, n) {
  return '/index.html?preview=edit' + (n ? '&r=' + n : '') + (f.piece && slug ? '#' + slug : '');
}

export default function Preview({ items, drop, slug, ready, visible, placeholderPhoto }) {
  const [big, setBig] = useState('phone');
  const [width, setWidth] = useState(0);
  const box = useRef(null);
  const frames = useRef({});
  const count = useRef(0);
  const [loadedOnce, setLoadedOnce] = useState(false);

  // pane width, for scaling (0 while the プレビュー tab is hidden)
  useEffect(() => {
    if (!box.current) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)));
    ro.observe(box.current);
    return () => ro.disconnect();
  }, []);

  // about 400 ms after typing stops: write the draft, then reload each frame without growing its history
  const data = JSON.stringify({ drop: siteDrop(drop), items });
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      try { localStorage.setItem(KEY, data); } catch (e) { /* private mode: the frames show the site as it is */ }
      count.current += 1;
      for (const f of FRAMES) {
        const fr = frames.current[f.key];
        if (fr && fr.contentWindow) fr.contentWindow.location.replace(urlFor(f, slug, count.current));
      }
      setLoadedOnce(true);
    }, loadedOnce ? 400 : 0);
    return () => clearTimeout(t);
  }, [data, slug, ready]);   // eslint-disable-line react-hooks/exhaustive-deps

  // the site focuses its listing's close button when a piece opens; inside a frame that would take the
  // cursor out of the form. The frames ignore clicks, so focus landing in one is always that: hand it back.
  useEffect(() => {
    const back = e => {
      const from = e.target;
      setTimeout(() => {
        const now = document.activeElement;
        if (now && now.tagName === 'IFRAME' && now.closest('.preview') && from && from.isConnected) from.focus({ preventScroll: true });
      }, 0);
    };
    document.addEventListener('focusout', back, true);
    return () => document.removeEventListener('focusout', back, true);
  }, []);

  // phones have no scrollbar gutter; hide it so the phone frames are exactly 375px wide
  const onLoad = e => { try { e.target.contentDocument.documentElement.style.scrollbarWidth = 'none'; } catch (err) { /* ignore */ } };

  const main = FRAMES.find(f => f.key === big);
  const thumbs = FRAMES.filter(f => f.key !== big);
  // the big frame fits the pane width, but never taller than the window
  const maxH = Math.max(300, (typeof window !== 'undefined' ? window.innerHeight : 800) - 170);
  const bigScale = width ? Math.min(width / main.w, maxH / main.h) : 0;
  const thumbW = width ? Math.floor((width - 10) / 2) : 0;

  const frame = f => (
    <iframe key={f.key} data-frame={f.key} title={f.label} width={f.w} height={f.h} onLoad={onLoad}
      ref={el => { frames.current[f.key] = el; }} src="about:blank" tabIndex={-1} />
  );
  // every frame stays mounted in one place in the tree; only its box and scale change
  const placed = {};
  placed[main.key] = { style: { width: Math.round(main.w * bigScale), height: Math.round(main.h * bigScale), margin: '0 auto' }, scale: bigScale, cls: 'pv-big' };
  thumbs.forEach(f => {
    const s = thumbW / f.w;
    placed[f.key] = { style: { width: thumbW, height: Math.round(f.h * s) }, scale: s, cls: 'pv-thumb' };
  });

  return (
    <section className="preview" aria-label="プレビュー">
      <div className="seg" role="group" aria-label="大きく表示する画面">
        {FRAMES.map(f => <button type="button" key={f.key} className={big === f.key ? 'on' : ''} aria-pressed={big === f.key} onClick={() => setBig(f.key)}>{f.label}</button>)}
      </div>
      <div ref={box} style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
        {FRAMES.map(f => {
          const p = placed[f.key];
          const isBig = f.key === big;
          return (
            <div key={f.key} className={p.cls} style={{ ...p.style, order: isBig ? 0 : 1, flex: isBig ? '0 0 auto' : undefined }}
              onClick={isBig ? undefined : () => setBig(f.key)} role={isBig ? undefined : 'button'} aria-label={isBig ? undefined : f.label + 'を大きく表示'}>
              {/* inert: the site focuses its close button; without this the frame would take the cursor from the form */}
              <div className="pv-scale" inert={true} style={{ transform: 'scale(' + p.scale + ')', width: f.w, height: f.h }}>{frame(f)}</div>
              {!isBig && <span>{f.label}</span>}
            </div>
          );
        })}
      </div>
      <p className="pv-note">
        <a href={urlFor(main, slug, 0)} target="_blank" rel="noopener">別タブで開く</a>
        {placeholderPhoto && <span className="pv-temp">写真は仮です</span>}
        {!visible && null}
      </p>
    </section>
  );
}
