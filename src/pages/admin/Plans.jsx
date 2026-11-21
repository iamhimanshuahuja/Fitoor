import { useAuth } from '../../lib/auth';
import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { FEATURES, MUSCLES, EQUIPMENT, pretty } from '../../lib/constants';
import { Card, Tabs, Spinner, useToast } from '../../components/ui';
import DietPlanEditor from '../../components/DietPlanEditor';
import { useExercises } from '../app/Gym';

export default function Plans() {
  const { isSuper } = useAuth();
  const [tab, setTab] = useState(isSuper ? 'plans' : 'templates');
  const tabs = [...(isSuper ? [{ key: 'plans', label: 'Subscription plans' }] : []), { key: 'templates', label: 'Diet templates' }, { key: 'exercises', label: 'Exercise library' }];
  return (
    <div className="page">
      <div className="page-head"><h1>{isSuper ? 'Plans & library' : 'Library'}</h1>
        <Tabs tabs={tabs} value={tab} onChange={setTab} />
      </div>
      {tab === 'plans' && isSuper && <PlanMatrix />}
      {tab === 'templates' && <Templates />}
      {tab === 'exercises' && <ExerciseLibrary />}
    </div>
  );
}

function PlanMatrix() {
  const [plans, setPlans] = useState(null);
  const [toast, show] = useToast();
  const load = () => supabase.from('plans').select('*').order('created_at').then(({ data }) => setPlans(data || []));
  useEffect(() => { load(); }, []);
  if (!plans) return <div className="center-pad"><Spinner /></div>;

  const toggle = async (p, k) => {
    const features = p.features.includes(k) ? p.features.filter((x) => x !== k) : [...p.features, k];
    const { error } = await supabase.from('plans').update({ features }).eq('id', p.id);
    if (error) show(error.message, 'bad'); load();
  };
  const add = async () => {
    const name = prompt('New plan name'); if (!name) return;
    const { error } = await supabase.from('plans').insert({ name, features: ['diet', 'meals', 'weight'] });
    if (error) show(error.message, 'bad'); load();
  };
  const del = async (p) => {
    if (!confirm(`Delete plan "${p.name}"? Clients on it will have no plan.`)) return;
    await supabase.from('profiles').update({ plan_id: null }).eq('plan_id', p.id);
    await supabase.from('plans').delete().eq('id', p.id); load();
  };
  return (
    <Card title="Which features each plan includes" action={<button className="btn btn-soft btn-sm" onClick={add}><Plus size={16} /> New plan</button>}>
      {toast}
      <div className="table-wrap">
        <table className="table matrix">
          <thead><tr><th>Feature</th>{plans.map((p) => <th key={p.id}>{p.name} <button className="icon-btn sm" onClick={() => del(p)} aria-label="Delete plan"><Trash2 size={13} /></button></th>)}</tr></thead>
          <tbody>
            {FEATURES.map((f) => (
              <tr key={f.key}>
                <td><b>{f.label}</b><div className="muted small">{f.hint}</div></td>
                {plans.map((p) => <td key={p.id} className="center"><input type="checkbox" className="switch" checked={p.features.includes(f.key)} onChange={() => toggle(p, f.key)} /></td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small muted">Per-client overrides are on each client's “Plan & access” tab.</p>
    </Card>
  );
}

function Templates() {
  const { user, isSuper } = useAuth();
  const [list, setList] = useState(null);
  const [open, setOpen] = useState(null);
  const load = () => supabase.from('diet_plans').select('id, title, updated_at, created_by').eq('is_template', true).order('title').then(({ data }) => setList(data || []));
  useEffect(() => { load(); }, []);
  if (!list) return <div className="center-pad"><Spinner /></div>;
  if (open) return <><button className="btn btn-ghost" onClick={() => { setOpen(null); load(); }}>← All templates</button><DietPlanEditor planId={open === 'new' ? null : open} /></>;
  return (
    <Card title={isSuper ? 'Diet plan templates · yours are shared with every coach' : 'Diet plan templates · shared ones come from the super admin; yours are private'} action={<button className="btn btn-soft btn-sm" onClick={() => setOpen('new')}><Plus size={16} /> New template</button>}>
      <ul className="list">
        {list.map((t) => (
          <li key={t.id}>
            <button className="link" onClick={() => setOpen(t.id)}>{t.title}</button>
            <span className="tag">{t.created_by === user.id ? (isSuper ? 'Shared with all coaches' : 'Private · mine') : 'Shared'}</span>
            {(isSuper || t.created_by === user.id) && <button className="icon-btn sm" onClick={async () => { if (confirm('Delete template?')) { await supabase.from('diet_plans').delete().eq('id', t.id); load(); } }}><Trash2 size={14} /></button>}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ExerciseLibrary() {
  const [list, reload] = useExercises();
  const [f, setF] = useState({ name: '', muscle_group: 'chest', equipment: 'machine', kind: 'strength' });
  const [toast, show] = useToast();
  const add = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('exercises').insert(f);
    if (error) return show(error.message, 'bad');
    setF({ ...f, name: '' }); reload();
  };
  const del = async (x) => {
    const { error } = await supabase.from('exercises').delete().eq('id', x.id);
    if (error) show('Used in workouts — cannot delete', 'bad'); else reload();
  };
  return (
    <Card title={`Exercise library (${list.length})`}>
      {toast}
      <form className="row gap wrap" onSubmit={add}>
        <input className="grow" required placeholder="Exercise / machine name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <select value={f.muscle_group} onChange={(e) => setF({ ...f, muscle_group: e.target.value })}>{MUSCLES.map((m) => <option key={m} value={m}>{pretty(m)}</option>)}</select>
        <select value={f.equipment} onChange={(e) => setF({ ...f, equipment: e.target.value })}>{EQUIPMENT.map((m) => <option key={m} value={m}>{pretty(m)}</option>)}</select>
        <select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}><option value="strength">Strength</option><option value="cardio">Cardio</option><option value="mobility">Mobility</option></select>
        <button className="btn btn-primary"><Plus size={16} /> Add</button>
      </form>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Name</th><th>Muscle</th><th>Equipment</th><th>Type</th><th></th></tr></thead>
          <tbody>{list.map((x) => <tr key={x.id}><td>{x.name}</td><td>{pretty(x.muscle_group)}</td><td>{pretty(x.equipment)}</td><td>{x.kind}</td><td><button className="icon-btn sm" onClick={() => del(x)}><Trash2 size={14} /></button></td></tr>)}</tbody>
        </table>
      </div>
    </Card>
  );
}
