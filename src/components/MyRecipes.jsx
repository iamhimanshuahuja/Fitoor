import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, BookOpen } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { RECIPE_COLS } from '../lib/recipes';
import { RecipeCard } from './PublicShell';
import { Card, Empty, Spinner } from './ui';

/** Plan → Recipes: the client's own recipes (any status) + link to the public book. */
export default function MyRecipes({ userId }) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    supabase.from('recipes').select(RECIPE_COLS).eq('author_id', userId).order('updated_at', { ascending: false })
      .then(({ data }) => setRows(data || []));
  }, [userId]);
  return (
    <Card title="My recipes" action={<Link className="btn btn-pop btn-sm" to="/recipes/new"><Plus size={15} /> Add recipe</Link>}>
      {!rows ? <Spinner /> : rows.length ? <div className="recipe-grid">{rows.map((r) => <RecipeCard key={r.id} r={r} />)}</div>
        : <Empty>Cook something you love? Add it here. Keep it private, or share it on the website (a coach checks it first).</Empty>}
      <p><Link to="/recipes" className="btn btn-ghost btn-sm"><BookOpen size={15} /> Browse the Fitoor recipe book</Link></p>
    </Card>
  );
}
