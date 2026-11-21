import { supabase } from './supabase';
import { compressImage } from './media';

export const DIETS = {
  veg: { label: 'Veg', short: 'Veg', color: '#2FA35F', emoji: '🟢' },
  egg: { label: 'Eggetarian', short: 'Egg', color: '#FFB627', emoji: '🟡' },
  nonveg: { label: 'Non-veg', short: 'Non-veg', color: '#C0392B', emoji: '🔴' },
};
/** Which diets a person can eat: veg → veg; egg → veg + egg; nonveg → all. */
export const dietAllows = (pref) => (pref === 'veg' ? ['veg'] : pref === 'egg' ? ['veg', 'egg'] : ['veg', 'egg', 'nonveg']);

export const TAGS = {
  weight_loss: 'Weight loss',
  high_protein: 'High protein',
  low_gi: 'Low GI',
  diabetes_friendly: 'Diabetes-friendly',
  pcos_friendly: 'PCOS-friendly',
  heart_healthy: 'Heart healthy',
  gut_health: 'Gut health',
  quick: 'Under 20 min',
  no_cook: 'No cook',
  kid_friendly: 'Kid friendly',
};
export const MEALS = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack', drink: 'Drink' };
export const STATUS = {
  private: { label: 'Private', hint: 'Only you (and your coach) can see it' },
  pending: { label: 'In review', hint: 'Waiting for a coach to approve it for the website' },
  public: { label: 'Public', hint: 'Live on the Fitoor website' },
  rejected: { label: 'Needs changes', hint: 'A coach sent it back. See the note.' },
};

export const SITE = 'https://fitoor.life';
export const recipeUrl = (slug) => `${SITE}/recipes/${slug}`;
export const imageUrl = (path) => (path ? supabase.storage.from('recipes').getPublicUrl(path).data.publicUrl : null);
export const totalMin = (r) => (Number(r.prep_min) || 0) + (Number(r.cook_min) || 0);

/** Upload a dish photo to the public 'recipes' bucket (compressed). */
export async function uploadRecipeImage(userId, file) {
  const body = await compressImage(file);
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
  const { error } = await supabase.storage.from('recipes').upload(path, body, { contentType: body.type || 'image/webp', upsert: false });
  if (error) throw error;
  return path;
}

export const RECIPE_COLS = 'id, slug, title, summary, diet, tags, meal_types, prep_min, cook_min, servings, kcal, protein_g, image_path, by_staff, status, published_at, views, author_id';

/** Same colour per recipe for the placeholder cover when there's no photo. */
export function coverStyle(r) {
  const palette = [['#C8F25A', '#2FA35F'], ['#FFB627', '#FF5D73'], ['#BBA8FF', '#8FD3FF'], ['#8FD3FF', '#C8F25A'], ['#FFD0DC', '#BBA8FF']];
  const n = [...(r.slug || r.title || 'x')].reduce((s, c) => s + c.charCodeAt(0), 0) % palette.length;
  return { background: `linear-gradient(135deg, ${palette[n][0]}, ${palette[n][1]})` };
}
export const coverEmoji = (r) => {
  const t = (r.title || '').toLowerCase();
  return /egg|anda/.test(t) ? '🍳' : /chicken|mutton|fish|prawn/.test(t) ? '🍗' : /salad|sprout/.test(t) ? '🥗' : /oat|poha|upma|porridge/.test(t) ? '🥣'
    : /chilla|dosa|pancake|cheela/.test(t) ? '🫓' : /paneer|palak|dal|curry|sabzi/.test(t) ? '🍛' : /smoothie|juice|lassi|shake/.test(t) ? '🥤' : '🍽️';
};
