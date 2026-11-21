import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Screen, H1, T } from './ui';
import { WEB_URL } from '../lib/supabase';
import { C, R } from '../theme';

export default function AuthFrame({ title, sub, children }) {
  return (
    <Screen footerSpace={30} style={{ paddingTop: 70 }}>
      <View style={s.card}>
        <Image source={require('../../assets/icon.png')} style={s.logo} accessibilityLabel="Fitoor" />
        <H1>{title}</H1>
        {sub ? <T muted>{sub}</T> : null}
        {children}
      </View>
      <View style={s.legal}>
        <Pressable onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/terms`)} accessibilityRole="link"><Text style={s.link}>Terms</Text></Pressable>
        <Text style={{ color: C.muted }}>·</Text>
        <Pressable onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/privacy`)} accessibilityRole="link"><Text style={s.link}>Privacy</Text></Pressable>
      </View>
    </Screen>
  );
}
const s = StyleSheet.create({
  card: { backgroundColor: '#fff', borderWidth: 2, borderColor: C.ink, borderRadius: R.lg, padding: 18, gap: 12 },
  logo: { width: 56, height: 56, borderRadius: 14 },
  legal: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  link: { color: C.deep, fontWeight: '700', padding: 8 },
});
