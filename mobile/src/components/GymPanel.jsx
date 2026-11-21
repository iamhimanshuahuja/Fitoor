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

  const loadHist = useCallback(async () => {
    const { data } = await supabase.from('workouts').select('*, workout_sets(*, exercises(name, kind, muscle_group))').eq('user_id', userId).gte('log_date', addDays(today(), -90)).order('log_date', { ascending: false });
    setHist(data || []);
  }, [userId]);
  useEffect(() => { loadHist(); }, [loadHist]);
  useEffect(() => on('data-changed', loadHist), [loadHist]);

  const addEx = (ex) => { setRows([...rows, { exercise: ex, sets: [blankSet()] }]); setQ(''); };
  const setSet = (ri, si, k, v) => setRows(rows.map((r, i) => i !== ri ? r : { ...r, sets: r.sets.map((s, j) => j !== si ? s : { ...s, [k]: v }) }));
  const addSet = (ri) => setRows(rows.map((r, i) => i !== ri ? r : { ...r, sets: [...r.sets, { ...r.sets.at(-1) }] }));
  const delRow = (ri) => setRows(rows.filter((_, i) => i !== ri));

  const save = async () => {
    if (!rows.length && !label) return Alert.alert('Add an exercise or a day label');
    setBusy('Saving…');
    const { data: w, error } = await supabase.from('workouts').insert({ user_id: userId, log_date: date, day_label: label || null, duration_min: n(dur), notes: notes || null }).select().single();
    if (error) { setBusy(''); return Alert.alert('Not saved', error.message); }
    const sets = rows.flatMap((r) => r.sets.map((s, j) => ({ workout_id: w.id, user_id: userId, exercise_id: r.exercise.id, set_no: j + 1,
      reps: n(s.reps), weight_kg: n(s.weight_kg), duration_min: n(s.duration_min), incline: n(s.incline), distance_km: n(s.distance_km) })))
      .filter((s) => s.reps || s.duration_min || s.distance_km);
    if (sets.length) { const r = await supabase.from('workout_sets').insert(sets); if (r.error) Alert.alert('Some sets not saved', r.error.message); }
    setBusy(''); setRows([]); setLabel(''); setDur(''); setNotes('');
    cheer('workout'); notifyDataChanged(); loadHist();
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
  const prs = {};
  (hist || []).forEach((w) => (w.workout_sets || []).forEach((s) => { const nm = s.exercises?.name; if (nm && s.weight_kg && (!prs[nm] || s.weight_kg > prs[nm])) prs[nm] = Number(s.weight_kg); }));

  return (
    <View style={{ gap: 14 }}>
      <Row wrap gap={8}>
        <Stat label="Workouts this week" value={week} tone={C.lime} />
        <Stat label="Last 90 days" value={(hist || []).length} tone={C.sky} />
      </Row>
      <Card title="Log a workout">
        <DateField label="Date" value={date} onChange={setDate} />
        <Chips>{DAY_LABELS.map((d) => <Chip key={d} small label={d} on={label === d} onPress={() => setLabel(label === d ? '' : d)} />)}</Chips>
        <Row gap={8}><NumField label="Minutes" value={dur} onChangeText={setDur} placeholder="e.g. 60" /></Row>
        {rows.map((r, ri) => (
          <View key={ri} style={{ borderWidth: 1.5, borderColor: C.line, borderRadius: 12, padding: 10, gap: 6 }}>
            <Row style={{ justifyContent: 'space-between' }}><T bold style={{ flex: 1 }}>{r.exercise.name}</T><Chip small label="🗑" onPress={() => delRow(ri)} /></Row>
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
      {Object.keys(prs).length > 0 && (
        <Card title="🏆 Best lifts (90 days)">{Object.entries(prs).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => <Row key={k} style={{ justifyContent: 'space-between' }}><T small style={{ flex: 1 }}>{k}</T><T small bold>{v} kg</T></Row>)}</Card>
      )}
      <Card title="History">
        {!hist ? <Spinner /> : !hist.length ? <Empty>No workouts yet.</Empty> : hist.slice(0, 30).map((w) => (
          <Pressable key={w.id} onLongPress={() => del(w)} style={{ borderTopWidth: 1, borderTopColor: C.line, paddingTop: 8, gap: 2 }}>
            <T bold>{fmtLong(w.log_date)} · {w.day_label || 'Workout'}{w.duration_min ? ` · ${w.duration_min} min` : ''}</T>
            <T small muted>{[...new Set((w.workout_sets || []).map((s) => s.exercises?.name).filter(Boolean))].join(', ') || '—'}</T>
          </Pressable>
        ))}
        {hist?.length ? <T small muted>Long-press a workout to delete it.</T> : null}
      </Card>
    </View>
  );
}
