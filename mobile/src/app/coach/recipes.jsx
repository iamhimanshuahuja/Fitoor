import { useCallback, useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { RECIPE_COLS } from '../../lib/recipes';
import { Btn, Card, Empty, Field, Row, Screen, Spinner, T } from '../../components/ui';
import RecipeCard from '../../components/RecipeCard';

export default function RecipeReviews() {
  const { user } = useAuth();
  const [list, setList] = useState(null);
  const [notes, setNotes] = useState({});
  const load = useCallback(() => supabase.from('recipes').select(`${RECIPE_COLS}, review_note`).eq('status', 'pending').order('updated_at').then(({ data }) => setList(data || [])), []);
  useEffect(() => { load(); }, [load]);
  const decide = async (r, ok) => {
    if (!ok && !notes[r.id]?.trim()) return Alert.alert('Add a short note', 'Tell the author what to change.');
    const { error } = await supabase.from('recipes').update({ status: ok ? 'public' : 'rejected', review_note: ok ? null : notes[r.id].trim() }).eq('id', r.id);
    if (error) return Alert.alert('Not saved', error.message);
    load();
  };
  if (!list) return <Spinner />;
  return (
    <Screen onRefresh={load}>
      {!list.length ? <Empty>Nothing waiting for review 🎉</Empty> : list.map((r) => (
        <Card key={r.id}>
          <RecipeCard r={r} onPress={() => router.push(`/coach/recipe/${r.slug || r.id}`)} />
          <T small muted>Check it’s in the author’s own words, no copied text or photos, and nothing that reads like medical advice.</T>
          <Field value={notes[r.id] || ''} onChangeText={(v) => setNotes({ ...notes, [r.id]: v })} placeholder="Note if sending back" />
          <Row><Btn small title="Publish" onPress={() => decide(r, true)} /><Btn small variant="ghost" title="Send back" onPress={() => decide(r, false)} /></Row>
        </Card>
      ))}
    </Screen>
  );
}
