import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { on } from '../lib/events';
import { cheer } from '../shared/cheer';
import { notifyDataChanged } from '../shared/chatLog';
import { SITES, measureStats, toUnit, fromUnit, fmtVal } from '../shared/measure';
import { today, fmtLong } from '../shared/dates';
import { Btn, Card, Empty, Field, NumField, Row, Seg, Spinner, Stat, T } from './ui';
import LineChart from './LineChart';
import { C } from '../theme';

/** Weight history + optional body measurements for one user. */
export default function WeightPanel({ userId, profile }) {
  const [weights, setWeights] = useState(null);
  const [rows, setRows] = useState(null);
  const [unit, setUnit] = useState('in');
  const [form, setForm] = useState(null);
  const [site, setSite] = useState('waist');
  const load = useCallback(async () => {
    const [w, m] = await Promise.all([
      supabase.from('weight_logs').select('*').eq('user_id', userId).order('log_date'),
      supabase.from('body_measurements').select('*').eq('user_id', userId).order('log_date'),
    ]);
    setWeights(w.data || []); setRows(m.data || []);
  }, [userId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => on('data-changed', load), [load]);
  if (!weights || !rows) return <Spinner />;

  const last = weights.at(-1), h = Number(profile?.height_cm);
  const bmi = last && h ? (last.weight_kg / ((h / 100) ** 2)).toFixed(1) : null;
  const avg7 = weights.slice(-7).reduce((s, x) => s + Number(x.weight_kg), 0) / Math.max(1, weights.slice(-7).length);
  const bm = measureStats(rows);
  const delW = (w) => Alert.alert('Delete this weigh-in?', fmtLong(w.log_date), [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { await supabase.from('weight_logs').delete().eq('id', w.id); notifyDataChanged(); load(); } }]);

  const openForm = (r) => setForm(r ? { ...Object.fromEntries(SITES.map((s) => [s.key, r[s.key] == null ? '' : String(toUnit(r[s.key], unit))])), log_date: r.log_date, note: r.note || '' } : { log_date: today(), note: '' });
  const saveM = async () => {
    const vals = Object.fromEntries(SITES.map((s) => [s.key, fromUnit(form[s.key], unit)]));
    if (!Object.values(vals).some((v) => v != null)) return Alert.alert('Add at least one measurement');
    if (Object.values(vals).some((v) => v != null && (v < 3 || v > 90))) return Alert.alert('Check the numbers', `Values look off for ${unit === 'in' ? 'inches' : 'cm'}.`);
    const { error } = await supabase.from('body_measurements').upsert({ user_id: userId, log_date: form.log_date, ...vals, note: form.note || null }, { onConflict: 'user_id,log_date' });
    if (error) return Alert.alert('Not saved', error.message);
    setForm(null); cheer('measure'); notifyDataChanged(); load();
  };
  const delM = (r) => Alert.alert('Delete measurements?', fmtLong(r.log_date), [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { await supabase.from('body_measurements').delete().eq('id', r.id); load(); } }]);
  const siteData = rows.filter((r) => r[site] != null).map((r) => ({ date: r.log_date, value: toUnit(r[site], unit) }));

  return (
    <View style={{ gap: 14 }}>
      <Row wrap gap={8}>
        <Stat label="Latest" value={last ? `${last.weight_kg} kg` : '—'} tone={C.lime} />
        <Stat label="7-day avg" value={weights.length ? `${avg7.toFixed(1)} kg` : '—'} tone={C.lav} />
        <Stat label="BMI" value={bmi || '—'} sub={h ? '' : 'add height in Me'} tone={C.sky} />
        <Stat label="Target" value={profile?.target_weight ? `${profile.target_weight} kg` : '—'} tone={C.haldi} />
      </Row>
      <Card title="Weight trend">
        {weights.length >= 2 ? <LineChart data={weights.slice(-90).map((w) => ({ date: w.log_date, value: Number(w.weight_kg) }))} refLine={Number(profile?.target_weight) || null} /> : <T muted>Log 2 or more weigh-ins on Today to see a chart.</T>}
      </Card>
      <Card title="Weigh-ins">
        {!weights.length ? <Empty>No weigh-ins yet. Add one on Today.</Empty> : [...weights].reverse().slice(0, 40).map((w) => (
          <Pressable key={w.id} onLongPress={() => delW(w)}><Row style={{ justifyContent: 'space-between', minHeight: 32 }}><T small>{fmtLong(w.log_date)}</T><T small bold>{w.weight_kg} kg{w.waist_cm ? ` · waist ${w.waist_cm} cm` : ''}{w.source === 'ai' ? ' · 📷' : ''}</T></Row></Pressable>
        ))}
        {weights.length ? <T small muted>Long-press to delete.</T> : null}
      </Card>

      <Card title="📏 Body measurements (optional)" action={<Seg items={[{ key: 'in', label: 'in' }, { key: 'cm', label: 'cm' }]} value={unit} onChange={setUnit} />}>
        <T small muted>Totally optional. Measure the same spots, same time of day, tape snug not tight.</T>
        {bm.totalSites > 0 && <T bold>{bm.total <= 0 ? `${fmtVal(-toUnit(bm.total, unit))} ${unit} lost` : `+${fmtVal(toUnit(bm.total, unit))} ${unit}`} in total across {bm.totalSites} spots</T>}
        {Object.entries(bm.sites).map(([k, v]) => (
          <Row key={k} style={{ justifyContent: 'space-between' }}>
            <T small>{SITES.find((s) => s.key === k)?.emoji} {SITES.find((s) => s.key === k)?.label}</T>
            <T small bold>{fmtVal(toUnit(v.last, unit))} {unit}{v.change != null ? `  (${v.change > 0 ? '+' : ''}${fmtVal(toUnit(v.change, unit))})` : ''}</T>
          </Row>
        ))}
        {!form && <Btn small title="+ Add measurements" onPress={() => openForm(rows.find((r) => r.log_date === today()))} />}
        {form && (
          <View style={{ gap: 8 }}>
            <Field label="Date (YYYY-MM-DD)" value={form.log_date} onChangeText={(v) => setForm({ ...form, log_date: v })} autoCapitalize="none" />
            <Row wrap gap={8}>
              {SITES.map((s) => <View key={s.key} style={{ width: '47%' }}><NumField label={`${s.emoji} ${s.label} (${unit})`} hint={s.how} value={form[s.key] || ''} onChangeText={(v) => setForm({ ...form, [s.key]: v })} /></View>)}
            </Row>
            <Field label="Note" value={form.note} onChangeText={(v) => setForm({ ...form, note: v })} placeholder="optional" />
            <Row><Btn small title="Save" onPress={saveM} /><Btn small variant="ghost" title="Cancel" onPress={() => setForm(null)} /></Row>
          </View>
        )}
        {rows.length >= 2 && (
          <>
            <Row wrap gap={6}>{SITES.filter((s) => rows.some((r) => r[s.key] != null)).map((s) => <Btn key={s.key} small variant={site === s.key ? 'pop' : 'ghost'} title={s.label} onPress={() => setSite(s.key)} />)}</Row>
            {siteData.length >= 2 ? <LineChart data={siteData} /> : null}
          </>
        )}
        {[...rows].reverse().map((r) => (
          <Pressable key={r.id} onPress={() => openForm(r)} onLongPress={() => delM(r)} style={{ borderTopWidth: 1, borderTopColor: C.line, paddingTop: 6 }}>
            <T small bold>{fmtLong(r.log_date)}</T>
            <T small muted>{SITES.filter((s) => r[s.key] != null).map((s) => `${s.label} ${fmtVal(toUnit(r[s.key], unit))}`).join(' · ')}</T>
          </Pressable>
        ))}
        {rows.length ? <T small muted>Tap to edit, long-press to delete.</T> : null}
      </Card>
    </View>
  );
}
