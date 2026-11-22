import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { runAI } from '../lib/ai';
import { on } from '../lib/events';
import { pickImage, uploadMedia } from '../lib/media';
import { cheer } from '../shared/cheer';
import { DAY_LABELS, MUSCLES, pretty } from '../shared/constants';
import { today, addDays, fmtLong } from '../shared/dates';
import { notifyDataChanged } from '../shared/chatLog';
import { parseSets, fmtSet, fmtSets, isPR, loadBests, prList, saveWorkout } from '../shared/workouts';
import { Btn, Card, Chip, Chips, Empty, Field, NumField, Row, Spinner, Stat, T } from './ui';
import { C } from '../theme';
import DateField from './DateField';

export function useExercises() {
  const [list, setList] = useState([]);
  useEffect(() => { supabase.from('exercises').select('*').order('name').then(({ data }) => setList(data || [])); }, []);
  return list;
}

const blankSet = () => ({ reps: '', weight_kg: '', duration_min: '', incline: '', distance_km: '' });
const n = (v) => (v === '' || v == null ? null : Number(v));

/** Log + history of workouts for one user (client tab and coach). */
export default function GymPanel({ userId }) {
  const { has } = useAuth();
  const exercises = useExercises();
  const [date, setDate] = useState(today());
  const [label, setLabel] = useState('');
  const [dur, setDur] = useState('');
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState([]); // [{exercise, sets:[...]}]
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState(null);
  const [busy, setBusy] = useState('');
  const [machine, setMachine] = useState(null);
  const [hist, setHist] = useState(null);
  const [bests, setBests] = useState({});
  const [quick, setQuick] = useState({});

  const loadHist = useCallback(async () => {
    const { data } = await supabase.from('workouts').select('*, workout_sets(*, exercises(name, kind, muscle_group))').eq('user_id', userId).gte('log_date', addDays(today(), -90)).order('log_date', { ascending: false });
    setHist(data || []);
    setBests(await loadBests(userId));
  }, [userId]);
  useEffect(() => { loadHist(); }, [loadHist]);
  useEffect(() => on('data-changed', loadHist), [loadHist]);

  const addEx = (ex) => { setRows([...rows, { exercise: ex, sets: [blankSet()] }]); setQ(''); };
  // Last session's sets for an exercise (from 90-day history, before the chosen date).
  const lastOf = (exId) => {
    for (const w of hist || []) {
      if (w.log_date >= date) continue;
      const ss = (w.workout_sets || []).filter((x) => x.exercise_id === exId).sort((a, b) => a.set_no - b.set_no);
      if (ss.length) return { date: w.log_date, sets: ss };
    }
    return null;
  };
  const fillQuick = (ri) => {
    const parsed = parseSets(quick[ri]);
    if (!parsed.length) return Alert.alert('Type sets like 12x20, 10x25, 8x30');
    setRows(rows.map((r, i) => i !== ri ? r : { ...r, sets: parsed.map((p) => ({ ...blankSet(), reps: p.reps ?? '', weight_kg: p.weight_kg ?? '' })) }));
    setQuick({ ...quick, [ri]: '' });
  };
  const copyLast = (ri, last) => setRows(rows.map((r, i) => i !== ri ? r : { ...r, sets: last.sets.map((x) => ({ ...blankSet(), reps: x.reps ?? '', weight_kg: x.weight_kg ?? '', duration_min: x.duration_min ?? '', incline: x.incline ?? '', distance_km: x.distance_km ?? '' })) }));
  const setSet = (ri, si, k, v) => setRows(rows.map((r, i) => i !== ri ? r : { ...r, sets: r.sets.map((s, j) => j !== si ? s : { ...s, [k]: v }) }));
  const addSet = (ri) => setRows(rows.map((r, i) => i !== ri ? r : { ...r, sets: [...r.sets, { ...r.sets.at(-1) }] }));
  const delRow = (ri) => setRows(rows.filter((_, i) => i !== ri));

  const save = async () => {
    if (!rows.length && !label) return Alert.alert('Add an exercise or a day label');
    setBusy('Saving…');
    try {
      const items = rows.map((r) => ({ exercise_id: r.exercise.id, sets: r.sets.filter((x) => x.reps || x.weight_kg || x.duration_min || x.distance_km) }));
      await saveWorkout(userId, date, { day_label: label, duration_min: dur, notes, items });
      setRows([]); setDur(''); setNotes(''); setQuick({});
      cheer('workout');
      notifyDataChanged(); loadHist();
    } catch (e) { cheer('error', e.message); }
    setBusy('');
  };

  const scanMachine = async () => {
    const img = await pickImage('camera'); if (!img) return;
    setBusy('Looking at the machine…');
    try {
      await uploadMedia(userId, 'machines', img);
      const r = await runAI('machine', { image: img.base64, mime: img.mime, library: exercises.map((e) => e.name) });
      setMachine(r);
    } catch (e) { Alert.alert('AI couldn’t read it', e.message); }
    setBusy('');
  };

  const del = (w) => Alert.alert('Delete this workout?', fmtLong(w.log_date), [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => {
    await supabase.from('workout_sets').delete().eq('workout_id', w.id); await supabase.from('workouts').delete().eq('id', w.id); notifyDataChanged(); loadHist();
  } }]);

  const found = exercises.filter((e) => (!muscle || e.muscle_group === muscle) && (!q || e.name.toLowerCase().includes(q.toLowerCase()))).slice(0, 12);
  const week = (hist || []).filter((w) => w.log_date >= addDays(today(), -6)).length;
  const prs = prList(bests, today()).slice(0, 8);

  return (
    <View style={{ gap: 14 }}>
      <Row wrap gap={8}>
        <Stat label="Workouts this week" value={week} tone={C.lime} />
        <Stat label="Last 90 days" value={(hist || []).length} tone={C.sky} />
      </Row>
      {prs.length > 0 && (
        <Card title="🏆 Your PRs">
          {prs.map((p) => (
            <Row key={p.exercise_id} style={{ justifyContent: 'space-between' }}>
              <T small style={{ flex: 1 }}>{p.name}{p.isNew ? '  🆕' : ''}</T>
              <T small bold>{p.reps ? `${p.reps}×` : ''}{p.kg} kg</T>
              <T small muted style={{ width: 82, textAlign: 'right' }}>1RM ~{p.e1rm}</T>
            </Row>
          ))}
        </Card>
      )}
      <Card title="Log a workout">
        <DateField label="Date" value={date} onChange={setDate} />
        <Chips>{DAY_LABELS.map((d) => <Chip key={d} small label={d} on={label === d} onPress={() => setLabel(label === d ? '' : d)} />)}</Chips>
        <Row gap={8}><NumField label="Minutes" value={dur} onChangeText={setDur} placeholder="e.g. 60" /></Row>
        {rows.map((r, ri) => (
          <View key={ri} style={{ borderWidth: 1.5, borderColor: C.line, borderRadius: 12, padding: 10, gap: 6 }}>
            <Row style={{ justifyContent: 'space-between' }}><T bold style={{ flex: 1 }}>{r.exercise.name}{isPR(r.sets, bests[r.exercise.id]) ? '  🏆 New PR!' : ''}</T><Chip small label="🗑" onPress={() => delRow(ri)} /></Row>
            {(() => { const last = lastOf(r.exercise.id); return last ? (
              <Row gap={6}><T small muted style={{ flex: 1 }}>Last time: {fmtSets(last.sets)}</T><Chip small label="Copy" onPress={() => copyLast(ri, last)} /></Row>
            ) : null; })()}
            {bests[r.exercise.id] ? <T small muted>PR: {fmtSet({ reps: bests[r.exercise.id].reps, weight_kg: bests[r.exercise.id].kg })}</T> : null}
            {r.exercise.kind !== 'cardio' && (
              <Row gap={6} style={{ alignItems: 'flex-end' }}>
                <View style={{ flex: 1 }}><Field label="Quick sets (reps x kg)" value={quick[ri] || ''} onChangeText={(v) => setQuick({ ...quick, [ri]: v })} placeholder="12x20, 10x25, 8x30" autoCapitalize="none" /></View>
                <Btn small variant="ghost" title="Fill" onPress={() => fillQuick(ri)} />
              </Row>
            )}
            {r.sets.map((s, si) => (
              <Row key={si} gap={6}>
                <T small style={{ width: 22 }}>#{si + 1}</T>
                {r.exercise.kind === 'cardio' ? (
                  <>
                    <NumField label="Min" value={s.duration_min} onChangeText={(v) => setSet(ri, si, 'duration_min', v)} />
                    <NumField label="Incline" value={s.incline} onChangeText={(v) => setSet(ri, si, 'incline', v)} />
                    <NumField label="Km" value={s.distance_km} onChangeText={(v) => setSet(ri, si, 'distance_km', v)} />
                  </>
                ) : (
                  <>
                    <NumField label="Reps" value={s.reps} onChangeText={(v) => setSet(ri, si, 'reps', v)} />
                    <NumField label="Kg" value={s.weight_kg} onChangeText={(v) => setSet(ri, si, 'weight_kg', v)} />
                  </>
                )}
              </Row>
            ))}
            <Btn small variant="ghost" title="+ Set" onPress={() => addSet(ri)} />
          </View>
        ))}
        <Field label="Add exercise" value={q} onChangeText={setQ} placeholder="Search e.g. bench press" />
        <Chips>{MUSCLES.map((m) => <Chip key={m} small label={pretty(m)} on={muscle === m} onPress={() => setMuscle(muscle === m ? null : m)} />)}</Chips>
        {(q || muscle) ? <Chips>{found.map((e) => <Chip key={e.id} small label={`+ ${e.name}`} tone={C.lime} onPress={() => addEx(e)} />)}</Chips> : null}
        {has('ai') && <Btn small variant="soft" title="📷 Which exercises for this machine? (AI)" onPress={scanMachine} disabled={!!busy} />}
        {machine && (
          <Card tone={C.lav} title={`🏋️ ${machine.machine || 'Machine'}`}>
            {machine.how_to ? <T small>{machine.how_to}</T> : null}
            <Chips>{(machine.exercises || []).map((x) => {
              const name = typeof x === 'string' ? x : x.name; const ex = exercises.find((e) => e.name.toLowerCase() === String(name).toLowerCase());
              return <Chip key={name} small label={ex ? `+ ${name}` : name} tone={ex ? C.lime : undefined} onPress={() => ex && addEx(ex)} />;
            })}</Chips>
          </Card>
        )}
        <Field label="Notes" value={notes} onChangeText={setNotes} placeholder="How did it feel?" multiline />
        <Btn title="Save workout" onPress={save} busy={busy === 'Saving…'} />
        {busy && busy !== 'Saving…' ? <T small muted>⏳ {busy}</T> : null}
      </Card>
      <Card title="History">
        {!hist ? <Spinner /> : !hist.length ? <Empty>No workouts yet.</Empty> : hist.slice(0, 30).map((w) => (
          <Pressable key={w.id} onLongPress={() => del(w)} style={{ borderTopWidth: 1, borderTopColor: C.line, paddingTop: 8, gap: 2 }}>
            <T bold>{fmtLong(w.log_date)} · {w.day_label || 'Workout'}{w.duration_min ? ` · ${w.duration_min} min` : ''}</T>
            {Object.values((w.workout_sets || []).slice().sort((a, b) => a.set_no - b.set_no).reduce((m, x) => { const k = x.exercises?.name || '—'; (m[k] = m[k] || { k, sets: [] }).sets.push(x); return m; }, {})).map(({ k, sets }) => (
              <T key={k} small muted>{k}: {fmtSets(sets)}</T>
            ))}
          </Pressable>
        ))}
        {hist?.length ? <T small muted>Long-press a workout to delete it.</T> : null}
      </Card>
    </View>
  );
}
