import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { on } from '../lib/events';
import { today, addDays, toISO } from '../shared/dates';
import { Card, Row, Spinner, Stat, T } from './ui';
import { C, R } from '../theme';

/** Month grid (Mon-first). Tap a day to open it on Today. Also used by the coach (userId prop + onOpen). */
export default function MonthCalendar({ userId, onOpen }) {
  const [month, setMonth] = useState(today().slice(0, 8) + '01');
  const [data, setData] = useState(null);
  const load = useCallback(async () => {
    const from = month, to = toISO(new Date(new Date(month + 'T00:00:00').getFullYear(), new Date(month + 'T00:00:00').getMonth() + 1, 0));
    const q = (t, cols, col = 'log_date') => supabase.from(t).select(cols).eq('user_id', userId).gte(col, from).lte(col, to);
    const [m, w, wo, h, jd, pl] = await Promise.all([
      q('meal_logs', 'log_date, followed, cheat'), q('weight_logs', 'log_date, weight_kg'), q('workouts', 'log_date, day_label'),
      q('habit_logs', 'log_date, habits'), q('juice_days', 'day, status', 'day'),
      supabase.from('period_logs').select('start_date, end_date').eq('user_id', userId).lte('start_date', to).gte('start_date', addDays(from, -10)),
    ]);
    const days = {};
    const day = (k) => (days[k] ||= { meals: [], workouts: [] });
    (m.data || []).forEach((x) => day(x.log_date).meals.push(x));
    (w.data || []).forEach((x) => { day(x.log_date).weight = Number(x.weight_kg); });
    (wo.data || []).forEach((x) => day(x.log_date).workouts.push(x));
    (h.data || []).forEach((x) => { if (x.habits?.cheat_day) day(x.log_date).cheatDay = true; });
    (jd.data || []).forEach((x) => { day(x.day).juice = x.status; });
    (pl.data || []).forEach((x) => { const end = x.end_date || x.start_date; for (let k = x.start_date; k <= end; k = addDays(k, 1)) if (k >= from && k <= to) day(k).period = true; });
    setData(days);
  }, [userId, month]);
  useEffect(() => { setData(null); load(); }, [load]);
  useEffect(() => on('data-changed', load), [load]);

  const cells = useMemo(() => {
    const first = new Date(month + 'T00:00:00');
    const pad = (first.getDay() + 6) % 7;
    const n = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    return [...Array(pad).fill(null), ...Array.from({ length: n }, (_, i) => toISO(new Date(first.getFullYear(), first.getMonth(), i + 1)))];
  }, [month]);
  const shift = (k) => { const d = new Date(month + 'T00:00:00'); d.setMonth(d.getMonth() + k); setMonth(toISO(d).slice(0, 8) + '01'); };
  const stats = useMemo(() => {
    if (!data) return null;
    const v = Object.values(data), meals = v.flatMap((d) => d.meals), plan = meals.filter((x) => !x.cheat);
    const ws = Object.entries(data).filter(([, d]) => d.weight).sort(([a], [b]) => a.localeCompare(b)).map(([, d]) => d.weight);
    return { logged: v.filter((d) => d.meals.length || d.workouts.length || d.weight).length, onPlan: plan.length ? Math.round(meals.filter((x) => x.followed === true).length / plan.length * 100) : null,
      workouts: v.reduce((s, d) => s + d.workouts.length, 0), change: ws.length > 1 ? +(ws.at(-1) - ws[0]).toFixed(1) : null };
  }, [data]);
  const title = new Date(month + 'T00:00:00').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  return (
    <View style={{ gap: 12 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Pressable onPress={() => shift(-1)} style={s.nav} accessibilityLabel="Previous month"><Text style={s.navT}>‹</Text></Pressable>
        <Text style={s.title}>{title}</Text>
        <Pressable onPress={() => month < today().slice(0, 8) + '01' && shift(1)} style={[s.nav, month >= today().slice(0, 8) + '01' && { opacity: 0.3 }]} accessibilityLabel="Next month"><Text style={s.navT}>›</Text></Pressable>
      </Row>
      {stats && (
        <Row wrap gap={8}>
          <Stat label="Days logged" value={stats.logged} tone={C.lime} />
          <Stat label="Meals on plan" value={stats.onPlan != null ? `${stats.onPlan}%` : '—'} tone={C.lav} />
          <Stat label="Workouts" value={stats.workouts} tone={C.sky} />
          <Stat label="Weight change" value={stats.change != null ? `${stats.change > 0 ? '+' : ''}${stats.change} kg` : '—'} tone={C.haldi} />
        </Row>
      )}
      <Card style={{ padding: 8 }}>
        <View style={s.grid}>
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <Text key={i} style={s.wd}>{d}</Text>)}
          {!data ? null : cells.map((dd, i) => {
            if (!dd) return <View key={`b${i}`} style={s.cell} />;
            const x = data[dd]; const future = dd > today();
            const plan = (x?.meals || []).filter((m) => !m.cheat).length, onp = (x?.meals || []).filter((m) => m.followed === true).length;
            const score = !x ? 0 : Math.min(1, (x.meals.length ? 0.45 * (plan ? onp / plan : 1) + 0.15 : 0) + (x.workouts.length ? 0.25 : 0) + (x.weight ? 0.15 : 0));
            return (
              <Pressable key={dd} disabled={future} onPress={() => onOpen(dd)} accessibilityRole="button" accessibilityLabel={`${dd}: ${x?.meals.length || 0} meals`}
                style={[s.cell, s.day, { backgroundColor: `rgba(200,242,90,${score})` }, dd === today() && { borderColor: C.ink, borderWidth: 2 }, future && { opacity: 0.35 }]}>
                <Text style={s.num}>{Number(dd.slice(8))}</Text>
                <View style={s.dots}>{(x?.meals || []).slice(0, 4).map((m, j) => <View key={j} style={[s.dot, { backgroundColor: m.cheat ? C.haldi : m.followed === true ? C.fresh : m.followed === false ? C.chilli : '#B9C7BD' }]} />)}</View>
                <Text style={s.icons}>{x?.workouts.length ? '🏋️' : ''}{x?.juice ? '🧃' : ''}{x?.cheatDay ? '🍕' : ''}{x?.period ? '🩸' : ''}</Text>
              </Pressable>
            );
          })}
        </View>
        {!data && <Spinner />}
      </Card>
      <T small muted>● green on plan · pink off plan · orange cheat · grey not marked. Darker day = better day.</T>
    </View>
  );
}

const s = StyleSheet.create({
  nav: { width: 46, height: 46, borderWidth: 2, borderColor: C.ink, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  navT: { fontSize: 26, color: C.ink, lineHeight: 28 }, title: { fontSize: 20, fontWeight: '800', color: C.ink },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  wd: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 12, fontWeight: '700', color: C.muted, paddingVertical: 4 },
  cell: { width: `${100 / 7}%`, aspectRatio: 0.78, padding: 2 },
  day: { borderRadius: 10, borderWidth: 1, borderColor: C.line, alignItems: 'center', paddingTop: 3 },
  num: { fontSize: 13, fontWeight: '800', color: C.ink },
  dots: { flexDirection: 'row', gap: 2, marginTop: 2 }, dot: { width: 5, height: 5, borderRadius: 3 },
  icons: { fontSize: 9, marginTop: 2 },
});
