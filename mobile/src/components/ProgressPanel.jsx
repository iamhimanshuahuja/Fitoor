import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { supabase } from '../lib/supabase';
import { on } from '../lib/events';
import { today, addDays } from '../shared/dates';
import { measureStats } from '../shared/measure';
import { Card, Row, Seg, Spinner, Stat, T } from './ui';
import LineChart from './LineChart';
import { C } from '../theme';

const RANGES = [{ key: 7, label: '7d' }, { key: 30, label: '30d' }, { key: 90, label: '3m' }, { key: 0, label: 'All' }];

/** Progress summary for one user (client tab + coach client page). */
export default function ProgressPanel({ userId, profile }) {
  const [range, setRange] = useState(30);
  const [d, setD] = useState(null);
  const load = useCallback(async () => {
    const from = range ? addDays(today(), -range + 1) : '2000-01-01';
    const [w, m, wo, bm] = await Promise.all([
      supabase.from('weight_logs').select('log_date, weight_kg').eq('user_id', userId).order('log_date'),
      supabase.from('meal_logs').select('log_date, followed, cheat, kcal, protein_g, carbs_g, fat_g').eq('user_id', userId).gte('log_date', from),
      supabase.from('workouts').select('log_date, duration_min').eq('user_id', userId).gte('log_date', from),
      supabase.from('body_measurements').select('*').eq('user_id', userId).order('log_date'),
    ]);
    setD({ from, weights: w.data || [], meals: m.data || [], workouts: wo.data || [], measures: bm.data || [] });
  }, [userId, range]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => on('data-changed', load), [load]);
  if (!d) return <Spinner />;

  const ws = d.weights.map((x) => ({ date: x.log_date, value: Number(x.weight_kg) }));
  const inRange = ws.filter((x) => x.date >= d.from);
  const start = Number(profile?.start_weight) || ws[0]?.value, now = ws.at(-1)?.value, target = Number(profile?.target_weight) || null;
  const lost = start && now ? +(start - now).toFixed(1) : null;
  const pct = start && now && target && start !== target ? Math.max(0, Math.min(100, Math.round(((start - now) / (start - target)) * 100))) : null;
  const plan = d.meals.filter((x) => !x.cheat);
  const onPlan = plan.length ? Math.round((d.meals.filter((x) => x.followed === true).length / plan.length) * 100) : null;
  const days = new Set(d.meals.map((x) => x.log_date)).size || 1;
  const avg = (k) => Math.round(d.meals.reduce((s, x) => s + (Number(x[k]) || 0), 0) / days);
  const hasNutr = d.meals.some((x) => x.kcal);
  const gymDays = new Set(d.workouts.map((x) => x.log_date)).size;
  const bm = measureStats(d.measures);
  const lowest = ws.length ? Math.min(...ws.map((x) => x.value)) : null;

  return (
    <View style={{ gap: 14 }}>
      <Seg items={RANGES} value={range} onChange={setRange} />
      <Card title="Your journey" tone={C.lime}>
        <T style={{ fontSize: 30, fontWeight: '800' }}>{lost == null ? 'Log a weigh-in to start' : lost >= 0 ? `${lost} kg down` : `${-lost} kg up`}</T>
        <T small>{start ? `Day 1: ${start} kg` : ''}{now ? ` · Now: ${now} kg` : ''}{target ? ` · Goal: ${target} kg` : ''}</T>
        {pct != null && (
          <View style={{ height: 14, borderWidth: 2, borderColor: C.ink, borderRadius: 8, backgroundColor: '#fff', overflow: 'hidden' }}>
            <View style={{ width: `${pct}%`, height: '100%', backgroundColor: C.deep }} />
          </View>
        )}
        {pct != null && <T small bold>{pct}% of the way to your goal</T>}
      </Card>
      <Row wrap gap={8}>
        <Stat label="Meals on plan" value={onPlan != null ? `${onPlan}%` : '—'} tone={C.lav} />
        <Stat label="Gym days" value={gymDays} tone={C.sky} />
        <Stat label="Lowest weight" value={lowest ? `${lowest} kg` : '—'} tone={C.haldi} />
        {hasNutr && <Stat label="Avg kcal / day" value={avg('kcal')} tone={C.lime} />}
        {hasNutr && <Stat label="Protein / day" value={`${avg('protein_g')} g`} tone={C.lav} />}
        {hasNutr && <Stat label="Carbs · fat / day" value={`${avg('carbs_g')} · ${avg('fat_g')} g`} tone={C.sky} />}
        {bm.totalSites > 0 && <Stat label="Inches lost" value={`${bm.total <= 0 ? -bm.total : `+${bm.total}`} in`} sub={`${bm.totalSites} spots`} tone={C.haldi} />}
      </Row>
      <Card title="Weight trend">
        {inRange.length >= 2 ? <LineChart data={inRange} unit=" kg" refLine={target} /> : <T muted>Log at least 2 weigh-ins in this range to see a chart.</T>}
        {target ? <T small muted>Dashed line = your goal.</T> : null}
      </Card>
      <T small muted>Numbers are estimates to help you see trends, not medical advice.</T>
    </View>
  );
}
