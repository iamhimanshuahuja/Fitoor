import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { supabase, WEB_URL } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { TERMS_VERSION } from '../shared/legal';
import { Btn, T } from './ui';
import { C, R, font } from '../theme';

/** One-time agreement, same rules as the web TermsGate (server stamps terms_accepted_at). */
export default function TermsGate() {
  const { user, profile, refresh, isAdmin, signOut } = useAuth();
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const need = !!(user && profile && profile.terms_version !== TERMS_VERSION);
  const atSignup = user?.user_metadata?.terms_version === TERMS_VERSION;
  const accept = async () => {
    setBusy(true);
    await supabase.from('profiles').update({ terms_version: TERMS_VERSION }).eq('id', user.id);
    setBusy(false); refresh();
  };
  useEffect(() => { if (need && atSignup) accept(); }, [need, atSignup]);
  if (!need || atSignup) return null;
  const open = (p) => WebBrowser.openBrowserAsync(`${WEB_URL}/${p}`);
  return (
    <Modal transparent animationType="fade" visible>
      <View style={s.back}>
        <ScrollView contentContainerStyle={s.card}>
          <Text style={s.h}>{profile.terms_version ? 'We’ve updated our terms' : 'One quick thing before you continue'}</Text>
          <T>Fitoor keeps health data (meals, weight, photos, lab reports{isAdmin ? ' of your clients' : ''}), so here’s how it’s handled:</T>
          {[`Only ${isAdmin ? 'you (for your clients) and the Fitoor admin' : 'you, your coach and the Fitoor admin'} can see logs.`,
            'AI features send the photo or text you choose to our AI provider to make an estimate. You check every result before it’s saved. New: the text of AI chat and Ask AI messages is kept 30 days so the Fitoor admin can check quality and misuse (photos aren’t kept).',
            'Fitoor is not medical advice. Talk to your doctor about health decisions.',
            ...(isAdmin ? ['As a coach you keep client data confidential and use it only for coaching on Fitoor.'] : []),
            'We don’t sell your data or show ads. You can ask us to delete it any time.'].map((l) => <T key={l} small>•  {l}</T>)}
          <Pressable style={s.check} onPress={() => setOk(!ok)} accessibilityRole="checkbox" accessibilityState={{ checked: ok }}>
            <View style={[s.box, ok && s.boxOn]}>{ok ? <Text style={{ color: C.ink, fontWeight: '800' }}>✓</Text> : null}</View>
            <Text style={s.checkText}>I’m 18 or older and I agree to the <Text style={s.link} onPress={() => open('terms')}>Terms of Service</Text> and <Text style={s.link} onPress={() => open('privacy')}>Privacy Policy</Text>, including the processing of my health data and the use of AI features.</Text>
          </Pressable>
          <Btn title="Agree & continue" onPress={accept} disabled={!ok} busy={busy} />
          <Btn title="Not now, sign out" variant="ghost" onPress={signOut} />
        </ScrollView>
      </View>
    </Modal>
  );
}
const s = StyleSheet.create({
  back: { flex: 1, backgroundColor: 'rgba(18,38,27,.6)', justifyContent: 'center', padding: 16 },
  card: { backgroundColor: C.paper, borderRadius: R.lg, borderWidth: 2, borderColor: C.ink, padding: 18, gap: 10 },
  h: { fontSize: 22, color: C.ink, ...font.display },
  check: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginVertical: 6 },
  box: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: C.ink, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  boxOn: { backgroundColor: C.lime },
  checkText: { flex: 1, fontSize: 14, color: C.ink, lineHeight: 20 },
  link: { color: C.deep, fontWeight: '700', textDecorationLine: 'underline' },
});
