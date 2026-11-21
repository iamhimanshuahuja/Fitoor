import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, R, pop, font } from '../theme';
import { useSignedUrl } from '../lib/media';

/** Scrollable page with pull-to-refresh, safe-area padding and keyboard avoidance. */
export function Screen({ children, onRefresh, pad = true, scroll = true, style, footerSpace = 90 }) {
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const refresh = useCallback(async () => { if (!onRefresh) return; setRefreshing(true); try { await onRefresh(); } finally { setRefreshing(false); } }, [onRefresh]);
  const body = scroll ? (
    <ScrollView contentContainerStyle={[pad && s.pad, { paddingBottom: footerSpace + insets.bottom }, style]} keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.deep} /> : undefined}>
      {children}
    </ScrollView>
  ) : <View style={[{ flex: 1 }, pad && s.pad, style]}>{children}</View>;
  return <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>{body}</KeyboardAvoidingView>;
}

export const H1 = ({ children, style }) => <Text style={[s.h1, style]} accessibilityRole="header">{children}</Text>;
export const H2 = ({ children, style }) => <Text style={[s.h2, style]} accessibilityRole="header">{children}</Text>;
export const T = ({ children, style, muted, small, bold, ...p }) => <Text style={[s.t, muted && s.muted, small && s.small, bold && font.bold, style]} {...p}>{children}</Text>;

export function Card({ title, action, children, style, tone }) {
  return (
    <View style={[s.card, tone && { backgroundColor: tone }, style]}>
      {(title || action) && (
        <View style={s.cardHead}>
          {title ? <Text style={s.cardTitle} accessibilityRole="header">{title}</Text> : <View />}
          {action}
        </View>
      )}
      {children}
    </View>
  );
}

/** Button. variant: primary (ink + lime text) | pop (lime) | ghost | soft | danger */
export function Btn({ title, onPress, variant = 'primary', small, disabled, busy, icon, style, accessibilityLabel }) {
  const v = VARIANTS[variant] || VARIANTS.primary;
  return (
    <Pressable onPress={onPress} disabled={disabled || busy} accessibilityRole="button" accessibilityLabel={accessibilityLabel || title}
      accessibilityState={{ disabled: !!(disabled || busy), busy: !!busy }}
      style={({ pressed }) => [s.btn, small && s.btnSm, v.box, (variant === 'primary' || variant === 'pop') && !pressed && pop, pressed && s.pressed, (disabled || busy) && s.disabled, style]}>
      {busy ? <ActivityIndicator color={v.text.color} /> : (
        <Text style={[s.btnText, small && s.btnTextSm, v.text]} numberOfLines={1}>{icon ? `${icon}  ` : ''}{title}</Text>
      )}
    </Pressable>
  );
}
const VARIANTS = {
  primary: { box: { backgroundColor: C.ink, borderColor: C.ink }, text: { color: C.lime } },
  pop: { box: { backgroundColor: C.lime, borderColor: C.ink }, text: { color: C.ink } },
  ghost: { box: { backgroundColor: C.card, borderColor: C.ink }, text: { color: C.ink } },
  soft: { box: { backgroundColor: C.lime, borderColor: C.ink }, text: { color: C.ink } },
  danger: { box: { backgroundColor: C.card, borderColor: C.red }, text: { color: C.red } },
};

export function Chip({ label, on, onPress, tone, small, style }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: !!on }}
      style={[s.chip, small && s.chipSm, on && { backgroundColor: tone || C.deep, borderColor: tone ? C.ink : C.deep }, style]}>
      <Text style={[s.chipText, small && { fontSize: 12 }, on && { color: tone ? C.ink : '#fff' }]}>{label}</Text>
    </Pressable>
  );
}
export const Chips = ({ children, style }) => <View style={[s.chips, style]}>{children}</View>;

export function Field({ label, hint, style, inputStyle, multiline, ...p }) {
  return (
    <View style={[s.field, style]}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <TextInput placeholderTextColor="#8A9A8F" style={[s.input, multiline && { minHeight: 70, textAlignVertical: 'top' }, inputStyle]} multiline={multiline} accessibilityLabel={label || p.placeholder} {...p} />
      {hint ? <Text style={s.hint}>{hint}</Text> : null}
    </View>
  );
}
export const NumField = (p) => <Field keyboardType="decimal-pad" {...p} />;

export function Row({ children, style, gap = 8, wrap }) { return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, wrap && { flexWrap: 'wrap' }, style]}>{children}</View>; }
export const Empty = ({ children }) => <Text style={s.empty}>{children}</Text>;
export const Spinner = ({ style }) => <ActivityIndicator color={C.deep} style={[{ padding: 20 }, style]} />;

export function Toggle({ label, hint, value, onChange, disabled }) {
  return (
    <View style={s.toggle}>
      <View style={{ flex: 1 }}><Text style={s.toggleLabel}>{label}</Text>{hint ? <Text style={s.hint}>{hint}</Text> : null}</View>
      <Switch value={!!value} onValueChange={onChange} disabled={disabled} trackColor={{ true: C.fresh, false: '#C9D4C4' }} accessibilityLabel={label} />
    </View>
  );
}

/** Segmented control: items = [{ key, label }, …] (or [value, label] pairs) */
export function Seg({ items, value, onChange, style }) {
  return (
    <View style={[s.seg, style]} accessibilityRole="tablist">
      {(items || []).map((it) => { const [v, l] = Array.isArray(it) ? it : [it.key, it.label]; return (
        <Pressable key={String(v)} onPress={() => onChange(v)} accessibilityRole="tab" accessibilityState={{ selected: value === v }} style={[s.segBtn, value === v && s.segOn]}>
          <Text style={[s.segText, value === v && { color: C.ink }]}>{l}</Text>
        </Pressable>
      ); })}
    </View>
  );
}

export function Pill({ children, tone }) { return <View style={[s.pill, tone && { backgroundColor: tone }]}><Text style={s.pillText}>{children}</Text></View>; }
export function Tag({ children, tone = C.lime }) { return <View style={[s.tag, { backgroundColor: tone }]}><Text style={s.tagText}>{children}</Text></View>; }

/** Private 'media' photo by storage path. */
export function SignedImg({ path, style }) {
  const url = useSignedUrl(path);
  return url ? <Image source={{ uri: url }} style={[s.thumb, style]} accessibilityIgnoresInvertColors /> : <View style={[s.thumb, { backgroundColor: C.line }, style]} />;
}

export function Stat({ label, value, sub, tone = C.lime }) {
  return (
    <View style={[s.stat, { backgroundColor: tone }]}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={s.statValue}>{value ?? '—'}</Text>
      {sub ? <Text style={s.statSub}>{sub}</Text> : null}
    </View>
  );
}

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.paper },
  pad: { padding: 14, gap: 14 },
  h1: { fontSize: 28, color: C.ink, ...font.display },
  h2: { fontSize: 19, color: C.ink, ...font.display, marginBottom: 6 },
  t: { fontSize: 15, color: C.ink, lineHeight: 21 },
  muted: { color: C.muted },
  small: { fontSize: 13, lineHeight: 18 },
  card: { backgroundColor: C.card, borderRadius: R.lg, borderWidth: 2, borderColor: C.ink, padding: 14, gap: 10 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardTitle: { fontSize: 17, color: C.ink, ...font.display, flexShrink: 1 },
  btn: { minHeight: 46, paddingHorizontal: 16, borderRadius: R.md, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  btnSm: { minHeight: 38, paddingHorizontal: 12, borderRadius: R.sm },
  btnText: { fontSize: 15, ...font.bold },
  btnTextSm: { fontSize: 13 },
  pressed: { transform: [{ translateX: 2 }, { translateY: 2 }] },
  disabled: { opacity: 0.5 },
  chip: { borderWidth: 1.5, borderColor: C.line, backgroundColor: C.card, borderRadius: R.pill, paddingHorizontal: 12, minHeight: 36, justifyContent: 'center' },
  chipSm: { minHeight: 30, paddingHorizontal: 9 },
  chipText: { fontSize: 13.5, color: C.ink, ...font.semi },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  field: { gap: 4, flexGrow: 1, flexShrink: 1, minWidth: 64 },
  label: { fontSize: 13, color: C.ink, ...font.semi },
  hint: { fontSize: 12, color: C.muted },
  input: { borderWidth: 2, borderColor: C.line, borderRadius: 12, backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: C.ink, minHeight: 46 },
  empty: { color: C.muted, fontSize: 14, paddingVertical: 6 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  toggleLabel: { fontSize: 15, color: C.ink, ...font.semi },
  seg: { flexDirection: 'row', borderWidth: 2, borderColor: C.ink, borderRadius: 12, padding: 3, backgroundColor: '#fff', alignSelf: 'flex-start' },
  segBtn: { paddingHorizontal: 12, minHeight: 34, justifyContent: 'center', borderRadius: 9 },
  segOn: { backgroundColor: C.lime },
  segText: { fontSize: 13, color: C.muted, ...font.bold },
  pill: { borderWidth: 1.5, borderColor: C.ink, borderRadius: R.pill, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#fff' },
  pillText: { fontSize: 13, color: C.ink, ...font.semi },
  tag: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start', borderWidth: 1, borderColor: C.ink },
  tagText: { fontSize: 11, color: C.ink, ...font.bold },
  thumb: { width: 64, height: 64, borderRadius: 10, borderWidth: 1.5, borderColor: C.ink },
  stat: { flexGrow: 1, flexBasis: '45%', borderWidth: 2, borderColor: C.ink, borderRadius: R.md, padding: 12 },
  statLabel: { fontSize: 12.5, color: C.ink, ...font.semi },
  statValue: { fontSize: 22, color: C.ink, ...font.display, marginTop: 2 },
  statSub: { fontSize: 12, color: C.ink, opacity: 0.75 },
});
