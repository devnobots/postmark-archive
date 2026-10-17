// Standard Gauge back office: routes, sign-in (Supabase mode) and the local-mode banner.
import { useEffect, useState } from 'react';
import { Refine } from '@refinedev/core';
import routerProvider from '@refinedev/react-router';
import { BrowserRouter, Routes, Route, Link } from 'react-router';
import { MODE, supabase, authProvider } from './config.js';
import PieceList from './PieceList.jsx';
import PieceEditor from './PieceEditor.jsx';

const RESOURCES = [
  { name: 'pieces', list: '/', create: '/pieces/new', edit: '/pieces/:id' },
  { name: 'drops' },
  { name: 'categories', meta: { idColumnName: 'code' } },
];

export default function App({ provider, persistent }) {
  return (
    <BrowserRouter basename="/admin">
      <Refine dataProvider={provider} routerProvider={routerProvider} authProvider={authProvider || undefined}
        resources={RESOURCES} options={{ disableTelemetry: true, syncWithLocation: false, warnWhenUnsavedChanges: false }}>
        <Gate>
          <Header />
          {MODE === 'local' && <LocalBanner provider={provider} persistent={persistent} />}
          <Routes>
            <Route path="/" element={<PieceList />} />
            <Route path="/pieces/new" element={<PieceEditor key="new" />} />
            <Route path="/pieces/:id" element={<PieceEditor />} />
            <Route path="*" element={<p className="empty">Page not found. <Link to="/">Back to the list</Link></p>} />
          </Routes>
        </Gate>
      </Refine>
    </BrowserRouter>
  );
}

function Header() {
  return (
    <header className="topbar">
      <Link to="/" className="brand">STANDARD GAUGE <span>admin</span></Link>
      {MODE === 'supabase' && <button className="link" onClick={() => supabase.auth.signOut()}>Sign out</button>}
    </header>
  );
}

function LocalBanner({ provider, persistent }) {
  if (!persistent) return <div className="banner warn">This browser cannot save (changes are lost when you close the page)</div>;
  return (
    <div className="banner">
      Local mode: saved in this browser only
      <button className="link" onClick={() => {
        if (window.confirm('Discard every change in this browser and start again from what is on the site now?')) { provider.reset(); window.location.reload(); }
      }}>Start over</button>
    </div>
  );
}

// Supabase mode: email and password sign-in, then only admins get in. Local mode: no sign-in.
function Gate({ children }) {
  const [state, setState] = useState(MODE === 'local' ? 'ok' : 'checking');
  useEffect(() => {
    if (MODE === 'local') return;
    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return setState('login');
      const { data: admin, error } = await supabase.rpc('is_admin');
      setState(!error && admin === true ? 'ok' : 'denied');
    };
    check();
    const { data: sub } = supabase.auth.onAuthStateChange(() => { check(); });
    return () => sub.subscription.unsubscribe();
  }, []);
  if (state === 'ok') return children;
  if (state === 'checking') return <p className="empty">Checking…</p>;
  if (state === 'denied') return (
    <div className="signin">
      <p>This account cannot edit the shop.</p>
      <button className="btn" onClick={() => supabase.auth.signOut()}>Sign out</button>
    </div>
  );
  return <SignIn />;
}

function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async e => {
    e.preventDefault();
    setBusy(true); setError('');
    const r = await authProvider.login({ email, password });
    setBusy(false);
    if (!r.success) setError('Wrong email or password');
  };
  return (
    <form className="signin" onSubmit={submit}>
      <div className="brand">STANDARD GAUGE <span>admin</span></div>
      <label>Email<input type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required /></label>
      <label>Password<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required /></label>
      {error && <p className="err">{error}</p>}
      <button className="btn primary" disabled={busy}>Sign in</button>
    </form>
  );
}
