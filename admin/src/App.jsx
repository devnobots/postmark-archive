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
            <Route path="*" element={<p className="empty">ページがありません。<Link to="/">一覧へ</Link></p>} />
          </Routes>
        </Gate>
      </Refine>
    </BrowserRouter>
  );
}

function Header() {
  return (
    <header className="topbar">
      <Link to="/" className="brand">STANDARD GAUGE <span>管理</span></Link>
      {MODE === 'supabase' && <button className="link" onClick={() => supabase.auth.signOut()}>ログアウト</button>}
    </header>
  );
}

function LocalBanner({ provider, persistent }) {
  if (!persistent) return <div className="banner warn">このブラウザでは保存できません（ページを閉じると消えます）</div>;
  return (
    <div className="banner">
      ローカルモード：このブラウザにだけ保存されます
      <button className="link" onClick={() => {
        if (window.confirm('このブラウザの変更をすべて消して、サイトの今の内容に戻しますか？')) { provider.reset(); window.location.reload(); }
      }}>最初に戻す</button>
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
  if (state === 'checking') return <p className="empty">確認しています…</p>;
  if (state === 'denied') return (
    <div className="signin">
      <p>このアカウントには編集権限がありません</p>
      <button className="btn" onClick={() => supabase.auth.signOut()}>ログアウト</button>
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
    if (!r.success) setError('メールアドレスかパスワードが違います');
  };
  return (
    <form className="signin" onSubmit={submit}>
      <div className="brand">STANDARD GAUGE <span>管理</span></div>
      <label>メールアドレス<input type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required /></label>
      <label>パスワード<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required /></label>
      {error && <p className="err">{error}</p>}
      <button className="btn primary" disabled={busy}>ログイン</button>
    </form>
  );
}
