import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { cheer } from '../shared/cheer';
import { PCOS, PREGNANCY, FLOW, SYMPTOMS, cycleStats } from '../shared/cycle';
import { today, fmt, fmtLong, daysAgo } from '../shared/dates';
import { Btn, Card, Chip, Chips, Field, Row, Spinner, Stat, T, Toggle } from './ui';
import { C } from '../theme';

/** Optional women's health profile + period tracker (descriptive only, no medical advice). */
export default function WomensHealth({ profile, onSaved, userId = profile.id }) {
  const [f, setF] = useState({ pcos: profile.pcos || '', pregnancy: profile.pregnancy || '', due_date: profile.due_date || '', track_cycle: !!profile.track_cycle });
  const save = async () => {
    const { error } = await supabase.from('profiles').update({
      pcos: f.pcos || null, pregnancy: f.pregnancy || null, due_date: f.pregnancy === 'pregnant' && f.due_date ? f.due_date : null,
      track_cycle: f.track_cycle, wh_updated_at: new Date().toISOString(),
    }).eq('id', userId);
    if (error) return Alert.alert('Not saved', error.message);
    cheer('update'); onSaved?.();
  };
  return (
    <>
      <Card title="🌸 Women’s health (optional)">
        <T small muted>Helps your coach plan around your body. Skip anything you don’t want to share.</T>
        <T small bold>PCOS / PCOD</T>
        <Chips>{Object.entries(PCOS).map(([k, l]) => <Chip key={k} small label={l} on={f.pcos === k} onPress={() => setF({ ...f, pcos: f.pcos === k ? '' : k })} />)}</Chips>
        <T small bold>Pregnancy</T>
        <Chips>{Object.entries(PREGNANCY).map(([k, l]) => <Chip key={k} small label={l} on={f.pregnancy === k} onPress={() => setF({ ...f, pregnancy: f.pregnancy === k ? '' : k })} />)}</Chips>
        {f.pregnancy === 'pregnant' && <Field label="Due date (YYYY-MM-DD)" value={f.due_date} onChangeText={(v) => setF({ ...f, due_date: v })} autoCapitalize="none" />}
        <Toggle label="Track my periods" value={f.track_cycle} onChange={(v) => setF({ ...f, track_cycle: v })} />
        <Btn small title="Save" onPress={save} />
      </Card>
      {profile.track_cycle && <PeriodTracker userId={userId} />}
    </>
  );
}

function PeriodTracker({ userId }) {
  const [logs, setLogs] = useState(null);
  const [form, setForm] = useState(null);
  const load = useCallback(async () => {
    const { data } = await supabase.from('period_logs').select('*').eq('user_id', userId).order('start_date', { ascending: false }).limit(36);
    setLogs(data || []);
  }, [userId]);
  useEffect(() => { load(); }, [load]);
  if (!logs) return <Spinner />;
  const s = cycleStats(logs);
  const open = logs.find((l) => !l.end_date && daysAgo(l.start_date) <= 10);
  const save = async () => {
    const row = { user_id: userId, start_date: form.start_date, end_date: form.end_date || null, flow: form.flow || null, symptoms: form.symptoms || [], notes: form.notes || null };
    const { error } = form.id ? await supabase.from('period_logs').update(row).eq('id', form.id) : await supabase.from('period_logs').insert(row);
    if (error) return Alert.alert('Not saved', /duplicate|unique/i.test(error.message) ? 'There is already a period starting that day' : error.message);
    setForm(null); cheer('period'); load();
  };
  const endToday = async () => { const { error } = await supabase.from('period_logs').update({ end_date: today() }).eq('id', open.id); if (error) Alert.alert('Not saved', error.message); else cheer('period'); load(); };
  const del = (l) => Alert.alert('Delete this entry?', fmtLong(l.start_date), [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { await supabase.from('period_logs').delete().eq('id', l.id); load(); } }]);
  return (
    <Card title="🩸 Period tracker">
      {s && (
        <Row wrap gap={8}>
          <Stat label="Cycle day" value={s.cycleDay ?? '—'} tone="#FFE3E7" />
          <Stat label="Avg cycle" value={s.avg ? `${s.avg} d` : '—'} sub={s.avg ? (s.regular ? 'regular' : 'irregular') : 'need 2+ periods'} tone={C.lav} />
          <Stat label={s.lateBy ? 'Late by' : 'Next expected'} value={s.lateBy ? `${s.lateBy} d` : s.nextDue ? fmt(s.nextDue) : '—'} tone={C.sky} />
        </Row>
      )}
      <Row wrap>
        {open ? <Btn small title="Period ended today" onPress={endToday} /> : <Btn small title="Period started today" onPress={() => setForm({ start_date: today(), symptoms: [] })} />}
        <Btn small variant="ghost" title="+ Add past period" onPress={() => setForm({ start_date: '', symptoms: [] })} />
      </Row>
      {form && (
        <View style={{ gap: 8 }}>
          <Row gap={8}>
            <Field label="Start (YYYY-MM-DD)" value={form.start_date} onChangeText={(v) => setForm({ ...form, start_date: v })} autoCapitalize="none" />
            <Field label="End" value={form.end_date || ''} onChangeText={(v) => setForm({ ...form, end_date: v })} placeholder="optional" autoCapitalize="none" />
          </Row>
          <Chips>{Object.entries(FLOW).map(([k, l]) => <Chip key={k} small label={l} on={form.flow === k} onPress={() => setForm({ ...form, flow: k })} />)}</Chips>
          <Chips>{SYMPTOMS.map((x) => { const on = form.symptoms?.includes(x); return <Chip key={x} small label={x} on={on} tone="#FFC9D1" onPress={() => setForm({ ...form, symptoms: on ? form.symptoms.filter((y) => y !== x) : [...(form.symptoms || []), x] })} />; })}</Chips>
          <Field label="Notes" value={form.notes || ''} onChangeText={(v) => setForm({ ...form, notes: v })} />
          <Row><Btn small title="Save" onPress={save} disabled={!/^\d{4}-\d{2}-\d{2}$/.test(form.start_date)} /><Btn small variant="ghost" title="Cancel" onPress={() => setForm(null)} /></Row>
        </View>
      )}
      {logs.slice(0, 12).map((l) => (
        <Pressable key={l.id} onPress={() => setForm({ ...l })} onLongPress={() => del(l)} style={{ borderTopWidth: 1, borderTopColor: C.line, paddingTop: 6 }}>
          <T small bold>{fmtLong(l.start_date)}{l.end_date ? ` → ${fmt(l.end_date)}` : ' · ongoing'}</T>
          {(l.flow || l.symptoms?.length) ? <T small muted>{[FLOW[l.flow], ...(l.symptoms || [])].filter(Boolean).join(' · ')}</T> : null}
        </Pressable>
      ))}
      <T small muted>Predictions are estimates from your own history, not medical advice. If something feels off, see your doctor.</T>
    </Card>
  );
}
