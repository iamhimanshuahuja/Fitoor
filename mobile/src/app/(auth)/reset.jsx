import { useState } from 'react';
import { Link } from 'expo-router';
import AuthFrame from '../../components/AuthFrame';
import { Btn, Field, T } from '../../components/ui';
import { supabase, WEB_URL } from '../../lib/supabase';
import { friendlyAuthError } from '../../lib/authErrors';
import { C } from '../../theme';

/** Sends the reset email; the link opens the website's reset page (works the same for app and web users). */
export default function Reset() {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${WEB_URL}/reset` });
    setBusy(false); setMsg(error ? friendlyAuthError(error) : 'Check your email for a reset link. Set your new password there, then log in here.');
  };
  return (
    <AuthFrame title="Reset password">
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      {msg ? <T>{msg}</T> : null}
      <Btn title="Send reset link" onPress={send} busy={busy} disabled={!email} />
      <Link href="/login" style={{ color: C.deep, fontWeight: '700' }}>Back to log in</Link>
    </AuthFrame>
  );
}
