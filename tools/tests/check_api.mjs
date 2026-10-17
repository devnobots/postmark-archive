// Server code: admins only, keys stay on the server. Usage: node tools/tests/check_api.mjs
import assert from 'node:assert';
import { suggest, parseAnswer, buildPrompt } from '../../api/suggest-titles.js';
import { publish } from '../../api/publish.js';
const calls = [];
const fake = (adminOk, answer) => async (url, opt) => {
  calls.push(url);
  if (url.endsWith('/rpc/is_admin')) return { ok: true, json: async () => adminOk };
  if (url.includes('anthropic')) { const b = JSON.parse(opt.body); assert.equal(b.model, 'claude-sonnet-5-5'); assert.ok(opt.headers['x-api-key']);
    return { ok: true, json: async () => ({ content: [{ type: 'text', text: answer }] }) }; }
  if (url.includes('hook')) return { ok: true };
  throw new Error(url);
};
const env = { ANTHROPIC_API_KEY: 'k', SUPABASE_URL: 'https://x.supabase.co/', SUPABASE_ANON_KEY: 'a', VERCEL_DEPLOY_HOOK_URL: 'https://api.vercel.com/hook' };
const req = (h = { authorization: 'Bearer t' }) => ({ method: 'POST', headers: h, body: { nameJa: '1960年代 アメリカ空軍 MA-1 フライトジャケット', nameEn: 'x', problems: ['4行'] } });
const ans = 'Here you go:\n{"ja": ["60年代 USAF MA-1 フライトジャケット", "60年代 MA-1 フライトジャケット", "60年代 MA-1 フライトジャケット"], "en": ["1960s USAF MA-1 Flight Jacket"], "cap": ["MA-1"]}';
let r = await suggest(req(), env, fake(true, ans)); assert.equal(r.status, 200); assert.deepEqual(r.body.cap, ['MA-1']); assert.equal(r.body.ja.length, 2, 'duplicates removed');
r = await suggest(req(), env, fake(false, ans)); assert.equal(r.status, 401);
r = await suggest(req({}), env, fake(true, ans)); assert.equal(r.status, 401);
r = await suggest(req(), { ...env, ANTHROPIC_API_KEY: '' }, fake(true, ans)); assert.deepEqual(r, { status: 503, body: { error: 'no-key' } });
r = await suggest(req({}), { ANTHROPIC_API_KEY: 'k', LOCAL_DEV: '1' }, fake(true, ans)); assert.equal(r.status, 200, 'local dev without database');
r = await suggest(req({}), { ANTHROPIC_API_KEY: 'k' }, fake(true, ans)); assert.equal(r.status, 401, 'no database and not dev: refused');
r = await suggest(req(), env, fake(true, 'sorry')); assert.equal(r.status, 502);
r = await publish(req(), env, fake(true)); assert.deepEqual(r, { status: 200, body: { ok: true } });
r = await publish(req(), env, fake(false)); assert.equal(r.status, 401);
r = await publish(req(), { ...env, VERCEL_DEPLOY_HOOK_URL: '' }, fake(true)); assert.equal(r.body.error, 'no-hook');
assert.ok(buildPrompt({ nameJa: 'a', nameEn: 'b' }).includes('12 characters'));
console.log('api ok: admins only, missing settings reported, answers cleaned');
