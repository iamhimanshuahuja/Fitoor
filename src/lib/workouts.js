// Workout helpers shared by the manual logger, log-by-chat, Today, Gym and the mobile app.
import { supabase } from './supabase';

const num = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v));

/** "12x17.5, 10×25kg, 6 x 30, x65, 15" → [{reps, weight_kg}] (x65 = weight with reps unknown, 15 = 15 reps bodyweight). */
export function parseSets(text) {
  const t = String(text || '').toLowerCase().replace(/reps?|kgs?/g, ' ');
  // reps × weight, e.g. 12x17.5 · 12 x 17,5 · x65 (weight's decimal comma only when not followed by another "x")
  const re = /(\d+)?\s*[x×*]\s*(\d+(?:[.,]\d+(?!\s*[x×*]))?)/g;
  const out = [];
  let m;
  while ((m = re.exec(t))) out.push({ reps: m[1] ? Number(m[1]) : null, weight_kg: Number(m[2].replace(',', '.')) });
  if (out.length) return out;
  // only numbers → reps with bodyweight, e.g. "15, 12, 10"
  return (t.match(/\d+/g) || []).map((r) => ({ reps: Number(r), weight_kg: null }));
}

/** One set as text: "12×17.5kg", "?×65kg", "15 reps", "20 min · incline 8 · 2 km". */
export function fmtSet(s) {
  if (s.duration_min || s.distance_km) {
    return [s.duration_min && `${num(s.duration_min)} min`, s.incline && `incline ${num(s.incline)}`, s.distance_km && `${num(s.distance_km)} km`].filter(Boolean).join(' · ');
  }
  if (s.weight_kg != null && s.weight_kg !== '') return `${s.reps ?? '?'}×${num(s.weight_kg)}kg`;
  return s.reps ? `${s.reps} reps` : '—';
}
export const fmtSets = (sets) => (sets || []).map(fmtSet).join(' · ');

/** Estimated one-rep max (Epley). */
export const e1rm = (kg, reps) => (kg ? Math.round(kg * (1 + (Number(reps) || 1) / 30) * 2) / 2 : 0);

/** Better set = heavier; same weight → more reps. */
const better = (a, b) => !b || a.kg > b.kg || (a.kg === b.kg && (a.reps || 0) > (b.reps || 0));

/** rows: [{exercise_id, name, reps, weight_kg, log_date}] → { [exercise_id]: { name, kg, reps, date, e1rm } } (heaviest set per exercise). */
export function bestSets(rows) {
  const m = {};
  (rows || []).forEach((r) => {
    const kg = num(r.weight_kg);
    if (!kg) return;
    const cand = { name: r.name, kg, reps: num(r.reps), date: r.log_date, e1rm: e1rm(kg, r.reps) };
    if (better(cand, m[r.exercise_id])) m[r.exercise_id] = cand;
  });
  return m;
}

/** Personal records for a user, optionally only from days before `beforeDate` (to spot new PRs on that day). */
export async function loadBests(userId, beforeDate) {
  let q = supabase.from('workout_sets').select('exercise_id, reps, weight_kg, exercises(name), workouts!inner(log_date)')
    .eq('user_id', userId).not('weight_kg', 'is', null).limit(5000);
  if (beforeDate) q = q.lt('workouts.log_date', beforeDate);
  const { data } = await q;
  return bestSets((data || []).map((r) => ({ exercise_id: r.exercise_id, name: r.exercises?.name, reps: r.reps, weight_kg: r.weight_kg, log_date: r.workouts?.log_date })));
}

/** PR list, newest first: [{ exercise_id, name, kg, reps, date, e1rm, isNew }] (isNew = set in the last 7 days). */
export function prList(bests, today) {
  const week = new Date(`${today}T00:00:00`); week.setDate(week.getDate() - 7);
  const wk = week.toISOString().slice(0, 10);
  return Object.entries(bests).map(([exercise_id, b]) => ({ exercise_id, ...b, isNew: b.date >= wk }))
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.kg - a.kg);
}

/** Top set of an exercise's sets on a day → is it a PR vs `prev` (best before that day)? */
export function isPR(sets, prev) {
  const top = (sets || []).reduce((t, s) => { const c = { kg: num(s.weight_kg) || 0, reps: num(s.reps) }; return c.kg && better(c, t) ? c : t; }, null);
  return !!top && (!prev || better(top, prev));
}

/**
 * Save a workout the way the chat does: one workout per day + day label.
 * If that day already has a workout with the same label, the exercises are added to it, and an exercise that is
 * already in it has its sets REPLACED (a re-log is a correction, not a second time).
 * items: [{ exercise_id, sets: [{reps, weight_kg, duration_min, incline, distance_km}] }]
 */
export async function saveWorkout(userId, date, { day_label = null, duration_min = null, notes = null, items = [] }) {
  const label = day_label?.trim() || null;
  let q = supabase.from('workouts').select('id, duration_min, notes').eq('user_id', userId).eq('log_date', date).order('created_at').limit(1);
  q = label ? q.eq('day_label', label) : q.is('day_label', null);
  const { data: found, error: e0 } = await q;
  if (e0) throw e0;
  let w = found?.[0];
  if (w) {
    const patch = {};
    if (num(duration_min)) patch.duration_min = Math.max(num(duration_min), num(w.duration_min) || 0);
    const note = notes?.trim();
    if (note && !(w.notes || '').includes(note)) patch.notes = [w.notes, note].filter(Boolean).join(' · ');
    if (Object.keys(patch).length) { const { error } = await supabase.from('workouts').update(patch).eq('id', w.id); if (error) throw error; }
    const exIds = [...new Set(items.map((i) => i.exercise_id))];
    if (exIds.length) { const { error } = await supabase.from('workout_sets').delete().eq('workout_id', w.id).in('exercise_id', exIds); if (error) throw error; }
  } else {
    const { data, error } = await supabase.from('workouts').insert({ user_id: userId, log_date: date, day_label: label, duration_min: num(duration_min), notes: notes?.trim() || null }).select('id').single();
    if (error) throw error;
    w = data;
  }
  const rows = items.flatMap((it) => (it.sets?.length ? it.sets : [{}]).map((s, k) => ({
    workout_id: w.id, user_id: userId, exercise_id: it.exercise_id, set_no: k + 1,
    reps: num(s.reps), weight_kg: num(s.weight_kg), duration_min: num(s.duration_min), incline: num(s.incline), distance_km: num(s.distance_km),
  })));
  if (rows.length) { const { error } = await supabase.from('workout_sets').insert(rows); if (error) throw error; }
  return { workout_id: w.id, merged: !!found?.[0] };
}
