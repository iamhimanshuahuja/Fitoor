import { useEffect, useState } from 'react';
import { Alert, Image, View } from 'react-native';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { pickImage } from '../../lib/media';
import { cheer } from '../../shared/cheer';
import { DIETS, TAGS, MEALS, imageUrl, uploadRecipeImage } from '../../lib/recipes';
import { Btn, Card, Chip, Chips, Field, NumField, Row, Screen, Spinner, T } from '../../components/ui';
import { C } from '../../theme';

const blank = { title: '', summary: '', diet: 'veg', tags: [], meal_types: [], prep_min: '', cook_min: '', servings: '', kcal: '', protein_g: '', carbs_g: '', fat_g: '',
  ingredients: [{ qty: '', item: '' }], steps: [''], tips: '', image_path: null, source_name: '', source_url: '', status: 'private' };
const s = (v) => (v == null ? '' : String(v));

export default function RecipeEditor() {
  const { id } = useLocalSearchParams();
  const { user, isAdmin } = useAuth();
  const [f, setF] = useState(id ? null : blank);
  const [busy, setBusy] = useState('');
  useEffect(() => {
    if (!id) return;
    supabase.from('recipes').select('*').eq('id', id).single().then(({ data }) => data && setF({ ...blank, ...data,
      ...Object.fromEntries(['prep_min', 'cook_min', 'servings', 'kcal', 'protein_g', 'carbs_g', 'fat_g', 'summary', 'tips', 'source_name', 'source_url'].map((k) => [k, s(data[k])])),
      ingredients: data.ingredients?.length ? data.ingredients : blank.ingredients, steps: data.steps?.length ? data.steps : blank.steps }));
  }, [id]);
  if (!f) return <Spinner />;
  const set = (k) => (v) => setF({ ...f, [k]: v });
  const toggle = (k, v) => setF({ ...f, [k]: f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v] });
  const photo = async (src) => {
    const p = await pickImage(src, { max: 1400 }); if (!p) return;
    setBusy('Uploading photo…');
    try { setF({ ...f, image_path: await uploadRecipeImage(user.id, p) }); } catch (e) { Alert.alert('Upload failed', e.message); }
    setBusy('');
  };
  const save = async () => {
    if (f.title.trim().length < 3) return Alert.alert('Give it a title');
    const ingredients = f.ingredients.filter((x) => x.item.trim()).map((x) => ({ qty: x.qty.trim(), item: x.item.trim() }));
    const steps = f.steps.map((x) => x.trim()).filter(Boolean);
    if (!ingredients.length || !steps.length) return Alert.alert('Add at least one ingredient and one step');
    const num = (v) => (v === '' || v == null ? null : Number(v));
    const row = { title: f.title.trim(), summary: f.summary.trim() || null, diet: f.diet, tags: f.tags, meal_types: f.meal_types,
      prep_min: num(f.prep_min), cook_min: num(f.cook_min), servings: num(f.servings), kcal: num(f.kcal), protein_g: num(f.protein_g), carbs_g: num(f.carbs_g), fat_g: num(f.fat_g),
      ingredients, steps, tips: f.tips.trim() || null, image_path: f.image_path, source_name: f.source_name.trim() || null, source_url: f.source_url.trim() || null, status: f.status };
    setBusy('Saving…');
    const res = id ? await supabase.from('recipes').update(row).eq('id', id).select('slug, status').single() : await supabase.from('recipes').insert(row).select('slug, status').single();
    setBusy('');
    if (res.error) return Alert.alert('Not saved', res.error.message);
    cheer(res.data.status === 'pending' ? 'recipe_review' : res.data.status === 'public' ? 'recipe_public' : 'recipe');
    router.replace(`/recipe/${res.data.slug}`);
  };
  const publicLabel = isAdmin ? 'Publish on the website' : 'Share on the website (a coach reviews it first)';
  return (
    <Screen>
      <Stack.Screen options={{ title: id ? 'Edit recipe' : 'Add a recipe' }} />
      <Card title="Dish">
        {f.image_path ? <Image source={{ uri: imageUrl(f.image_path) }} style={{ width: '100%', aspectRatio: 16 / 10, borderRadius: 12 }} /> : null}
        <Row wrap><Btn small variant="soft" title="📷 Photo" onPress={() => photo('camera')} /><Btn small variant="ghost" title="🖼 Gallery" onPress={() => photo('library')} /></Row>
        <Field label="Title" value={f.title} onChangeText={set('title')} placeholder="e.g. Moong dal chilla" />
        <Field label="Short summary" value={f.summary} onChangeText={set('summary')} multiline />
        <Chips>{Object.entries(DIETS).map(([k, d]) => <Chip key={k} small label={`${d.emoji} ${d.label}`} on={f.diet === k} onPress={() => set('diet')(k)} />)}</Chips>
        <Chips>{Object.entries(MEALS).map(([k, l]) => <Chip key={k} small label={l} on={f.meal_types.includes(k)} onPress={() => toggle('meal_types', k)} />)}</Chips>
        <Chips>{Object.entries(TAGS).map(([k, l]) => <Chip key={k} small label={l} on={f.tags.includes(k)} tone={C.lime} onPress={() => toggle('tags', k)} />)}</Chips>
        <Row gap={6}><NumField label="Prep min" value={f.prep_min} onChangeText={set('prep_min')} /><NumField label="Cook min" value={f.cook_min} onChangeText={set('cook_min')} /><NumField label="Serves" value={f.servings} onChangeText={set('servings')} /></Row>
        <Row gap={6}><NumField label="kcal" value={f.kcal} onChangeText={set('kcal')} /><NumField label="Protein g" value={f.protein_g} onChangeText={set('protein_g')} /><NumField label="Carbs g" value={f.carbs_g} onChangeText={set('carbs_g')} /><NumField label="Fat g" value={f.fat_g} onChangeText={set('fat_g')} /></Row>
      </Card>
      <Card title="Ingredients">
        {f.ingredients.map((x, i) => (
          <Row key={i} gap={6}>
            <Field value={x.qty} onChangeText={(v) => setF({ ...f, ingredients: f.ingredients.map((y, j) => j === i ? { ...y, qty: v } : y) })} placeholder="1 cup" style={{ maxWidth: 100 }} />
            <Field value={x.item} onChangeText={(v) => setF({ ...f, ingredients: f.ingredients.map((y, j) => j === i ? { ...y, item: v } : y) })} placeholder="moong dal, soaked" />
          </Row>
        ))}
        <Btn small variant="ghost" title="+ Ingredient" onPress={() => setF({ ...f, ingredients: [...f.ingredients, { qty: '', item: '' }] })} />
      </Card>
      <Card title="Method">
        {f.steps.map((x, i) => <Field key={i} label={`Step ${i + 1}`} value={x} multiline onChangeText={(v) => setF({ ...f, steps: f.steps.map((y, j) => j === i ? v : y) })} />)}
        <Btn small variant="ghost" title="+ Step" onPress={() => setF({ ...f, steps: [...f.steps, ''] })} />
        <Field label="Tip (optional)" value={f.tips} onChangeText={set('tips')} multiline />
      </Card>
      <Card title="Credit (optional)">
        <T small muted>Inspired by a recipe online? Add the link. Write the steps in your own words, never copy text or photos.</T>
        <Field label="Source name" value={f.source_name} onChangeText={set('source_name')} />
        <Field label="Source link" value={f.source_url} onChangeText={set('source_url')} autoCapitalize="none" keyboardType="url" />
      </Card>
      <Card title="Who can see it">
        <Chips>
          <Chip label="Private" on={f.status === 'private'} onPress={() => set('status')('private')} />
          <Chip label={publicLabel} on={f.status === 'public' || f.status === 'pending'} tone={C.lime} onPress={() => set('status')('public')} />
        </Chips>
        {f.review_note ? <T small>Coach note: {f.review_note}</T> : null}
      </Card>
      <View style={{ gap: 6 }}><Btn title="Save recipe" onPress={save} busy={busy === 'Saving…'} disabled={!!busy} />{busy ? <T small muted>{busy}</T> : null}</View>
    </Screen>
  );
}
