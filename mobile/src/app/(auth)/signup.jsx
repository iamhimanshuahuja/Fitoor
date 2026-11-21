import { useEffect, useState } from 'react';
import { Link, useLocalSearchParams } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import AuthFrame from '../../components/AuthFrame';
import { Btn, Field, T } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { trackLogin } from '../../lib/track';
import { friendlyAuthError } from '../../lib/authErrors';
import { TERMS_VERSION } from '../../shared/legal';
import { C } from '../../theme';

/** Sign up, with the optional coach code (locked when it comes from an invite link: fitoor://signup?coach=CODE). */
export default function Signup() {
  const { coach: fromLink } = useLocalSearchParams();
  const [f, setF] = useState({ full_name: '', phone: '', email: '', password: '' });
  const [code, setCode] = useState(String(fromLink || '').toUpperCase());
  const [coach, setCoach] = useState({ state: 'idle', name: '' });
  const [agree, setAgree] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const set = (k) => (v) => setF({ ...f, [k]: v });

  useEffect(() => {
    const c = code.trim();
    if (c.length < 3) { setCoach({ state: 'idle', name: '' }); return; }
    setCoach({ state: 'checking', name: '' });
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc('coach_lookup', { code: c });
      setCoach(data ? { state: 'ok', name: data } : { state: 'bad', name: '' });
    }, 350);
    return () => clearTimeout(t);
  }, [code]);

  const submit = async () => {
    if (!agree) return setErr('Please tick the box to agree to the Terms and Privacy Policy.');
    setBusy(true); setErr('');
    const { data, error } = await supabase.auth.signUp({
      email: f.email.trim(), password: f.password,
      options: { data: { full_name: f.full_name.trim(), phone: f.phone, coach_code: coach.state === 'ok' ? code.trim().toUpperCase() : '', terms_version: TERMS_VERSION, terms_agreed_at: new Date().toISOString() } },
    });
    setBusy(false);
    if (error) return setErr(friendlyAuthError(error));
    if (data.session) trackLogin('sign_up'); else setDone(true);
  };
  if (done) return <AuthFrame title="Check your email" sub={`We sent a confirmation link to ${f.email}. Open it, then come back and log in.`}><Link href="/login" style={{ color: C.deep, fontWeight: '700' }}>Back to log in</Link></AuthFrame>;
  const hint = coach.state === 'ok' ? `✓ Coach: ${coach.name}${fromLink ? ' (from your invite link)' : ''}`
    : coach.state === 'bad' ? 'We couldn’t find that code. You can still sign up and we’ll match you with a coach.'
    : coach.state === 'checking' ? 'Checking code…' : 'Got a code from your coach? Enter it. No code? Leave it empty.';
  return (
    <AuthFrame title="Create your account" sub={coach.state === 'ok' ? `You’re joining ${coach.name}’s coaching on Fitoor.` : 'Your coach will set up your plan after you join.'}>
      <Field label="Full name" value={f.full_name} onChangeText={set('full_name')} autoComplete="name" textContentType="name" />
      <Field label="Mobile (optional)" value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" autoComplete="tel" />
      <Field label="Email" value={f.email} onChangeText={set('email')} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      <Field label="Password" value={f.password} onChangeText={set('password')} secureTextEntry autoComplete="password-new" textContentType="newPassword" hint="At least 8 characters" />
      <Field label={fromLink ? 'Coach code' : 'Coach code (optional)'} value={code} editable={!fromLink} autoCapitalize="characters"
        onChangeText={(v) => setCode(v.toUpperCase().replace(/[^A-Z0-9]/g, ''))} placeholder="e.g. RIYA42" maxLength={12} hint={hint}
        inputStyle={fromLink ? { backgroundColor: C.paper, fontWeight: '700' } : null} />
      <Pressable onPress={() => setAgree(!agree)} accessibilityRole="checkbox" accessibilityState={{ checked: agree }} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
        <View style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: C.ink, backgroundColor: agree ? C.lime : '#fff', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
          {agree ? <Text style={{ fontWeight: '800' }}>✓</Text> : null}
        </View>
        <Text style={{ flex: 1, fontSize: 14, color: C.ink, lineHeight: 20 }}>I’m 18 or older and I agree to the Terms of Service and Privacy Policy, including the processing of my health data and the use of AI features.</Text>
      </Pressable>
      {err ? <T style={{ color: C.red }}>{err}</T> : null}
      <Btn title="Sign up" onPress={submit} busy={busy} disabled={!agree || !f.full_name || !f.email || f.password.length < 8} />
      <T small muted>To keep your account safe we log each sign-in: time, IP address, approximate city and device. You can see yours under Me.</T>
      <Text style={{ fontSize: 14 }}>Already have an account? <Link href="/login" style={{ color: C.deep, fontWeight: '700' }}>Log in</Link></Text>
    </AuthFrame>
  );
}
