import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { on } from '../lib/events';
import { cheerText } from '../shared/cheer';
import { useAuth } from '../lib/auth';
import { C, R, font } from '../theme';

/** Lime toast after a save (cheer) or a short message (toast). Mounted once in the root layout. */
export default function CheerToast() {
  const insets = useSafeAreaInsets();
  const { isAdmin } = useAuth() || {};
  const [msg, setMsg] = useState(null);
  const y = useRef(new Animated.Value(120)).current;
  const timer = useRef(null);
  useEffect(() => {
    const show = (m) => {
      setMsg(m); clearTimeout(timer.current);
      Animated.spring(y, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
      timer.current = setTimeout(() => Animated.timing(y, { toValue: 140, duration: 220, useNativeDriver: true }).start(() => setMsg(null)), 2800);
    };
    const offs = [
      on('cheer', ({ kind, text } = {}) => { const c = cheerText(kind, text); show(c.bad ? { ...c, tone: 'bad' } : isAdmin ? { emoji: '✅', title: kind === 'removed' ? 'Removed' : 'Saved', line: 'Updated for your client.' } : c); }),
      on('toast', ({ text, tone } = {}) => show({ emoji: tone === 'bad' ? '⚠️' : '✅', title: text, line: '', tone })),
    ];
    return () => offs.forEach((f) => f());
  }, [isAdmin, y]);
  if (!msg) return null;
  return (
    <Animated.View pointerEvents="none" style={[s.wrap, { bottom: insets.bottom + 84, transform: [{ translateY: y }] }]} accessibilityLiveRegion="polite">
      <View style={[s.toast, msg.tone === 'bad' && { backgroundColor: C.pink }]}>
        <Text style={s.emoji}>{msg.emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{msg.title}</Text>
          {msg.line ? <Text style={s.line}>{msg.line}</Text> : null}
        </View>
      </View>
    </Animated.View>
  );
}
const s = StyleSheet.create({
  wrap: { position: 'absolute', left: 12, right: 12 },
  toast: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: C.lime, borderWidth: 2, borderColor: C.ink, borderRadius: R.md, padding: 12 },
  emoji: { fontSize: 24 }, title: { fontSize: 15, color: C.ink, ...font.bold }, line: { fontSize: 13, color: C.ink },
});
