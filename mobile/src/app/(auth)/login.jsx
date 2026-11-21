import { useState } from 'react';
import { Link } from 'expo-router';
import { Text } from 'react-native';
import AuthFrame from '../../components/AuthFrame';
import { Btn, Field, T } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { trackLogin } from '../../lib/track';
import { friendlyAuthError } from '../../lib/authErrors';
import { C } from '../../theme';

export default function Login() {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true); setErr('');
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pw });
    setBusy(false);
    if (error) return setErr(friendlyAuthError(error));
    trackLogin('sign_in');
  };
  return (
    <AuthFrame title="Welcome back" sub="Log in to track today’s meals and workout.">
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="emailAddress" />
      <Field label="Password" value={pw} onChangeText={setPw} secureTextEntry autoComplete="password" textContentType="password" onSubmitEditing={submit} />
      {err ? <T style={{ color: C.red }}>{err}</T> : null}
      <Btn title="Log in" onPress={submit} busy={busy} disabled={!email || !pw} />
      <T small muted>You stay signed in on this phone until you sign out.</T>
      <Text style={{ fontSize: 14, color: C.ink }}>
        <Link href="/reset" style={{ color: C.deep, fontWeight: '700' }}>Forgot password?</Link>{'  ·  '}New here? <Link href="/signup" style={{ color: C.deep, fontWeight: '700' }}>Create an account</Link>
      </Text>
    </AuthFrame>
  );
}
