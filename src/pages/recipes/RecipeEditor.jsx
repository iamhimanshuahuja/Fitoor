import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, ImagePlus, Camera, ArrowUp, ArrowDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { cheer } from '../../lib/cheer';
import { DIETS, TAGS, MEALS, STATUS, uploadRecipeImage } from '../../lib/recipes';
import PublicShell, { RecipeCover } from '../../components/PublicShell';
import { Card, Spinner, useToast } from '../../components/ui';

const EMPTY = {
  title: '', summary: '', diet: 'veg', tags: [], meal_types: [], prep_min: '', cook_min: '', servings: 2,
  kcal: '', protein_g: '', carbs_g: '', fat_g: '', ingredients: [{ qty: '', item: '' }, { qty: '', item: '' }, { qty: '', item: '' }],
  steps: ['', ''], tips: '', image_path: null, source_name: '', source_url: '', status: 'private',
};
const num = (v) => (v === '' || v == null ? null : Number(v));

/** /recipes/new and /recipes/edit/:id — clients, coaches and the super admin. */
export default function RecipeEditor() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user, profile, isAdmin, isSuper } = useAuth();
  const [f, setF] = useState(id ? null : { ...EMPTY, diet: profile?.diet_pref === 'nonveg' ? 'nonveg' : profile?.diet_pref === 'egg' ? 'egg' : 'veg' });
  const [busy, setBusy] = useState(false);
  const [imgBusy, setImgBusy] = useState(false);
  const [toast, show] = useToast();

  useEffect(() => {
    if (!id) return;
    supabase.from('recipes').select('*').eq('id', id).maybeSingle().then(({ data }) => {
      if (!data) { show('Recipe not found or not yours to edit', 'bad'); return; }
      setF({ ...EMPTY, ...data, ingredients: data.ingredients?.length ? data.ingredients : EMPTY.ingredients, steps: data.steps?.length ? data.steps : EMPTY.steps,
        prep_min: data.prep_min ?? '', cook_min: data.cook_min ?? '', kcal: data.kcal ?? '', protein_g: data.protein_g ?? '', carbs_g: data.carbs_g ?? '', fat_g: data.fat_g ?? '' });
    });
  }, [id]);

  if (!f) return <PublicShell><div className="center-pad"><Spinner />{toast}</div></PublicShell>;
  const set = (k, v) => setF({ ...f, [k]: v });
  const toggle = (k, v) => set(k, f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v]);
  const setIng = (i, k, v) => set('ingredients', f.ingredients.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const setStep = (i, v) => set('steps', f.steps.map((x, j) => (j === i ? v : x)));
  const moveStep = (i, d) => { const s = [...f.steps]; const j = i + d; if (j < 0 || j >= s.length) return; [s[i], s[j]] = [s[j], s[i]]; set('steps', s); };
  const ownsIt = !id || f.author_id === user.id;
  const reviewingOther = id && !ownsIt && isAdmin;

  const pickImage = async (e) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    setImgBusy(true);
    try { set('image_path', await uploadRecipeImage(user.id, file)); } catch (err) { show(err.message, 'bad'); }
    setImgBusy(false);
  };

  const save = async (e) => {
    e.preventDefault();
    const ingredients = f.ingredients.filter((x) => x.item.trim()).map((x) => ({ qty: x.qty.trim(), item: x.item.trim() }));
    const steps = f.steps.map((s) => s.trim()).filter(Boolean);
    if (f.title.trim().length < 3) return show('Give your recipe a name', 'bad');
    if (!ingredients.length) return show('Add at least one ingredient', 'bad');
    if (!steps.length) return show('Add at least one step', 'bad');
    if (f.source_url && !/^https?:\/\//i.test(f.source_url.trim())) return show('Reference link should start with https://', 'bad');
    setBusy(true);
    const row = {
      title: f.title.trim(), summary: f.summary.trim() || null, diet: f.diet, tags: f.tags, meal_types: f.meal_types,
      prep_min: num(f.prep_min), cook_min: num(f.cook_min), servings: num(f.servings), kcal: num(f.kcal), protein_g: num(f.protein_g), carbs_g: num(f.carbs_g), fat_g: num(f.fat_g),
      ingredients, steps, tips: f.tips.trim() || null, image_path: f.image_path, source_name: f.source_name.trim() || null, source_url: f.source_url.trim() || null, status: f.status,
    };
    const res = id ? await supabase.from('recipes').update(row).eq('id', id).select('slug, status').single() : await supabase.from('recipes').insert(row).select('slug, status').single();
    setBusy(false);
    if (res.error) return show(res.error.message, 'bad');
    cheer(res.data.status === 'pending' ? 'recipe_review' : res.data.status === 'public' ? 'recipe_public' : 'recipe');
    nav(`/recipes/${res.data.slug}`);
  };

  const visibility = isAdmin
    ? [['private', 'Private', 'Only you can see it'], ['public', 'Public on the website', 'Anyone can find it on fitoor.life/recipes']]
    : [['private', 'Private', 'Only you and your coach'], ['public', 'Share on the website', 'A coach reviews it first, then it goes live']];

  return (
    <PublicShell>
      {toast}
      <form className="recipe-editor" onSubmit={save}>
        <h1>{id ? 'Edit recipe' : 'Add a recipe'}</h1>
        {reviewingOther && <p className="rp-status pending">You’re editing a client’s recipe that’s waiting for review.</p>}
        {f.status === 'rejected' && f.review_note && <p className="rp-status rejected"><b>Coach note:</b> {f.review_note}</p>}

        <Card title="Basics">
          <label>Recipe name<input value={f.title} onChange={(e) => set('title', e.target.value)} maxLength={120} placeholder="e.g. Paneer besan chilla" required /></label>
          <label>Short description<textarea rows={2} value={f.summary} onChange={(e) => set('summary', e.target.value)} maxLength={300} placeholder="One or two lines: what it is and why it’s good" /></label>
          <div className="re-photo">
            <RecipeCover r={{ ...f, image_path: f.image_path }} className="re-photo-img" />
            <div>
              <b>Photo of the final dish</b>
              <p className="small muted">A real photo helps people try it. It’s shown publicly if the recipe is public.</p>
              <div className="row gap wrap">
                <label className="btn btn-soft btn-sm">{imgBusy ? <Spinner size={14} /> : <Camera size={15} />} Camera<input type="file" accept="image/*" capture="environment" hidden onChange={pickImage} /></label>
                <label className="btn btn-ghost btn-sm"><ImagePlus size={15} /> Gallery<input type="file" accept="image/*" hidden onChange={pickImage} /></label>
                {f.image_path && <button type="button" className="btn btn-ghost btn-sm" onClick={() => set('image_path', null)}>Remove</button>}
              </div>
            </div>
          </div>
          <div className="re-row">
            <span className="re-label">Diet</span>
            <div className="chips-row">{Object.entries(DIETS).map(([k, d]) => <button type="button" key={k} className={`chip ${f.diet === k ? 'on' : ''}`} aria-pressed={f.diet === k} onClick={() => set('diet', k)}><span className={`diet-dot ${k}`}><i /></span>{d.label}</button>)}</div>
          </div>
          <div className="re-row">
            <span className="re-label">Meal</span>
            <div className="chips-row">{Object.entries(MEALS).map(([k, l]) => <button type="button" key={k} className={`chip ${f.meal_types.includes(k) ? 'on' : ''}`} aria-pressed={f.meal_types.includes(k)} onClick={() => toggle('meal_types', k)}>{l}</button>)}</div>
          </div>
          <div className="re-row">
            <span className="re-label">Good for</span>
            <div className="chips-row">{Object.entries(TAGS).map(([k, l]) => <button type="button" key={k} className={`chip ${f.tags.includes(k) ? 'on' : ''}`} aria-pressed={f.tags.includes(k)} onClick={() => toggle('tags', k)}>{l}</button>)}</div>
          </div>
          <div className="re-nums">
            <label>Prep (min)<input type="number" min="0" value={f.prep_min} onChange={(e) => set('prep_min', e.target.value)} /></label>
            <label>Cook (min)<input type="number" min="0" value={f.cook_min} onChange={(e) => set('cook_min', e.target.value)} /></label>
            <label>Servings<input type="number" min="1" value={f.servings} onChange={(e) => set('servings', e.target.value)} /></label>
          </div>
        </Card>

        <Card title="Ingredients">
          {f.ingredients.map((x, i) => (
            <div key={i} className="re-ing">
              <input value={x.qty} onChange={(e) => setIng(i, 'qty', e.target.value)} placeholder="1 cup" aria-label={`Quantity ${i + 1}`} />
              <input value={x.item} onChange={(e) => setIng(i, 'item', e.target.value)} placeholder="moong dal, soaked" aria-label={`Ingredient ${i + 1}`} />
              <button type="button" className="icon-btn sm" onClick={() => set('ingredients', f.ingredients.filter((_, j) => j !== i))} aria-label="Remove ingredient"><Trash2 size={14} /></button>
            </div>
          ))}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => set('ingredients', [...f.ingredients, { qty: '', item: '' }])}><Plus size={15} /> Add ingredient</button>
        </Card>

        <Card title="Method">
          {f.steps.map((s, i) => (
            <div key={i} className="re-step">
              <span className="re-step-n">{i + 1}</span>
              <textarea rows={2} value={s} onChange={(e) => setStep(i, e.target.value)} placeholder="Describe this step" aria-label={`Step ${i + 1}`} />
              <div className="re-step-btns">
                <button type="button" className="icon-btn sm" onClick={() => moveStep(i, -1)} aria-label="Move up"><ArrowUp size={14} /></button>
                <button type="button" className="icon-btn sm" onClick={() => moveStep(i, 1)} aria-label="Move down"><ArrowDown size={14} /></button>
                <button type="button" className="icon-btn sm" onClick={() => set('steps', f.steps.filter((_, j) => j !== i))} aria-label="Remove step"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => set('steps', [...f.steps, ''])}><Plus size={15} /> Add step</button>
          <label>Tip (optional)<textarea rows={2} value={f.tips} onChange={(e) => set('tips', e.target.value)} placeholder="Swaps, storage, how to make it lighter…" /></label>
        </Card>

        <Card title="Nutrition per serving (optional, approx.)">
          <div className="re-nums four">
            <label>kcal<input type="number" min="0" value={f.kcal} onChange={(e) => set('kcal', e.target.value)} /></label>
            <label>Protein g<input type="number" min="0" step="0.1" value={f.protein_g} onChange={(e) => set('protein_g', e.target.value)} /></label>
            <label>Carbs g<input type="number" min="0" step="0.1" value={f.carbs_g} onChange={(e) => set('carbs_g', e.target.value)} /></label>
            <label>Fat g<input type="number" min="0" step="0.1" value={f.fat_g} onChange={(e) => set('fat_g', e.target.value)} /></label>
          </div>
          <div className="re-nums">
            <label>Reference / inspired by (optional)<input value={f.source_name} onChange={(e) => set('source_name', e.target.value)} placeholder="e.g. Mom’s recipe, or a website name" /></label>
            <label>Reference link<input type="url" value={f.source_url} onChange={(e) => set('source_url', e.target.value)} placeholder="https://…" /></label>
          </div>
          <p className="small muted">Please write steps in your own words; don’t copy text or photos from other websites.</p>
        </Card>

        <Card title="Who can see it">
          {(ownsIt || !isAdmin) ? visibility.map(([k, l, h]) => (
            <label key={k} className={`re-vis ${(f.status === k || (k === 'public' && f.status === 'pending')) ? 'on' : ''}`}>
              <input type="radio" name="vis" checked={f.status === k || (k === 'public' && ['pending', 'public'].includes(f.status))} onChange={() => set('status', k)} />
              <span><b>{l}</b><small>{h}</small></span>
            </label>
          )) : (
            <div className="row gap wrap">
              <label className={`re-vis ${f.status === 'public' ? 'on' : ''}`}><input type="radio" name="vis" checked={f.status === 'public'} onChange={() => set('status', 'public')} /><span><b>Approve & publish</b></span></label>
              <label className={`re-vis ${f.status === 'pending' ? 'on' : ''}`}><input type="radio" name="vis" checked={f.status === 'pending'} onChange={() => set('status', 'pending')} /><span><b>Keep in review</b></span></label>
            </div>
          )}
          {id && f.status && <p className="small muted">Current status: {STATUS[f.status]?.label}</p>}
        </Card>

        <div className="row gap re-save">
          <button className="btn btn-primary" disabled={busy}>{busy ? <Spinner /> : id ? 'Save changes' : 'Save recipe'}</button>
          <button type="button" className="btn btn-ghost" onClick={() => nav(-1)}>Cancel</button>
          {id && (ownsIt || isSuper) && <button type="button" className="btn btn-ghost danger" onClick={async () => { if (confirm('Delete this recipe?')) { await supabase.from('recipes').delete().eq('id', id); nav('/recipes'); } }}><Trash2 size={15} /> Delete</button>}
        </div>
      </form>
    </PublicShell>
  );
}
