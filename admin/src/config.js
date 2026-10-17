// Standard Gauge back office: which mode we run in.
// Both VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY set: Supabase mode (sign-in, shared database).
// Either missing: local mode (this browser only, no sign-in).
import { createClient } from '@supabase/supabase-js';
import { dataProvider as supabaseDataProvider } from '@refinedev/supabase';
import { localDataProvider, seedFromSite } from './lib/local-provider.mjs';
import { loadSiteData, loadPastData, safeStorage } from './util.js';

const URL_ = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const MODE = URL_ && KEY ? 'supabase' : 'local';

export const supabase = MODE === 'supabase' ? createClient(URL_, KEY) : null;

// bearer token for /api/* (Supabase mode); local mode needs none
export async function authHeader() {
  if (!supabase) return {};
  const { data } = await supabase.auth.getSession();
  return data.session ? { Authorization: 'Bearer ' + data.session.access_token } : {};
}

// email and password only: no magic links, no redirect addresses
export const authProvider = supabase && {
  login: async ({ email, password }) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? { success: false, error: { name: 'Sign-in failed', message: error.message } } : { success: true, redirectTo: '/' };
  },
  logout: async () => { await supabase.auth.signOut(); return { success: true, redirectTo: '/' }; },
  check: async () => {
    const { data } = await supabase.auth.getSession();
    return data.session ? { authenticated: true } : { authenticated: false };
  },
  onError: async error => (error && (error.statusCode === 401 || error.code === 'PGRST301') ? { logout: true } : {}),
  getIdentity: async () => {
    const { data } = await supabase.auth.getUser();
    return data.user ? { id: data.user.id, name: data.user.email } : null;
  },
};

// the data provider for the screens; local mode starts from today's homepage pieces
export async function makeDataProvider() {
  if (MODE === 'supabase') return { provider: withHistory(supabaseDataProvider(supabase)), persistent: true };
  const { storage, persistent } = safeStorage();
  const [site, past] = await Promise.all([loadSiteData(), loadPastData()]);
  return { provider: withHistory(localDataProvider(storage, await seedFromSite(site, past))), persistent };
}

// change history: before a piece is changed or deleted, the version before is kept in piece_history,
// so it can be put back (undo). Reordering alone (position only) is not recorded.
export function withHistory(p) {
  const keep = async (id, action) => {
    try {
      const { data } = await p.getOne({ resource: 'pieces', id });
      await p.create({ resource: 'piece_history', variables: { piece_id: id, action, snapshot: data } });
    } catch (e) { /* history must never stop a save */ }
  };
  return {
    ...p,
    async update(args) {
      if (args.resource === 'pieces' && Object.keys(args.variables || {}).some(k => k !== 'position')) await keep(args.id, 'update');
      return p.update(args);
    },
    async deleteOne(args) {
      if (args.resource === 'pieces') await keep(args.id, 'delete');
      return p.deleteOne(args);
    },
  };
}
