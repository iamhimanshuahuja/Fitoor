import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { runAI } from '../lib/ai';
import { on, emit } from '../lib/events';
import { pickImage, uploadMedia } from '../lib/media';
import { cheer } from '../shared/cheer';
import { SLOTS, HABITS, SUPPLEMENTS } from '../shared/constants';
import { JUICES, TANGY, JUICE_GROUPS } from '../shared/juices';
import { addDays, fmtTime } from '../shared/dates';
import { Btn, Card, Chip, Chips, Empty, Field, IconBtn, MacroFields, NumField, Pill, Row, SignedImg, Spinner, T, Toggle } from './ui';
import Notes from './Notes';
import { C, R, font } from '../theme';

const num = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Math.max(0, Number(v)));
const r1 = (v) => (v == null || v === '' ? '' : String(Math.round(Number(v) * 10) / 10));

/** One person's day. mode 'user' (client) or 'admin' (coach reviewing a client). Both can edit. */
export default function DayView({ userId, date, mode = 'user' }) {
  const { has } = useAuth();
  const isCoach = mode === 'admin';
  const [d, setD] = useState(null);

  const load = useCallback(async () => {
    const [m, w, h, wo, p, y, prof, jd] = await Promise.all([
      supabase.from('meal_logs').select('*').eq('user_id', userId).eq('log_date', date).order('eaten_at'),
      supabase.from('weight_logs').select('*').eq('user_id', userId).eq('log_date', date).maybeSingle(),
      supabase.from('habit_logs').select('*').eq('user_id', userId).eq('log_date', date).maybeSingle(),
      supabase.from('workouts').select('*, workout_sets(*, exercises(name, kind))').eq('user_id', userId).eq('log_date', date),
      supabase.from('diet_plans').select('*').eq('user_id', userId).eq('is_active', true).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('meal_logs').select('eaten_at').eq('user_id', userId).eq('log_date', addDays(date, -1)).in('slot', ['dinner', 'evening', 'lunch', 'other']).order('eaten_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('profiles').select('juice_group').eq('id', userId).maybeSingle(),
      supabase.from('juice_days').select('*').eq('user_id', userId).eq('day', date).neq('status', 'missed').maybeSingle(),
    ]);
    setD({ meals: m.data || [], weight: w.data, habits: h.data || { habits: {}, supplements: {} }, workouts: wo.data || [], plan: p.data,
      lastMealBefore: y.data?.eaten_at || null, juiceGroup: prof.data?.juice_group || null, juiceDay: jd.data || null });
  }, [userId, date]);
  useEffect(() => { setD(null); load(); }, [load]);
  useEffect(() => on('data-changed', load), [load]);
  // Any change → this view, Calendar and Progress all reload.
  const changed = useCallback(() => emit('data-changed'), []);

  if (!d) return <Spinner />;
  const { meals, weight, habits, workouts, plan, juiceDay } = d;
  const sum = (k) => meals.reduce((s, m) => s + (Number(m[k]) || 0), 0);
  const kcal = sum('kcal'), protein = sum('protein_g'), carbs = sum('carbs_g'), fat = sum('fat_g');
  const cheats = meals.filter((m) => m.cheat).length;
  const onPlan = meals.filter((m) => m.followed === true).length;
  const cheatDay = !!habits.habits?.cheat_day;
  const firstMeal = meals.filter((m) => !['early_morning', 'before_breakfast', 'bedtime'].includes(m.slot)).map((m) => m.eaten_at).sort()[0];
  const fastH = d.lastMealBefore && firstMeal ? (new Date(firstMeal) - new Date(d.lastMealBefore)) / 36e5 : null;

  const saveHabits = async (next) => {
    setD({ ...d, habits: next });
    const { error } = await supabase.from('habit_logs').upsert({ user_id: userId, log_date: date, habits: next.habits || {}, supplements: next.supplements || {} }, { onConflict: 'user_id,log_date' });
    if (error) { setD((x) => ({ ...x, habits })); cheer('error', error.message); return false; }
    changed();
    return true;
  };
  const toggleCheatDay = async () => {
    const h = { ...(habits.habits || {}) };
    if (cheatDay) delete h.cheat_day; else h.cheat_day = true;
    if (await saveHabits({ ...habits, habits: h })) cheer(!cheatDay ? 'cheat_day' : 'saved');
  };

  return (
    <View style={{ gap: 14 }}>
      <View style={st.pills}>
        {has('weight') && <Pill>⚖️ {weight ? `${weight.weight_kg} kg` : 'No weight'}</Pill>}
        {has('meals') && <Pill>✓ {onPlan}/{meals.length - cheats} on plan</Pill>}
        {cheats > 0 && <Pill tone="#FFF1CF">🍕 {cheats} cheat</Pill>}
        {kcal > 0 && <Pill>🔥 ~{Math.round(kcal)} kcal</Pill>}
        {protein > 0 && <Pill>P ~{Math.round(protein)} g</Pill>}
        {(carbs > 0 || fat > 0) && <Pill>C ~{Math.round(carbs)} · F ~{Math.round(fat)} g</Pill>}
        {fastH != null && fastH > 0 && fastH < 30 && <Pill tone={fastH >= 12 ? C.lime : C.cream}>⏱ {Math.floor(fastH)}h {Math.round((fastH % 1) * 60)}m fast</Pill>}
        {has('gym') && <Pill>🏋️ {workouts.length ? workouts.map((w) => w.day_label || 'Workout').join(', ') : 'No workout'}</Pill>}
      </View>

      {has('weight') && <WeightQuick userId={userId} date={date} weight={weight} onSaved={changed} isCoach={isCoach} />}

      {juiceDay && (
        <JuiceTracker group={d.juiceGroup} value={habits.habits?.juices || {}} note={juiceDay.note}
          onChange={async (juices) => {
            const before = countJuices(habits.habits?.juices);
            if (await saveHabits({ ...habits, habits: { ...(habits.habits || {}), juices } })) cheer(countJuices(juices) === 6 && before < 6 ? 'juice_done' : 'saved');
          }} />
      )}

      {has('meals') && juiceDay && <JuiceDayMeals meals={meals} userId={userId} date={date} isCoach={isCoach} onChange={changed} />}

      {has('meals') && !juiceDay && (
        <Card title="Meals" action={<Btn small variant={cheatDay ? 'pop' : 'ghost'} title={cheatDay ? '🍕 Cheat day on' : '🍕 Cheat day?'} onPress={toggleCheatDay} style={cheatDay ? { backgroundColor: C.haldi } : null} />}>
          {cheatDay && <T style={st.cheatBanner}>🍕 <T bold>Cheat day.</T> Enjoy it, no guilt. Meals you log today are tagged as cheat and don’t count against your plan or streak. Back on track tomorrow 💪</T>}
          {SLOTS.map((s) => (
            <MealSlot key={s.key} slot={s} planSlot={plan?.slots?.find((x) => x.key === s.key)} meals={meals.filter((m) => m.slot === s.key)}
              userId={userId} date={date} isCoach={isCoach} cheatDay={cheatDay} onChange={changed} />
          ))}
        </Card>
      )}

      {(has('habits') || has('supplements')) && <Habits value={habits} onSave={saveHabits} has={has} />}

      {has('gym') && (
        <Card title="Workout" action={!isCoach && <Btn small variant="soft" title="+ Log workout" onPress={() => router.push('/gym')} />}>
          {workouts.length ? workouts.map((w) => <WorkoutSummary key={w.id} w={w} />) : <Empty>No workout logged.</Empty>}
        </Card>
      )}

      <Notes userId={userId} date={date} title={isCoach ? 'Notes for this day' : 'Coach’s notes'} />
    </View>
  );
}

/** Juice day: juices only is the plan, but food can still be logged honestly (tagged so the coach sees it). */
function JuiceDayMeals({ meals, userId, date, isCoach, onChange }) {
  const [show, setShow] = useState(false);
  const slots = SLOTS.filter((s) => show || isCoach || meals.some((m) => m.slot === s.key));
  return (
    <Card title="Meals">
      <T style={st.noFood}>🧃 Juice day: the plan is juices only today.{isCoach ? ' Anything logged here is tagged as eaten on a juice day.' : ' If you did eat something (or your coach said it’s OK), log it below. It’s marked so your coach knows.'}</T>
      {!isCoach && !show ? <Btn small variant="ghost" title="+ I ate something, log it" onPress={() => setShow(true)} style={{ alignSelf: 'flex-start' }} /> : null}
      {slots.map((s) => <MealSlot key={s.key} slot={s} meals={meals.filter((m) => m.slot === s.key)} userId={userId} date={date} isCoach={isCoach} onChange={onChange} />)}
    </Card>
  );
}

const countJuices = (j) => ['red', 'smoothie_am', 'green1', 'smoothie_pm', 'white'].filter((k) => j?.[k]).length + (j?.green2 || j?.tangy ? 1 : 0);

function WeightQuick({ userId, date, weight, onSaved, isCoach }) {
  const { has } = useAuth();
  const [val, setVal] = useState(weight?.weight_kg ? String(weight.weight_kg) : '');
  const [waist, setWaist] = useState(weight?.waist_cm ? String(weight.waist_cm) : '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => { setVal(weight?.weight_kg ? String(weight.weight_kg) : ''); setWaist(weight?.waist_cm ? String(weight.waist_cm) : ''); }, [weight]);
  const save = async (extra = {}) => {
    const kg = num(extra.weight_kg ?? val);
    if (!kg || kg < 20 || kg > 400) return Alert.alert('Check the weight', 'Enter your weight in kg, e.g. 72.4');
    setBusy(true);
    const w = num(waist);
    const { error } = await supabase.from('weight_logs').upsert({ user_id: userId, log_date: date, weight_kg: kg, waist_cm: w && w > 30 && w < 250 ? w : null, source: 'manual', ...extra }, { onConflict: 'user_id,log_date' });
    setBusy(false);
    if (error) return Alert.alert('Not saved', error.message);
    cheer('weight'); onSaved();
  };
  const scale = async () => {
    const img = await pickImage('camera'); if (!img) return;
    setBusy(true); setMsg('Reading your scale…');
    try {
      const path = await uploadMedia(userId, 'scale', img);
      let kg = null;
      if (has('ai')) { const r = await runAI('scale', { image: img.base64, mime: img.mime }); kg = r?.weight_kg; }
      setMsg(kg ? `AI read ${kg} kg. Check it and tap Save.` : 'Couldn’t read the scale. Please type it.');
      if (kg) setVal(String(kg));
      if (kg) await supabase.from('weight_logs').upsert({ user_id: userId, log_date: date, weight_kg: kg, photo_path: path, source: 'ai' }, { onConflict: 'user_id,log_date' });
      onSaved();
    } catch (e) { setMsg(e.message); }
    setBusy(false);
  };
  return (
    <Card title="Weight" action={!isCoach && <Btn small variant="ghost" title="📏 Inches" onPress={() => router.push('/weight')} />}>
      <Row gap={10}>
        <NumField label="Weight (kg)" value={val} onChangeText={setVal} placeholder="e.g. 72.4" />
        <NumField label="Waist (cm)" value={waist} onChangeText={setWaist} placeholder="optional" />
      </Row>
      <Row wrap>
        <Btn title="Save" onPress={() => save()} busy={busy} small />
        <Btn title={has('ai') ? '📷 Scale photo (AI)' : '📷 Scale photo'} variant="soft" small onPress={scale} disabled={busy} />
      </Row>
      {msg ? <T small muted>{msg}</T> : null}
      {weight?.photo_path ? <SignedImg path={weight.photo_path} /> : null}
    </Card>
  );
}

function MealSlot({ slot, planSlot, meals, userId, date, isCoach, cheatDay = false, onChange }) {
  const { has } = useAuth();
  const [open, setOpen] = useState(false);
  const [desc, setDesc] = useState('');
  const [nutr, setNutr] = useState({ kcal: '', protein_g: '', carbs_g: '', fat_g: '' });
  const [photo, setPhoto] = useState(null);
  const [ai, setAi] = useState(null);
  const [cheat, setCheat] = useState(cheatDay);
  const [busy, setBusy] = useState('');
  const [editing, setEditing] = useState(null);
  useEffect(() => setCheat(cheatDay), [cheatDay]);
  
  const reset = async (removePhoto) => {
    if (removePhoto && photo) await supabase.storage.from('media').remove([photo]);
    setPhoto(null); setAi(null); setDesc(''); setNutr({ kcal: '', protein_g: '', carbs_g: '', fat_g: '' });
  };
  const attach = async (source) => {
    const img = await pickImage(source); if (!img) return;
    setBusy(has('ai') ? 'Uploading & guessing calories…' : 'Uploading photo…');
    try {
      if (photo) await supabase.storage.from('media').remove([photo]);
      const path = await uploadMedia(userId, 'meals', img);
      setPhoto(path); setAi(null);
      if (has('ai')) {
        try {
          const r = await runAI('meal', { image: img.base64, mime: img.mime, slot: slot.label, note: desc, plan: planSlot ? { items: planSlot.items, avoid: planSlot.avoid } : null });
          setAi(r);
          setNutr({ kcal: r1(r?.kcal), protein_g: r1(r?.protein_g), carbs_g: r1(r?.carbs_g), fat_g: r1(r?.fat_g) });
          if (!desc && r?.items?.length) setDesc(r.items.join(', '));
        } catch (e) { Alert.alert('AI couldn’t read it', `${e.message}\nYou can type the details.`); }
      }
    } catch (e) { Alert.alert('Upload failed', e.message); }
    setBusy('');
  };
  const add = async () => {
    if (!desc.trim() && !photo) return Alert.alert('Add a photo or say what you had');
    setBusy('Saving…');
    const followed = cheat ? null : ai?.plan_check ? ai.plan_check === 'on_plan' : null;
    const edited = ai && ['kcal', 'protein_g', 'carbs_g', 'fat_g'].some((k) => num(nutr[k]) !== (ai[k] == null ? null : Math.round(Number(ai[k]) * 10) / 10));
    const { error } = await supabase.from('meal_logs').insert({
      user_id: userId, log_date: date, slot: slot.key, photo_path: photo, followed, cheat, description: desc.trim() || null,
      ai: ai ? { ...ai, edited_by_user: edited || undefined } : null,
      kcal: num(nutr.kcal), protein_g: num(nutr.protein_g), carbs_g: num(nutr.carbs_g), fat_g: num(nutr.fat_g),
    });
    setBusy('');
    if (error) return Alert.alert('Not saved', error.message);
    setPhoto(null); await reset(false); setOpen(false); onChange();
    cheer(cheat ? 'cheat' : followed === true ? 'on_plan' : 'meal');
  };
  const close = async () => { if (photo) await reset(true); setOpen(false); };

  const setFollowed = async (m, v) => {
    const { error } = await supabase.from('meal_logs').update({ followed: v, cheat: false }).eq('id', m.id);
    if (error) return cheer('error', error.message);
    onChange(); cheer(v && m.followed !== true ? 'on_plan' : 'saved');
  };
  const toggleCheat = async (m) => {
    const v = !m.cheat;
    const { error } = await supabase.from('meal_logs').update({ cheat: v, ...(v ? { followed: null } : {}) }).eq('id', m.id);
    if (error) return cheer('error', error.message);
    onChange(); cheer(v ? 'cheat' : 'saved');
  };
  // One tap on an option from the diet plan logs it straight away as an on-plan meal.
  const quickLog = async (item) => {
    setBusy('Saving…');
    const { error } = await supabase.from('meal_logs').insert({ user_id: userId, log_date: date, slot: slot.key, description: item, followed: cheat ? null : true, cheat });
    setBusy('');
    if (error) return cheer('error', error.message);
    await close(); onChange(); cheer(isCoach ? 'update' : cheat ? 'cheat' : 'on_plan');
  };
  const del = (m) => Alert.alert('Delete this meal?', m.description || '', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => {
    const { error } = await supabase.from('meal_logs').delete().eq('id', m.id);
    if (error) return cheer('error', error.message);
    if (m.photo_path) await supabase.storage.from('media').remove([m.photo_path]);
    onChange(); cheer('removed');
  } }]);
  const saveEdit = async () => {
    const { error } = await supabase.from('meal_logs').update({ description: editing.description || null, kcal: num(editing.kcal), protein_g: num(editing.protein_g), carbs_g: num(editing.carbs_g), fat_g: num(editing.fat_g) }).eq('id', editing.id);
    if (error) return cheer('error', error.message);
    setEditing(null); onChange(); cheer('update');
  };

  return (
    <View style={[st.slot, meals.length > 0 && { backgroundColor: '#F4FAEE' }]}>
      <Pressable onPress={() => (open ? close() : setOpen(true))} style={st.slotHead} accessibilityRole="button" accessibilityLabel={`${open ? 'Close' : 'Add'} ${slot.label}`}>
        <Text style={st.slotTitle}>{slot.emoji} {slot.label}{planSlot?.title ? <Text style={st.slotSub}>  · {planSlot.title}</Text> : null}</Text>
        <Text style={st.plus}>{open ? '×' : '+'}</Text>
      </Pressable>

      {meals.map((m) => (
        <View key={m.id} style={st.meal}>
          {m.photo_path ? <SignedImg path={m.photo_path} /> : null}
          <View style={{ flex: 1, gap: 4 }}>
            {editing?.id === m.id ? (
              <>
                <Field value={editing.description || ''} onChangeText={(v) => setEditing({ ...editing, description: v })} multiline />
                <MacroFields value={editing} onChange={(v) => setEditing({ ...editing, ...v })} />
                <Row><Btn small title="Save" onPress={saveEdit} /><Btn small variant="ghost" title="Cancel" onPress={() => setEditing(null)} /></Row>
              </>
            ) : (
              <Row style={{ alignItems: 'flex-start' }}>
                <T style={{ flex: 1 }}>{m.description || 'Photo only'}</T>
                <IconBtn icon="✏️" label="Edit meal" onPress={() => setEditing({ ...m })} />
                <IconBtn icon="🗑" label="Delete meal" tone={C.pink} onPress={() => del(m)} />
              </Row>
            )}
            <T small muted>{fmtTime(m.eaten_at)}{m.kcal ? ` · ~${Math.round(m.kcal)} kcal` : ''}{m.protein_g ? ` · P ${Math.round(m.protein_g)}g` : ''}{m.carbs_g ? ` · C ${Math.round(m.carbs_g)}g` : ''}{m.fat_g ? ` · F ${Math.round(m.fat_g)}g` : ''}{m.ai?.edited_by_user ? ' · edited' : ''}</T>
            {m.ai?.juice_day ? <T small style={{ color: C.red }}>🧃 Eaten on a juice day</T> : null}
            {m.ai?.plan_note ? <T small style={[st.aiNote, m.ai.plan_check === 'on_plan' ? { backgroundColor: '#E4DCFF' } : m.ai.plan_check ? { backgroundColor: C.pink } : null]}>✨ {m.ai.plan_note}</T> : null}
            {m.ai?.breakdown?.length > 0 && <Breakdown ai={m.ai} />}
            <Chips>
              <Chip small label="✓ On plan" on={m.followed === true} tone={C.lime} onPress={() => setFollowed(m, true)} />
              <Chip small label="✕ Off plan" on={m.followed === false} tone={C.haldi} onPress={() => setFollowed(m, false)} />
              <Chip small label="🍕 Cheat" on={!!m.cheat} tone={C.haldi} onPress={() => toggleCheat(m)} />
            </Chips>
          </View>
        </View>
      ))}

      {open && (
        <View style={{ gap: 10, paddingTop: 6 }}>
          {planSlot?.items?.length > 0 && (
            <View style={{ gap: 6 }}>
              <T small muted>From your plan, tap to log it:</T>
              <Chips>{planSlot.items.slice(0, 8).map((it) => <Chip key={it} label={`+ ${it}`} onPress={() => quickLog(it)} style={{ borderColor: C.ink, borderWidth: 2 }} />)}</Chips>
              <T small muted>Had something else? Type it or add a photo below.</T>
            </View>
          )}
          {planSlot?.avoid?.length > 0 && <T small style={{ color: C.red }}>Avoid: {planSlot.avoid.join(', ')}</T>}
          {photo && (
            <Row style={{ alignItems: 'flex-start' }}>
              <SignedImg path={photo} />
              <View style={{ flex: 1, gap: 4 }}>
                {ai?.plan_note ? <T small style={st.aiNote}>✨ {ai.plan_note}</T> : null}
                {ai ? <T small muted>AI guess{ai.confidence ? ` (${ai.confidence === 'high' ? 'good' : ai.confidence === 'low' ? 'rough' : 'fair'})` : ''}. Check the numbers below and fix anything that’s off.</T> : null}
              </View>
            </Row>
          )}
          <Field value={desc} onChangeText={setDesc} placeholder="What did you have? e.g. 2 roti, dal, salad" multiline />
          <MacroFields value={nutr} onChange={setNutr} />
          <T small muted>{has('ai') && has('meal_photos') ? 'Add a photo and AI fills these in. You can change any number before adding.' : 'Optional. Fill in what you know.'}</T>
          <Toggle label="🍕 Cheat meal" hint="Planned treat, no guilt" value={cheat} onChange={setCheat} />
          <Row wrap>
            {has('meal_photos') && <Btn small variant="soft" title="📷 Camera" onPress={() => attach('camera')} disabled={!!busy} />}
            {has('meal_photos') && <Btn small variant="ghost" title="🖼 Gallery" onPress={() => attach('library')} disabled={!!busy} />}
            <Btn small title="Add meal" onPress={add} disabled={!!busy || (!desc.trim() && !photo)} />
          </Row>
          {busy ? <T small muted>⏳ {busy}</T> : null}
        </View>
      )}
    </View>
  );
}

export function Breakdown({ ai }) {
  const [open, setOpen] = useState(false);
  const mult = ai.portion_multiplier || 1;
  return (
    <View>
      <Pressable onPress={() => setOpen(!open)} accessibilityRole="button" hitSlop={6}>
        <T small style={{ color: C.deep, fontWeight: '700' }}>{open ? '▾' : '▸'} AI breakdown{ai.confidence ? ` · ${ai.confidence === 'high' ? 'good' : ai.confidence === 'low' ? 'rough' : 'fair'} guess` : ''}</T>
      </Pressable>
      {open && ai.breakdown.map((b, i) => (
        <Row key={i} style={{ justifyContent: 'space-between' }}><T small style={{ flex: 1 }}>{b.item}{b.portion ? ` · ${b.portion}` : ''}</T><T small bold>~{Math.round(b.kcal * mult)} kcal</T></Row>
      ))}
    </View>
  );
}

function Habits({ value, onSave, has }) {
  const water = Number(value.habits?.water_glasses || 0);
  const setHabit = (k, v) => {
    const next = { ...value, habits: { ...(value.habits || {}), [k]: v } };
    onSave(next).then((ok) => {
      if (!ok) return;
      if (k === 'water_glasses' && v >= 8 && water < 8) cheer('water');
      else if (k !== 'water_glasses' && v && HABITS.every((h) => next.habits[h.key])) cheer('habits_all');
      else cheer('saved');
    });
  };
  const setSupp = (k, v) => onSave({ ...value, supplements: { ...(value.supplements || {}), [k]: v } }).then((ok) => ok && cheer('saved'));
  return (
    <Card title="Habits & supplements">
      {has('habits') && (
        <>
          <Row style={{ justifyContent: 'space-between' }}><T bold>💧 Water</T><T bold>{water}/10</T></Row>
          <View style={st.glasses}>
            {Array.from({ length: 10 }).map((_, i) => (
              <Pressable key={i} onPress={() => setHabit('water_glasses', i + 1 === water ? i : i + 1)} accessibilityRole="button" accessibilityLabel={`${i + 1} glasses`}
                style={[st.glass, i < water && st.glassFull]} hitSlop={2} />
            ))}
          </View>
          {HABITS.map((h) => <Toggle key={h.key} label={h.label} value={!!value.habits?.[h.key]} onChange={(v) => setHabit(h.key, v)} />)}
        </>
      )}
      {has('supplements') && SUPPLEMENTS.map((s) => <Toggle key={s.key} label={`💊 ${s.label}`} value={!!value.supplements?.[s.key]} onChange={(v) => setSupp(s.key, v)} />)}
    </Card>
  );
}

function WorkoutSummary({ w }) {
  const byEx = {};
  (w.workout_sets || []).forEach((s) => { const n = s.exercises?.name || 'Exercise'; (byEx[n] ||= []).push(s); });
  return (
    <View style={{ gap: 3 }}>
      <T bold>{w.day_label || 'Workout'}{w.duration_min ? ` · ${w.duration_min} min` : ''}</T>
      {Object.entries(byEx).map(([n, sets]) => (
        <T small key={n}>{n}: {sets.map((s) => s.reps ? `${s.reps}×${s.weight_kg || 'bw'}` : s.duration_min ? `${s.duration_min} min${s.incline ? ` @${s.incline}` : ''}` : '').filter(Boolean).join(' · ')}</T>
      ))}
      {w.notes ? <T small muted>{w.notes}</T> : null}
    </View>
  );
}

function JuiceTracker({ group, value, onChange, note }) {
  const g = JUICE_GROUPS[group];
  const tick = (k) => onChange({ ...value, [k]: !value[k] });
  const done = countJuices(value);
  return (
    <Card title={`🧃 Juice day · ${done}/6`} tone="#FFF3D6">
      {note ? <T small>Coach: {note}</T> : null}
      {!g ? <T small muted>Your coach hasn’t set your juice amounts yet.</T> : null}
      {JUICES.map((j) => (
        <Pressable key={j.key} onPress={() => tick(j.key)} style={st.juice} accessibilityRole="checkbox" accessibilityState={{ checked: !!value[j.key] }}>
          <View style={[st.box, value[j.key] && st.boxOn]}>{value[j.key] ? <Text style={{ fontWeight: '800' }}>✓</Text> : null}</View>
          <View style={{ flex: 1 }}><T bold>{j.emoji} {j.name}</T><T small muted>{j.window}</T></View>
          {g ? <T bold>{j.ml[group]} ml</T> : null}
        </Pressable>
      ))}
      <Pressable onPress={() => tick('tangy')} style={st.juice} accessibilityRole="checkbox" accessibilityState={{ checked: !!value.tangy }}>
        <View style={[st.box, value.tangy && st.boxOn]}>{value.tangy ? <Text style={{ fontWeight: '800' }}>✓</Text> : null}</View>
        <View style={{ flex: 1 }}><T bold>{TANGY.emoji} {TANGY.name}</T><T small muted>{TANGY.window}</T></View>
      </Pressable>
    </Card>
  );
}

const st = StyleSheet.create({
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  noFood: { backgroundColor: C.pink, borderRadius: 10, padding: 10 },
  cheatBanner: { backgroundColor: '#FFF1CF', borderWidth: 2, borderColor: C.ink, borderRadius: 12, padding: 10 },
  slot: { borderWidth: 1.5, borderColor: C.line, borderRadius: R.md, padding: 10, gap: 8 },
  slotHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 40 },
  slotTitle: { fontSize: 15.5, color: C.ink, ...font.bold, flex: 1 },
  slotSub: { fontSize: 12.5, color: C.muted, fontWeight: '500' },
  plus: { fontSize: 26, color: C.ink, width: 40, height: 40, textAlign: 'center', lineHeight: 38, borderWidth: 2, borderColor: C.ink, borderRadius: 10, overflow: 'hidden', backgroundColor: '#fff' },
  meal: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', borderTopWidth: 1, borderTopColor: C.line, paddingTop: 8 },
  aiNote: { backgroundColor: '#E4DCFF', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, overflow: 'hidden' },
  glasses: { flexDirection: 'row', justifyContent: 'space-between', gap: 4 },
  glass: { flex: 1, height: 40, borderWidth: 2, borderTopWidth: 0, borderColor: '#5BB6EA', borderBottomLeftRadius: 6, borderBottomRightRadius: 6 },
  glassFull: { backgroundColor: '#3BA3E0' },
  juice: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, borderTopWidth: 1, borderTopColor: '#EBDDB8', paddingTop: 6 },
  box: { width: 26, height: 26, borderRadius: 7, borderWidth: 2, borderColor: C.ink, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: C.lime },
});
