// Mobile copy of src/lib/recipes.js (constants are the same; upload uses the native image helper).
import { supabase, WEB_URL } from './supabase';
import { uploadPublic } from './media';

export const DIETS = {
  veg: { label: 'Veg', short: 'Veg', color: '#2FA35F', emoji: '🟢' },
  egg: { label: 'Eggetarian', short: 'Egg', color: '#FFB627', emoji: '🟡' },
  nonveg: { label: 'Non-veg', short: 'Non-veg', color: '#C0392B', emoji: '🔴' },
};
export const dietAllows = (pref) => (pref === 'veg' ? ['veg'] : pref === 'egg' ? ['veg', 'egg'] : ['veg', 'egg', 'nonveg']);
export const TAGS = {
  weight_loss: 'Weight loss', high_protein: 'High protein', low_gi: 'Low GI', diabetes_friendly: 'Diabetes-friendly', pcos_friendly: 'PCOS-friendly',
  heart_healthy: 'Heart healthy', gut_health: 'Gut health', quick: 'Under 20 min', no_cook: 'No cook', kid_friendly: 'Kid friendly',
};
export const MEALS = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack', drink: 'Drink' };
export const STATUS = {
  private: { label: 'Private', hint: 'Only you (and your coach) can see it' },
  pending: { label: 'In review', hint: 'Waiting for a coach to approve it for the website' },
  public: { label: 'Public', hint: 'Live on the Fitoor website' },
  rejected: { label: 'Needs changes', hint: 'A coach sent it back. See the note.' },
};
export const recipeUrl = (slug) => `${WEB_URL}/recipes/${slug}`;
export const imageUrl = (path) => (path ? supabase.storage.from('recipes').getPublicUrl(path).data.publicUrl : null);
export const totalMin = (r) => (Number(r.prep_min) || 0) + (Number(r.cook_min) || 0);
export const uploadRecipeImage = (userId, img) => uploadPublic('recipes', userId, img);
export const RECIPE_COLS = 'id, slug, title, summary, diet, tags, meal_types, prep_min, cook_min, servings, kcal, protein_g, image_path, by_staff, status, published_at, views, author_id';
const PALETTE = ['#C8F25A', '#FFB627', '#BBA8FF', '#8FD3FF', '#FFD0DC'];
export const coverColor = (r) => PALETTE[[...(r.slug || r.title || 'x')].reduce((s, c) => s + c.charCodeAt(0), 0) % PALETTE.length];
export const coverEmoji = (r) => {
  const t = (r.title || '').toLowerCase();
  return /egg|anda/.test(t) ? '🍳' : /chicken|mutton|fish|prawn/.test(t) ? '🍗' : /salad|sprout/.test(t) ? '🥗' : /oat|poha|upma|porridge/.test(t) ? '🥣'
    : /chilla|dosa|pancake|cheela/.test(t) ? '🫓' : /paneer|palak|dal|curry|sabzi/.test(t) ? '🍛' : /smoothie|juice|lassi|shake/.test(t) ? '🥤' : '🍽️';
};
