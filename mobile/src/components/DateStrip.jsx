import { Pressable, StyleSheet, Text, View } from 'react-native';
import { addDays, fmt, today } from '../shared/dates';
import { C, R } from '../theme';
export default function DateStrip({ value, onChange }) {
  const t = today();
  return (
    <View style={s.wrap}>
      <Pressable onPress={() => onChange(addDays(value, -1))} style={s.arrow} accessibilityLabel="Previous day" hitSlop={8}><Text style={s.a}>‹</Text></Pressable>
      <Pressable onPress={() => onChange(t)} style={s.mid} accessibilityRole="button" accessibilityLabel="Go to today">
        <Text style={s.date}>{value === t ? 'Today' : value === addDays(t, -1) ? 'Yesterday' : fmt(value, { weekday: 'short', day: 'numeric', month: 'short' })}</Text>
      </Pressable>
      <Pressable onPress={() => value < t && onChange(addDays(value, 1))} style={[s.arrow, value >= t && { opacity: 0.3 }]} accessibilityLabel="Next day" hitSlop={8}><Text style={s.a}>›</Text></Pressable>
    </View>
  );
}
const s = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: C.ink, borderRadius: R.md, backgroundColor: '#fff' },
  arrow: { width: 48, height: 46, alignItems: 'center', justifyContent: 'center' }, a: { fontSize: 28, color: C.ink, lineHeight: 30 },
  mid: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 46 }, date: { fontSize: 16, fontWeight: '800', color: C.ink },
});
