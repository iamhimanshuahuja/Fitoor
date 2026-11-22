// Collects a compact snapshot of one person's recent logs for "Ask AI". Runs with the caller's own permissions (RLS),
// so a client only sends their own data and a coach only their client's.
import { supabase } from './supabase';
import { addDays, today } from './dates';

export async function buildAskData(userId) {
  const d14 = addDays(today(), -14), d60 = addDays(today(), -60);
  const [p, meals, weights, workouts, habits, labs, plan, measures] = await Promise.all([
    supabase.from('profiles').select('full_name, gender, dob, height_cm, start_weight, target_weight, goal, diet_pref, pcos, pregnancy').eq('id', userId).maybeSingle(),
    supabase.from('meal_logs').select('log_date, slot, description, kcal, protein_g, carbs_g, fat_g, followed, cheat').eq('user_id', userId).gte('log_date', d14).order('log_date', { ascending: false }).limit(120),
    supabase.from('weight_logs').select('log_date, weight_kg, waist_cm').eq('user_id', userId).gte('log_date', d60).order('log_date', { ascending: false }).limit(60),
    supabase.from('workouts').select('log_date, day_label, duration_min, workout_sets(set_no, reps, weight_kg, duration_min, incline, distance_km, exercises(name))').eq('user_id', userId).gte('log_date', d60).order('log_date', { ascending: false }).limit(40),
    supabase.from('habit_logs').select('log_date, habits, supplements').eq('user_id', userId).gte('log_date', d14).order('log_date', { ascending: false }),
    supabase.from('lab_results').select('test_name, value, value_text, unit, ref_low, ref_high, flag, lab_reports(report_date)').eq('user_id', userId).limit(300),
    supabase.from('diet_plans').select('slots, guidelines').eq('user_id', userId).eq('is_active', true).limit(1).maybeSingle(),
    supabase.from('body_measurements').select('*').eq('user_id', userId).order('log_date', { ascending: false }).limit(6),
  ]);
  const prof = p.data || {};
  return {
    today: today(),
    person: { name: prof.full_name?.split(' ')[0], gender: prof.gender, height_cm: prof.height_cm, start_weight: prof.start_weight, target_weight: prof.target_weight, goal: prof.goal, diet: prof.diet_pref, pcos: prof.pcos, pregnancy: prof.pregnancy },
    meals_14d: meals.data || [],
    weights_60d: weights.data || [],
    workouts_60d: (workouts.data || []).map((w) => ({ date: w.log_date, day: w.day_label, min: w.duration_min,
      exercises: Object.values((w.workout_sets || []).reduce((m, s) => { const n = s.exercises?.name || 'Exercise'; (m[n] ||= { name: n, sets: [] }).sets.push([s.reps, s.weight_kg, s.duration_min].filter((x) => x != null).join('×')); return m; }, {})) })),
    habits_14d: habits.data || [],
    labs: (labs.data || []).map((r) => ({ date: r.lab_reports?.report_date, test: r.test_name, value: r.value ?? r.value_text, unit: r.unit, ref: [r.ref_low, r.ref_high].join('–'), flag: r.flag }))
      .sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 150),
    diet_plan: plan.data ? { slots: (plan.data.slots || []).map((s) => ({ slot: s.label, have: s.items, avoid: s.avoid })), guidelines: plan.data.guidelines } : null,
    measurements_in: measures.data || [],
  };
}
