import { useEffect, useState } from 'react';
import { Alert, Linking, View } from 'react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { supabase, WEB_URL } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { cheer } from '../../shared/cheer';
import { isFemale } from '../../shared/cycle';
import { LEGAL_CONTACT } from '../../shared/legal';
import { FEATURES } from '../../shared/constants';
import { Btn, Card, Chip, Chips, Field, NumField, Row, Screen, T } from '../../components/ui';
import WomensHealth from '../../components/WomensHealth';
import Avatar, { AvatarEditor } from '../../components/Avatar';
import PlanCard from '../../components/PlanCard';
import { C } from '../../theme';

const DIETS = [['veg', 'Veg'], ['egg', 'Eggetarian'], ['nonveg', 'Non-veg']];

export default function Me() {
  const { user, profile, refresh, signOut, has, features } = useAuth();
  const toForm = (p) => ({ ...(p || {}), dob: p?.dob ? p.dob.split('-').reverse().join('/') : '' });
  const [f, setF] = useState(toForm(profile));
  const [busy, setBusy] = useState(false);
  const [coach, setCoach] = useState(null);
  const [logins, setLogins] = useState([]);
  useEffect(() => setF(toForm(profile)), [profile]);
  useEffect(() => {
    if (profile?.coach_id) supabase.from('profiles').select('full_name, avatar_path').eq('id', profile.coach_id).maybeSingle().then(({ data }) => setCoach(data));
    supabase.from('login_events').select('created_at, event, city, region, country, device').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5).then(({ data }) => setLogins(data || []));
  }, [profile?.coach_id, user.id]);
  const set = (k) => (v) => setF({ ...f, [k]: v });

  const save = async () => {
    if (!f.full_name?.trim()) return Alert.alert('Add your name');
    let dob = null;
    if (f.dob?.trim()) {
      const m = f.dob.trim().match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
      if (!m) return Alert.alert('Date of birth', 'Use DD/MM/YYYY, e.g. 23/04/1995');
      dob = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
      const d = new Date(dob + 'T00:00:00'), now = new Date();
      if (Number.isNaN(d.getTime()) || d.getDate() !== Number(m[1])) return Alert.alert('Date of birth', 'That date doesn’t exist. Use DD/MM/YYYY.');
      const age = now.getFullYear() - d.getFullYear() - (now < new Date(now.getFullYear(), d.getMonth(), d.getDate()) ? 1 : 0);
      if (age < 18) return Alert.alert('Fitoor is for adults (18+)', 'Please check your date of birth.');
    }
    const n = (v) => (v === '' || v == null ? null : Number(v));
    setBusy(true);
    const { error } = await supabase.from('profiles').update({
      full_name: f.full_name.trim(), phone: f.phone || null, gender: f.gender || null, dob,
      height_cm: n(f.height_cm), start_weight: n(f.start_weight), target_weight: n(f.target_weight), goal: f.goal || null, diet_pref: f.diet_pref || null,
    }).eq('id', user.id);
    setBusy(false);
    if (error) return Alert.alert('Not saved', error.message);
    cheer('profile'); refresh();
  };

  return (
    <Screen>
      <Card><AvatarEditor note="Your coach sees it next to your name. Only people you work with can see it." /></Card>
      <Card title="Profile">
        <Field label="Full name" value={f.full_name || ''} onChangeText={set('full_name')} />
        <Field label="Mobile" value={f.phone || ''} onChangeText={set('phone')} keyboardType="phone-pad" />
        <T small bold>Gender</T>
        <Chips>{['Male', 'Female', 'Other'].map((g) => <Chip key={g} small label={g} on={f.gender === g} onPress={() => set('gender')(f.gender === g ? '' : g)} />)}</Chips>
        <Row gap={8}>
          <Field label="Date of birth" value={f.dob || ''} onChangeText={set('dob')} placeholder="DD/MM/YYYY" keyboardType="numbers-and-punctuation" />
          <NumField label="Height (cm)" value={f.height_cm ? String(f.height_cm) : ''} onChangeText={set('height_cm')} />
        </Row>
        <Row gap={8}>
          <NumField label="Starting weight (kg)" value={f.start_weight ? String(f.start_weight) : ''} onChangeText={set('start_weight')} />
          <NumField label="Target weight (kg)" value={f.target_weight ? String(f.target_weight) : ''} onChangeText={set('target_weight')} />
        </Row>
        <T small bold>I eat</T>
        <Chips>{DIETS.map(([k, l]) => <Chip key={k} small label={l} on={f.diet_pref === k} onPress={() => set('diet_pref')(f.diet_pref === k ? '' : k)} />)}</Chips>
        <Field label="My goal" value={f.goal || ''} onChangeText={set('goal')} multiline placeholder="e.g. Lose 8 kg, improve cholesterol, build strength" />
        <Btn title="Save profile" onPress={save} busy={busy} />
      </Card>

      {profile && isFemale(profile) && <WomensHealth profile={profile} onSaved={refresh} />}

      <Card title="Shortcuts">
        <Row wrap>
          {has('weight') && <Btn small variant="ghost" title="⚖️ Weight & inches" onPress={() => router.push('/weight')} />}
          {has('labs') && <Btn small variant="ghost" title="🧪 Lab reports" onPress={() => router.push('/labs')} />}
          <Btn small variant="ghost" title="🍲 Recipes" onPress={() => router.push('/recipes')} />
        </Row>
      </Card>

      <Card title="My coach">
        {coach ? <Row gap={12}><Avatar path={coach.avatar_path} name={coach.full_name} size={52} /><T style={{ flex: 1 }}><T bold>{coach.full_name}</T> sees your logs, plan and reports, and replies in notes.</T></Row> : <T muted>You don’t have a coach yet. We’ll match you soon.</T>}
      </Card>

      <PlanCard />
      <Card title="My features">
        <Chips>{FEATURES.filter((x) => features?.includes?.(x.key) ?? has(x.key)).map((x) => <Chip key={x.key} small label={x.label} on tone={C.lime} />)}</Chips>
      </Card>

      <Card title="Recent sign-ins on your account">
        {logins.length ? logins.map((l, i) => (
          <T small key={i}>{new Date(l.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} · {[l.city, l.region, l.country].filter(Boolean).join(', ') || 'Unknown place'}{l.device ? ` · ${l.device}` : ''}</T>
        )) : <T small muted>Nothing yet.</T>}
        <T small muted>Don’t recognise one? Change your password and tell your coach.</T>
      </Card>

      <Card title="Privacy & terms">
        <Row wrap>
          <Btn small variant="ghost" title="Terms" onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/terms`)} />
          <Btn small variant="ghost" title="Privacy" onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/privacy`)} />
          <Btn small variant="ghost" title="Ask for my data / delete it" onPress={() => Linking.openURL(`mailto:${LEGAL_CONTACT}?subject=${encodeURIComponent('Fitoor data request')}&body=${encodeURIComponent(`Account: ${user.email}\n\nI would like to: (export my data / delete my account)`)}`)} />
        </Row>
      </Card>

      <View style={{ gap: 8 }}>
        <Btn variant="danger" title="Sign out" onPress={signOut} />
        <T small muted style={{ textAlign: 'center' }}>Signed in as {user.email}</T>
      </View>
    </Screen>
  );
}
