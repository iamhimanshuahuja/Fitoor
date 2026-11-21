import { useEffect, useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../lib/auth';
import { pickImage, uploadMedia } from '../../lib/media';
import { askChat, saveAction, actionAllowed, notifyDataChanged } from '../../shared/chatLog';
import { cheer } from '../../shared/cheer';
import { SLOTS, HABITS, SUPPLEMENTS, slotLabel } from '../../shared/constants';
import { SITES } from '../../shared/measure';
import { fmt } from '../../shared/dates';
import { Btn, Chip, Chips, Field, NumField, Row, T } from '../../components/ui';
import { C, R } from '../../theme';

const uid = () => Math.random().toString(36).slice(2, 10);
const ICON = { meal: '🍛', weight: '⚖️', water: '💧', habit: '✅', supplement: '💊', workout: '🏋️', period: '🩸', measure: '📏' };
const SAMPLES = ['lunch 2 roti dal salad', 'weighed 72.4 today', '8 glasses of water', '30 min incline walk', 'waist 36, hips 41'];

export default function Chat() {
  const { user, has } = useAuth();
  const key = `ft_chat_${user.id}`;
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const [img, setImg] = useState(null);
  const [busy, setBusy] = useState(false);
  const scroll = useRef(null);
  useEffect(() => { AsyncStorage.getItem(key).then((v) => { try { setMsgs(JSON.parse(v) || []); } catch { /* ignore */ } }); }, [key]);
  useEffect(() => { AsyncStorage.setItem(key, JSON.stringify(msgs.slice(-40))).catch(() => {}); setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50); }, [msgs, key]);

  const send = async (override) => {
    const body = (override ?? text).trim();
    if ((!body && !img) || busy) return;
    const mine = { id: uid(), role: 'user', text: body, localImg: img?.uri, at: Date.now() };
    const history = msgs.filter((m) => m.text && !m.error).slice(-8).map(({ role, text: t }) => ({ role, text: t }));
    setMsgs((m) => [...m, mine]); setText(''); setBusy(true);
    const photo = img; setImg(null);
    try {
      let photoPath;
      if (photo) photoPath = await uploadMedia(user.id, 'meals', photo);
      const r = await askChat({ userId: user.id, text: body, image: photo?.base64, mime: photo?.mime, history });
      const allowed = (r.actions || []).filter((a) => actionAllowed(a, has));
      const dropped = (r.actions || []).length - allowed.length;
      setMsgs((m) => [...m, { id: uid(), role: 'ai', at: Date.now(), photoPath, text: r.reply + (dropped ? ' (Some of this isn’t switched on for your plan, so I left it out.)' : ''),
        actions: allowed.map((a) => ({ ...a, _id: uid(), _status: 'pending' })) }]);
    } catch (e) {
      setMsgs((m) => [...m, { id: uid(), role: 'ai', at: Date.now(), error: true, text: `Couldn’t read that: ${e.message}` }]);
    }
    setBusy(false);
  };
  const patch = (mid, aid, ch) => setMsgs((m) => m.map((x) => x.id !== mid ? x : { ...x, actions: x.actions.map((a) => a._id === aid ? { ...a, ...ch } : a) }));
  const save = async (msg, a) => {
    patch(msg.id, a._id, { _status: 'saving', _msg: '' });
    try {
      const done = await saveAction(user.id, a, msg.photoPath);
      patch(msg.id, a._id, { _status: 'saved', _msg: done }); notifyDataChanged();
      cheer(a.type === 'meal' && a.plan_check === 'on_plan' ? 'on_plan' : a.type === 'workout' ? 'workout' : a.type === 'weight' ? 'weight' : a.type === 'period' ? 'period' : a.type === 'measure' ? 'measure' : 'chat');
    } catch (e) { patch(msg.id, a._id, { _status: 'pending', _msg: e.message }); }
  };
  const saveAll = async (msg) => { for (const a of msg.actions.filter((x) => x._status === 'pending')) await save(msg, a); };

  if (!has('ai')) return <View style={{ padding: 20 }}><T>AI logging isn’t switched on for your plan. Ask your coach.</T></View>;
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.paper }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <ScrollView ref={scroll} contentContainerStyle={{ padding: 14, gap: 10 }} keyboardShouldPersistTaps="handled">
        {!msgs.length && (
          <View style={{ gap: 8 }}>
            <T>Tell me what you ate, weighed or did, or snap a photo. I’ll turn it into entries you can check and save. Nothing is saved until you tap Save.</T>
            <Chips>{SAMPLES.map((s) => <Chip key={s} small label={s} onPress={() => send(s)} />)}</Chips>
          </View>
        )}
        {msgs.map((m) => (
          <View key={m.id} style={[st.bubble, m.role === 'user' ? st.me : st.ai, m.error && { backgroundColor: C.pink }]}>
            {m.localImg ? <Image source={{ uri: m.localImg }} style={{ width: 140, height: 140, borderRadius: 10 }} /> : null}
            {m.text ? <T>{m.text}</T> : null}
            {(m.actions || []).map((a) => <ActionCard key={a._id} a={a} onChange={(ch) => patch(m.id, a._id, ch)} onSave={() => save(m, a)} onSkip={() => patch(m.id, a._id, { _status: 'skipped' })} />)}
            {(m.actions || []).filter((a) => a._status === 'pending').length > 1 && <Btn small title="Save all" onPress={() => saveAll(m)} />}
          </View>
        ))}
        {busy ? <T muted small>✨ Thinking…</T> : null}
        <T small muted>AI can make mistakes. Check each card before saving. Not medical advice.</T>
      </ScrollView>
      <View style={st.bar}>
        {img ? <Row><Image source={{ uri: img.uri }} style={{ width: 48, height: 48, borderRadius: 8 }} /><Btn small variant="ghost" title="Remove photo" onPress={() => setImg(null)} /></Row> : null}
        <Row style={{ alignItems: 'flex-end' }}>
          <Btn small variant="soft" title="📷" accessibilityLabel="Add photo" onPress={async () => { const p = await pickImage('camera'); if (p) setImg(p); }} />
          <Btn small variant="ghost" title="🖼" accessibilityLabel="Pick from gallery" onPress={async () => { const p = await pickImage('library'); if (p) setImg(p); }} />
          <Field value={text} onChangeText={setText} placeholder="lunch 2 roti dal, 30 min walk…" multiline style={{ flex: 1 }} />
          <Btn small title="Send" onPress={() => send()} disabled={busy || (!text.trim() && !img)} />
        </Row>
      </View>
    </KeyboardAvoidingView>
  );
}

function ActionCard({ a, onChange, onSave, onSkip }) {
  const locked = a._status !== 'pending';
  const nf = (k, label) => <NumField key={k} label={label} value={a[k] == null ? '' : String(a[k])} editable={!locked} onChangeText={(v) => onChange({ [k]: v })} />;
  let title = '', body = null;
  if (a.type === 'meal') {
    title = slotLabel(a.slot) || 'Meal';
    body = (<>
      <Field label="What" value={a.description || ''} editable={!locked} onChangeText={(v) => onChange({ description: v })} />
      {!locked && <Chips>{SLOTS.map((s) => <Chip key={s.key} small label={s.label} on={a.slot === s.key} onPress={() => onChange({ slot: s.key })} />)}</Chips>}
      <Row gap={6}>{nf('kcal', 'kcal')}{nf('protein_g', 'P g')}{nf('carbs_g', 'C g')}{nf('fat_g', 'F g')}</Row>
      {a.plan_note ? <T small>✨ {a.plan_note}</T> : null}
    </>);
  } else if (a.type === 'weight') { title = 'Weight'; body = <Row gap={6}>{nf('weight_kg', 'kg')}{nf('waist_cm', 'Waist cm')}</Row>; }
  else if (a.type === 'measure') { title = 'Measurements (inches)'; body = <Row wrap gap={6}>{SITES.filter((s) => a[s.key] != null).map((s) => nf(s.key, s.label))}</Row>; }
  else if (a.type === 'water') { title = 'Water'; body = <Row>{nf('glasses', 'Glasses')}</Row>; }
  else if (a.type === 'habit') title = HABITS.find((h) => h.key === a.key)?.label || 'Habit';
  else if (a.type === 'period') title = a.event === 'end' ? 'Period ended' : 'Period started';
  else if (a.type === 'supplement') title = SUPPLEMENTS.find((s) => s.key === a.key)?.label || 'Supplement';
  else if (a.type === 'workout') {
    title = `Workout${a.day_label ? ` · ${a.day_label}` : ''}`;
    body = (<>
      <Row>{nf('duration_min', 'Minutes')}</Row>
      {(a.exercises || []).map((e, i) => <T small key={i}>• <T small bold>{e.name}</T> {(e.sets || []).map((s) => [s.reps && `${s.reps} reps`, s.weight_kg && `${s.weight_kg} kg`, s.duration_min && `${s.duration_min} min`, s.incline && `incline ${s.incline}`, s.distance_km && `${s.distance_km} km`].filter(Boolean).join(' · ')).join(' / ')}</T>)}
    </>);
  }
  return (
    <View style={[st.card, a._status === 'saved' && { backgroundColor: '#EAF8D2' }, a._status === 'skipped' && { opacity: 0.5 }]}>
      <Row style={{ justifyContent: 'space-between' }}><T bold>{ICON[a.type]} {title}</T><T small muted>{a.date ? fmt(a.date) : 'Today'}</T></Row>
      {body}
      {a._msg ? <T small style={{ color: a._status === 'saved' ? C.deep : C.red }}>{a._msg}</T> : null}
      {a._status === 'pending' && <Row><Btn small title="Save" onPress={onSave} /><Btn small variant="ghost" title="Skip" onPress={onSkip} /></Row>}
      {a._status === 'saving' && <T small muted>Saving…</T>}
    </View>
  );
}

const st = StyleSheet.create({
  bubble: { borderRadius: R.lg, padding: 10, gap: 8, borderWidth: 2, borderColor: C.ink, maxWidth: '92%' },
  me: { alignSelf: 'flex-end', backgroundColor: C.lime }, ai: { alignSelf: 'flex-start', backgroundColor: '#fff' },
  card: { borderWidth: 1.5, borderColor: C.line, borderRadius: 12, padding: 10, gap: 6, backgroundColor: '#FBFDF8' },
  bar: { borderTopWidth: 2, borderTopColor: C.ink, padding: 10, gap: 6, backgroundColor: '#fff' },
});
