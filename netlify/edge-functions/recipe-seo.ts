// Netlify Edge Function: server-side SEO for the public recipe book.
// Crawlers (Google, WhatsApp, X…) get a real <title>, meta description, Open Graph tags,
// canonical link, schema.org/Recipe JSON-LD and a plain-HTML copy of the recipe — the SPA still boots on top.
// Uses only the PUBLIC anon key (Netlify env VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY); RLS only returns status='public'.
import type { Config, Context } from 'https://edge.netlify.com';

const SITE = 'https://fitoor.life';
const TAGS: Record<string, string> = {
  weight_loss: 'Weight loss', high_protein: 'High protein', low_gi: 'Low GI', diabetes_friendly: 'Diabetes-friendly',
  pcos_friendly: 'PCOS-friendly', heart_healthy: 'Heart healthy', gut_health: 'Gut health', quick: 'Under 20 min',
  no_cook: 'No cook', kid_friendly: 'Kid friendly',
};
const DIETS: Record<string, string> = { veg: 'Veg', egg: 'Eggetarian', nonveg: 'Non-veg' };
const MEALS: Record<string, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack', drink: 'Drink' };

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const jsonForScript = (o: unknown) => JSON.stringify(o).replace(/</g, '\\u003c');

function env() {
  const url = Netlify.env.get('VITE_SUPABASE_URL');
  const key = Netlify.env.get('VITE_SUPABASE_ANON_KEY');
  return url && key ? { url: url.replace(/\/$/, ''), key } : null;
}
async function rest(path: string) {
  const e = env();
  if (!e) return null;
  const res = await fetch(`${e.url}/rest/v1/${path}`, { headers: { apikey: e.key, Authorization: `Bearer ${e.key}` }, signal: AbortSignal.timeout(2500) });
  return res.ok ? res.json() : null;
}
const imgUrl = (path?: string | null) => {
  const e = env();
  return path && e ? `${e.url}/storage/v1/object/public/recipes/${path}` : `${SITE}/icons/icon-512.png`;
};

function headTags({ title, desc, url, image, type = 'website', ld }: { title: string; desc: string; url: string; image: string; type?: string; ld?: unknown }) {
  return [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(desc)}" />`,
    `<link rel="canonical" href="${esc(url)}" />`,
    `<meta property="og:site_name" content="Fitoor" />`,
    `<meta property="og:type" content="${type}" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(desc)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta property="og:image" content="${esc(image)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    ld ? `<script type="application/ld+json" id="recipe-jsonld-ssr">${jsonForScript(ld)}</script>` : '',
  ].join('\n    ');
}

function inject(html: string, head: string, body: string) {
  return html
    .replace(/<title>[\s\S]*?<\/title>/i, '')
    .replace(/<meta name="description"[^>]*>/i, '')
    .replace('</head>', `    ${head}\n  </head>`)
    .replace('<div id="root"></div>', `<div id="root">${body}</div>`);
}

const iso = (m?: number | null) => (m ? `PT${m}M` : undefined);

export default async (req: Request, ctx: Context) => {
  const url = new URL(req.url);
  const parts = url.pathname.replace(/\/+$/, '').split('/').filter(Boolean); // ['recipes', slug?]
  if (parts[1] === 'new' || parts[1] === 'edit') return; // editor: plain SPA
  const res = await ctx.next();
  if (!(res.headers.get('content-type') || '').includes('text/html')) return res;
  let html = await res.text();
  try {
    if (parts.length === 1) {
      const tag = url.searchParams.get('tag') || '';
      const diet = url.searchParams.get('diet') || '';
      const label = [TAGS[tag], DIETS[diet]].filter(Boolean).join(' ');
      const title = `${label ? label + ' ' : 'Healthy Indian '}Recipes | Fitoor Kitchen`;
      const desc = 'High-protein, weight-loss friendly, low-GI and PCOS-friendly Indian recipes with calories and protein per serving. Veg, egg and non-veg.';
      const rows = (await rest('recipes?select=slug,title,summary,diet,tags&status=eq.public&order=published_at.desc&limit=200')) || [];
      const list = rows.filter((r: any) => (!tag || (r.tags || []).includes(tag)) && (!diet || r.diet === diet));
      const canonical = `${SITE}/recipes${tag ? `?tag=${encodeURIComponent(tag)}` : diet ? `?diet=${encodeURIComponent(diet)}` : ''}`;
      const ld = { '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: list.map((r: any, i: number) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE}/recipes/${r.slug}`, name: r.title })) };
      const body = `<main><h1>${esc(label || 'Healthy Indian')} recipes</h1><p>${esc(desc)}</p><ul>${list.map((r: any) => `<li><a href="/recipes/${esc(r.slug)}">${esc(r.title)}</a> (${esc(DIETS[r.diet] || '')}) ${esc(r.summary || '')}</li>`).join('')}</ul></main>`;
      html = inject(html, headTags({ title, desc, url: canonical, image: `${SITE}/icons/icon-512.png`, ld }), body);
    } else {
      const slug = decodeURIComponent(parts[1]);
      const rows = await rest(`recipes?select=*&status=eq.public&slug=eq.${encodeURIComponent(slug)}&limit=1`);
      const r = rows?.[0];
      if (!r) {
        html = html.replace('</head>', '    <meta name="robots" content="noindex" />\n  </head>');
        return new Response(html, { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } });
      }
      const pageUrl = `${SITE}/recipes/${r.slug}`;
      const desc = (r.summary || `${r.title}: healthy Indian recipe with calories and protein.`).slice(0, 160);
      const total = (r.prep_min || 0) + (r.cook_min || 0);
      const ingredients = (r.ingredients || []).map((i: any) => [i.qty, i.item].filter(Boolean).join(' '));
      const ld = {
        '@context': 'https://schema.org', '@type': 'Recipe', name: r.title, description: r.summary || undefined, image: [imgUrl(r.image_path)],
        author: { '@type': 'Organization', name: r.by_staff ? 'Fitoor Kitchen' : 'Fitoor community', url: SITE },
        datePublished: r.published_at ? String(r.published_at).slice(0, 10) : undefined,
        prepTime: iso(r.prep_min), cookTime: iso(r.cook_min), totalTime: iso(total),
        recipeYield: r.servings ? `${r.servings} servings` : undefined,
        recipeCategory: (r.meal_types || []).map((m: string) => MEALS[m]).filter(Boolean).join(', ') || undefined,
        recipeCuisine: 'Indian',
        keywords: [...(r.tags || []).map((t: string) => TAGS[t] || t), DIETS[r.diet]].filter(Boolean).join(', '),
        suitableForDiet: r.diet === 'veg' ? 'https://schema.org/VegetarianDiet' : undefined,
        nutrition: r.kcal ? { '@type': 'NutritionInformation', calories: `${r.kcal} calories`, proteinContent: r.protein_g ? `${r.protein_g} g` : undefined, carbohydrateContent: r.carbs_g ? `${r.carbs_g} g` : undefined, fatContent: r.fat_g ? `${r.fat_g} g` : undefined } : undefined,
        recipeIngredient: ingredients,
        recipeInstructions: (r.steps || []).map((s: string, i: number) => ({ '@type': 'HowToStep', position: i + 1, text: s })),
      };
      const crumbs = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Recipes', item: `${SITE}/recipes` },
        { '@type': 'ListItem', position: 2, name: r.title, item: pageUrl }] };
      const body = `<article><h1>${esc(r.title)}</h1><p>${esc(r.summary || '')}</p>`
        + `<p>${esc(DIETS[r.diet] || '')}${total ? ` · ${total} min` : ''}${r.kcal ? ` · ~${r.kcal} kcal` : ''}${r.protein_g ? ` · ${r.protein_g} g protein` : ''}</p>`
        + `<h2>Ingredients</h2><ul>${ingredients.map((i: string) => `<li>${esc(i)}</li>`).join('')}</ul>`
        + `<h2>Method</h2><ol>${(r.steps || []).map((s: string) => `<li>${esc(s)}</li>`).join('')}</ol>`
        + (r.tips ? `<p>${esc(r.tips)}</p>` : '') + `<p><a href="/recipes">More healthy recipes on Fitoor</a></p></article>`;
      html = inject(html, headTags({ title: `${r.title} | Fitoor Kitchen`, desc, url: pageUrl, image: imgUrl(r.image_path), type: 'article', ld })
        + `\n    <script type="application/ld+json">${jsonForScript(crumbs)}</script>`, body);
    }
  } catch { /* on any error just serve the SPA */ }
  const headers = new Headers(res.headers);
  headers.delete('content-length');
  headers.set('cache-control', 'public, max-age=0, must-revalidate');
  headers.set('netlify-cdn-cache-control', 'public, s-maxage=300, stale-while-revalidate=86400');
  return new Response(html, { status: res.status, headers });
};

export const config: Config = { path: ['/recipes', '/recipes/*'], excludedPath: ['/recipes/new', '/recipes/edit/*'] };
