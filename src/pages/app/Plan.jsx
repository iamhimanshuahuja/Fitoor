import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { fmtLong } from '../../lib/dates';
import { Card, Empty, Spinner, Tabs } from '../../components/ui';
import { JuiceProgram } from '../../components/Juices';
import { MyJuiceDays } from '../../components/JuiceDays';
import { useJuiceDays } from '../../lib/juiceDays';
import Learn from '../../components/Learn';
import MyRecipes from '../../components/MyRecipes';

export function PlanView({ plan }) {
  if (!plan) return <Card><Empty>Your coach hasn't assigned a diet plan yet.</Empty></Card>;
  return (
    <>
      <Card>
        <h2 className="plan-title">{plan.title}</h2>
        <p className="muted small">Updated {fmtLong(plan.updated_at?.slice(0, 10))}</p>
        {plan.notes && <p>{plan.notes}</p>}
      </Card>
      <div className="plan-grid">
        {(plan.slots || []).map((s) => (
          <Card key={s.key} className="plan-slot">
            <div className="plan-slot-head"><span className="slot-label">{s.label}</span><b>{s.title}</b></div>
            <ul>{(s.items || []).map((it) => <li key={it}>{it}</li>)}</ul>
            {s.avoid?.length > 0 && <p className="avoid">Avoid: {s.avoid.join(', ')}</p>}
          </Card>
        ))}
      </div>
      {plan.guidelines?.length > 0 && (
        <Card title="Guidelines">
          <ol className="guidelines">{plan.guidelines.map((g) => <li key={g}>{g}</li>)}</ol>
        </Card>
      )}
    </>
  );
}

export default function Plan() {
  const { user, has, profile } = useAuth();
  const [plan, setPlan] = useState(undefined);
  const [sp] = useSearchParams();
  const [tab, setTab] = useState(sp.get('tab') || 'plan');
  const [jdays] = useJuiceDays(user.id);
  const showJuices = (jdays?.length || 0) > 0 || !!profile?.juice_group;
  useEffect(() => {
    supabase.from('diet_plans').select('*').eq('user_id', user.id).eq('is_active', true).order('updated_at', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => setPlan(data));
  }, [user.id]);
  return (
    <div className="page">
      <div className="page-head">
        <h1>My plan</h1>
        <div className="row gap wrap">
          <Tabs tabs={[{ key: 'plan', label: 'Diet chart' }, ...(showJuices ? [{ key: 'juices', label: 'Juices' }] : []), { key: 'recipes', label: 'Recipes' }, { key: 'learn', label: 'Learn' }]} value={tab} onChange={setTab} />
          {plan && <Link className="btn btn-pop btn-sm" to="/print/plan"><Printer size={16} /> Print / PDF</Link>}
        </div>
      </div>
      {tab === 'plan' && (plan === undefined ? <div className="center-pad"><Spinner /></div> : <PlanView plan={plan} />)}
      {tab === 'juices' && showJuices && (<><MyJuiceDays userId={user.id} /><JuiceProgram group={profile?.juice_group} /></>)}
      {tab === 'recipes' && <MyRecipes userId={user.id} />}
      {tab === 'learn' && <Learn />}
    </div>
  );
}
