import { cheer } from '../lib/cheer';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2, Sparkles, Check, X, Scale, Dumbbell, Flame, Pencil, Timer, Bean } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { SLOTS, HABITS, SUPPLEMENTS, slotLabel } from '../lib/constants';
import { fmtTime, addDays } from '../lib/dates';
import { uploadMedia, toBase64 } from '../lib/media';
import { runAI } from '../lib/ai';
import { Card, PhotoInput, SignedImg, Lightbox, Spinner, Empty } from './ui';
import Comments from './Comments';
import { JuiceTracker } from './Juices';

/**
 * One day for one user: meals by slot, weight, habits, supplements, workout, notes.
 * mode = 'user' (editable) | 'admin' (read + comment + mark on/off plan)
 */
export default function DayView({ userId, date, mode = 'user', features }) {
  const { has: myHas } = useAuth();
  const has = features ? (f) => features.includes(f) : myHas;
  const editable = true; // client and coach can both add/edit
  const isCoach = mode === 'admin';
  const [meals, setMeals] = useState([]);
  const [weight, setWeight] = useState(null);
  const [habits, setHabits] = useState({ habits: {}, supplements: {} });
  const [workouts, setWorkouts] = useState([]);
  const [plan, setPlan] = useState(null);
  const [lastMealBefore, setLastMealBefore] = useState(null);
  const [juiceGroup, setJuiceGroup] = useState(null);
  const [juiceDay, setJuiceDay] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [m, w, h, wo, p, y, prof, jd] = await Promise.all([
      supabase.from('meal_logs').select('*').eq('user_id', userId).eq('log_date', date).order('eaten_at'),
      supabase.from('weight_logs').select('*').eq('user_id', userId).eq('log_date', date).maybeSingle(),
      supabase.from('habit_logs').select('*').eq('user_id', userId).eq('log_date', date).maybeSingle(),
      supabase.from('workouts').select('*, workout_sets(*, exercises(name, kind))').eq('user_id', userId).eq('log_date', date),
      supabase.from('diet_plans').select('*').eq('user_id', userId).eq('is_active', true).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
      // last real meal of the previous day (for the dinner → breakfast fasting gap)
      supabase.from('meal_logs').select('eaten_at').eq('user_id', userId).eq('log_date', addDays(date, -1))
        .in('slot', ['dinner', 'evening', 'lunch', 'other']).order('eaten_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('profiles').select('juice_group').eq('id', userId).maybeSingle(),
      supabase.from('juice_days').select('*').eq('user_id', userId).eq('day', date).neq('status', 'missed').maybeSingle(),
    ]);
    setJuiceDay(jd.data || null);
    setJuiceGroup(prof.data?.juice_group || null);
    setLastMealBefore(y.data?.eaten_at || null);
    setMeals(m.data || []);
    setWeight(w.data);
    setHabits(h.data || { habits: {}, supplements: {} });
    setWorkouts(wo.data || []);
    setPlan(p.data);
    setLoading(false);
  }, [userId, date]);

  useEffect(() => { load(); }, [load]);
  const changed = useCallback(() => window.dispatchEvent(new Event('ft:data-changed')), []);
  useEffect(() => { window.addEventListener('ft:data-changed', load); return () => window.removeEventListener('ft:data-changed', load); }, [load]);

  const kcal = meals.reduce((s, m) => s + (Number(m.kcal) || 0), 0);
  const protein = meals.reduce((s, m) => s + (Number(m.protein_g) || 0), 0);
  const carbs = meals.reduce((s, m) => s + (Number(m.carbs_g) || 0), 0);
  const fat = meals.reduce((s, m) => s + (Number(m.fat_g) || 0), 0);
  const firstMeal = meals.filter((m) => !['early_morning', 'before_breakfast', 'bedtime'].includes(m.slot)).map((m) => m.eaten_at).sort()[0];
  const fastH = lastMealBefore && firstMeal ? (new Date(firstMeal) - new Date(lastMealBefore)) / 36e5 : null;
  const onPlan = meals.filter((m) => m.followed === true).length;
  const cheats = meals.filter((m) => m.cheat).length;
  const cheatDay = !!habits.habits?.cheat_day;
  const toggleCheatDay = async () => {
    const next = { ...(habits.habits || {}), cheat_day: !cheatDay };
    if (!next.cheat_day) delete next.cheat_day;
    setHabits({ ...habits, habits: next });
    const { error } = await supabase.from('habit_logs').upsert({ user_id: userId, log_date: date, habits: next, supplements: habits.supplements || {} }, { onConflict: 'user_id,log_date' });
    if (error) { setHabits(habits); return cheer('error', error.message); }
    changed(); cheer(next.cheat_day && !isCoach ? 'cheat_day' : 'saved');
  };

  if (loading) return <div className="center-pad"><Spinner size={24} /></div>;

  return (
    <div className="dayview">
      <div className="day-summary">
        {has('weight') && <div className="pill"><Scale size={16} /> {weight ? `${weight.weight_kg} kg` : 'No weight'}</div>}
        {has('meals') && <div className="pill"><Check size={16} /> {onPlan}/{meals.length - cheats} meals on plan</div>}
        {cheats > 0 && <div className="pill pill-cheat">🍕 {cheats} cheat meal{cheats > 1 ? 's' : ''}</div>}
        {kcal > 0 && <div className="pill"><Flame size={16} /> ~{Math.round(kcal)} kcal</div>}
        {protein > 0 && <div className="pill"><Bean size={16} /> ~{Math.round(protein)} g protein</div>}
        {(carbs > 0 || fat > 0) && <div className="pill" title="Carbs / fat today">C ~{Math.round(carbs)} g · F ~{Math.round(fat)} g</div>}
        {fastH != null && fastH > 0 && fastH < 30 && (
          <div className={`pill ${fastH >= 12 ? 'pill-good' : 'pill-warn'}`} title="Dinner yesterday → first meal today (plan: 12 h)">
            <Timer size={16} /> {Math.floor(fastH)}h {Math.round((fastH % 1) * 60)}m fast {fastH >= 12 ? '✓' : ''}
          </div>
        )}
        {has('gym') && <div className="pill"><Dumbbell size={16} /> {workouts.length ? workouts.map((w) => w.day_label || 'Workout').join(', ') : 'No workout'}</div>}
      </div>

      {has('weight') && <WeightQuick userId={userId} date={date} weight={weight} editable={editable} onSaved={changed} setLightbox={setLightbox} />}

      {juiceDay && (
        <JuiceTracker group={juiceGroup} value={habits.habits?.juices || {}} editable
          title="🧃 Juice day"
          onChange={async (juices) => {
            const next = { ...(habits.habits || {}), juices };
            setHabits({ ...habits, habits: next });
            const { error } = await supabase.from('habit_logs').upsert({ user_id: userId, log_date: date, habits: next, supplements: habits.supplements || {} }, { onConflict: 'user_id,log_date' });
            const n = (j) => ['red', 'smoothie_am', 'green1', 'smoothie_pm', 'white'].filter((k) => j?.[k]).length + (j?.green2 || j?.tangy ? 1 : 0);
            if (error) return cheer('error', error.message);
            changed(); cheer(n(juices) === 6 && n(habits.habits?.juices) < 6 ? 'juice_done' : 'saved');
          }} />
      )}

      {has('meals') && juiceDay && (
        <Card title="Meals">
          <p className="jd-nofood">🚫 Juice day: no other food today.{isCoach ? ' Clients can’t log meals; you can still record a slip below.' : ' If you feel unwell, message your coach.'}</p>
          {meals.length > 0 && (
            <div className="slots">
              {SLOTS.filter((s) => meals.some((m) => m.slot === s.key)).map((s) => (
                <MealSlot key={s.key} slot={s} planSlot={null} meals={meals.filter((m) => m.slot === s.key)} userId={userId} date={date}
                  editable={isCoach} admin={isCoach} has={has} onChange={changed} setLightbox={setLightbox} />
              ))}
            </div>
          )}
          {isCoach && !meals.length && <MealSlot slot={SLOTS.find((s) => s.key === 'other') || SLOTS.at(-1)} planSlot={null} meals={[]} userId={userId} date={date} editable admin has={has} onChange={changed} setLightbox={setLightbox} />}
        </Card>
      )}

      {has('meals') && !juiceDay && (
        <Card title="Meals" action={editable && <button type="button" className={`btn btn-sm ${cheatDay ? 'btn-cheat' : 'btn-ghost'}`} aria-pressed={cheatDay} onClick={toggleCheatDay}>🍕 {cheatDay ? 'Cheat day on' : 'Cheat day?'}</button>}>
          {cheatDay && <p className="cheat-banner">🍕 <b>Cheat day.</b> Enjoy it, no guilt. Meals you log today are tagged as cheat and don’t count against your plan or streak. Back on track tomorrow 💪</p>}
          <div className="slots">
            {SLOTS.map((s) => {
              const ps = plan?.slots?.find((x) => x.key === s.key);
              const list = meals.filter((m) => m.slot === s.key);
              if (!editable && !list.length) return null;
              if (s.key === 'other' && !list.length && !editable) return null;
              return (
                <MealSlot key={s.key} slot={s} planSlot={ps} meals={list} userId={userId} date={date} cheatDay={cheatDay}
                  editable={editable} admin={isCoach} has={has} onChange={changed} setLightbox={setLightbox} />
              );
            })}
            {!editable && !meals.length && <Empty>No meals logged this day.</Empty>}
          </div>
        </Card>
      )}

      {(has('habits') || has('supplements')) && (
        <HabitsCard userId={userId} date={date} value={habits} editable={editable} has={has} onSaved={changed} />
      )}

      {has('gym') && (
        <Card title="Workout" action={!isCoach && <Link to="/app/gym" className="btn btn-soft btn-sm"><Plus size={16} /> Log workout</Link>}>
          {workouts.length ? workouts.map((w) => <WorkoutSummary key={w.id} w={w} editable onChange={changed} />) : <Empty>No workout logged.</Empty>}
        </Card>
      )}

      <Card title={mode === 'admin' ? 'Notes for this day' : "Coach's notes"}>
        <Comments userId={userId} date={date} />
      </Card>

      <Lightbox path={lightbox} onClose={() => setLightbox(null)} />
    </div>
  );
}

export function WorkoutSummary({ w, editable = false, onChange }) {
  const [edit, setEdit] = useState(false);
  const [sets, setSets] = useState(w.workout_sets || []);
  const [meta, setMeta] = useState({ day_label: w.day_label || '', duration_min: w.duration_min || '', notes: w.notes || '' });
  const [busy, setBusy] = useState(false);
  useEffect(() => { setSets(w.workout_sets || []); }, [w]);
  const byEx = {};
  sets.forEach((s) => { (byEx[s.exercise_id] ||= { name: s.exercises?.name, kind: s.exercises?.kind, sets: [] }).sets.push(s); });
  const upd = (id, k, v) => setSets(sets.map((s) => (s.id === id ? { ...s, [k]: v } : s)));
  const num = (v) => (v === '' || v == null ? null : Number(v));
  const save = async () => {
    setBusy(true);
    await supabase.from('workouts').update({ day_label: meta.day_label || null, duration_min: num(meta.duration_min), notes: meta.notes || null }).eq('id', w.id);
    for (const s of sets) {
      await supabase.from('workout_sets').update({ reps: num(s.reps), weight_kg: num(s.weight_kg), duration_min: num(s.duration_min), incline: num(s.incline), distance_km: num(s.distance_km) }).eq('id', s.id);
    }
    setBusy(false); setEdit(false); onChange && onChange();
  };
  const delSet = async (id) => { await supabase.from('workout_sets').delete().eq('id', id); setSets(sets.filter((s) => s.id !== id)); };
  const delWorkout = async () => {
    if (!confirm('Delete this whole workout?')) return;
    await supabase.from('workouts').delete().eq('id', w.id); onChange && onChange();
  };
  return (
    <div className="workout-sum">
      <div className="ws-head">
        {edit ? (
          <div className="row gap wrap">
            <input className="grow" value={meta.day_label} onChange={(e) => setMeta({ ...meta, day_label: e.target.value })} placeholder="Day (Push, Legs…)" />
            <input style={{ width: 90 }} type="number" value={meta.duration_min} onChange={(e) => setMeta({ ...meta, duration_min: e.target.value })} placeholder="min" />
          </div>
        ) : (<><b>{w.day_label || 'Workout'}</b>{w.duration_min && <span className="muted"> · {w.duration_min} min</span>}</>)}
        {editable && !edit && (
          <span className="ws-actions">
            <button className="icon-btn sm" onClick={() => setEdit(true)} aria-label="Edit workout"><Pencil size={14} /></button>
            <button className="icon-btn sm" onClick={delWorkout} aria-label="Delete workout"><Trash2 size={14} /></button>
          </span>
        )}
      </div>
      {edit ? (
        <div className="ws-edit">
          {Object.values(byEx).map((e, i) => (
            <div key={i} className="ex-block">
              <b>{e.name}</b>
              {e.sets.map((s) => (
                <div key={s.id} className="row gap set-edit">
                  {e.kind === 'cardio' ? (<>
                    <label>Min<input type="number" value={s.duration_min ?? ''} onChange={(x) => upd(s.id, 'duration_min', x.target.value)} /></label>
                    <label>Incline<input type="number" value={s.incline ?? ''} onChange={(x) => upd(s.id, 'incline', x.target.value)} /></label>
                    <label>Km<input type="number" step="0.1" value={s.distance_km ?? ''} onChange={(x) => upd(s.id, 'distance_km', x.target.value)} /></label>
                  </>) : (<>
                    <label>Reps<input type="number" value={s.reps ?? ''} onChange={(x) => upd(s.id, 'reps', x.target.value)} /></label>
                    <label>Kg<input type="number" step="0.5" value={s.weight_kg ?? ''} onChange={(x) => upd(s.id, 'weight_kg', x.target.value)} /></label>
                  </>)}
                  <button className="icon-btn sm" onClick={() => delSet(s.id)} aria-label="Delete set"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          ))}
          <input value={meta.notes} onChange={(e) => setMeta({ ...meta, notes: e.target.value })} placeholder="Notes" />
          <div className="row gap">
            <button className="btn btn-primary btn-sm" disabled={busy} onClick={save}>{busy ? <Spinner size={14} /> : 'Save'}</button>
            <button className="btn btn-ghost btn-sm" onClick={() => { setEdit(false); setSets(w.workout_sets || []); }}>Cancel</button>
          </div>
        </div>
      ) : (
        <ul>
          {Object.values(byEx).map((e, i) => (
            <li key={i}><span>{e.name}</span>
              <small>{e.kind === 'cardio'
                ? e.sets.map((s) => `${s.duration_min || '?'} min${s.incline ? ` @${s.incline}%` : ''}${s.distance_km ? ` ${s.distance_km} km` : ''}`).join(', ')
                : e.sets.map((s) => `${s.reps ?? '?'}×${s.weight_kg ? s.weight_kg + 'kg' : 'bw'}`).join(' · ')}</small>
            </li>
          ))}
        </ul>
      )}
      {!edit && w.notes && <p className="muted small">{w.notes}</p>}
    </div>
  );
}

function WeightQuick({ userId, date, weight, editable, onSaved, setLightbox }) {
  const { has, user } = useAuth();
  const own = user?.id === userId;
  const [val, setVal] = useState(weight?.weight_kg || '');
  const [waist, setWaist] = useState(weight?.waist_cm || '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [pending, setPending] = useState(null);
  useEffect(() => { setVal(weight?.weight_kg || ''); setWaist(weight?.waist_cm || ''); }, [weight]);

  const save = async () => {
    if (!val) return;
    setBusy(true);
    const row = { user_id: userId, log_date: date, weight_kg: Number(val), waist_cm: waist ? Number(waist) : null, ...(pending ? { photo_path: pending } : {}) };
    setPending(null);
    const { error } = await supabase.from('weight_logs').upsert(row, { onConflict: 'user_id,log_date' });
    setBusy(false);
    setMsg(error ? error.message : '');
    if (error) cheer('error', error.message); else { onSaved(); cheer('weight'); }
  };

  const fromPhoto = async (file) => {
    setBusy(true); setMsg('');
    try {
      const { path, file: small } = await uploadMedia(userId, 'scale', file);
      let kg = null;
      if (has('ai')) {
        const r = await runAI('scale', { image: await toBase64(small), mime: small.type });
        kg = r?.weight_kg;
        setMsg(kg ? `AI read ${kg} kg — check and save` : 'Could not read the scale, please type it');
      }
      const typed = Number(val);
      if (kg) setVal(kg);
      if (kg || typed) {
        await supabase.from('weight_logs').upsert({ user_id: userId, log_date: date, weight_kg: kg || typed, waist_cm: waist ? Number(waist) : null, photo_path: path, source: kg ? 'ai' : 'manual' }, { onConflict: 'user_id,log_date' });
        onSaved();
      } else {
        setPending(path); // keep the photo; attach it when the user types the number and saves
        setMsg('Photo uploaded — type the weight and press Save');
      }
    } catch (e) { setMsg(e.message); }
    setBusy(false);
  };

  return (
    <Card title="Weight" action={own && <Link className="btn btn-ghost btn-sm" to="/app/weight#inches">📏 Inches</Link>}>
      {editable ? (
        <div className="weight-quick">
          <div className="row gap">
            <label className="grow">Weight (kg)<input inputMode="decimal" type="number" step="0.1" value={val} onChange={(e) => setVal(e.target.value)} placeholder="e.g. 89.4" /></label>
            <label className="grow">Waist (cm)<input inputMode="decimal" type="number" step="0.5" value={waist} onChange={(e) => setWaist(e.target.value)} placeholder="optional" /></label>
          </div>
          <div className="row gap wrap">
            <button className="btn btn-primary" disabled={busy} onClick={() => save()}>{busy ? <Spinner /> : 'Save'}</button>
            <PhotoInput onFile={fromPhoto} busy={busy} label={has('ai') ? 'Scale photo (AI)' : 'Scale photo'} />
          </div>
          {msg && <p className="muted small">{msg}</p>}
        </div>
      ) : weight ? (
        <p className="big-num">{weight.weight_kg} kg {weight.waist_cm && <small className="muted">· waist {weight.waist_cm} cm</small>} {weight.source === 'ai' && <span className="tag">AI read</span>}</p>
      ) : <Empty>No weight logged.</Empty>}
      {weight?.photo_path && <SignedImg path={weight.photo_path} className="thumb" onClick={() => setLightbox(weight.photo_path)} />}
    </Card>
  );
}

function MealSlot({ slot, planSlot, meals, userId, date, editable, admin, has, onChange, setLightbox, cheatDay = false }) {
  const [open, setOpen] = useState(false);
  const [cheat, setCheat] = useState(cheatDay);
  useEffect(() => { setCheat(cheatDay); }, [cheatDay]);
  const [desc, setDesc] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // Draft meal: photo (uploaded) + AI guess + editable numbers. Nothing is saved until "Add meal".
  const EMPTY_N = { kcal: '', protein_g: '', carbs_g: '', fat_g: '' };
  const [nutr, setNutr] = useState(EMPTY_N);
  const [photo, setPhoto] = useState(null);   // { path }
  const [ai, setAi] = useState(null);
  const setN = (k) => (e) => setNutr({ ...nutr, [k]: e.target.value });
  const r1 = (v) => (v == null || v === '' ? '' : String(Math.round(Number(v) * 10) / 10));

  const [busyMsg, setBusyMsg] = useState('');
  const attach = async (file) => {
    setBusy(true); setErr(''); setBusyMsg(has('ai') ? 'Uploading & guessing calories…' : 'Uploading photo…');
    try {
      if (photo?.path) await supabase.storage.from('media').remove([photo.path]);
      const up = await uploadMedia(userId, 'meals', file);
      setPhoto({ path: up.path }); setAi(null);
      if (has('ai')) {
        try {
          const r = await runAI('meal', {
            image: await toBase64(up.file), mime: up.file.type, slot: slot.label, note: desc,
            plan: planSlot ? { items: planSlot.items, avoid: planSlot.avoid } : null,
          });
          setAi(r);
          setNutr({ kcal: r1(r?.kcal), protein_g: r1(r?.protein_g), carbs_g: r1(r?.carbs_g), fat_g: r1(r?.fat_g) });
          if (!desc && r?.items?.length) setDesc(r.items.join(', '));
        } catch (e) { setErr(`AI couldn’t read it: ${e.message}. You can type the details.`); }
      }
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };
  // closing the slot with an unsaved photo → delete it so nothing is kept that wasn't logged
  useEffect(() => { if (!open && photo?.path) { supabase.storage.from('media').remove([photo.path]); setPhoto(null); setAi(null); setNutr(EMPTY_N); } }, [open]);
  const resetDraft = async (removePhoto) => {
    if (removePhoto && photo?.path) await supabase.storage.from('media').remove([photo.path]);
    setPhoto(null); setAi(null); setNutr(EMPTY_N); setDesc(''); setErr('');
  };
  const add = async () => {
    if (!desc.trim() && !photo) return setErr('Add a photo or say what you had');
    setBusy(true); setErr(''); setBusyMsg('Saving…');
    const num = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Math.max(0, Number(v)));
    const followed = cheat ? null : ai?.plan_check ? ai.plan_check === 'on_plan' : null;
    const edited = ai && ['kcal', 'protein_g', 'carbs_g', 'fat_g'].some((k) => num(nutr[k]) !== (ai[k] == null ? null : Math.round(Number(ai[k]) * 10) / 10));
    const { error } = await supabase.from('meal_logs').insert({
      user_id: userId, log_date: date, slot: slot.key, photo_path: photo?.path || null, followed, cheat,
      ai: ai ? { ...ai, edited_by_user: edited || undefined } : null,
      description: desc.trim() || null,
      kcal: num(nutr.kcal), protein_g: num(nutr.protein_g), carbs_g: num(nutr.carbs_g), fat_g: num(nutr.fat_g),
    });
    setBusy(false);
    if (error) { setErr(error.message); return cheer('error', error.message); }
    setPhoto(null); setAi(null); setNutr(EMPTY_N); setDesc(''); setOpen(false); onChange();
    if (!admin) cheer(cheat ? 'cheat' : followed === true ? 'on_plan' : 'meal');
    else cheer('update');
  };

  const [editing, setEditing] = useState(null);
  const saveEdit = async () => {
    const num = (v) => (v === '' || v == null ? null : Number(v));
    const { error } = await supabase.from('meal_logs').update({ description: editing.description || null, kcal: num(editing.kcal), protein_g: num(editing.protein_g), carbs_g: num(editing.carbs_g), fat_g: num(editing.fat_g) }).eq('id', editing.id);
    if (error) return cheer('error', error.message);
    setEditing(null); onChange(); cheer('update');
  };
  const toggleMealCheat = async (m) => {
    const v = !m.cheat;
    const { error } = await supabase.from('meal_logs').update({ cheat: v, ...(v ? { followed: null } : {}) }).eq('id', m.id);
    if (error) return cheer('error', error.message);
    onChange(); cheer(v && !admin ? 'cheat' : 'saved');
  };
  const setFollowed = async (m, v) => {
    const { error } = await supabase.from('meal_logs').update({ followed: v, cheat: false }).eq('id', m.id);
    if (error) return cheer('error', error.message);
    onChange(); cheer(v && m.followed !== true && !admin ? 'on_plan' : 'saved');
  };
  const del = async (m) => {
    if (!confirm('Delete this meal entry?')) return;
    const { error } = await supabase.from('meal_logs').delete().eq('id', m.id);
    if (error) return cheer('error', error.message);
    if (m.photo_path) await supabase.storage.from('media').remove([m.photo_path]);
    onChange(); cheer('removed');
  };
  // One tap on an option from the diet plan logs it straight away as an on-plan meal (numbers can be added later with ✏️).
  const quickLog = async (item) => {
    setBusy(true); setErr('');
    const { error } = await supabase.from('meal_logs').insert({ user_id: userId, log_date: date, slot: slot.key, description: item, followed: cheat ? null : true, cheat });
    setBusy(false);
    if (error) { setErr(error.message); return cheer('error', error.message); }
    setOpen(false); onChange(); cheer(admin ? 'update' : cheat ? 'cheat' : 'on_plan');
  };

  return (
    <div className={`slot ${meals.length ? 'has' : ''}`}>
      <div className="slot-head" onClick={() => editable && setOpen(!open)}>
        <div>
          <span className="slot-emoji" aria-hidden>{slot.emoji}</span><b>{slot.label}</b>
          {planSlot?.title && <small className="muted"> · {planSlot.title}</small>}
        </div>
        {editable && <button className="icon-btn" aria-label={`Add ${slot.label}`}><Plus size={18} /></button>}
      </div>
      {meals.map((m) => (
        <div key={m.id} className="meal">
          {m.photo_path && <SignedImg path={m.photo_path} onClick={() => setLightbox(m.photo_path)} />}
          <div className="meal-body">
            {editing?.id === m.id ? (
              <div className="meal-edit">
                <textarea rows={2} value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
                <div className="row gap">
                  <label className="grow">kcal<input type="number" value={editing.kcal ?? ''} onChange={(e) => setEditing({ ...editing, kcal: e.target.value })} /></label>
                  <label className="grow">Protein g<input type="number" value={editing.protein_g ?? ''} onChange={(e) => setEditing({ ...editing, protein_g: e.target.value })} /></label>
                  <label className="grow">Carbs g<input type="number" value={editing.carbs_g ?? ''} onChange={(e) => setEditing({ ...editing, carbs_g: e.target.value })} /></label>
                  <label className="grow">Fat g<input type="number" value={editing.fat_g ?? ''} onChange={(e) => setEditing({ ...editing, fat_g: e.target.value })} /></label>
                </div>
                <div className="row gap">
                  <button className="btn btn-primary btn-sm" onClick={saveEdit}>Save</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>Cancel</button>
                </div>
              </div>
            ) : <p>{m.description || <span className="muted">Photo only</span>}</p>}
            <small className="muted">{fmtTime(m.eaten_at)}{m.kcal ? ` · ~${Math.round(m.kcal)} kcal` : ''}{m.protein_g ? ` · P ${Math.round(m.protein_g)}g` : ''}{m.carbs_g ? ` · C ${Math.round(m.carbs_g)}g` : ''}{m.fat_g ? ` · F ${Math.round(m.fat_g)}g` : ''}{m.ai?.edited_by_user ? ' · edited' : ''}</small>
            {m.cheat && <span className="tag cheat-tag">🍕 Cheat meal</span>}
            {m.ai?.plan_note && <small className={`ai-note ${m.ai.plan_check}`}><Sparkles size={12} /> {m.ai.plan_note}</small>}
            {m.ai?.breakdown?.length > 0 && (
              <details className="meal-breakdown"><summary>AI breakdown{m.ai.confidence ? ` · ${m.ai.confidence === 'high' ? 'good' : m.ai.confidence === 'low' ? 'rough' : 'fair'} guess` : ''}</summary>
                <ul>{m.ai.breakdown.map((b, i) => <li key={i}><span>{b.item}{b.portion ? ` · ${b.portion}` : ''}</span><em>~{Math.round(b.kcal * (m.ai.portion_multiplier || 1))} kcal</em></li>)}</ul>
              </details>
            )}
            <div className="meal-actions">
              <button className={`chip ${m.followed === true ? 'on ok' : ''}`} onClick={() => setFollowed(m, true)}><Check size={14} /> On plan</button>
              <button className={`chip ${m.followed === false ? 'on bad' : ''}`} onClick={() => setFollowed(m, false)}><X size={14} /> Off plan</button>
              <button className={`chip ${m.cheat ? 'on cheat' : ''}`} aria-pressed={!!m.cheat} onClick={() => toggleMealCheat(m)} title="Planned treat: doesn’t count against your plan">🍕 Cheat</button>
              {editable && <button className="icon-btn sm" onClick={() => setEditing({ ...m })} aria-label="Edit"><Pencil size={15} /></button>}
              {editable && <button className="icon-btn sm" onClick={() => del(m)} aria-label="Delete"><Trash2 size={15} /></button>}
            </div>
          </div>
        </div>
      ))}
      {open && editable && (
        <div className="slot-add">
          {planSlot?.items?.length > 0 && (
            <div className="plan-quick">
              <small className="muted">From your plan, tap to log it:</small>
              <div className="plan-hints">
                {planSlot.items.slice(0, 8).map((it) => <button key={it} type="button" className="chip chip-log" disabled={busy} onClick={() => quickLog(it)}><Plus size={13} /> {it}</button>)}
              </div>
              <small className="muted">Had something else? Type it or add a photo below.</small>
            </div>
          )}
          {planSlot?.avoid?.length > 0 && <p className="avoid">Avoid: {planSlot.avoid.join(', ')}</p>}
          {photo && (
            <div className="draft-photo">
              <SignedImg path={photo.path} className="thumb" />
              <div>
                {ai?.plan_note && <small className={`ai-note ${ai.plan_check}`}><Sparkles size={12} /> {ai.plan_note}</small>}
                {ai && <small className="muted">AI guess{ai.confidence ? ` (${ai.confidence === 'high' ? 'good' : ai.confidence === 'low' ? 'rough' : 'fair'})` : ''}. Check the numbers below and fix anything that’s off.</small>}
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => resetDraft(true)}>Remove photo</button>
              </div>
            </div>
          )}
          <textarea rows={2} placeholder="What did you have? e.g. 2 roti, dal, salad" value={desc} onChange={(e) => setDesc(e.target.value)} />
          <div className="nutr-row" role="group" aria-label="Nutrition for this meal">
            <label>kcal<input type="number" inputMode="decimal" min="0" value={nutr.kcal} onChange={setN('kcal')} placeholder="–" /></label>
            <label>Protein g<input type="number" inputMode="decimal" min="0" step="0.1" value={nutr.protein_g} onChange={setN('protein_g')} placeholder="–" /></label>
            <label>Carbs g<input type="number" inputMode="decimal" min="0" step="0.1" value={nutr.carbs_g} onChange={setN('carbs_g')} placeholder="–" /></label>
            <label>Fat g<input type="number" inputMode="decimal" min="0" step="0.1" value={nutr.fat_g} onChange={setN('fat_g')} placeholder="–" /></label>
          </div>
          <p className="small muted nutr-hint">{has('ai') && has('meal_photos') ? 'Add a photo and AI fills these in. You can change any number before adding.' : 'Optional. Fill in what you know.'}</p>
          <label className="check cheat-check"><input type="checkbox" checked={cheat} onChange={(e) => setCheat(e.target.checked)} /> 🍕 Cheat meal <span className="muted small">(planned treat, no guilt)</span></label>
          <div className="row gap wrap">
            {has('meal_photos') && <PhotoInput onFile={attach} busy={busy} label={photo ? 'Change photo' : has('ai') ? 'Photo (AI guesses)' : 'Add photo'} />}
            <button className="btn btn-primary" disabled={busy || (!desc.trim() && !photo)} onClick={add}>Add meal</button>
            {(photo || desc || nutr.kcal) && <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => resetDraft(true)}>Clear</button>}
          </div>
          {busy && <p className="muted small"><Spinner size={14} /> {busyMsg}</p>}
        </div>
      )}
      {err && <p className="error small">{err}</p>}
    </div>
  );
}

function HabitsCard({ userId, date, value, editable, has, onSaved }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  const save = async (next) => {
    const prev = v;
    setV(next);
    if (!editable) return;
    const { error } = await supabase.from('habit_logs').upsert({ user_id: userId, log_date: date, habits: next.habits || {}, supplements: next.supplements || {} }, { onConflict: 'user_id,log_date' });
    if (error) { setV(prev); return cheer('error', error.message); }
    onSaved && onSaved();
    const done = (x) => HABITS.filter((h) => x?.habits?.[h.key]).length;
    if (done(next) === HABITS.length && done(prev) < HABITS.length) cheer('habits_all');
    else if (Number(next.habits?.water_glasses || 0) >= 8 && Number(prev.habits?.water_glasses || 0) < 8) cheer('water');
    else cheer('saved');
  };
  const water = Number(v.habits?.water_glasses || 0);
  return (
    <Card title="Habits & supplements">
      {has('habits') && (
        <>
          <div className="water">
            <span>Water</span>
            <div className="glasses">
              {Array.from({ length: 10 }).map((_, i) => (
                <button key={i} disabled={!editable} className={i < water ? 'full' : ''} aria-label={`${i + 1} glasses`}
                  onClick={() => save({ ...v, habits: { ...v.habits, water_glasses: i + 1 === water ? i : i + 1 } })} />
              ))}
            </div>
            <b>{water}/10</b>
          </div>
          <div className="checks">
            {HABITS.map((h) => (
              <label key={h.key} className={`check ${v.habits?.[h.key] ? 'on' : ''}`}>
                <input type="checkbox" disabled={!editable} checked={!!v.habits?.[h.key]} onChange={(e) => save({ ...v, habits: { ...v.habits, [h.key]: e.target.checked } })} />
                {h.label}
              </label>
            ))}
          </div>
        </>
      )}
      {has('supplements') && (
        <div className="checks supp">
          {SUPPLEMENTS.map((h) => (
            <label key={h.key} className={`check ${v.supplements?.[h.key] ? 'on' : ''}`}>
              <input type="checkbox" disabled={!editable} checked={!!v.supplements?.[h.key]} onChange={(e) => save({ ...v, supplements: { ...v.supplements, [h.key]: e.target.checked } })} />
              {h.label}
            </label>
          ))}
        </div>
      )}
    </Card>
  );
}

export { slotLabel };
