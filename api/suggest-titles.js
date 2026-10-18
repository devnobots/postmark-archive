// Postmark Archive back office: shorter title ideas from Claude. Runs on the server (Vercel Function, or
// the back office's dev server), so the Anthropic key never reaches a browser.
// The back office measures every idea in the real site before showing it; ideas that still do not fit are dropped.
//
// POST /api/suggest-titles   body: { nameJa, nameEn, capJa, problems: [...], facts: {category, era, maker} }
// answer: { ja: [...], en: [...], cap: [...] }   or { error }
//
// Settings (environment): ANTHROPIC_API_KEY (required), ANTHROPIC_MODEL (default below),
// SUPABASE_URL + SUPABASE_ANON_KEY (when set, only signed-in admins may call this),
// LOCAL_DEV=1 (dev server only: allows calls without signing in).

export const DEFAULT_MODEL = 'claude-sonnet-5-5';

export function buildPrompt({ nameJa, nameEn, capJa, problems, facts }) {
  return [
    'You write product titles for Postmark Archive, a shop selling one-of-a-kind American vintage clothing to Japanese buyers.',
    'The current titles are too long for the page. Suggest shorter versions that keep the meaning.',
    '',
    'Current Japanese title: ' + nameJa,
    'Current English subtitle: ' + nameEn,
    'Current stamp label: ' + (capJa || '(none)'),
    'What does not fit: ' + ((problems || []).join(' / ') || 'nothing; offer tighter options anyway'),
    'Known facts: ' + JSON.stringify(facts || {}),
    '',
    'Rules for the Japanese title:',
    '- Start with the decade exactly as now (e.g. 70年代). Keep the maker or model if there is one (リーバイス 611, MA-1).',
    '- Keep the item word a Japanese vintage buyer would search for (フライトジャケット, リンガーTシャツ).',
    '- Put a normal space between words. Never more than 12 characters without a space. Never split a word with a space.',
    '- Drop the least important detail first (color, minor trim, country), never the item word.',
    '- Natural shop Japanese, no marketing words (希少, 最高), no brackets or symbols.',
    'Rules for the English subtitle: same piece, plain English, at most 36 characters, starts with the decade (1970s).',
    'Rules for the stamp label: the item word only, at most 9 full-width characters (MA-1, リンガーTシャツ, バケットハット).',
    '',
    'Give 6 Japanese titles (shortest last), 3 English subtitles and 3 stamp labels.',
    'Answer with JSON only, no other text: {"ja": [...], "en": [...], "cap": [...]}',
  ].join('\n');
}

export function parseAnswer(text) {
  const m = String(text).match(/\{[\s\S]*\}/);
  if (!m) throw new Error('no JSON in answer');
  const j = JSON.parse(m[0]);
  const list = v => (Array.isArray(v) ? v : []).map(s => String(s).replace(/\s+/g, ' ').trim()).filter(Boolean);
  const uniq = a => [...new Set(a)];
  return { ja: uniq(list(j.ja)).slice(0, 8), en: uniq(list(j.en)).slice(0, 5), cap: uniq(list(j.cap)).slice(0, 5) };
}

async function isAdmin(req, env, fetchImpl) {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return env.LOCAL_DEV === '1';
  const auth = req.headers.authorization || req.headers.Authorization || '';
  if (!/^Bearer /.test(auth)) return false;
  const r = await fetchImpl(env.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/rpc/is_admin', {
    method: 'POST', headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: auth, 'Content-Type': 'application/json' }, body: '{}',
  });
  return r.ok && (await r.json()) === true;
}

export async function suggest(req, env = process.env, fetchImpl = fetch) {
  if (req.method !== 'POST') return { status: 405, body: { error: 'POST only' } };
  if (!env.ANTHROPIC_API_KEY) return { status: 503, body: { error: 'no-key' } };
  if (!(await isAdmin(req, env, fetchImpl))) return { status: 401, body: { error: 'sign-in' } };
  const input = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  if (!input.nameJa) return { status: 400, body: { error: 'nameJa is required' } };
  const r = await fetchImpl('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: env.ANTHROPIC_MODEL || DEFAULT_MODEL,
      max_tokens: 800,
      messages: [{ role: 'user', content: buildPrompt(input) }],
    }),
  });
  if (!r.ok) return { status: 502, body: { error: 'anthropic ' + r.status, detail: (await r.text()).slice(0, 300) } };
  const data = await r.json();
  const text = (data.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
  try { return { status: 200, body: parseAnswer(text) }; }
  catch (e) { return { status: 502, body: { error: 'unreadable answer' } }; }
}

// Vercel Function entry
export default async function handler(req, res) {
  const out = await suggest(req);
  res.status(out.status).json(out.body);
}
