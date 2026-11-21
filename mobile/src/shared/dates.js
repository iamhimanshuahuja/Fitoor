// AUTO-COPIED from src/lib/dates.js by mobile/scripts/sync-shared.mjs — edit the web file, then run "npm run sync-shared".
// All dates are local calendar dates as 'YYYY-MM-DD'
export const toISO = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};
export const today = () => toISO(new Date());
export const addDays = (iso, n) => {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return toISO(d);
};
export const fmt = (iso, opts = { day: 'numeric', month: 'short' }) =>
  iso ? new Date(iso + (iso.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('en-IN', opts) : '';
export const fmtLong = (iso) => fmt(iso, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
export const fmtTime = (ts) => (ts ? new Date(ts).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : '');
export const daysAgo = (iso) => (iso ? Math.round((new Date(today()) - new Date(iso)) / 86400000) : null);
