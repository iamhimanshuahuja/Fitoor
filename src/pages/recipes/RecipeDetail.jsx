import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Printer, Share2, Pencil, Clock, Users, Flame, Dumbbell, ExternalLink } from 'lucide-react';
import QRCode from 'qrcode';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { DIETS, TAGS, MEALS, STATUS, RECIPE_COLS, recipeUrl, imageUrl, totalMin, SITE } from '../../lib/recipes';
import PublicShell, { DietDot, RecipeCover, RecipeCard } from '../../components/PublicShell';
import { Spinner } from '../../components/ui';

/** schema.org/Recipe for Google rich results (the Netlify edge function injects the same for crawlers). */
export function recipeJsonLd(r) {
  const iso = (m) => (m ? `PT${m}M` : undefined);
  return {
    '@context': 'https://schema.org', '@type': 'Recipe',
    name: r.title, description: r.summary || undefined,
    image: imageUrl(r.image_path) ? [imageUrl(r.image_path)] : [`${SITE}/icons/app-icon-512.png`],
    author: { '@type': 'Organization', name: r.by_staff ? 'Fitoor Kitchen' : 'Fitoor community' },
    datePublished: r.published_at ? r.published_at.slice(0, 10) : undefined,
    prepTime: iso(r.prep_min), cookTime: iso(r.cook_min), totalTime: iso(totalMin(r)),
    recipeYield: r.servings ? `${r.servings} servings` : undefined,
    recipeCategory: (r.meal_types || []).map((m) => MEALS[m]).join(', ') || undefined,
    recipeCuisine: 'Indian',
    keywords: [...(r.tags || []).map((t) => TAGS[t] || t), DIETS[r.diet]?.label].filter(Boolean).join(', '),
    suitableForDiet: r.diet === 'veg' ? 'https://schema.org/VegetarianDiet' : undefined,
    nutrition: r.kcal ? { '@type': 'NutritionInformation', calories: `${r.kcal} calories`, proteinContent: r.protein_g ? `${r.protein_g} g` : undefined, carbohydrateContent: r.carbs_g ? `${r.carbs_g} g` : undefined, fatContent: r.fat_g ? `${r.fat_g} g` : undefined } : undefined,
    recipeIngredient: (r.ingredients || []).map((i) => [i.qty, i.item].filter(Boolean).join(' ')),
    recipeInstructions: (r.steps || []).map((s, i) => ({ '@type': 'HowToStep', position: i + 1, text: s })),
  };
}

function setHead(r) {
  const desc = (r.summary || `${r.title}: healthy Indian recipe with calories and protein.`).slice(0, 160);
  document.title = `${r.title} | Fitoor Kitchen`;
  const meta = (attr, key, val) => {
    let el = document.head.querySelector(`meta[${attr}="${key}"]`);
    if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el); }
    el.setAttribute('content', val);
  };
  meta('name', 'description', desc);
  meta('property', 'og:title', r.title); meta('property', 'og:description', desc); meta('property', 'og:type', 'article');
  meta('property', 'og:url', recipeUrl(r.slug));
  if (imageUrl(r.image_path)) meta('property', 'og:image', imageUrl(r.image_path));
  let link = document.head.querySelector('link[rel="canonical"]');
  if (!link) { link = document.createElement('link'); link.rel = 'canonical'; document.head.appendChild(link); }
  link.href = recipeUrl(r.slug);
  let ld = document.getElementById('recipe-jsonld');
  if (!ld) { ld = document.createElement('script'); ld.type = 'application/ld+json'; ld.id = 'recipe-jsonld'; document.head.appendChild(ld); }
  ld.textContent = JSON.stringify(recipeJsonLd(r));
}

export default function RecipeDetail() {
  const { slug } = useParams();
  const { user, isSuper, isAdmin } = useAuth() || {};
  const [r, setR] = useState(undefined);
  const [qr, setQr] = useState('');
  const [related, setRelated] = useState([]);
  const [copied, setCopied] = useState(false);
  const [done, setDone] = useState({});

  useEffect(() => {
    setR(undefined); setDone({});
    supabase.from('recipes').select('*').eq('slug', slug).maybeSingle().then(({ data }) => setR(data || null));
  }, [slug]);

  useEffect(() => {
    if (!r) return;
    setHead(r);
    QRCode.toString(recipeUrl(r.slug), { type: 'svg', margin: 0, color: { dark: '#12261B', light: '#0000' } }).then(setQr).catch(() => {});
    if (r.status === 'public') {
      const k = `ft_viewed_${r.slug}`;
      try { if (!sessionStorage.getItem(k)) { sessionStorage.setItem(k, '1'); supabase.rpc('recipe_view', { p_slug: r.slug }); } } catch { /* ignore */ }
      supabase.from('recipes').select(RECIPE_COLS).eq('status', 'public').neq('id', r.id).eq('diet', r.diet).limit(12)
        .then(({ data }) => setRelated((data || []).sort((a, b) => (b.tags || []).filter((t) => (r.tags || []).includes(t)).length - (a.tags || []).filter((t) => (r.tags || []).includes(t)).length).slice(0, 3)));
    }
    return () => { document.getElementById('recipe-jsonld')?.remove(); };
  }, [r]);

  if (r === undefined) return <PublicShell><div className="center-pad"><Spinner /></div></PublicShell>;
  if (r === null) return <PublicShell><div className="center-pad"><h1>Recipe not found</h1><p>It may have been removed or is private.</p><Link className="btn btn-primary" to="/recipes">Browse recipes</Link></div></PublicShell>;

  const canEdit = user && (r.author_id === user.id || isSuper || (isAdmin && r.status === 'pending'));
  const mins = totalMin(r);
  const share = async () => {
    const url = recipeUrl(r.slug);
    if (navigator.share) { try { await navigator.share({ title: r.title, text: `${r.title} on Fitoor`, url }); return; } catch { /* cancelled */ } }
    await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  return (
    <PublicShell>
      <article className="recipe-page">
        <nav className="crumbs no-print" aria-label="Breadcrumb"><Link to="/recipes">Recipes</Link> › <Link to={`/recipes?diet=${r.diet}`}>{DIETS[r.diet]?.label}</Link></nav>
        {r.status !== 'public' && (
          <div className={`rp-status ${r.status} no-print`}><b>{STATUS[r.status]?.label}</b> · {STATUS[r.status]?.hint}{r.review_note ? <> · Coach note: “{r.review_note}”</> : null}</div>
        )}
        <header className="rp-head">
          <div className="rp-head-text">
            <div className="rp-badges"><DietDot diet={r.diet} label />{(r.meal_types || []).map((m) => <span key={m} className="chip sm">{MEALS[m]}</span>)}</div>
            <h1>{r.title}</h1>
            {r.summary && <p className="rp-summary">{r.summary}</p>}
            <ul className="rp-facts">
              {mins > 0 && <li><Clock size={16} /> <b>{mins} min</b><span>{r.prep_min ? `${r.prep_min} prep` : ''}{r.prep_min && r.cook_min ? ' + ' : ''}{r.cook_min ? `${r.cook_min} cook` : ''}</span></li>}
              {r.servings && <li><Users size={16} /> <b>{r.servings}</b><span>servings</span></li>}
              {r.kcal && <li><Flame size={16} /> <b>~{r.kcal}</b><span>kcal / serving</span></li>}
              {r.protein_g && <li><Dumbbell size={16} /> <b>{Math.round(r.protein_g)} g</b><span>protein / serving</span></li>}
            </ul>
            <div className="rp-tags">{(r.tags || []).map((t) => <Link key={t} to={`/recipes?tag=${t}`} className="chip sm">{TAGS[t] || t}</Link>)}</div>
            <div className="row gap wrap no-print rp-actions">
              <button className="btn btn-primary" onClick={() => window.print()}><Printer size={16} /> Print / Save PDF</button>
              <button className="btn btn-ghost" onClick={share}><Share2 size={16} /> {copied ? 'Link copied' : 'Share'}</button>
              {canEdit && <Link className="btn btn-ghost" to={`/recipes/edit/${r.id}`}><Pencil size={16} /> Edit</Link>}
            </div>
          </div>
          <RecipeCover r={r} className="rp-hero" />
        </header>

        <div className="rp-body">
          <section className="rp-ingredients">
            <h2>Ingredients</h2>
            <ul>
              {(r.ingredients || []).map((i, n) => (
                <li key={n} className={done[n] ? 'done' : ''}>
                  <label><input type="checkbox" className="no-print" checked={!!done[n]} onChange={() => setDone({ ...done, [n]: !done[n] })} /><span><b>{i.qty}</b> {i.item}</span></label>
                </li>
              ))}
            </ul>
            {r.kcal && (
              <div className="rp-nutrition">
                <h3>Nutrition per serving <small>(approx.)</small></h3>
                <dl><div><dt>Calories</dt><dd>{r.kcal}</dd></div>{r.protein_g != null && <div><dt>Protein</dt><dd>{r.protein_g} g</dd></div>}{r.carbs_g != null && <div><dt>Carbs</dt><dd>{r.carbs_g} g</dd></div>}{r.fat_g != null && <div><dt>Fat</dt><dd>{r.fat_g} g</dd></div>}</dl>
              </div>
            )}
          </section>
          <section className="rp-steps">
            <h2>Method</h2>
            <ol>{(r.steps || []).map((s, n) => <li key={n}>{s}</li>)}</ol>
            {r.tips && <div className="rp-tips"><b>Coach tip</b><p>{r.tips}</p></div>}
            <p className="rp-byline">{r.by_staff ? 'By Fitoor Kitchen' : 'Shared by the Fitoor community'}{r.published_at ? ` · ${new Date(r.published_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}</p>
            {r.source_url && <p className="rp-source">Reference: <a href={r.source_url} target="_blank" rel="noopener nofollow">{r.source_name || new URL(r.source_url).hostname} <ExternalLink size={12} /></a></p>}
          </section>
        </div>

        {/* Shown only on print / PDF */}
        <aside className="rp-print-about print-only">
          <div className="rp-qr" dangerouslySetInnerHTML={{ __html: qr }} />
          <div>
            <img src="/logo.svg" alt="Fitoor" height={44} />
            <p><b>About Fitoor.</b> Fitoor is a diet, gym and health tracker for India: log your thali with a photo, track weight and workouts, compare blood reports, and get feedback from a real coach.</p>
            <p>Scan for this recipe and more at <b>fitoor.life/recipes</b>. Plate se PR tak.</p>
          </div>
        </aside>

        {related.length > 0 && (
          <section className="rp-related no-print">
            <h2>You might also like</h2>
            <div className="recipe-grid">{related.map((x) => <RecipeCard key={x.id} r={x} />)}</div>
          </section>
        )}
        <section className="rp-cta no-print">
          <h2>Track this meal on Fitoor</h2>
          <p>Snap your plate, see calories and protein, and get a coach’s eye on your week.</p>
          <Link className="btn btn-pop" to={user ? '/app' : '/signup'}>{user ? 'Open the app' : 'Start free'}</Link>
        </section>
      </article>
    </PublicShell>
  );
}
