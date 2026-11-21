import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Check, Undo2, ExternalLink } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { RECIPE_COLS, STATUS, TAGS } from '../../lib/recipes';
import { RecipeCover, DietDot } from '../../components/PublicShell';
import { Card, Empty, Spinner, Tabs, useToast } from '../../components/ui';

/** Coach / super admin: review client recipes, manage the public recipe book. */
export default function AdminRecipes() {
  const { user } = useAuth();
  const [tab, setTab] = useState('review');
  const [rows, setRows] = useState(null);
  const [toast, show] = useToast();
  const load = async () => {
    const { data } = await supabase.from('recipes').select(RECIPE_COLS + ', review_note, updated_at').order('updated_at', { ascending: false }).limit(500);
    setRows(data || []);
  };
  useEffect(() => { load(); }, []);
  if (!rows) return <div className="center-pad"><Spinner /></div>;

  const pending = rows.filter((r) => r.status === 'pending');
  const published = rows.filter((r) => r.status === 'public');
  const mine = rows.filter((r) => r.author_id === user.id && r.status !== 'public');
  const list = tab === 'review' ? pending : tab === 'public' ? published : mine;

  const decide = async (r, ok) => {
    let note = null;
    if (!ok) { note = prompt('What should they change? (shown to the client)', 'Please add a photo and clearer steps.'); if (note === null) return; }
    const { error } = await supabase.from('recipes').update({ status: ok ? 'public' : 'rejected', review_note: note }).eq('id', r.id);
    if (error) return show(error.message, 'bad');
    show(ok ? 'Published on the website' : 'Sent back to the client'); load();
  };

  return (
    <div className="page">
      {toast}
      <div className="page-head">
        <h1>Recipes</h1>
        <div className="row gap wrap">
          <a className="btn btn-ghost btn-sm" href="/recipes" target="_blank" rel="noreferrer"><ExternalLink size={15} /> View recipe book</a>
          <Link className="btn btn-pop btn-sm" to="/recipes/new"><Plus size={15} /> New recipe</Link>
        </div>
      </div>
      <Tabs tabs={[{ key: 'review', label: `To review${pending.length ? ` (${pending.length})` : ''}` }, { key: 'public', label: `Published (${published.length})` }, { key: 'mine', label: 'My drafts' }]} value={tab} onChange={setTab} />
      <Card>
        {!list.length ? <Empty>{tab === 'review' ? 'Nothing waiting for review.' : tab === 'public' ? 'No published recipes yet.' : 'No private recipes.'}</Empty> : (
          <ul className="admin-recipes">
            {list.map((r) => (
              <li key={r.id}>
                <RecipeCover r={r} className="ar-thumb" />
                <div className="grow">
                  <div className="row gap"><DietDot diet={r.diet} /><Link to={`/recipes/${r.slug}`}><b>{r.title}</b></Link></div>
                  <div className="small muted">{r.by_staff ? 'Fitoor Kitchen' : 'Client recipe'} · {STATUS[r.status]?.label}{r.status === 'public' ? ` · ${r.views} views` : ''}{(r.tags || []).length ? ` · ${(r.tags || []).slice(0, 3).map((t) => TAGS[t] || t).join(', ')}` : ''}</div>
                  {r.review_note && r.status === 'rejected' && <div className="small">Note: {r.review_note}</div>}
                </div>
                {r.status === 'pending' && (
                  <div className="row gap">
                    <button className="btn btn-pop btn-sm" onClick={() => decide(r, true)}><Check size={14} /> Publish</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => decide(r, false)}><Undo2 size={14} /> Send back</button>
                  </div>
                )}
                <Link className="btn btn-ghost btn-sm" to={`/recipes/edit/${r.id}`}>Edit</Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <p className="small muted">Client recipes marked “Share on the website” wait here until a coach publishes them. Published recipes appear on fitoor.life/recipes and in Google search.</p>
    </div>
  );
}
