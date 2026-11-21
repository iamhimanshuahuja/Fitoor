// Netlify Edge Function: /sitemap.xml built live from public recipes (anon key, RLS = public only).
import type { Config } from 'https://edge.netlify.com';

const SITE = 'https://fitoor.life';
const TAG_PAGES = ['weight_loss', 'high_protein', 'low_gi', 'diabetes_friendly', 'pcos_friendly', 'heart_healthy', 'gut_health', 'quick'];
const x = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

export default async () => {
  const url = Netlify.env.get('VITE_SUPABASE_URL')?.replace(/\/$/, '');
  const key = Netlify.env.get('VITE_SUPABASE_ANON_KEY');
  let rows: { slug: string; updated_at: string }[] = [];
  if (url && key) {
    try {
      const res = await fetch(`${url}/rest/v1/recipes?select=slug,updated_at&status=eq.public&order=published_at.desc&limit=5000`,
        { headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(3000) });
      if (res.ok) rows = await res.json();
    } catch { /* serve static part */ }
  }
  const u = (loc: string, extra = '') => `  <url><loc>${x(loc)}</loc>${extra}</url>`;
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    u(`${SITE}/`, '<changefreq>weekly</changefreq><priority>1.0</priority>'),
    u(`${SITE}/recipes`, '<changefreq>daily</changefreq><priority>0.9</priority>'),
    ...['veg', 'egg', 'nonveg'].map((d) => u(`${SITE}/recipes?diet=${d}`)),
    ...TAG_PAGES.map((t) => u(`${SITE}/recipes?tag=${t}`)),
    ...rows.map((r) => u(`${SITE}/recipes/${r.slug}`, `<lastmod>${r.updated_at.slice(0, 10)}</lastmod><priority>0.8</priority>`)),
    u(`${SITE}/signup`), u(`${SITE}/login`), u(`${SITE}/terms`), u(`${SITE}/privacy`),
    '</urlset>',
  ].join('\n');
  return new Response(body, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=0', 'netlify-cdn-cache-control': 'public, s-maxage=3600' } });
};

export const config: Config = { path: '/sitemap.xml' };
