import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { DIETS, TAGS, MEALS, RECIPE_COLS, dietAllows } from '../../lib/recipes';
import PublicShell, { RecipeCard } from '../../components/PublicShell';
import { Spinner, Empty } from '../../components/ui';

const DIET_FILTERS = [['', 'All'], ['veg', 'Veg only'], ['egg', 'Veg + egg'], ['nonveg', 'Non-veg']];

/** Public recipe book: /recipes?diet=veg&tag=weight_loss&meal=breakfast&q=chilla */
export default function RecipeList() {
  const { profile, user } = useAuth() || {};
  const [sp, setSp] = useSearchParams();
  const [rows, setRows] = useState(null);
  const q = sp.get('q') || '';
  const tag = sp.get('tag') || '';
  const meal = sp.get('meal') || '';
  const diet = sp.has('diet') ? sp.get('diet') : (profile?.diet_pref || '');
  const set = (k, v) => { const n = new URLSearchParams(sp); if (v) n.set(k, v); else if (k === 'diet') n.set('diet', ''); else n.delete(k); setSp(n, { replace: true }); };

  useEffect(() => {
    supabase.from('recipes').select(RECIPE_COLS).eq('status', 'public').order('published_at', { ascending: false }).limit(300)
      .then(({ data }) => setRows(data || []));
  }, []);

  useEffect(() => {
    const parts = [tag && TAGS[tag], diet === 'veg' ? 'Veg' : diet === 'egg' ? 'Eggetarian' : diet === 'nonveg' ? 'Non-veg' : '', meal && MEALS[meal]].filter(Boolean);
    document.title = `${parts.length ? parts.join(' ') + ' ' : 'Healthy Indian '}Recipes | Fitoor Kitchen`;
  }, [tag, diet, meal]);

  const list = useMemo(() => (rows || []).filter((r) =>
    (!diet || dietAllows(diet).includes(r.diet))
    && (!tag || (r.tags || []).includes(tag))
    && (!meal || (r.meal_types || []).includes(meal))
    && (!q || `${r.title} ${r.summary || ''}`.toLowerCase().includes(q.toLowerCase()))), [rows, diet, tag, meal, q]);

  return (
    <PublicShell>
      <section className="rl-hero">
        <p className="rl-kicker">Fitoor Kitchen</p>
        <h1>Healthy Indian recipes that fit your plate</h1>
        <p>High-protein breakfasts, weight-loss friendly thalis, PCOS-friendly and low-GI meals. Real home food, with calories and protein for every recipe.</p>
        {user && <Link to="/recipes/new" className="btn btn-primary"><Plus size={16} /> Add your recipe</Link>}
      </section>

      <section className="rl-filters" aria-label="Filter recipes">
        <div className="search"><Search size={16} /><input placeholder="Search chilla, paneer, oats…" value={q} onChange={(e) => set('q', e.target.value)} aria-label="Search recipes" /></div>
        <div className="chips-row" role="group" aria-label="Diet">
          {DIET_FILTERS.map(([k, l]) => <button key={k || 'all'} className={`chip ${diet === k ? 'on' : ''}`} aria-pressed={diet === k} onClick={() => set('diet', k)}>{k && <span className={`diet-dot ${k}`}><i /></span>}{l}</button>)}
        </div>
        <div className="chips-row" role="group" aria-label="Health goal">
          <button className={`chip ${!tag ? 'on' : ''}`} onClick={() => set('tag', '')}>Any goal</button>
          {Object.entries(TAGS).map(([k, l]) => <button key={k} className={`chip ${tag === k ? 'on' : ''}`} aria-pressed={tag === k} onClick={() => set('tag', tag === k ? '' : k)}>{l}</button>)}
        </div>
        <div className="chips-row" role="group" aria-label="Meal">
          <button className={`chip ${!meal ? 'on' : ''}`} onClick={() => set('meal', '')}>Any meal</button>
          {Object.entries(MEALS).map(([k, l]) => <button key={k} className={`chip ${meal === k ? 'on' : ''}`} aria-pressed={meal === k} onClick={() => set('meal', meal === k ? '' : k)}>{l}</button>)}
        </div>
        {profile && !profile.diet_pref && <p className="small muted">Tip: set what you eat (veg / egg / non-veg) under <Link to="/app/profile">Me</Link> and we’ll filter recipes for you.</p>}
      </section>

      {!rows ? <div className="center-pad"><Spinner /></div> : list.length ? (
        <>
          <p className="small muted rl-count">{list.length} recipe{list.length > 1 ? 's' : ''}</p>
          <div className="recipe-grid">{list.map((r) => <RecipeCard key={r.id} r={r} />)}</div>
        </>
      ) : <Empty>No recipes match these filters yet. Try another goal{user ? ', or add your own' : ''}.</Empty>}
    </PublicShell>
  );
}
