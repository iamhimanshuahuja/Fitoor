import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { DIETS, STATUS, coverColor, coverEmoji, imageUrl, totalMin } from '../lib/recipes';
import { T, Tag } from './ui';
import { C, R, pop } from '../theme';
export default function RecipeCard({ r, onPress, showStatus }) {
  const img = imageUrl(r.image_path);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.card, !pressed && pop]} accessibilityRole="button" accessibilityLabel={r.title}>
      {img ? <Image source={{ uri: img }} style={s.img} /> : <View style={[s.img, { backgroundColor: coverColor(r), alignItems: 'center', justifyContent: 'center' }]}><Text style={{ fontSize: 44 }}>{coverEmoji(r)}</Text></View>}
      <View style={{ padding: 10, gap: 4 }}>
        <T bold>{r.title}</T>
        <T small muted>{DIETS[r.diet]?.emoji} {DIETS[r.diet]?.short}{totalMin(r) ? ` · ${totalMin(r)} min` : ''}{r.kcal ? ` · ${r.kcal} kcal` : ''}{r.protein_g ? ` · P ${r.protein_g} g` : ''}</T>
        {showStatus && r.status !== 'public' ? <Tag tone={r.status === 'rejected' ? C.pink : C.cream}>{STATUS[r.status]?.label}</Tag> : null}
      </View>
    </Pressable>
  );
}
const s = StyleSheet.create({
  card: { backgroundColor: '#fff', borderWidth: 2, borderColor: C.ink, borderRadius: R.lg, overflow: 'hidden' },
  img: { width: '100%', aspectRatio: 16 / 9 },
});
