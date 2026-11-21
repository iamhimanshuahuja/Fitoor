import { useState } from 'react';
import { Alert, Image, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { runAI } from '../../lib/ai';
import { pickImage, uploadMedia } from '../../lib/media';
import { cheer } from '../../shared/cheer';
import { isCheatDay, notifyDataChanged } from '../../shared/chatLog';
import { SLOTS } from '../../shared/constants';
import { today } from '../../shared/dates';
import { Btn, Card, Chip, Chips, MacroFields, Row, Screen, Seg, Spinner, T, Toggle } from '../../components/ui';
import { C } from '../../theme';

export function slotForNow(d = new Date()) {
  const h = d.getHours() + d.getMinutes() / 60;
  return h < 7 ? 'early_morning' : h < 8.5 ? 'before_breakfast' : h < 11.5 ? 'breakfast' : h < 15.5 ? 'lunch' : h < 19 ? 'evening' : h < 22 ? 'dinner' : 'bedtime';
}
const PORTIONS = [{ key: 0.5, label: '½' }, { key: 1, label: '1×' }, { key: 1.5, label: '1½' }, { key: 2, label: '2×' }];
const num = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Math.max(0, Number(v)));
const r0 = (v) => Math.round(Number(v) || 0);

/** 📸 Guess calories: photo → AI estimate → edit → log (or close; photo isn't kept unless logged). */
export default function Scan() {
  const { user, has } = useAuth();
  const params = useLocalSearchParams();
  const date = params.date || today();
  const [img, setImg] = useState(null);
  const [res, setRes] = useState(null);
  const [mult, setMult] = useState(1);
  const [nutr, setNutr] = useState({});
  const [slot, setSlot] = useState(slotForNow());
  const [cheat, setCheat] = useState(false);
  const [busy, setBusy] = useState('');

  const fill = (r, m) => setNutr({ kcal: String(r0(r.kcal * m)), protein_g: String(r0(r.protein_g * m)), carbs_g: String(r0(r.carbs_g * m)), fat_g: String(r0(r.fat_g * m)) });
  const shoot = async (source) => {
    const p = await pickImage(source); if (!p) return;
    setImg(p); setRes(null); setBusy('Guessing calories…');
    try {
      const [r, cd] = await Promise.all([runAI('meal', { image: p.base64, mime: p.mime, slot: SLOTS.find((s) => s.key === slot)?.label }), isCheatDay(user.id, date)]);
      setRes(r); setMult(1); fill(r, 1); setCheat(cd);
    } catch (e) { Alert.alert('AI couldn’t read it', e.message); }
    setBusy('');
  };
  const portion = (m) => { setMult(m); if (res) fill(res, m); };
  const log = async () => {
    setBusy('Logging…');
    try {
      const path = await uploadMedia(user.id, 'meals', img);
      const followed = cheat ? null : res.plan_check ? res.plan_check === 'on_plan' : null;
      const edited = ['kcal', 'protein_g', 'carbs_g', 'fat_g'].some((k) => num(nutr[k]) !== r0(res[k] * mult));
      const { error } = await supabase.from('meal_logs').insert({
        user_id: user.id, log_date: date, slot, photo_path: path, followed, cheat, description: (res.items || []).join(', ') || null,
        kcal: num(nutr.kcal), protein_g: num(nutr.protein_g), carbs_g: num(nutr.carbs_g), fat_g: num(nutr.fat_g),
        ai: { ...res, source: 'scanner', portion_multiplier: mult, edited_by_user: edited || undefined },
      });
      if (error) throw error;
      notifyDataChanged(); cheer(cheat ? 'cheat' : followed === true ? 'on_plan' : 'meal'); router.back();
    } catch (e) { Alert.alert('Not logged', e.message); }
    setBusy('');
  };

  if (!has('ai')) return <Screen><T>AI isn’t switched on for your plan.</T></Screen>;
  return (
    <Screen>
      {!img && (
        <Card title="Snap your plate" tone={C.lime}>
          <T>Take a clear photo from above, the whole plate in view. AI guesses the items, portions and calories. You can fix anything before logging.</T>
          <Row><Btn title="📷 Camera" onPress={() => shoot('camera')} /><Btn variant="ghost" title="🖼 Gallery" onPress={() => shoot('library')} /></Row>
        </Card>
      )}
      {img && <Image source={{ uri: img.uri }} style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: 16, borderWidth: 2, borderColor: C.ink }} />}
      {busy ? <Spinner /> : null}
      {busy ? <T muted style={{ textAlign: 'center' }}>{busy}</T> : null}
      {res && (
        <>
          <Card title={`~${nutr.kcal || 0} kcal`} tone={C.lime}>
            <T small>{res.confidence === 'high' ? 'Good guess' : res.confidence === 'low' ? 'Rough guess' : 'Fair guess'}. Portion size:</T>
            <Seg items={PORTIONS} value={mult} onChange={portion} full />
            <MacroFields value={nutr} onChange={setNutr} />
          </Card>
          {res.breakdown?.length > 0 && (
            <Card title="What AI sees">
              {res.breakdown.map((b, i) => <Row key={i} style={{ justifyContent: 'space-between' }}><T small style={{ flex: 1 }}>{b.item}{b.portion ? ` · ${b.portion}` : ''}</T><T small bold>~{r0(b.kcal * mult)} kcal</T></Row>)}
            </Card>
          )}
          {res.swap_tip ? <Card tone={C.lav} title="💡 Tip"><T>{res.swap_tip}</T></Card> : null}
          <Card title="Log it?">
            <Chips>{SLOTS.map((s) => <Chip key={s.key} small label={`${s.emoji} ${s.label}`} on={slot === s.key} onPress={() => setSlot(s.key)} />)}</Chips>
            <Toggle label="🍕 Cheat meal" value={cheat} onChange={setCheat} />
            <Row wrap><Btn title="Log this meal" onPress={log} disabled={!!busy} /><Btn variant="ghost" title="Retake" onPress={() => shoot('camera')} disabled={!!busy} /><Btn variant="ghost" title="Just checking, close" onPress={() => router.back()} /></Row>
          </Card>
        </>
      )}
      <T small muted>AI estimates can be off. Not medical or nutrition advice.</T>
    </Screen>
  );
}
