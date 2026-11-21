// AUTO-COPIED from src/lib/cycle.js by mobile/scripts/sync-shared.mjs — edit the web file, then run "npm run sync-shared".
import { addDays, today, daysAgo } from './dates';

export const PCOS = { yes: 'Yes (diagnosed)', no: 'No', not_sure: 'Not sure' };
export const PREGNANCY = { no: 'Not pregnant', trying: 'Trying to conceive', pregnant: 'Pregnant', postpartum: 'Postpartum (had a baby in the last 6 months)', breastfeeding: 'Breastfeeding' };
export const SYMPTOMS = ['Cramps', 'Bloating', 'Acne', 'Mood swings', 'Fatigue', 'Headache', 'Cravings', 'Back pain', 'Spotting'];
export const FLOW = { light: 'Light', medium: 'Medium', heavy: 'Heavy' };

/** Pregnancy/breastfeeding: fasting and juice-only days need a doctor's OK. */
export const needsCare = (p) => ['pregnant', 'breastfeeding'].includes(p?.pregnancy);
export const isFemale = (p) => String(p?.gender || '').toLowerCase() === 'female';

const diff = (a, b) => Math.round((new Date(b + 'T00:00') - new Date(a + 'T00:00')) / 864e5);

/**
 * Cycle numbers from logged period start dates. Purely descriptive — not medical advice.
 * Returns: last, cycleDay, lengths[], avg, min, max, regular, nextDue, lateBy, avgPeriodDays
 */
export function cycleStats(logs) {
  const starts = [...(logs || [])].filter((l) => l.start_date).sort((a, b) => a.start_date.localeCompare(b.start_date));
  if (!starts.length) return null;
  const last = starts.at(-1);
  const lengths = [];
  for (let i = 1; i < starts.length; i++) {
    const d = diff(starts[i - 1].start_date, starts[i].start_date);
    if (d >= 10 && d <= 120) lengths.push(d);
  }
  const recent = lengths.slice(-6);
  const avg = recent.length ? Math.round(recent.reduce((s, x) => s + x, 0) / recent.length) : null;
  const min = recent.length ? Math.min(...recent) : null;
  const max = recent.length ? Math.max(...recent) : null;
  // Regular = recent cycles 21–35 days and within ~7–9 days of each other (common clinical rule of thumb)
  const regular = recent.length >= 2 ? (min >= 21 && max <= 35 && max - min <= 8) : null;
  const cycleDay = daysAgo(last.start_date) + 1;
  const nextDue = addDays(last.start_date, avg || 28);
  const lateBy = Math.max(0, diff(nextDue, today()));
  const periodDays = starts.filter((s) => s.end_date).map((s) => diff(s.start_date, s.end_date) + 1).slice(-6);
  const avgPeriodDays = periodDays.length ? Math.round(periodDays.reduce((s, x) => s + x, 0) / periodDays.length) : null;
  const ongoing = !last.end_date && cycleDay <= 10;
  return { last, cycleDay, lengths, avg, min, max, regular, nextDue, lateBy, avgPeriodDays, ongoing, estimated: !avg, count: starts.length };
}

/** Pregnancy week from a due date (40 weeks = due date). */
export function pregnancyWeek(due) {
  if (!due) return null;
  const w = 40 - Math.ceil(diff(today(), due) / 7);
  return w >= 1 && w <= 42 ? w : null;
}
