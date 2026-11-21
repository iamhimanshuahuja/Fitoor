// Fitoor sign-in tracker (Supabase Edge Function, Deno)
// POST { event: 'sign_in' | 'sign_up' | 'session_resume' | 'sign_out', remember?: boolean }
// Records the caller's IP (from the request headers), approximate location and device in public.login_events.
// Writes with the service-role key so clients can't insert or fake rows (they only have SELECT on the table).
// Deploy: supabase functions deploy track
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const EVENTS = ['sign_in', 'sign_up', 'session_resume', 'sign_out'];
const URL_ = Deno.env.get('SUPABASE_URL')!;

function clientIp(req: Request): string | null {
  const xf = req.headers.get('x-forwarded-for');
  const ip = (xf ? xf.split(',')[0] : req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip') || '').trim();
  return ip || null;
}

const isPrivate = (ip: string) => /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1|fc|fd|fe80)/i.test(ip);

/** Approximate city/region/country from the IP. Best effort: never blocks the login for more than ~2 s. */
async function geo(ip: string | null) {
  if (!ip || isPrivate(ip)) return {};
  try {
    const r = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}?fields=success,city,region,country,connection`, { signal: AbortSignal.timeout(2000) });
    const j = await r.json();
    if (!j?.success) return {};
    return { city: j.city || null, region: j.region || null, country: j.country || null, isp: j.connection?.isp || null };
  } catch { return {}; }
}

/** "iPhone · Safari", "Mac · Chrome", "Android · Chrome"… */
function device(ua: string) {
  const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android'
    : /Mac OS X|Macintosh/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : 'Other';
  const br = /Edg\//.test(ua) ? 'Edge' : /Brave/.test(ua) ? 'Brave' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox'
    : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const app = /\bwv\b|; wv\)/.test(ua) ? ' (app)' : '';
  return `${os} · ${br}${app}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const auth = req.headers.get('Authorization') || '';
  const asUser = createClient(URL_, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
  const { data: u } = await asUser.auth.getUser();
  if (!u?.user) return json({ error: 'Not signed in' }, 401);

  let body: any = {};
  try { body = await req.json(); } catch { /* empty body is fine */ }
  const event = EVENTS.includes(body?.event) ? body.event : 'sign_in';

  const ip = clientIp(req);
  const ua = (req.headers.get('user-agent') || '').slice(0, 400);
  const g = await geo(ip);

  const admin = createClient(URL_, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { error } = await admin.from('login_events').insert({
    user_id: u.user.id, event, ip, ...g, device: device(ua), user_agent: ua,
    remember: typeof body?.remember === 'boolean' ? body.remember : null,
  });
  if (error) return json({ error: error.message }, 500);

  // Light housekeeping: keep one year of history.
  if (Math.random() < 0.02) {
    const cutoff = new Date(Date.now() - 365 * 864e5).toISOString();
    await admin.from('login_events').delete().lt('created_at', cutoff);
    await admin.from('activity_logs').delete().lt('created_at', cutoff);
  }
  return json({ ok: true });
});
