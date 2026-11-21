import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { DIETS, TAGS, MEALS, RECIPE_COLS, dietAllows } from '../../lib/recipes';
import { Btn, Chip, Chips, Empty, Field, Row, Screen, Seg, Spinner } from '../../components/ui';
import RecipeCard from '../../components/RecipeCard';

export default function Recipes() {
  const { user, profile } = useAuth();
  const p = useLocalSearchParams();
  const [mine, setMine] = useState(p.mine === '1');
  const [diet, setDiet] = useState(profile?.diet_pref || '');
  const [tag, setTag] = useState('');
  const [meal, setMeal] = useState('');
  const [q, setQ] = useState('');
  const [list, setList] = useState(null);
  useEffect(() => {
    setList(null);
    let qq = supabase.from('recipes').select(RECIPE_COLS);
    qq = mine ? qq.eq('author_id', user.id).order('updated_at', { ascending: false }) : qq.eq('status', 'public').order('published_at', { ascending: false });
    if (!mine && diet) qq = qq.in('diet', dietAllows(diet));
    if (tag) qq = qq.contains('tags', [tag]);
    if (meal) qq = qq.contains('meal_types', [meal]);
    if (q.trim()) qq = qq.ilike('title', `%${q.trim()}%`);
    const t = setTimeout(() => qq.limit(60).then(({ data }) => setList(data || [])), q ? 300 : 0);
    return () => clearTimeout(t);
  }, [mine, diet, tag, meal, q, user.id]);
  return (
    <Screen>
      <Seg items={[{ key: false, label: 'All recipes' }, { key: true, label: 'My recipes' }]} value={mine} onChange={setMine} full />
      <Row><Field value={q} onChangeText={setQ} placeholder="Search e.g. chilla, dal" /><Btn small variant="pop" title="+ Add" onPress={() => router.push('/recipe-new')} /></Row>
      {!mine && <Chips>{Object.entries(DIETS).map(([k, d]) => <Chip key={k} small label={`${d.emoji} ${d.short}`} on={diet === k} onPress={() => setDiet(diet === k ? '' : k)} />)}</Chips>}
      <Chips>{Object.entries(MEALS).map(([k, l]) => <Chip key={k} small label={l} on={meal === k} onPress={() => setMeal(meal === k ? '' : k)} />)}</Chips>
      <Chips>{Object.entries(TAGS).map(([k, l]) => <Chip key={k} small label={l} on={tag === k} onPress={() => setTag(tag === k ? '' : k)} />)}</Chips>
      {!list ? <Spinner /> : !list.length ? <Empty>{mine ? 'You haven’t added a recipe yet.' : 'No recipes match. Try fewer filters.'}</Empty> : (
        <View style={{ gap: 12 }}>{list.map((r) => <RecipeCard key={r.id} r={r} showStatus={mine} onPress={() => router.push(`/recipe/${r.slug || r.id}`)} />)}</View>
      )}
    </Screen>
  );
}
