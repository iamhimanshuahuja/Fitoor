import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { supabase } from '../lib/supabase';
import { fmtLong } from '../shared/dates';
import { Card, Empty, Spinner, T } from './ui';
import { C } from '../theme';

export default function DietPlan({ userId }) {
  const [plan, setPlan] = useState(undefined);
  useEffect(() => {
    supabase.from('diet_plans').select('*').eq('user_id', userId).eq('is_active', true).order('updated_at', { ascending: false }).limit(1).maybeSingle().then(({ data }) => setPlan(data || null));
  }, [userId]);
  if (plan === undefined) return <Spinner />;
  if (!plan) return <Empty>Your coach hasn’t shared a diet plan yet.</Empty>;
  return (
    <View style={{ gap: 12 }}>
      <Card title={plan.title || 'Your diet plan'}>
        <T small muted>Updated {fmtLong(plan.updated_at?.slice(0, 10))}</T>
        {plan.notes ? <T>{plan.notes}</T> : null}
      </Card>
      {(plan.slots || []).map((s) => (
        <Card key={s.key} title={`${s.label}${s.title ? ` · ${s.title}` : ''}`}>
          {(s.items || []).map((it) => <T key={it}>• {it}</T>)}
          {s.avoid?.length > 0 && <T small style={{ color: C.red }}>Avoid: {s.avoid.join(', ')}</T>}
        </Card>
      ))}
      {plan.guidelines?.length > 0 && <Card title="Guidelines">{plan.guidelines.map((g, i) => <T key={g}>{i + 1}. {g}</T>)}</Card>}
    </View>
  );
}

