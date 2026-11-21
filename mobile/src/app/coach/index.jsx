import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { supabase, WEB_URL } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { decideRequest } from '../../shared/juiceDays';
import { today, daysAgo, fmt, fmtLong } from '../../shared/dates';
import { Btn, Card, Chip, Chips, Empty, Field, Row, Screen, Spinner, Stat, T } from '../../components/ui';
import { C, R } from '../../theme';

const lastSeen = (c) => [c.last_meal, c.last_weight, c.last_workout].filter(Boolean).sort().at(-1);
function attention(c) {
  const r = [];
  const ls = lastSeen(c);
  if (!ls || daysAgo(ls) >= 3) r.push(ls ? `Quiet ${daysAgo(ls)} days` : 'Nothing logged yet');
  if (c.meals_7d >= 5 && c.followed_7d / c.meals_7d < 0.5) r.push('Under 50% on plan');
  if (!c.last_weight || daysAgo(c.last_weight) >= 7) r.push('No weigh-in this week');
  return r;
}

export default function CoachHome() {
  const { user, profile, isSuper, signOut } = useAuth();
  const [clients, setClients] = useState(null);
  const [requests, setRequests] = useState([]);
  const [pending, setPending] = useState(0);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('mine');
  const load = useCallback(async () => {
    const [c, jr, rp] = await Promise.all([
      supabase.from('user_activity').select('*').order('full_name'),
      supabase.from('juice_days').select('*, profiles:user_id(full_name)').eq('request_status', 'pending'),
      supabase.from('recipes').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    ]);
    setClients(c.data || []); setRequests(jr.data || []); setPending(rp.count || 0);
  }, []);
  useEffect(() => { load(); }, [load]);

  if (!clients) return <Spinner />;
  const mine = isSuper && filter === 'mine' ? clients.filter((c) => c.coach_id === user.id) : isSuper && filter === 'none' ? clients.filter((c) => !c.coach_id) : clients;
  const list = mine.filter((c) => !q || `${c.full_name} ${c.email}`.toLowerCase().includes(q.toLowerCase()));
  const needs = mine.filter((c) => c.active !== false && attention(c).length);
  const unassigned = clients.filter((c) => !c.coach_id).length;
  return (
    <Screen onRefresh={load}>
      <T style={{ fontSize: 22, fontWeight: '800' }}>Hi {profile?.full_name?.split(' ')[0] || 'coach'}</T>
      {profile?.coach_code ? <T small>Your coach code: <T bold>{profile.coach_code}</T> · invite link {WEB_URL}/signup?coach={profile.coach_code}</T> : null}
      <Row wrap gap={8}>
        <Stat label="Clients" value={mine.length} tone={C.lime} />
        <Stat label="Need attention" value={needs.length} tone={C.chilli} />
        <Stat label="Logged today" value={mine.filter((c) => lastSeen(c) === today()).length} tone={C.sky} />
        <Stat label="Recipes to review" value={pending} tone={C.lav} />
      </Row>
      {pending > 0 && <Btn variant="pop" title={`Review ${pending} recipe${pending > 1 ? 's' : ''}`} onPress={() => router.push('/coach/recipes')} />}
      {isSuper && unassigned > 0 && <Card tone={C.cream} title={`⏳ Waiting for a coach · ${unassigned}`}><T small>Assign coaches from the web panel (client → Plan & access → Coach).</T></Card>}
      {requests.length > 0 && (
        <Card title="🧃 Juice day move requests" tone="#FFF3D6">
          {requests.map((r) => (
            <View key={r.id} style={{ gap: 4 }}>
              <T small><T bold>{r.profiles?.full_name || 'Client'}</T>: {fmt(r.day)} → {fmtLong(r.request_day)}{r.request_reason ? ` · “${r.request_reason}”` : ''}</T>
              <Row><Btn small title="Approve" onPress={async () => { await decideRequest(r, true); load(); }} /><Btn small variant="ghost" title="Decline" onPress={async () => { await decideRequest(r, false); load(); }} /></Row>
            </View>
          ))}
        </Card>
      )}
      {needs.length > 0 && (
        <Card title="Needs attention">
          {needs.slice(0, 8).map((c) => <Pressable key={c.user_id} onPress={() => router.push(`/coach/client/${c.user_id}`)}><T small><T bold>{c.full_name || c.email}</T> · {attention(c).join(' · ')}</T></Pressable>)}
        </Card>
      )}
      <Card title="Clients">
        {isSuper && <Chips>{[['mine', 'My clients'], ['all', 'All'], ['none', 'Waiting for a coach']].map(([k, l]) => <Chip key={k} small label={l} on={filter === k} onPress={() => setFilter(k)} />)}</Chips>}
        <Field value={q} onChangeText={setQ} placeholder="Search name or email" />
        {!list.length ? <Empty>No clients here yet. Share your invite link.</Empty> : list.map((c) => (
          <Pressable key={c.user_id} onPress={() => router.push(`/coach/client/${c.user_id}`)} style={{ borderWidth: 1.5, borderColor: C.line, borderRadius: R.md, padding: 10, gap: 2, backgroundColor: c.active === false ? '#eee' : '#fff' }} accessibilityRole="button">
            <Row style={{ justifyContent: 'space-between' }}><T bold style={{ flex: 1 }}>{c.full_name || c.email}</T><T small muted>{c.plan_name || ''}</T></Row>
            <T small muted>
              {c.latest_weight ? `${c.latest_weight} kg${c.first_weight ? ` (${(c.latest_weight - c.first_weight > 0 ? '+' : '')}${(c.latest_weight - c.first_weight).toFixed(1)})` : ''} · ` : ''}
              {c.meals_7d ? `${Math.round((c.followed_7d / c.meals_7d) * 100)}% on plan · ` : ''}{c.workouts_7d} workouts/7d · last {lastSeen(c) ? fmt(lastSeen(c)) : '—'}{c.active === false ? ' · paused' : ''}
            </T>
          </Pressable>
        ))}
      </Card>
      <Card title="More">
        <T small muted>Diet plan editing, templates, plans & features, coaches and sign-in history are in the web panel.</T>
        <Row wrap>
          <Btn small variant="ghost" title="Open web coach panel" onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/admin`)} />
          <Btn small variant="danger" title="Sign out" onPress={signOut} />
        </Row>
      </Card>
    </Screen>
  );
}
