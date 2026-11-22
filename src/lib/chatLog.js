import { SITE_KEYS } from './measure';
import { supabase } from './supabase';
import { saveWorkout } from './workouts';
import { runAI } from './ai';
import { today, addDays } from './dates';
import { SLOTS, HABITS, SUPPLEMENTS, DAY_LABELS, MUSCLES, EQUIPMENT } from './constants';

/** Which feature each action type needs. */
export const ACTION_FEATURE = { meal: 'meals', weight: 'weight', water: 'habits', habit: 'habits', supplement: 'supplements', workout: 'gym', period: null, measure: 'weight' };
/** Can this user save this kind of entry? (null = no plan feature needed) */
export const actionAllowed = (a, has) => a.type in ACTION_FEATURE && (!ACTION_FEATURE[a.type] || has(ACTION_FEATURE[a.type]));

/** Ask the AI to turn a chat message (and optional photo) into log entries. Nothing is saved here. */
// Tell the AI which entry cards were actually saved, so it never claims something is logged when the save failed or was skipped.
const cardNote = (m) => (m.actions?.length
  ? ` [entry cards: ${m.actions.map((a) => `${a.type}${a.description ? ` "${a.description}"` : ''}: ${a._status === 'saved' ? 'SAVED' : a._status === 'skipped' ? 'skipped by user' : 'NOT saved'}${a._msg && a._status !== 'saved' ? ` (${a._msg})` : ''}`).join('; ')}]`
  : '');

export async function askChat({ userId, text, image, mime, history }) {
  const [{ data: plan }, { data: ex }] = await Promise.all([
    supabase.from('diet_plans').select('slots').eq('user_id', userId).eq('is_active', true).maybeSingle(),
    supabase.from('exercises').select('name').order('name').limit(300),
  ]);
  const planSlots = {};
  (plan?.slots || []).forEach((s) => { planSlots[s.key] = { title: s.title, avoid: s.avoid || [] }; });
  const now = new Date();
  return runAI('chat', {
    text, image, mime,
    today: today(), weekday: now.toLocaleDateString('en-IN', { weekday: 'long' }),
    now: now.toTimeString().slice(0, 5),
    slots: SLOTS.map((s) => ({ key: s.key, label: s.label, time: s.time })),
    plan: planSlots,
    habits: HABITS.map((h) => h.key), supplements: SUPPLEMENTS.map((s) => s.key), day_labels: DAY_LABELS,
    library: (ex || []).map((e) => e.name),
    history: (history || []).map((m) => ({ from: m.role, text: m.text + cardNote(m) })).slice(-8),
  });
}

const n = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v));
/** AI dates must be real and not in the future; anything else falls back to today. */
const safeDate = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d || '') && d <= today() && d >= addDays(today(), -60) ? d : today());

/** True when the person switched on 🍕 Cheat day for that date (meals logged that day are tagged cheat). */
export async function isCheatDay(userId, date) {
  const { data } = await supabase.from('habit_logs').select('habits').eq('user_id', userId).eq('log_date', date).maybeSingle();
  return !!data?.habits?.cheat_day;
}

async function mergeHabits(userId, date, fn) {
  const { data } = await supabase.from('habit_logs').select('habits, supplements').eq('user_id', userId).eq('log_date', date).maybeSingle();
  const next = fn({ habits: { ...(data?.habits || {}) }, supplements: { ...(data?.supplements || {}) } });
  const { error } = await supabase.from('habit_logs').upsert({ user_id: userId, log_date: date, ...next }, { onConflict: 'user_id,log_date' });
  if (error) throw error;
}

/** Save one confirmed action. Returns a short "what was saved" string. */
export async function saveAction(userId, a, photoPath) {
  const date = safeDate(a.date);
  if (a.type === 'meal') {
    const slot = SLOTS.some((s) => s.key === a.slot) ? a.slot : 'other';
    const cheat = await isCheatDay(userId, date);
    const followed = cheat ? null : a.plan_check === 'on_plan' ? true : a.plan_check === 'off_plan' ? false : null;
    const { error } = await supabase.from('meal_logs').insert({
      user_id: userId, log_date: date, slot, description: a.description || null,
      photo_path: a.uses_photo ? photoPath || null : null, followed, cheat,
      kcal: n(a.kcal), protein_g: n(a.protein_g), carbs_g: n(a.carbs_g), fat_g: n(a.fat_g),
      ai: { source: 'chat', plan_check: a.plan_check, plan_note: a.plan_note, items: a.description ? [a.description] : [] },
    });
    if (error) throw error;
    return 'Meal saved';
  }
  if (a.type === 'weight') {
    const kg = n(a.weight_kg);
    if (!kg || kg < 20 || kg > 400) throw new Error('Check the weight');
    const waist = n(a.waist_cm);
    const row = { user_id: userId, log_date: date, weight_kg: kg, source: a.uses_photo ? 'ai' : 'manual' };
    if (waist && waist > 30 && waist < 250) row.waist_cm = waist;
    if (a.uses_photo && photoPath) row.photo_path = photoPath;
    const { error } = await supabase.from('weight_logs').upsert(row, { onConflict: 'user_id,log_date' });
    if (error) throw error;
    return 'Weight saved';
  }
  if (a.type === 'measure') {
    // inches; merge into that day's row so a second message doesn't wipe other spots
    const { data: prev } = await supabase.from('body_measurements').select('*').eq('user_id', userId).eq('log_date', date).maybeSingle();
    const row = { user_id: userId, log_date: date };
    let any = false;
    for (const k of SITE_KEYS) {
      const v = n(a[k]);
      if (v != null && v > 3 && v < 90) { row[k] = v; any = true; } else if (prev?.[k] != null) row[k] = prev[k];
    }
    if (!any) throw new Error('Check the measurements (inches)');
    const { error } = await supabase.from('body_measurements').upsert(row, { onConflict: 'user_id,log_date' });
    if (error) throw error;
    return 'Measurements saved';
  }
  if (a.type === 'water') {
    const g = Math.max(0, Math.round(n(a.glasses) || 0));
    if (!g) throw new Error('How many glasses?');
    await mergeHabits(userId, date, (x) => ({ ...x, habits: { ...x.habits, water_glasses: Number(x.habits.water_glasses || 0) + g } }));
    return `+${g} glass${g > 1 ? 'es' : ''} of water`;
  }
  if (a.type === 'habit') {
    if (!HABITS.some((h) => h.key === a.key)) throw new Error('Unknown habit');
    await mergeHabits(userId, date, (x) => ({ ...x, habits: { ...x.habits, [a.key]: true } }));
    return 'Habit ticked';
  }
  if (a.type === 'supplement') {
    if (!SUPPLEMENTS.some((s) => s.key === a.key)) throw new Error('Unknown supplement');
    await mergeHabits(userId, date, (x) => ({ ...x, supplements: { ...x.supplements, [a.key]: true } }));
    return 'Supplement ticked';
  }
  if (a.type === 'period') {
    if (a.event === 'end') {
      const { data: open } = await supabase.from('period_logs').select('id, start_date').eq('user_id', userId).is('end_date', null)
        .lte('start_date', date).order('start_date', { ascending: false }).limit(1).maybeSingle();
      if (!open) throw new Error('No open period to end. Log when it started first.');
      const { error } = await supabase.from('period_logs').update({ end_date: date }).eq('id', open.id);
      if (error) throw error;
      return 'Period end saved';
    }
    const { error } = await supabase.from('period_logs').insert({ user_id: userId, start_date: date });
    if (error) throw new Error(/duplicate|unique/i.test(error.message) ? 'Already logged for that day' : error.message);
    return 'Period start saved';
  }
  if (a.type === 'workout') {
    const exs = (a.exercises || []).filter((e) => e.name);
    if (!exs.length && !n(a.duration_min)) throw new Error('Add at least one exercise');
    const { data: lib } = await supabase.from('exercises').select('id, name');
    const ids = [];
    for (const e of exs) {
      let hit = (lib || []).find((x) => x.name.toLowerCase() === e.name.trim().toLowerCase());
      if (!hit) {
        const { data, error } = await supabase.from('exercises').insert({
          name: e.name.trim(), kind: ['strength', 'cardio', 'mobility'].includes(e.kind) ? e.kind : 'strength',
          muscle_group: MUSCLES.includes(e.muscle_group) ? e.muscle_group : 'full_body',
          equipment: EQUIPMENT.includes(e.equipment) ? e.equipment : 'other',
        }).select('id, name').single();
        if (error) throw error;
        hit = data;
      }
      ids.push(hit.id);
    }
    const { merged } = await saveWorkout(userId, date, {
      day_label: a.day_label || null, duration_min: n(a.duration_min), notes: a.notes || null,
      items: exs.map((e, i) => ({ exercise_id: ids[i], sets: e.sets || [] })),
    });
    return merged ? `Added to your ${a.day_label || ''} workout 💪`.replace('  ', ' ') : 'Workout saved 💪';
  }
  throw new Error('Unknown entry');
}

/** Tell open screens (Today, Calendar…) to reload. */
export const notifyDataChanged = () => window.dispatchEvent(new Event('ft:data-changed'));
