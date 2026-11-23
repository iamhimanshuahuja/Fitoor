import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';

/**
 * DEV-ONLY helper: GET /__dev/sql?file=supabase/dev/x.sql runs that SQL file on the Supabase project
 * through the Management API (token from .env) and writes the result to supabase/dev/last-result.json.
 * Only answers requests from this Mac (loopback) and only .sql files inside supabase/. Never part of the build.
 */
function devSqlRunner() {
  return {
    name: 'dev-sql-runner',
    apply: 'serve',
    configureServer(server) {
      const env = loadEnv('development', process.cwd(), '');
      server.middlewares.use('/__dev/sql', async (req, res) => {
        const ip = req.socket.remoteAddress || '';
        const send = (code, body) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body, null, 2)); };
        if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip)) return send(403, { error: 'localhost only' });
        const file = new URL(req.url, 'http://x').searchParams.get('file') || '';
        const abs = path.resolve(process.cwd(), file);
        if (!abs.startsWith(path.resolve(process.cwd(), 'supabase') + path.sep) || !abs.endsWith('.sql') || !fs.existsSync(abs)) return send(400, { error: 'file must be an existing .sql inside supabase/' });
        try {
          const r = await fetch(`https://api.supabase.com/v1/projects/${env.SUPABASE_PROJECT_REF}/database/query`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: fs.readFileSync(abs, 'utf8') }),
          });
          const out = { file, status: r.status, at: new Date().toISOString(), result: await r.json().catch(() => null) };
          fs.writeFileSync(path.resolve(process.cwd(), 'supabase/dev/last-result.json'), JSON.stringify(out, null, 2));
          send(200, out);
        } catch (e) { send(500, { error: String(e) }); }
      });
      // DEV-ONLY: /__dev/deploy-ai[?name=track] → redeploys supabase/functions/<name> (default ai) with the Supabase CLI (loopback only)
      server.middlewares.use('/__dev/deploy-ai', (req, res) => {
        const ip = req.socket.remoteAddress || '';
        if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip)) { res.statusCode = 403; return res.end('localhost only'); }
        const bin = ['/opt/homebrew/bin/supabase', '/usr/local/bin/supabase'].find((p) => fs.existsSync(p)) || 'supabase';
        const fn = new URL(req.url, 'http://x').searchParams.get('name') || 'ai';
        if (!/^[a-z0-9_-]+$/.test(fn) || !fs.existsSync(path.resolve(process.cwd(), 'supabase/functions', fn))) { res.statusCode = 400; return res.end('unknown function'); }
        execFile(bin, ['functions', 'deploy', fn, '--project-ref', env.SUPABASE_PROJECT_REF, '--use-api', '--yes'],
          { cwd: process.cwd(), env: { ...process.env, SUPABASE_ACCESS_TOKEN: env.SUPABASE_ACCESS_TOKEN }, timeout: 180000 },
          (err, stdout, stderr) => {
            res.setHeader('Content-Type', 'text/plain');
            res.end(`${err ? 'FAILED: ' + err.message : 'OK'}\n\n${stdout}\n${stderr}`);
          });
      });
      // DEV-ONLY: /__dev/login-as?email=… → one-time magic link for testing as that account (loopback only)
      server.middlewares.use('/__dev/login-as', async (req, res) => {
        const ip = req.socket.remoteAddress || '';
        if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip)) { res.statusCode = 403; return res.end('localhost only'); }
        const email = new URL(req.url, 'http://x').searchParams.get('email');
        try {
          const keys = await (await fetch(`https://api.supabase.com/v1/projects/${env.SUPABASE_PROJECT_REF}/api-keys?reveal=true`, {
            headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}` } })).json();
          const svc = (keys.find?.((k) => k.name === 'service_role') || keys.find?.((k) => k.type === 'secret'))?.api_key;
          const r = await fetch(`${env.VITE_SUPABASE_URL}/auth/v1/admin/generate_link`, {
            method: 'POST', headers: { apikey: svc, Authorization: `Bearer ${svc}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'magiclink', email, redirect_to: 'http://localhost:5173/app' }) });
          const j = await r.json();
          const link = j.action_link || j.properties?.action_link;
          if (!link) { res.statusCode = 500; return res.end(JSON.stringify(j)); }
          res.statusCode = 302; res.setHeader('Location', link); res.end();
        } catch (e) { res.statusCode = 500; res.end(String(e)); }
      });
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    devSqlRunner(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false, // registered in src/main.jsx so we can check for updates when the app comes back to the front
      includeAssets: ['favicon.ico', 'icon.svg', 'logo.svg', 'logo-inline.svg', 'icons/app-icon-180.png'],
      manifest: {
        name: 'Fitoor — Plate se PR tak',
        short_name: 'Fitoor',
        description: 'Plate se PR tak. Track your thali, gym sets, weight and lab reports with your coach.',
        theme_color: '#12261B',
        background_color: '#EEF6E8',
        display: 'standalone',
        start_url: '/app',
        icons: [
          { src: '/icons/app-icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/app-icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/app-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: { skipWaiting: true, clientsClaim: true, cleanupOutdatedCaches: true, navigateFallbackDenylist: [/^\/\.netlify/, /^\/__dev/, /^\/sitemap\.xml/, /^\/robots\.txt/] },
    }),
  ],
  server: { port: 5173, host: true },
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        // split big libraries into their own cached files so the first page loads faster
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
          charts: ['recharts'],
        },
      },
    },
  },
});
