import { measureStats } from '../lib/measure';
import { useEffect, useMemo, useState } from 'react';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, Area, ReferenceLine, ReferenceDot } from 'recharts';
import { supabase } from '../lib/supabase';
import { addDays, today, fmt, fmtLong, daysAgo, toISO as toISOd } from '../lib/dates';
import { labKey } from '../lib/labNames';
import { Card, Spinner, Empty } from './ui';

const C = { ink: '#12261B', lime: '#C8F25A', lav: '#BBA8FF', sky: '#8FD3FF', haldi: '#FFB627', chilli: '#FF5D73', fresh: '#2FA35F', grid: '#E2EADB' };

/** Rough gym energy: MET × 3.5 × kg / 200 per minute. Strength set ≈ 2 min at MET 5, cardio at MET 6 (7 with incline). */
function workoutKcal(w, bodyKg) {
  const kg = bodyKg || 75;
  return (w.workout_sets || []).reduce((s, x) => {
    const kind = x.exercises?.kind;
    if (kind === 'cardio') { const met = x.incline ? 7 : 6; return s + (Number(x.duration_min) || 0) * met * 3.5 * kg / 200; }
    if (kind === 'mobility') return s + 2 * 2.5 * 3.5 * kg / 200;
    return s + 2 * 5 * 3.5 * kg / 200;
  }, 0);
}

/** How far a value sits outside its reference range (0 = inside). */
const outBy = (v, lo, hi) => (v == null ? null : lo != null && v < lo ? lo - v : hi != null && v > hi ? v - hi : 0);

const PRESETS = [
  { key: '7', label: '7 days', days: 7 }, { key: '30', label: '30 days', days: 30 },
  { key: '90', label: '3 months', days: 90 }, { key: 'all', label: 'Since day 1' }, { key: 'custom', label: 'Custom' },
];

export default function ProgressDashboard({ userId, profile }) {
  const [d, setD] = useState(null);
  const [preset, setPreset] = useState('7');
  const [custom, setCustom] = useState({ from: addDays(today(), -13), to: today() });
  const [labFrom, setLabFrom] = useState('');
  const [labTo, setLabTo] = useState('');
  const [panel, setPanel] = useState('');
  const [onlyOut, setOnlyOut] = useState(true);

  // all weights + labs once (journey is always from day 1)
  const [base, setBase] = useState(null);
  useEffect(() => {
    Promise.all([
      supabase.from('weight_logs').select('log_date, weight_kg').eq('user_id', userId).order('log_date'),
      supabase.from('lab_results').select('test_name, panel, value, unit, ref_low, ref_high, flag, lab_reports(report_date)').eq('user_id', userId),
      supabase.from('body_measurements').select('*').eq('user_id', userId).order('log_date'),
    ]).then(([w, l, bm]) => setBase({ weights: w.data || [], labs: l.data || [], measures: bm.data || [] }));
  }, [userId]);

  const range = useMemo(() => {
    if (preset === 'custom') return custom.from <= custom.to ? custom : { from: custom.to, to: custom.from };
    if (preset === 'all') return { from: base?.weights[0]?.log_date || addDays(today(), -89), to: today() };
    const n = PRESETS.find((p) => p.key === preset).days;
    return { from: addDays(today(), -(n - 1)), to: today() };
  }, [preset, custom, base]);

  useEffect(() => {
    if (!base) return;
    setD(null);
    Promise.all([
      supabase.from('meal_logs').select('log_date, kcal, protein_g, carbs_g, fat_g, followed, cheat').eq('user_id', userId).gte('log_date', range.from).lte('log_date', range.to),
      supabase.from('workouts').select('log_date, duration_min, workout_sets(duration_min, incline, exercises(kind))').eq('user_id', userId).gte('log_date', range.from).lte('log_date', range.to),
    ]).then(([m, wo]) => setD({ ...base, meals: m.data || [], workouts: wo.data || [] }));
  }, [userId, base, range.from, range.to]);

  const x = useMemo(() => {
    if (!d) return null;
    const W = d.weights.map((r) => ({ date: r.log_date, kg: Number(r.weight_kg) }));
    const start = profile?.start_weight ? Number(profile.start_weight) : W[0]?.kg;
    const startDate = W[0]?.date;
    const current = W.at(-1)?.kg ?? start;
    const target = profile?.target_weight ? Number(profile.target_weight) : null;
    const lowest = W.length ? W.reduce((a, b) => (b.kg < a.kg ? b : a)) : null;
    const ms = measureStats(d.measures || []);
    const inches = ms.totalSites ? { lost: -ms.total, sites: ms.totalSites, since: d.measures[0].log_date } : null;
    const lost = start != null && current != null ? +(start - current).toFixed(1) : null;
    const toGoal = target != null && current != null ? +(current - target).toFixed(1) : null;
    const pct = target != null && start != null && start !== target ? Math.max(0, Math.min(100, ((start - current) / (start - target)) * 100)) : null;

    // energy over the selected range (daily; weekly buckets when the range is long)
    const nDays = Math.max(1, Math.round((new Date(range.to) - new Date(range.from)) / 864e5) + 1);
    const days = Array.from({ length: nDays }, (_, i) => addDays(range.from, i));
    const week = days.map((date) => {
      const ms = d.meals.filter((r) => r.log_date === date);
      const ws = d.workouts.filter((r) => r.log_date === date);
      return {
        date,
        eaten: Math.round(ms.reduce((s, r) => s + (Number(r.kcal) || 0), 0)),
        burned: Math.round(ws.reduce((s, r) => s + workoutKcal(r, current), 0)),
        protein: Math.round(ms.reduce((s, r) => s + (Number(r.protein_g) || 0), 0)),
        carbs: Math.round(ms.reduce((s, r) => s + (Number(r.carbs_g) || 0), 0)),
        fat: Math.round(ms.reduce((s, r) => s + (Number(r.fat_g) || 0), 0)),
        meals: ms.length, planMeals: ms.filter((r) => !r.cheat).length, cheats: ms.filter((r) => r.cheat).length, onPlan: ms.filter((r) => r.followed === true).length, gym: ws.length > 0,
      };
    });
    const sum = (k) => week.reduce((s, r) => s + r[k], 0);
    const logged = week.filter((r) => r.meals || r.gym || W.some((w) => w.date === r.date)).length;
    const meals = sum('planMeals'), onPlan = sum('onPlan'), cheatMeals = sum('cheats');
    const gymDays = week.filter((r) => r.gym).length, gymGoal = Math.max(1, Math.round((nDays / 7) * 5));
    const rings = [
      { key: 'plan', label: cheatMeals ? `Meals on plan (${cheatMeals} 🍕 cheat not counted)` : 'Meals on plan', v: meals ? onPlan / meals : 0, text: meals ? `${Math.round((onPlan / meals) * 100)}%` : '—', color: C.lime },
      { key: 'gym', label: 'Gym days', v: Math.min(1, gymDays / gymGoal), text: `${gymDays}/${gymGoal}`, color: C.haldi },
      { key: 'log', label: 'Days logged', v: logged / nDays, text: `${logged}/${nDays}`, color: C.lav },
    ];
    let chart = week;
    if (nDays > 31) {
      const b = {};
      week.forEach((r) => {
        const dt = new Date(r.date + 'T00:00'); dt.setDate(dt.getDate() - ((dt.getDay() + 6) % 7));
        const k = toISOd(dt);
        (b[k] ||= { date: k, eaten: 0, burned: 0, weekly: true });
        b[k].eaten += r.eaten; b[k].burned += r.burned;
      });
      chart = Object.values(b);
    }
    const inRange = W.filter((r) => r.date >= range.from && r.date <= range.to);
    const Wr = inRange.length ? inRange : W;
    const wFallback = !inRange.length && W.length > 0;

    // lab improvement between the two chosen reports (default: first vs latest)
    const reportDates = [...new Set(d.labs.map((r) => r.lab_reports?.report_date).filter(Boolean))].sort();
    const rFrom = labFrom || reportDates[0], rTo = labTo || reportDates.at(-1);
    const panels = [...new Set(d.labs.map((r) => r.panel).filter(Boolean))].sort();
    const byTest = {};
    d.labs.forEach((r) => {
      const rd = r.lab_reports?.report_date;
      if (r.value == null || (rd !== rFrom && rd !== rTo) || (panel && r.panel !== panel)) return;
      const k = labKey(r.test_name);
      (byTest[k] ||= { name: r.test_name, unit: r.unit, lo: r.ref_low, hi: r.ref_high, pts: [] }).pts.push({ date: r.lab_reports?.report_date, v: Number(r.value) });
    });
    const tests = Object.values(byTest).map((t) => {
      t.pts.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      t.pts = t.pts.filter((p, i, arr) => i === 0 || p.date !== arr[i - 1].date); // one value per report
      const first = t.pts[0], last = t.pts.at(-1);
      const o1 = outBy(first.v, t.lo, t.hi), o2 = outBy(last.v, t.lo, t.hi);
      return { ...t, first, last, flagged: o1 > 0 || o2 > 0, better: t.pts.length > 1 && o2 < o1, worse: t.pts.length > 1 && o2 > o1, out: o2 };
    }).filter((t) => !onlyOut || t.flagged).sort((a, b) => (b.out || 0) - (a.out || 0) || a.name.localeCompare(b.name));

    return { inches, W, Wr, wFallback, start, startDate, current, target, lowest, lost, toGoal, pct, week, chart, nDays, rings, tests, reportDates, rFrom, rTo, panels,
      eatenAvg: Math.round(sum('eaten') / Math.max(1, week.filter((r) => r.eaten).length)), burnedWeek: sum('burned'), proteinAvg: Math.round(sum('protein') / Math.max(1, week.filter((r) => r.protein).length)),
      carbsAvg: Math.round(sum('carbs') / Math.max(1, week.filter((r) => r.carbs).length)), fatAvg: Math.round(sum('fat') / Math.max(1, week.filter((r) => r.fat).length)) };
  }, [d, profile, range, labFrom, labTo, panel, onlyOut]);

  if (!x) return <div className="center-pad"><Spinner /></div>;
  const daysIn = x.startDate ? daysAgo(x.startDate) : null;
  const rangeLabel = preset === 'custom' ? `${fmt(range.from)} – ${fmt(range.to)}` : PRESETS.find((p) => p.key === preset).label.toLowerCase();

  return (
    <div className="pd">
      <div className="pd-filters" role="group" aria-label="Date range">
        {PRESETS.map((p) => <button key={p.key} className={`chip ${preset === p.key ? 'on' : ''}`} aria-pressed={preset === p.key} onClick={() => setPreset(p.key)}>{p.label}</button>)}
        {preset === 'custom' && (
          <span className="pd-custom">
            <input type="date" value={custom.from} max={today()} onChange={(e) => e.target.value && setCustom({ ...custom, from: e.target.value })} aria-label="From" />
            <span>→</span>
            <input type="date" value={custom.to} max={today()} onChange={(e) => e.target.value && setCustom({ ...custom, to: e.target.value })} aria-label="To" />
          </span>
        )}
      </div>
      {/* ---------- Journey track ---------- */}
      <section className="pd-journey">
        <div className="pd-journey-top">
          <div>
            <p className="pd-kicker">{daysIn != null ? `Day ${daysIn + 1} of the journey` : 'Your journey'}</p>
            {x.W.length >= 2 ? (<>
              <h2 className="pd-big">
                {x.lost > 0 ? <>−{x.lost}<small> kg</small></> : x.lost < 0 ? <>+{Math.abs(x.lost)}<small> kg</small></> : <>0<small> kg</small></>}
              </h2>
              <p className="pd-kicker">{x.lost > 0 ? 'down since day 1 🔥' : x.lost < 0 ? 'up since day 1 — keep going' : 'holding steady since day 1'}</p>
            </>) : x.W.length === 1 ? (<>
              <h2 className="pd-big">{x.current}<small> kg</small></h2>
              <p className="pd-kicker">Starting weight. Log again to see your change.</p>
            </>) : (<>
              <h2 className="pd-big pd-big-empty">Day 1</h2>
              <p className="pd-kicker">Log your first weigh-in to start the journey.</p>
            </>)}
          </div>
          {x.pct != null && (
            <div className="pd-goal-badge"><b>{Math.round(x.pct)}%</b><span>to goal</span></div>
          )}
        </div>
        <JourneyTrack start={x.start} current={x.current} target={x.target} lowest={x.lowest?.kg} />
        <div className="pd-journey-foot">
          <span>Start <b>{x.start ?? '—'} kg</b>{x.startDate ? ` · ${fmt(x.startDate)}` : ''}</span>
          <span>Now <b>{x.current ?? '—'} kg</b></span>
          <span>Goal <b>{x.target ? `${x.target} kg` : 'not set yet'}</b>{x.toGoal != null && x.toGoal > 0 ? ` · ${x.toGoal} kg to go` : ''}</span>
        </div>
      </section>

      {/* ---------- Stickers + rings ---------- */}
      <div className="pd-row">
        <section className="pd-rings-card">
          <h3>{preset === '7' ? 'This week' : `Last ${rangeLabel}`}</h3>
          <div className="pd-rings-wrap">
            <Rings rings={x.rings} />
            <ul className="pd-ring-legend">
              {x.rings.map((r) => <li key={r.key}><i style={{ background: r.color }} /><span>{r.label}</span><b>{r.text}</b></li>)}
            </ul>
          </div>
        </section>
        <div className="pd-stickers">
          <Sticker tone="haldi" emoji="🍛" value={x.eatenAvg || null} empty="No meals logged" unit="kcal / day" label={`Eaten (avg/day, ${rangeLabel})`} />
          <Sticker tone="lav" emoji="🏋️" value={x.burnedWeek || null} empty="No workouts" unit="kcal" label={`Burned at gym (${rangeLabel}, est.)`} />
          <Sticker tone="sky" emoji="🫘" value={x.proteinAvg || null} empty="No protein data" unit="g / day" label={`Protein (avg/day, ${rangeLabel})`} />
          {(x.carbsAvg > 0 || x.fatAvg > 0) && <Sticker tone="haldi" emoji="🍚" value={`${x.carbsAvg} · ${x.fatAvg}`} unit="g / day" label={`Carbs · fat (avg/day, ${rangeLabel})`} />}
          {x.inches && <Sticker tone="sky" emoji="📏" value={x.inches.lost > 0 ? +x.inches.lost.toFixed(1) : 0} unit="in" label={x.inches.lost > 0 ? `Inches lost · ${x.inches.sites} spots since ${fmt(x.inches.since)}` : `Inches · ${x.inches.sites} spots tracked`} />}
          <Sticker tone="lime" emoji="📉" value={x.lowest ? x.lowest.kg : null} empty="No weigh-ins" unit="kg" label={x.lowest ? `Lowest · ${fmt(x.lowest.date)}` : 'Lowest weight'} />
        </div>
      </div>

      {/* ---------- 7-day energy ---------- */}
      <Card title={`Food in vs gym out · ${rangeLabel}${x.nDays > 31 ? ' (weekly totals)' : ''}`} className="pd-card">
        {x.chart.some((r) => r.eaten || r.burned) ? (
          <ResponsiveContainer width="100%" height={230}>
            <ComposedChart data={x.chart} margin={{ top: 10, right: 6, left: -8, bottom: 0 }}>
              <CartesianGrid stroke={C.grid} vertical={false} />
              <XAxis dataKey="date" tickFormatter={(v) => (x.nDays <= 7 ? new Date(v + 'T00:00').toLocaleDateString('en-IN', { weekday: 'short' }) : fmt(v))} tick={{ fontSize: 12 }} minTickGap={12} />
              <YAxis tick={{ fontSize: 11 }} width={44} />
              <Tooltip formatter={(v, n) => [`${v} kcal`, n]} labelFormatter={(v) => fmtLong(v)} contentStyle={{ borderRadius: 12, border: `2px solid ${C.ink}` }} />
              <Bar dataKey="eaten" name="Eaten" fill={C.haldi} stroke={C.ink} strokeWidth={1.5} radius={[6, 6, 0, 0]} />
              <Bar dataKey="burned" name="Burned at gym" fill={C.lav} stroke={C.ink} strokeWidth={1.5} radius={[6, 6, 0, 0]} />
            </ComposedChart>
          </ResponsiveContainer>
        ) : <Empty>Log meals with photos (AI estimates calories) and workouts to fill this chart.</Empty>}
        <p className="small muted">Calories are estimates: food from meal photos, gym from sets and cardio minutes.</p>
      </Card>

      <div className="grid-2">
        {/* ---------- Weight from start ---------- */}
        <Card title={preset === 'all' || x.wFallback ? 'Weight since day 1' : `Weight · ${rangeLabel}`} className="pd-card">
          {x.wFallback && <p className="muted small" style={{ marginTop: -6 }}>No weigh-ins in the {rangeLabel}; showing every weigh-in.</p>}
          {x.Wr.length ? (
            <ResponsiveContainer width="100%" height={230}>
              <ComposedChart data={x.Wr} margin={{ top: 14, right: 12, left: -10, bottom: 0 }}>
                <defs><linearGradient id="wfill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={C.lime} stopOpacity={0.8} /><stop offset="1" stopColor={C.lime} stopOpacity={0.05} /></linearGradient></defs>
                <CartesianGrid stroke={C.grid} vertical={false} />
                <XAxis dataKey="date" tickFormatter={(v) => fmt(v)} tick={{ fontSize: 11 }} minTickGap={20} />
                <YAxis domain={[(min) => Math.floor(Math.min(min, x.target ?? min) - 1), (max) => Math.ceil(max + 1)]} tick={{ fontSize: 11 }} width={40} />
                <Tooltip formatter={(v) => [`${v} kg`, 'Weight']} labelFormatter={(v) => fmtLong(v)} contentStyle={{ borderRadius: 12, border: `2px solid ${C.ink}` }} />
                {x.target && <ReferenceLine y={x.target} stroke={C.fresh} strokeDasharray="6 4" label={{ value: `Goal ${x.target}`, position: 'insideBottomRight', fontSize: 11, fill: C.fresh }} />}
                <Area type="monotone" dataKey="kg" stroke={C.ink} strokeWidth={2.5} fill="url(#wfill)" dot={{ r: 3, fill: C.ink }} />
                {x.lowest && x.Wr.length > 1 && x.Wr.some((r) => r.date === x.lowest.date) && <ReferenceDot x={x.lowest.date} y={x.lowest.kg} r={6} fill={C.lime} stroke={C.ink} strokeWidth={2} />}
              </ComposedChart>
            </ResponsiveContainer>
          ) : <Empty>{x.W.length ? 'No weigh-ins in this range.' : 'No weigh-ins yet.'}</Empty>}
        </Card>

        {/* ---------- Reports then vs now ---------- */}
        <Card title="Lab reports: then vs now" className="pd-card">
          {x.reportDates.length > 0 && (
            <div className="pd-labfilters">
              {x.reportDates.length > 1 && (<>
                <label>From<select value={x.rFrom} onChange={(e) => setLabFrom(e.target.value)}>{x.reportDates.map((r) => <option key={r} value={r}>{fmtLong(r)}</option>)}</select></label>
                <label>To<select value={x.rTo} onChange={(e) => setLabTo(e.target.value)}>{x.reportDates.map((r) => <option key={r} value={r}>{fmtLong(r)}</option>)}</select></label>
              </>)}
              <label>Panel<select value={panel} onChange={(e) => setPanel(e.target.value)}><option value="">All panels</option>{x.panels.map((p) => <option key={p}>{p}</option>)}</select></label>
              <label className="check inline"><input type="checkbox" checked={onlyOut} onChange={(e) => setOnlyOut(e.target.checked)} /> Only out of range</label>
            </div>
          )}
          {x.tests.length ? (
            <ul className="pd-labs pd-labs-scroll">
              {x.tests.map((t) => <LabGauge key={t.name} t={t} />)}
            </ul>
          ) : <Empty>{x.reportDates.length ? (onlyOut ? 'Nothing out of range here. 🎉' : 'No values for this filter.') : 'No lab reports yet.'}</Empty>}
          {x.reportDates.length === 1 && <p className="small muted">Baseline from {fmtLong(x.reportDates[0])}. Upload your next report to see the change.</p>}
        </Card>
      </div>
    </div>
  );
}

function Sticker({ tone, emoji, value, unit, label, empty }) {
  return (
    <div className={`pd-sticker tone-${tone}`}>
      <span className="pd-sticker-emoji" aria-hidden>{emoji}</span>
      {value == null ? <b className="pd-sticker-v pd-sticker-empty">{empty}</b> : <b className="pd-sticker-v">{value}<small> {unit}</small></b>}
      <span className="pd-sticker-l">{label}</span>
    </div>
  );
}

/** A road from start → goal with the current position as a bead. */
function JourneyTrack({ start, current, target, lowest }) {
  if (start == null) return null;
  const goal = target ?? start - 10;
  const pos = (v) => Math.max(0, Math.min(100, ((start - v) / (start - goal || 1)) * 100));
  const now = pos(current ?? start);
  return (
    <div className="pd-track" role="img" aria-label={`From ${start} kg toward ${goal} kg, now ${current} kg`}>
      <div className="pd-track-road"><span style={{ width: `${now}%` }} /></div>
      {lowest != null && lowest !== current && <i className="pd-track-low" style={{ left: `${pos(lowest)}%` }} title={`Lowest ${lowest} kg`} />}
      <div className="pd-track-bead" style={{ left: `${now}%` }}><span>{current} kg</span></div>
      <span className="pd-track-flag" aria-hidden>🏁</span>
    </div>
  );
}

/** Three concentric activity rings. */
function Rings({ rings }) {
  const size = 150, sw = 14;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="pd-rings" aria-hidden>
      {rings.map((r, i) => {
        const rad = size / 2 - sw / 2 - i * (sw + 5) - 2;
        const len = 2 * Math.PI * rad;
        return (
          <g key={r.key} transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            <circle cx={size / 2} cy={size / 2} r={rad} fill="none" stroke="#E7EEDF" strokeWidth={sw} />
            <circle cx={size / 2} cy={size / 2} r={rad} fill="none" stroke={C.ink} strokeWidth={sw + 3} strokeDasharray={`${Math.max(0.001, r.v) * len} ${len}`} strokeLinecap="round" opacity={r.v ? 1 : 0} />
            <circle cx={size / 2} cy={size / 2} r={rad} fill="none" stroke={r.color} strokeWidth={sw - 1} strokeDasharray={`${Math.max(0.001, r.v) * len} ${len}`} strokeLinecap="round" opacity={r.v ? 1 : 0} />
          </g>
        );
      })}
    </svg>
  );
}

/** Range bar: green band = reference range; ○ first value, ● latest. */
function LabGauge({ t }) {
  const vals = [t.first.v, t.last.v, t.lo, t.hi].filter((v) => v != null);
  let min = Math.min(...vals), max = Math.max(...vals);
  const pad = (max - min) * 0.25 || Math.abs(max) * 0.2 || 1; min -= pad; max += pad;
  const p = (v) => ((v - min) / (max - min)) * 100;
  const bandL = t.lo != null ? p(t.lo) : 0, bandR = t.hi != null ? p(t.hi) : 100;
  const status = t.pts.length < 2 ? (t.out > 0 ? 'watch' : 'ok') : t.better ? 'better' : t.worse ? 'worse' : 'same';
  const label = { watch: 'Out of range', ok: 'In range', better: 'Improving ↗', worse: 'Needs work ↘', same: 'No change' }[status];
  return (
    <li className={`pd-lab ${status}`}>
      <div className="pd-lab-head">
        <b>{t.name}</b>
        <span className={`pd-lab-status ${status}`}>{label}</span>
      </div>
      <div className="pd-gauge">
        <span className="pd-gauge-band" style={{ left: `${bandL}%`, width: `${Math.max(2, bandR - bandL)}%` }} />
        {t.pts.length > 1 && <span className="pd-gauge-dot first" style={{ left: `${p(t.first.v)}%` }} title={`${t.first.v}`} />}
        <span className="pd-gauge-dot last" style={{ left: `${p(t.last.v)}%` }} />
      </div>
      <div className="pd-lab-nums">
        {t.pts.length > 1 ? <span>{t.first.v} → <b>{t.last.v}</b> {t.unit}</span> : <span><b>{t.last.v}</b> {t.unit}</span>}
        <span className="muted">{t.lo != null && t.hi != null ? `range ${t.lo}–${t.hi}` : t.hi != null ? `below ${t.hi}` : t.lo != null ? `above ${t.lo}` : ''}</span>
      </div>
    </li>
  );
}
