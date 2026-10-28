// Postmark Archive back office: dev server and build.
// The dev server shows the site at / and the back office at /admin/, from one address, so the preview
// and title measuring can load the real site pages. /api/* runs the same server code Vercel runs.
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

const SITE = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };
const SITE_PATHS = /^\/(index\.html|drops\.html|mobile\.css|mobile\.js|zoom\.js|exit\.js|zoom-test\.html|favicon\.ico|favicon\.svg|favicon-us\.svg|apple-touch-icon\.png|assets\/|data\/|$)/;

function siteAndApi(env) {
  return {
    name: 'sg-site-and-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, 'http://x');
        if (url.pathname.startsWith('/api/')) {
          const name = url.pathname.slice(5).replace(/[^a-z-]/g, '');
          const file = path.join(SITE, 'api', name + '.js');
          if (!fs.existsSync(file)) { res.statusCode = 404; return res.end('{}'); }
          let body = ''; for await (const c of req) body += c;
          const mod = await import(file + '?t=' + Date.now());
          const fn = mod.suggest || mod.publish;
          const out = await fn({ method: req.method, headers: req.headers, body }, { ...process.env, ...env, LOCAL_DEV: '1' });
          res.statusCode = out.status; res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify(out.body));
        }
        if (!SITE_PATHS.test(url.pathname)) return next();
        const rel = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
        const file = path.join(SITE, rel);
        if (!file.startsWith(SITE + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return next();
        res.setHeader('content-type', TYPES[path.extname(file)] || 'application/octet-stream');
        res.setHeader('cache-control', 'no-store');
        fs.createReadStream(file).pipe(res);
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');           // admin/.env.local (never committed)
  return {
    base: '/admin/',
    plugins: [react(), siteAndApi(env)],
    build: { outDir: '../dist/admin', emptyOutDir: true },
    server: { host: true, port: 5173 },               // host: true = your phone can open it on the same Wi-Fi
  };
});
