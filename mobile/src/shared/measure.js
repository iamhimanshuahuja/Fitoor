// AUTO-COPIED from src/lib/measure.js by mobile/scripts/sync-shared.mjs — edit the web file, then run "npm run sync-shared".
import { supabase } from '../lib/supabase';

/** Body measurement sites (stored in inches). `how` = one-line measuring tip. */
export const SITES = [
  { key: 'neck', label: 'Neck', emoji: '🧣', how: 'Just below the Adam’s apple' },
  { key: 'chest', label: 'Chest', emoji: '👕', how: 'Fullest part, across the nipples, arms down' },
  { key: 'arm', label: 'Arm', emoji: '💪', how: 'Mid upper arm, relaxed (same side every time)' },
  { key: 'waist', label: 'Waist', emoji: '📏', how: 'Narrowest point, above the belly button' },
  { key: 'belly', label: 'Belly', emoji: '⭕', how: 'At the belly button, breathe out normally' },
  { key: 'hips', label: 'Hips', emoji: '🍑', how: 'Widest part of the bum, feet together' },
  { key: 'thigh', label: 'Thigh', emoji: '🦵', how: 'Widest part, just below the bum' },
  { key: 'calf', label: 'Calf', emoji: '🦶', how: 'Widest part of the calf' },
];
export const SITE_KEYS = SITES.map((s) => s.key);
export const CM_PER_IN = 2.54;

/** Display unit, remembered per device. */
export const getUnit = () => { try { return localStorage.getItem('ft_measure_unit') || 'in'; } catch { return 'in'; } };
export const setUnitPref = (u) => { try { localStorage.setItem('ft_measure_unit', u); } catch { /* ignore */ } };
export const toUnit = (inch, unit) => (inch == null ? null : unit === 'cm' ? +(inch * CM_PER_IN).toFixed(1) : +Number(inch).toFixed(2));
export const fromUnit = (v, unit) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : unit === 'cm' ? +(Number(v) / CM_PER_IN).toFixed(2) : +Number(v));
export const fmtVal = (v) => (v == null ? '–' : `${+v.toFixed(v % 1 ? 1 : 0)}`);

/**
 * First vs latest value for every site (each site may have been measured on different days).
 * Returns { sites: {key: {first, firstDate, last, lastDate, change}}, total, totalSites }. total < 0 means inches lost.
 */
export function measureStats(rows) {
  const sites = {};
  let total = 0, totalSites = 0;
  for (const k of SITE_KEYS) {
    const pts = rows.filter((r) => r[k] != null).map((r) => ({ date: r.log_date, v: Number(r[k]) }));
    if (!pts.length) continue;
    const first = pts[0], last = pts.at(-1);
    const change = pts.length > 1 ? +(last.v - first.v).toFixed(2) : null;
    sites[k] = { first: first.v, firstDate: first.date, last: last.v, lastDate: last.date, change, n: pts.length };
    if (change != null) { total += change; totalSites += 1; }
  }
  return { sites, total: +total.toFixed(2), totalSites };
}

export const loadMeasurements = (userId) =>
  supabase.from('body_measurements').select('*').eq('user_id', userId).order('log_date').then(({ data }) => data || []);
