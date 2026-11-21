import { cheer } from '../../lib/cheer';
import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Sparkles, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { DAY_LABELS, MUSCLES, EQUIPMENT, pretty } from '../../lib/constants';
import { today, fmtLong, fmt, addDays } from '../../lib/dates';
import { uploadMedia, toBase64 } from '../../lib/media';
import { runAI } from '../../lib/ai';
import { Card, Empty, PhotoInput, Spinner, Stat, Tabs, DateStrip, useToast } from '../../components/ui';
import { WorkoutSummary } from '../../components/DayView';
import { DailyBars, TrendLine, COLORS } from '../../components/Charts';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export function useExercises() {
  const [list, setList] = useState([]);
  const load = () => supabase.from('exercises').select('*').order('name').then(({ data }) => setList(data || []));
  useEffect(() => { load(); }, []);
  return [list, load];
}

/** Log a workout: exercises + sets. */
function WorkoutLogger({ userId, onSaved }) {
  const { has } = useAuth();
  const [exercises, reloadEx] = useExercises();
  const [date, setDate] = useState(today());
  const [label, setLabel] = useState('');
  const [duration, setDuration] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([]); // [{exercise, sets:[{reps,weight_kg,duration_min,incline,distance_km}]}]
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState('');
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [toast, show] = useToast();

  const filtered = exercises.filter((e) =>
    (!muscle || e.muscle_group === muscle) && (!q || e.name.toLowerCase().includes(q.toLowerCase())));

  const addEx = (ex) => {
    const blank = ex.kind === 'cardio' ? { duration_min: '', incline: '', distance_km: '' } : { reps: '', weight_kg: '' };
    setItems([...items, { exercise: ex, sets: [{ ...blank }] }]);
    setQ('');
  };
  const createEx = async () => {
    const name = q.trim(); if (!name) return;
    const { data, error } = await supabase.from('exercises').insert({ name, muscle_group: muscle || 'full_body', equipment: 'other' }).select().single();
    if (error) return show(error.message, 'bad');
    reloadEx(); addEx(data);
  };
  const upd = (i, j, k, v) => setItems(items.map((it, a) => a !== i ? it : { ...it, sets: it.sets.map((s, b) => b !== j ? s : { ...s, [k]: v }) }));
  const addSet = (i) => setItems(items.map((it, a) => a !== i ? it : { ...it, sets: [...it.sets, { ...it.sets.at(-1) }] }));
  const delSet = (i, j) => setItems(items.map((it, a) => a !== i ? it : { ...it, sets: it.sets.filter((_, b) => b !== j) }).filter((it) => it.sets.length));

  const machinePhoto = async (file) => {
    setAiBusy(true); setAiResult(null);
    try {
      const { file: small } = await uploadMedia(userId, 'machines', file);
      const r = await runAI('machine', { image: await toBase64(small), mime: small.type, library: exercises.map((e) => e.name) });
      setAiResult(r);
    } catch (e) { show(e.message, 'bad'); }
    setAiBusy(false);
  };
  const addSuggested = async (s) => {
    let ex = exercises.find((e) => e.name.toLowerCase() === s.name.toLowerCase());
    if (!ex) {
      const { data, error } = await supabase.from('exercises').insert({ name: s.name, muscle_group: MUSCLES.includes(s.muscle_group) ? s.muscle_group : 'full_body', equipment: EQUIPMENT.includes(s.equipment) ? s.equipment : 'machine' }).select().single();
      if (error) return show(error.message, 'bad');
      ex = data; reloadEx();
    }
    addEx(ex);
  };

  const save = async () => {
    if (!items.length) return show('Add at least one exercise', 'bad');
    setBusy(true);
    const { data: w, error } = await supabase.from('workouts').insert({ user_id: userId, log_date: date, day_label: label || null, duration_min: duration || null, notes: notes || null }).select().single();
    if (error) { setBusy(false); return show(error.message, 'bad'); }
    const sets = items.flatMap((it) => it.sets.map((s, n) => ({
      workout_id: w.id, user_id: userId, exercise_id: it.exercise.id, set_no: n + 1,
      reps: s.reps ? Number(s.reps) : null, weight_kg: s.weight_kg ? Number(s.weight_kg) : null,
      duration_min: s.duration_min ? Number(s.duration_min) : null, incline: s.incline ? Number(s.incline) : null, distance_km: s.distance_km ? Number(s.distance_km) : null,
    })));
    const { error: e2 } = await supabase.from('workout_sets').insert(sets);
    setBusy(false);
    if (e2) return show(e2.message, 'bad');
    setItems([]); setNotes(''); setDuration(''); setLabel('');
    cheer('workout'); onSaved();
  };

  return (
    <>
      {toast}
      <Card title="Log a workout">
        <DateStrip value={date} onChange={setDate} />
        <div className="chips-row">
          {DAY_LABELS.map((d) => <button key={d} className={`chip ${label === d ? 'on' : ''}`} onClick={() => setLabel(label === d ? '' : d)}>{d}</button>)}
        </div>

        {items.map((it, i) => (
          <div key={i} className="ex-block">
            <div className="ex-head">
              <b>{it.exercise.name}</b>
              <small className="muted">{pretty(it.exercise.muscle_group)} · {pretty(it.exercise.equipment)}</small>
            </div>
            <table className="sets">
              <thead><tr><th>#</th>{it.exercise.kind === 'cardio' ? <><th>Min</th><th>Incline %</th><th>Km</th></> : <><th>Reps</th><th>Kg</th></>}<th></th></tr></thead>
              <tbody>
                {it.sets.map((s, j) => (
                  <tr key={j}>
                    <td>{j + 1}</td>
                    {it.exercise.kind === 'cardio' ? (
                      <>
                        <td><input inputMode="decimal" type="number" value={s.duration_min} onChange={(e) => upd(i, j, 'duration_min', e.target.value)} aria-label={`Set ${j + 1} minutes`} placeholder="min" /></td>
                        <td><input inputMode="decimal" type="number" value={s.incline} onChange={(e) => upd(i, j, 'incline', e.target.value)} aria-label={`Set ${j + 1} incline`} placeholder="incl" /></td>
                        <td><input inputMode="decimal" type="number" step="0.1" value={s.distance_km} onChange={(e) => upd(i, j, 'distance_km', e.target.value)} aria-label={`Set ${j + 1} km`} placeholder="km" /></td>
                      </>
                    ) : (
                      <>
                        <td><input inputMode="numeric" type="number" value={s.reps} onChange={(e) => upd(i, j, 'reps', e.target.value)} aria-label={`Set ${j + 1} reps`} placeholder="reps" /></td>
                        <td><input inputMode="decimal" type="number" step="0.5" value={s.weight_kg} onChange={(e) => upd(i, j, 'weight_kg', e.target.value)} placeholder="bw" aria-label={`Set ${j + 1} weight kg (empty = bodyweight)`} /></td>
                      </>
                    )}
                    <td><button className="icon-btn sm" onClick={() => delSet(i, j)} aria-label="Remove set"><Trash2 size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="btn btn-ghost btn-sm" onClick={() => addSet(i)}><Plus size={14} /> Add set</button>
          </div>
        ))}

        <div className="ex-picker">
          <div className="row gap">
            <div className="search grow"><Search size={16} /><input placeholder="Find or add exercise…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <select value={muscle} onChange={(e) => setMuscle(e.target.value)} aria-label="Muscle group">
              <option value="">All</option>{MUSCLES.map((m) => <option key={m} value={m}>{pretty(m)}</option>)}
            </select>
          </div>
          {(q || muscle) && (
            <div className="ex-results">
              {filtered.slice(0, 12).map((e) => <button key={e.id} className="chip" onClick={() => addEx(e)}><Plus size={13} /> {e.name}</button>)}
              {q && !filtered.some((e) => e.name.toLowerCase() === q.toLowerCase()) && <button className="chip on" onClick={createEx}><Plus size={13} /> Create “{q}”</button>}
            </div>
          )}
          {has('ai') && (
            <div className="ai-box">
              <p className="small"><Sparkles size={14} /> Not sure what a machine is called? Snap it.</p>
              <PhotoInput onFile={machinePhoto} busy={aiBusy} label="Machine photo" />
              {aiResult && (
                <div className="ai-result">
                  <b>{aiResult.machine}</b> <small className="muted">{aiResult.how_to}</small>
                  <div className="chips-row">{(aiResult.exercises || []).map((s) => <button key={s.name} className="chip" onClick={() => addSuggested(s)}><Plus size={13} /> {s.name}</button>)}</div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="row gap">
          <label className="grow">Duration (min)<input type="number" inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value)} /></label>
          <label className="grow">Notes<input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="How did it feel?" /></label>
        </div>
        <button className="btn btn-primary btn-block" disabled={busy || !items.length} onClick={save}>{busy ? <Spinner /> : 'Save workout'}</button>
      </Card>
    </>
  );
}

/** Stats + charts + history. Used by user Gym page and admin user detail. */
export function GymPanel({ userId, refreshKey }) {
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exId, setExId] = useState('');
  const [tick, setTick] = useState(0);
  useEffect(() => {
    setLoading(true);
    supabase.from('workouts').select('*, workout_sets(*, exercises(id, name, kind, muscle_group, equipment))')
      .eq('user_id', userId).gte('log_date', addDays(today(), -180)).order('log_date', { ascending: false })
      .then(({ data }) => { setWorkouts(data || []); setLoading(false); });
  }, [userId, refreshKey, tick]);

  const sets = useMemo(() => workouts.flatMap((w) => (w.workout_sets || []).map((s) => ({ ...s, log_date: w.log_date }))), [workouts]);
  const last30 = addDays(today(), -30);
  const w30 = workouts.filter((w) => w.log_date >= last30);
  const perWeek = useMemo(() => {
    const m = {};
    workouts.forEach((w) => { const d = new Date(w.log_date); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); const k = d.toISOString().slice(0, 10); m[k] = (m[k] || 0) + 1; });
    return Object.entries(m).sort().slice(-12).map(([date, count]) => ({ date, count }));
  }, [workouts]);
  const byMuscle = useMemo(() => {
    const m = {};
    sets.filter((s) => s.log_date >= last30).forEach((s) => { const g = s.exercises?.muscle_group || 'other'; m[g] = (m[g] || 0) + 1; });
    return Object.entries(m).map(([muscle, sets]) => ({ muscle: pretty(muscle), sets })).sort((a, b) => b.sets - a.sets);
  }, [sets]);
  const byEquip = useMemo(() => {
    const m = {};
    sets.filter((s) => s.log_date >= last30).forEach((s) => { const g = s.exercises?.equipment || 'other'; m[g] = (m[g] || 0) + 1; });
    return Object.entries(m).map(([k, v]) => `${pretty(k)} ${v}`).join(' · ');
  }, [sets]);
  const strengthEx = useMemo(() => {
    const m = {};
    sets.forEach((s) => { if (s.exercises?.kind === 'strength' && s.weight_kg) m[s.exercise_id] = s.exercises.name; });
    return Object.entries(m);
  }, [sets]);
  const progress = useMemo(() => {
    const id = exId || strengthEx[0]?.[0];
    const m = {};
    sets.filter((s) => s.exercise_id === id && s.weight_kg).forEach((s) => { m[s.log_date] = Math.max(m[s.log_date] || 0, Number(s.weight_kg)); });
    return Object.entries(m).sort().map(([date, value]) => ({ date, value }));
  }, [sets, exId, strengthEx]);
  const prs = useMemo(() => {
    const m = {};
    sets.forEach((s) => { if (s.weight_kg && (!m[s.exercise_id] || s.weight_kg > m[s.exercise_id].kg)) m[s.exercise_id] = { name: s.exercises?.name, kg: Number(s.weight_kg), date: s.log_date }; });
    return Object.values(m).sort((a, b) => b.kg - a.kg).slice(0, 6);
  }, [sets]);
  const streak = useMemo(() => {
    const days = new Set(workouts.map((w) => w.log_date)); let n = 0, d = today();
    if (!days.has(d)) d = addDays(d, -1);
    while (days.has(d)) { n++; d = addDays(d, -1); }
    return n;
  }, [workouts]);

  if (loading) return <div className="center-pad"><Spinner /></div>;
  if (!workouts.length) return <Card><Empty>No workouts logged yet.</Empty></Card>;
  return (
    <>
      <div className="stats">
        <Stat label="Workouts (30d)" value={w30.length} />
        <Stat label="Sets (30d)" value={sets.filter((s) => s.log_date >= last30).length} />
        <Stat label="Current streak" value={`${streak} day${streak === 1 ? '' : 's'}`} />
        <Stat label="Last workout" value={fmt(workouts[0].log_date)} sub={workouts[0].day_label} />
      </div>
      <div className="grid-2">
        <Card title="Workouts per week"><DailyBars data={perWeek} keys={[{ key: 'count', name: 'Workouts', color: COLORS.deep }]} height={200} /></Card>
        <Card title="Sets by muscle group (30d)">
          {byMuscle.length ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={byMuscle} layout="vertical" margin={{ left: 10, right: 10 }}>
                <CartesianGrid horizontal={false} stroke={COLORS.grid} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="muscle" width={80} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="sets" fill={COLORS.haldi} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <Empty>No sets in the last 30 days.</Empty>}
          {byEquip && <p className="small muted">Equipment: {byEquip}</p>}
        </Card>
      </div>
      {strengthEx.length > 0 && (
        <Card title="Strength progress" action={
          <select value={exId || strengthEx[0][0]} onChange={(e) => setExId(e.target.value)}>{strengthEx.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select>
        }>
          <TrendLine data={progress} name="Top set (kg)" unit="kg" />
          <div className="pr-list">{prs.map((p) => <span key={p.name} className="pill">🏆 {p.name}: <b>{p.kg} kg</b> <small>{fmt(p.date)}</small></span>)}</div>
        </Card>
      )}
      <Card title="History">
        {workouts.slice(0, 30).map((w) => (
          <div key={w.id} className="history-item">
            <div className="muted small">{fmtLong(w.log_date)}</div>
            <WorkoutSummary w={w} editable onChange={() => setTick((t) => t + 1)} />
          </div>
        ))}
      </Card>
    </>
  );
}

export default function Gym() {
  const { user } = useAuth();
  const [tab, setTab] = useState('log');
  const [key, setKey] = useState(0);
  return (
    <div className="page">
      <div className="page-head"><h1>Gym</h1><Tabs tabs={[{ key: 'log', label: 'Log' }, { key: 'progress', label: 'Progress' }]} value={tab} onChange={setTab} /></div>
      {tab === 'log' ? <WorkoutLogger userId={user.id} onSaved={() => { setKey(key + 1); }} /> : <GymPanel userId={user.id} refreshKey={key} />}
    </div>
  );
}
