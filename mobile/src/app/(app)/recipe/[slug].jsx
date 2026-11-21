import { useEffect, useState } from 'react';
import { Image, Linking, Pressable, Share, Text, View } from 'react-native';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../lib/auth';
import { DIETS, TAGS, STATUS, coverColor, coverEmoji, imageUrl, recipeUrl, totalMin } from '../../../lib/recipes';
import { Btn, Card, Chip, Chips, Empty, Row, Screen, Spinner, Stat, T } from '../../../components/ui';
import { C } from '../../../theme';

export default function RecipeDetail() {
  const { slug } = useLocalSearchParams();
  const { user } = useAuth();
  const [r, setR] = useState(undefined);
  const [done, setDone] = useState({});
  useEffect(() => {
    const isId = /^[0-9a-f-]{36}$/.test(slug);
    supabase.from('recipes').select('*').eq(isId ? 'id' : 'slug', slug).maybeSingle().then(({ data }) => {
      setR(data || null);
      if (data?.status === 'public') supabase.rpc('recipe_view', { p_slug: data.slug });
    });
  }, [slug]);
  if (r === undefined) return <Spinner />;
  if (!r) return <Screen><Empty>Recipe not found.</Empty></Screen>;
  const img = imageUrl(r.image_path);
  return (
    <Screen>
      <Stack.Screen options={{ title: r.title }} />
      {img ? <Image source={{ uri: img }} style={{ width: '100%', aspectRatio: 16 / 10, borderRadius: 16, borderWidth: 2, borderColor: C.ink }} />
        : <View style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 16, borderWidth: 2, borderColor: C.ink, backgroundColor: coverColor(r), alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 64 }}>{coverEmoji(r)}</Text></View>}
      <View style={{ gap: 4 }}>
        <T style={{ fontSize: 24, fontWeight: '800' }}>{r.title}</T>
        {r.summary ? <T>{r.summary}</T> : null}
        <T small muted>{DIETS[r.diet]?.emoji} {DIETS[r.diet]?.label} · by {r.by_staff ? 'Fitoor Kitchen' : 'Fitoor community'}</T>
        {r.status !== 'public' ? <T small bold>{STATUS[r.status]?.label}: {STATUS[r.status]?.hint}{r.review_note ? `\nCoach note: ${r.review_note}` : ''}</T> : null}
      </View>
      <Chips>{(r.tags || []).map((t) => <Chip key={t} small label={TAGS[t] || t} />)}</Chips>
      <Row wrap gap={8}>
        {totalMin(r) ? <Stat label="Time" value={`${totalMin(r)} min`} tone={C.lime} /> : null}
        {r.servings ? <Stat label="Serves" value={r.servings} tone={C.sky} /> : null}
        {r.kcal ? <Stat label="kcal / serving" value={r.kcal} tone={C.haldi} /> : null}
        {r.protein_g ? <Stat label="Protein" value={`${r.protein_g} g`} tone={C.lav} /> : null}
      </Row>
      <Card title="Ingredients">
        {(r.ingredients || []).map((x, i) => (
          <Pressable key={i} onPress={() => setDone({ ...done, [i]: !done[i] })} accessibilityRole="checkbox" accessibilityState={{ checked: !!done[i] }} style={{ minHeight: 34, justifyContent: 'center' }}>
            <T style={done[i] ? { textDecorationLine: 'line-through', color: C.muted } : null}>{done[i] ? '☑' : '☐'} {x.qty ? <T bold>{x.qty} </T> : null}{x.item}</T>
          </Pressable>
        ))}
      </Card>
      <Card title="Method">{(r.steps || []).map((s, i) => <T key={i}><T bold>{i + 1}.</T> {s}</T>)}</Card>
      {r.tips ? <Card title="Coach tip" tone={C.lav}><T>{r.tips}</T></Card> : null}
      {r.source_url ? <Pressable onPress={() => Linking.openURL(r.source_url)}><T small muted>Reference: {r.source_name || r.source_url}</T></Pressable> : null}
      <Row wrap>
        {r.status === 'public' && <Btn title="Share" variant="pop" onPress={() => Share.share({ message: `${r.title} · ${recipeUrl(r.slug)}`, url: recipeUrl(r.slug) })} />}
        {r.author_id === user.id && <Btn title="Edit" variant="ghost" onPress={() => router.push({ pathname: '/recipe-new', params: { id: r.id } })} />}
      </Row>
      <T small muted>Nutrition is an estimate per serving.</T>
    </Screen>
  );
}
