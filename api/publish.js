// Standard Gauge back office: put the saved pieces on the live site.
// Asks Vercel to rebuild the site; the build reads the database and writes data/current.js (tools/build_site.mjs).
// The site changes about a minute later. Nothing on the site changes when you only save.
//
// POST /api/publish   answer: { ok: true } or { error }
// Settings (environment): VERCEL_DEPLOY_HOOK_URL (Vercel > Project > Settings > Git > Deploy Hooks),
// SUPABASE_URL + SUPABASE_ANON_KEY (only signed-in admins may publish).

export async function publish(req, env = process.env, fetchImpl = fetch) {
  if (req.method !== 'POST') return { status: 405, body: { error: 'POST only' } };
  if (!env.VERCEL_DEPLOY_HOOK_URL) return { status: 503, body: { error: 'no-hook' } };
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return { status: 503, body: { error: 'no-database' } };
  const auth = req.headers.authorization || '';
  if (!/^Bearer /.test(auth)) return { status: 401, body: { error: 'sign-in' } };
  const a = await fetchImpl(env.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/rpc/is_admin', {
    method: 'POST', headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: auth, 'Content-Type': 'application/json' }, body: '{}',
  });
  if (!a.ok || (await a.json()) !== true) return { status: 401, body: { error: 'sign-in' } };
  const r = await fetchImpl(env.VERCEL_DEPLOY_HOOK_URL, { method: 'POST' });
  if (!r.ok) return { status: 502, body: { error: 'vercel ' + r.status } };
  return { status: 200, body: { ok: true } };
}

export default async function handler(req, res) {
  const out = await publish(req);
  res.status(out.status).json(out.body);
}
