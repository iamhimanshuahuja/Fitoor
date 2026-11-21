import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { HABITS, SLOTS, slotLabel } from '../lib/constants';
import { today, toISO, fmtLong } from '../lib/dates';
import { Spinner, Stat } from './ui';
import DayView from './DayView';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const LAYERS = [
  { key: 'meals', label: '🍽️ Meals' },
  { key: 'gym', label: '🏋️ Gym' },
  { key: 'weight', label: '⚖️ Weight' },
  { key: 'habits', label: '✅ Habits' },
  { key: 'juices', label: '🧃 Juice days' },
  { key: 'notes', label: '💬 Notes' },
];

const monthStart = (iso) => iso.slice(0, 8) + '01';
const shiftMonth = (iso, n) => { const d = new Date(iso + 'T00:00:00'); d.setMonth(d.getMonth() + n, 1); return toISO(d); };
const monthEnd = (iso) => { const d = new Date(iso + 'T00:00:00'); d.setMonth(d.getMonth() + 1, 0); return toISO(d); };

/** Month calendar of everything logged for one person. mode: 'user' | 'admin' */
export default function CalendarView({ userId, mode = 'user', features }) {
  const { has: myHas } = useAuth();
  const has = features ? (f) => features.includes(f) : myHas;
  const [month, setMonth] = useState(monthStart(today()));
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(null);           // selected day (YYYY-MM-DD)
  const [layers, setLayers] = useState(LAYERS.map((l) => l.key));
  const on = (k) => layers.includes(k);

  const load = useCallback(async () => {
    setData(null);
    const from = month, to = monthEnd(month);
    const q = (t, cols, dateCol = 'log_date') => supabase.from(t).select(cols).eq('user_id', userId).gte(dateCol, from).lte(dateCol, to);
    const [m, w, wo, h, c, l, jd] = await Promise.all([
      q('meal_logs', 'log_date, slot, followed, kcal, protein_g, description'),
      q('weight_logs', 'log_date, weight_kg'),
      q('workouts', 'log_date, day_label, duration_min, workout_sets(id)'),
      q('habit_logs', 'log_date, habits, supplements'),
      q('comments', 'log_date, body'),
      q('lab_reports', 'report_date, lab_name', 'report_date'),
      q('juice_days', 'day, status, request_status', 'day'),
    ]);
    const days = {};
    const day = (d) => (days[d] ||= { meals: [], workouts: [], notes: 0, labs: 0 });
    (m.data || []).forEach((x) => day(x.log_date).meals.push(x));
    (w.data || []).forEach((x) => { day(x.log_date).weight = Number(x.weight_kg); });
    (wo.data || []).forEach((x) => day(x.log_date).workouts.push(x));
    (h.data || []).forEach((x) => {
      const done = HABITS.filter((k) => x.habits?.[k.key]).length;
      day(x.log_date).habits = { done, total: HABITS.length, water: Number(x.habits?.water_glasses || 0) };
      const j = x.habits?.juices || {};
      const jn = ['red', 'smoothie_am', 'green1', 'smoothie_pm', 'white'].filter((k) => j[k]).length + (j.green2 || j.tangy ? 1 : 0);
      if (jn) day(x.log_date).juices = jn;
    });
    (c.data || []).forEach((x) => { if (x.log_date) day(x.log_date).notes++; });
    (l.data || []).forEach((x) => { day(x.report_date).labs++; });
    (jd.data || []).forEach((x) => { day(x.day).juiceDay = x; });
    setData(days);
  }, [userId, month]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { window.addEventListener('ft:data-changed', load); return () => window.removeEventListener('ft:data-changed', load); }, [load]);

  // Grid: weeks starting Monday, padded with blanks
  const cells = useMemo(() => {
    const first = new Date(month + 'T00:00:00');
    const pad = (first.getDay() + 6) % 7;
    const n = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    return [...Array(pad).fill(null), ...Array.from({ length: n }, (_, i) => toISO(new Date(first.getFullYear(), first.getMonth(), i + 1)))];
  }, [month]);

  // Month summary
  const sum = useMemo(() => {
    if (!data) return null;
    const vals = Object.entries(data);
    const meals = vals.flatMap(([, d]) => d.meals);
    const weights = vals.filter(([, d]) => d.weight).sort(([a], [b]) => a.localeCompare(b)).map(([, d]) => d.weight);
    return {
      logged: vals.filter(([, d]) => d.meals.length || d.workouts.length || d.weight).length,
      onPlan: meals.length ? Math.round((meals.filter((x) => x.followed === true).length / meals.length) * 100) : null,
      meals: meals.length,
      workouts: vals.reduce((s, [, d]) => s + d.workouts.length, 0),
      weightChange: weights.length > 1 ? +(weights.at(-1) - weights[0]).toFixed(1) : null,
    };
  }, [data]);

  const isFuture = (d) => d > today();
  const monthName = new Date(month + 'T00:00:00').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  return (
    <div className="cal">
      <div className="cal-head">
        <button className="icon-btn cal-nav" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month"><ChevronLeft size={20} /></button>
        <h2>{monthName}</h2>
        <button className="icon-btn cal-nav" onClick={() => setMonth(shiftMonth(month, 1))} disabled={monthStart(today()) === month} aria-label="Next month"><ChevronRight size={20} /></button>
        {monthStart(today()) !== month && <button className="btn btn-ghost btn-sm" onClick={() => setMonth(monthStart(today()))}>This month</button>}
      </div>

      {sum && (
        <div className="stats">
          <Stat label="Days logged" value={sum.logged} sub={`in ${monthName.split(' ')[0]}`} />
          <Stat label="Meals on plan" value={sum.onPlan != null ? `${sum.onPlan}%` : '—'} sub={`${sum.meals} meals`} />
          <Stat label="Workouts" value={sum.workouts} />
          <Stat label="Weight change" value={sum.weightChange != null ? `${sum.weightChange > 0 ? '+' : ''}${sum.weightChange} kg` : '—'} />
        </div>
      )}

      <div className="cal-layers" role="group" aria-label="Show on calendar">
        {LAYERS.filter((l) => (l.key === 'gym' ? has('gym') : l.key === 'weight' ? has('weight') : l.key === 'habits' ? has('habits') : true)).map((l) => (
          <button key={l.key} className={`chip ${on(l.key) ? 'on ok' : ''}`} aria-pressed={on(l.key)}
            onClick={() => setLayers(on(l.key) ? layers.filter((x) => x !== l.key) : [...layers, l.key])}>{l.label}</button>
        ))}
      </div>

      <div className="cal-grid-wrap">
        <div className="cal-grid" role="grid" aria-label={monthName}>
          {WEEKDAYS.map((w) => <div key={w} className="cal-wd" role="columnheader">{w}</div>)}
          {!data && <div className="cal-loading"><Spinner size={24} /></div>}
          {data && cells.map((d, i) => {
            if (!d) return <div key={`b${i}`} className="cal-cell blank" />;
            const x = data[d];
            const mealsOn = x?.meals.filter((m) => m.followed === true).length || 0;
            const mealsOff = x?.meals.filter((m) => m.followed === false).length || 0;
            const mealsN = x?.meals.length || 0;
            const score = !x ? 0 : Math.min(1, (mealsN ? 0.45 * (mealsOn / mealsN) + 0.15 : 0) + (x.workouts.length ? 0.25 : 0) + (x.weight ? 0.15 : 0));
            const label = `${fmtLong(d)}: ${mealsN} meals (${mealsOn} on plan)${x?.workouts.length ? ', workout' : ''}${x?.weight ? `, ${x.weight} kg` : ''}`;
            return (
              <button key={d} role="gridcell" aria-label={label}
                className={`cal-cell ${d === today() ? 'is-today' : ''} ${open === d ? 'is-open' : ''} ${isFuture(d) ? 'future' : ''}`}
                style={{ '--s': score }} disabled={isFuture(d)} onClick={() => setOpen(d)}>
                <span className="cal-date">{Number(d.slice(8))}</span>
                {x && (
                  <span className="cal-marks">
                    {on('meals') && mealsN > 0 && (
                      <span className="cal-meals" title={`${mealsN} meals`}>
                        {x.meals.slice(0, 7).map((m, j) => <i key={j} className={m.followed === true ? 'ok' : m.followed === false ? 'off' : ''} />)}
                        <em>{mealsOn}/{mealsN}</em>
                      </span>
                    )}
                    {on('gym') && x.workouts.length > 0 && <span className="cal-tag gym">🏋️<em>{x.workouts[0].day_label || 'Gym'}</em></span>}
                    {on('weight') && x.weight && <span className="cal-tag wt">⚖️<em>{x.weight}</em></span>}
                    {on('habits') && x.habits && <span className="cal-tag hab">✅<em>{x.habits.done}/{x.habits.total}</em></span>}
                    {on('juices') && x.juiceDay && <span className={`cal-tag juice ${x.juiceDay.status}`}>🧃<em>{x.juiceDay.status === 'done' ? 'Done' : x.juiceDay.status === 'missed' ? 'Missed' : x.juices ? `${x.juices}/6` : 'Juice day'}</em></span>}
                    {on('notes') && x.notes > 0 && <span className="cal-tag note">💬<em>{x.notes}</em></span>}
                    {x.labs > 0 && <span className="cal-tag lab">🧪<em>Report</em></span>}
                    {on('meals') && mealsOff > 0 && <span className="cal-off-dot" title={`${mealsOff} off plan`} />}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <p className="cal-legend small muted">
        <span><i className="lg ok" /> meal on plan</span> <span><i className="lg off" /> off plan</span> <span><i className="lg" /> not marked</span> · darker day = better day
      </p>

      {open && (
        <div className="cal-sheet" role="dialog" aria-label={fmtLong(open)}>
          <div className="cal-sheet-backdrop" onClick={() => { setOpen(null); load(); }} />
          <div className="cal-sheet-panel">
            <div className="cal-sheet-head">
              <div>
                <h3>{fmtLong(open)}</h3>
                {data?.[open]?.meals.length > 0 && (
                  <p className="small muted">{data[open].meals.map((m) => `${SLOTS.find((s) => s.key === m.slot)?.emoji || ''} ${slotLabel(m.slot)}`).join(' · ')}</p>
                )}
              </div>
              <button className="icon-btn" onClick={() => { setOpen(null); load(); }} aria-label="Close"><X size={20} /></button>
            </div>
            <DayView key={open} userId={userId} date={open} mode={mode} features={features} />
          </div>
        </div>
      )}
    </div>
  );
}

