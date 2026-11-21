import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../lib/auth';
import { emit, toast } from '../../../lib/events';
import { today, addDays, fmt, fmtLong } from '../../../shared/dates';
import { useJuiceDays, nextJuiceDay, daysUntil, REMIND_DAYS, requestChange, cancelRequest } from '../../../shared/juiceDays';
import { isFemale, cycleStats } from '../../../shared/cycle';
import DayView from '../../../components/DayView';
import DateStrip from '../../../components/DateStrip';
import DateField from '../../../components/DateField';
import ChatFab from '../../../components/ChatFab';
import { Btn, Card, Field, H1, Row, Screen, T } from '../../../components/ui';
import { C, R, pop } from '../../../theme';

function useStreak(userId) {
  const [n, setN] = useState(null);
  useEffect(() => {
    const since = addDays(today(), -60);
    Promise.all(['meal_logs', 'weight_logs', 'workouts'].map((t) => supabase.from(t).select('log_date').eq('user_id', userId).gte('log_date', since)))
      .then((rs) => {
        const days = new Set(rs.flatMap((r) => (r.data || []).map((x) => x.log_date)));
        let d = days.has(today()) ? today() : addDays(today(), -1), c = 0;
        while (days.has(d)) { c++; d = addDays(d, -1); }
        setN(c);
      });
  }, [userId]);
  return n;
}

export default function Today() {
  const { user, profile, has } = useAuth();
  const params = useLocalSearchParams();
  const [date, setDate] = useState(params.date || today());
  useEffect(() => { if (params.date) setDate(params.date); }, [params.date]);
  const streak = useStreak(user.id);
  const h = new Date().getHours();
  const greet = h < 5 ? 'Up late' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const refresh = useCallback(async () => emit('data-changed'), []);
  return (
    <View style={{ flex: 1 }}>
      <Screen onRefresh={refresh} footerSpace={96}>
        <View style={{ gap: 6 }}>
          <H1>{greet}, {profile?.full_name?.split(' ')[0] || 'there'}</H1>
          {streak != null && <Text style={[st.streak, !streak && { backgroundColor: C.lime }]}>{streak ? `🔥 ${streak}-day streak` : '🌱 Start your streak today'}</Text>}
        </View>
        <DateStrip value={date} onChange={setDate} />
        {has('ai') && (
          <Pressable onPress={() => router.push({ pathname: '/scan', params: { date } })} style={({ pressed }) => [st.scan, !pressed && pop]} accessibilityRole="button">
            <Text style={{ fontSize: 30 }}>📸</Text>
            <View style={{ flex: 1 }}><T bold>Guess calories from a photo</T><T small>Snap your plate, AI adds it up. Log it or just check.</T></View>
          </Pressable>
        )}
        <JuiceReminder userId={user.id} />
        {profile && isFemale(profile) && profile.track_cycle && <CycleStrip userId={user.id} />}
        <CoachNoteBanner userId={user.id} onOpen={setDate} />
        <DayView userId={user.id} date={date} mode="user" />
      </Screen>
      <ChatFab />
    </View>
  );
}

function JuiceReminder({ userId }) {
  const [days, reload] = useJuiceDays(userId);
  const [asking, setAsking] = useState(false);
  const [req, setReq] = useState({ day: '', reason: '' });
  const jd = nextJuiceDay(days);
  if (!jd) return null;
  const n = daysUntil(jd.day);
  if (n > REMIND_DAYS) return null;
  const send = async () => { const { error } = await requestChange(jd.id, req.day || addDays(jd.day, 2), req.reason); if (error) return toast(error.message, 'bad'); setAsking(false); reload(); };
  return (
    <Card tone={C.haldi} title={n === 0 ? '🧃 Juice day today' : `🧃 Juice day in ${n} day${n > 1 ? 's' : ''} · ${fmtLong(jd.day)}`}>
      {n > 0 && <T small>Be ready: buy beetroot, carrot, amla, cucumber, ash gourd, greens and coconut water. Eat light the night before.</T>}
      {jd.note ? <T small bold>Coach: {jd.note}</T> : null}
      {jd.request_status === 'pending' ? (
        <Row wrap><T small>⏳ You asked for {fmtLong(jd.request_day)} · waiting for coach</T><Btn small variant="ghost" title="Withdraw" onPress={async () => { await cancelRequest(jd.id); reload(); }} /></Row>
      ) : n > 0 && (asking ? (
        <View style={{ gap: 8 }}>
          <DateField label="New date" value={req.day || addDays(jd.day, 2)} max={null} min={today()} onChange={(v) => setReq({ ...req, day: v })} />
          <Field label="Why?" value={req.reason} onChangeText={(v) => setReq({ ...req, reason: v })} placeholder="e.g. Office lunch that day" />
          <Row><Btn small title="Send request" onPress={send} /><Btn small variant="ghost" title="Cancel" onPress={() => setAsking(false)} /></Row>
        </View>
      ) : <Btn small variant="ghost" title="Request another day" onPress={() => setAsking(true)} />)}
    </Card>
  );
}

function CycleStrip({ userId }) {
  const [s, setS] = useState(null);
  useEffect(() => { supabase.from('period_logs').select('*').eq('user_id', userId).order('start_date', { ascending: false }).limit(36).then(({ data }) => setS(cycleStats(data || []))); }, [userId]);
  if (!s?.cycleDay) return null;
  return (
    <Pressable onPress={() => router.push('/me')} style={st.cycle} accessibilityRole="button">
      <T bold>🩸 Cycle day {s.cycleDay}</T>{s.nextDue ? <T small>  · next ~{fmt(s.nextDue)}</T> : null}
    </Pressable>
  );
}

function CoachNoteBanner({ userId, onOpen }) {
  const [note, setNote] = useState(null);
  useEffect(() => {
    (async () => {
      const seen = (await AsyncStorage.getItem(`ft_note_seen_${userId}`)) || '1970-01-01';
      const { data } = await supabase.from('comments').select('id, body, log_date, created_at, author_id').eq('user_id', userId).neq('author_id', userId).gt('created_at', seen).order('created_at', { ascending: false }).limit(1).maybeSingle();
      setNote(data || null);
    })();
  }, [userId]);
  if (!note) return null;
  const dismiss = async () => { await AsyncStorage.setItem(`ft_note_seen_${userId}`, note.created_at); setNote(null); };
  return (
    <Card tone={C.lav} title={`💬 New note from your coach · ${new Date(note.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}>
      <T>{note.body}</T>
      <Row>{note.log_date ? <Btn small variant="ghost" title="Open day" onPress={() => { onOpen(note.log_date); dismiss(); }} /> : null}<Btn small variant="pop" title="Got it" onPress={dismiss} /></Row>
    </Card>
  );
}

const st = StyleSheet.create({
  streak: { alignSelf: 'flex-start', backgroundColor: C.haldi, borderWidth: 2, borderColor: C.ink, borderRadius: R.pill, paddingHorizontal: 12, paddingVertical: 4, fontWeight: '800', color: C.ink, overflow: 'hidden' },
  scan: { flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: C.lime, borderWidth: 2, borderColor: C.ink, borderRadius: R.lg, padding: 12 },
  cycle: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFE3E7', borderWidth: 2, borderColor: C.ink, borderRadius: R.pill, paddingHorizontal: 14, paddingVertical: 8, alignSelf: 'flex-start' },
});
