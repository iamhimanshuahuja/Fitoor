import { Pressable, StyleSheet, Text, View } from 'react-native';
import { addDays, fmt, today } from '../shared/dates';
import { C } from '../theme';

/** Date picker without typing: ‹ Sat, 21 Nov › . Tap the middle to jump to today. value = 'YYYY-MM-DD' or '' (optional). */
export default function DateField({ label, value, onChange, max = today(), min, optional, hint }) {
  const v = value || '';
  const set = (d) => { if ((max && d > max) || (min && d < min)) return; onChange(d); };
  const t = today();
  const text = !v ? 'Not set' : v === t ? 'Today' : v === addDays(t, -1) ? 'Yesterday' : v === addDays(t, 1) ? 'Tomorrow' : fmt(v, { weekday: 'short', day: 'numeric', month: 'short', year: v.slice(0, 4) === t.slice(0, 4) ? undefined : 'numeric' });
  return (
    <View style={{ gap: 4, flexGrow: 1, flexShrink: 1, minWidth: 0 }}>
      {label ? <Text style={st.label}>{label}</Text> : null}
      <View style={st.box}>
        <Pressable onPress={() => set(addDays(v || t, -1))} style={st.arrow} accessibilityLabel={`${label || 'Date'}: previous day`} hitSlop={4}><Text style={st.a}>‹</Text></Pressable>
        <Pressable onPress={() => onChange(v ? (optional ? '' : t) : (max && t > max ? max : t))} style={st.mid} accessibilityRole="button" accessibilityLabel={`${label || 'Date'}: ${text}`}>
          <Text style={[st.val, !v && { color: C.muted }]} numberOfLines={1}>{text}</Text>
        </Pressable>
        <Pressable onPress={() => set(addDays(v || t, 1))} style={[st.arrow, max && v && v >= max && { opacity: 0.3 }]} accessibilityLabel={`${label || 'Date'}: next day`} hitSlop={4}><Text style={st.a}>›</Text></Pressable>
      </View>
      {hint ? <Text style={st.hint}>{hint}</Text> : optional && v ? <Text style={st.hint}>Tap the date to clear it.</Text> : null}
    </View>
  );
}
const st = StyleSheet.create({
  label: { fontSize: 13, color: C.ink, fontWeight: '600' },
  hint: { fontSize: 12, color: C.muted },
  box: { flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: C.line, borderRadius: 12, backgroundColor: '#fff', minHeight: 46 },
  arrow: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' }, a: { fontSize: 24, color: C.ink, lineHeight: 26 },
  mid: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 44 }, val: { fontSize: 15, fontWeight: '700', color: C.ink },
});
