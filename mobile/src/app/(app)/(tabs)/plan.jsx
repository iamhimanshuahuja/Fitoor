import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../../lib/auth';
import { useJuiceDays } from '../../../shared/juiceDays';
import { JUICES, TANGY, JUICE_GROUPS, PREP_RULES } from '../../../shared/juices';
import { fmtLong, today } from '../../../shared/dates';
import { Btn, Card, Screen, Seg, T } from '../../../components/ui';
import DietPlan from '../../../components/DietPlan';
import { C } from '../../../theme';

export default function PlanTab() {
  const { user, profile } = useAuth();
  const [tab, setTab] = useState('diet');
  const [days] = useJuiceDays(user.id);
  const hasJuice = (days || []).length > 0 || profile?.juice_group;
  const items = [{ key: 'diet', label: 'Diet' }, ...(hasJuice ? [{ key: 'juices', label: 'Juices' }] : []), { key: 'recipes', label: 'Recipes' }, { key: 'learn', label: 'Learn' }];
  return (
    <Screen>
      <Seg items={items} value={tab} onChange={setTab} />
      {tab === 'diet' && <DietPlan userId={user.id} />}
      {tab === 'juices' && <Juices group={profile?.juice_group} days={days} />}
      {tab === 'recipes' && <RecipesLinks />}
      {tab === 'learn' && <Learn />}
    </Screen>
  );
}

function Juices({ group, days }) {
  const g = JUICE_GROUPS[group];
  const upcoming = (days || []).filter((d) => d.day >= today() && d.status === 'scheduled');
  return (
    <View style={{ gap: 12 }}>
      <Card title="🧃 Upcoming juice days" tone="#FFF3D6">
        {upcoming.length ? upcoming.map((d) => <T key={d.id}>{fmtLong(d.day)}{d.note ? ` · ${d.note}` : ''}</T>) : <T muted>None booked. Your coach books these.</T>}
        <T small>{g ? `Your amounts: ${g.label} · ${g.total}` : 'Your coach will set your amounts.'}</T>
      </Card>
      {[...JUICES, TANGY].map((j) => (
        <Card key={j.key} title={`${j.emoji} ${j.name} · ${j.window}${g && j.ml ? ` · ${j.ml[group]} ml` : ''}`}>
          {(j.ingredients || []).map((x) => <T key={x} small>• {x}</T>)}
        </Card>
      ))}
      {PREP_RULES?.length > 0 && <Card title="Prep rules">{PREP_RULES.map((r) => <T key={r} small>• {r}</T>)}</Card>}
    </View>
  );
}

function RecipesLinks() {
  return (
    <Card title="Recipes">
      <T>Healthy Indian recipes from Fitoor Kitchen and the community, plus the ones you saved.</T>
      <Btn title="Browse recipes" onPress={() => router.push('/recipes')} />
      <Btn variant="ghost" title="My recipes" onPress={() => router.push({ pathname: '/recipes', params: { mine: '1' } })} />
      <Btn variant="soft" title="+ Add a recipe" onPress={() => router.push('/recipe-new')} />
    </Card>
  );
}

const LEARN = [
  { t: '🍽 The 50/25/25 plate', b: 'Half your plate veggies and salad, a quarter protein (dal, paneer, eggs, chicken), a quarter whole grains (roti, rice, millets).' },
  { t: '🌿 Alkaline vs acidic', b: 'Lean on fruits, veggies, sprouts and nuts. Go easy on maida, sugar, fried food and too much tea/coffee.' },
  { t: '🔁 High-GI swaps', b: 'White rice → brown rice or millets. Maida roti → multigrain roti. Juice → whole fruit. Biscuits → roasted makhana or chana.' },
  { t: '📈 What spikes insulin', b: 'Sugary drinks, sweets, refined flour and late heavy dinners. Fibre, protein and a walk after meals help keep it steady.' },
  { t: '🧠 Diet habits behind insulin resistance', b: 'Frequent snacking on refined carbs, low protein, little fibre and poor sleep. Small daily swaps add up.' },
];
function Learn() {
  return (
    <View style={{ gap: 12 }}>
      {LEARN.map((l) => <Card key={l.t} title={l.t}><T>{l.b}</T></Card>)}
      <T small muted>General guidance only. For medical conditions, talk to your doctor.</T>
    </View>
  );
}
