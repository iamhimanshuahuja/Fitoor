import { Pressable, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../lib/auth';
import { C, pop } from '../theme';
/** Round ✨ button that opens Log by chat (only when the AI feature is on). */
export default function ChatFab() {
  const { has } = useAuth();
  if (!has('ai')) return null;
  return (
    <Pressable onPress={() => router.push('/chat')} style={({ pressed }) => [s.fab, pop, pressed && { transform: [{ translateX: 2 }, { translateY: 2 }] }]}
      accessibilityRole="button" accessibilityLabel="Log by chat">
      <Text style={s.t}>✨</Text>
    </Pressable>
  );
}
const s = StyleSheet.create({
  fab: { position: 'absolute', right: 16, bottom: 16, width: 58, height: 58, borderRadius: 29, backgroundColor: C.ink, borderWidth: 2, borderColor: C.ink, alignItems: 'center', justifyContent: 'center' },
  t: { fontSize: 26 },
});
