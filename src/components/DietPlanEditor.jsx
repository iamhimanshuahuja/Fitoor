import { useEffect, useState } from 'react';
import { Save, Copy, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { SLOTS } from '../lib/constants';
import { Card, Spinner, useToast } from './ui';

const blankSlots = () => SLOTS.filter((s) => s.key !== 'other').map((s) => ({ key: s.key, label: s.label, title: '', items: [], avoid: [] }));
const lines = (arr) => (arr || []).join('\n');
const split = (t) => t.split('\n').map((x) => x.trim()).filter(Boolean);

/**
 * Edit the active diet plan of a user (userId) — or a template (userId = null, planId given).
 */
export default function DietPlanEditor({ userId = null, planId = null, onSaved }) {
  const { user } = useAuth();
  const [plan, setPlan] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [busy, setBusy] = useState(false);
  const [toast, show] = useToast();

  useEffect(() => {
    (async () => {
      const t = await supabase.from('diet_plans').select('*').eq('is_template', true).order('title');
      setTemplates(t.data || []);
      let q = supabase.from('diet_plans').select('*');
      q = planId ? q.eq('id', planId) : q.eq('user_id', userId).eq('is_active', true).order('updated_at', { ascending: false }).limit(1);
      const { data } = await q.maybeSingle();
      setPlan(data || { title: 'Diet plan', slots: blankSlots(), guidelines: [], notes: '', is_template: !userId });
    })();
  }, [userId, planId]);

  if (!plan) return <div className="center-pad"><Spinner /></div>;
  const setSlot = (i, k, v) => setPlan({ ...plan, slots: plan.slots.map((s, j) => (j === i ? { ...s, [k]: v } : s)) });

  const useTemplate = (id) => {
    const t = templates.find((x) => x.id === id);
    if (t && confirm(`Replace the current plan content with "${t.title}"?`)) setPlan({ ...plan, title: t.title, slots: t.slots, guidelines: t.guidelines, notes: t.notes });
  };

  const save = async (asNewVersion = false) => {
    setBusy(true);
    const row = {
      title: plan.title, slots: plan.slots, guidelines: plan.guidelines, notes: plan.notes || null,
      is_template: !userId, user_id: userId, is_active: true, updated_at: new Date().toISOString(),
    };
    let res;
    if (plan.id && !asNewVersion) {
      res = await supabase.from('diet_plans').update(row).eq('id', plan.id).select().single();
    } else {
      if (userId) await supabase.from('diet_plans').update({ is_active: false }).eq('user_id', userId);
      res = await supabase.from('diet_plans').insert({ ...row, created_by: user.id }).select().single();
    }
    setBusy(false);
    if (res.error) return show(res.error.message, 'bad');
    setPlan(res.data); show('Plan saved'); onSaved && onSaved(res.data);
  };

  const saveAsTemplate = async () => {
    const title = prompt('Template name', plan.title); if (!title) return;
    const { error } = await supabase.from('diet_plans').insert({ title, slots: plan.slots, guidelines: plan.guidelines, notes: plan.notes, is_template: true, user_id: null, created_by: user.id });
    show(error ? error.message : 'Saved as template', error ? 'bad' : 'ok');
  };

  return (
    <div className="plan-editor">
      {toast}
      <Card>
        <div className="row gap wrap">
          <label className="grow">Plan title<input value={plan.title} onChange={(e) => setPlan({ ...plan, title: e.target.value })} /></label>
          {userId && templates.length > 0 && (
            <label>Start from template
              <select value="" onChange={(e) => useTemplate(e.target.value)}><option value="">Choose…</option>{templates.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}</select>
            </label>
          )}
        </div>
        <label>Notes for the client<textarea rows={2} value={plan.notes || ''} onChange={(e) => setPlan({ ...plan, notes: e.target.value })} /></label>
      </Card>

      <div className="plan-grid">
        {plan.slots.map((s, i) => (
          <Card key={s.key + i} className="plan-slot edit">
            <div className="row gap">
              <input className="slot-label-input" value={s.label} onChange={(e) => setSlot(i, 'label', e.target.value)} />
              <button className="icon-btn sm" onClick={() => setPlan({ ...plan, slots: plan.slots.filter((_, j) => j !== i) })} aria-label="Remove slot"><Trash2 size={14} /></button>
            </div>
            <label>Heading<input value={s.title || ''} onChange={(e) => setSlot(i, 'title', e.target.value)} placeholder="e.g. High-protein breakfast" /></label>
            <label>Options (one per line)<textarea rows={4} value={lines(s.items)} onChange={(e) => setSlot(i, 'items', split(e.target.value))} /></label>
            <label className="avoid-label">Avoid (one per line)<textarea rows={2} value={lines(s.avoid)} onChange={(e) => setSlot(i, 'avoid', split(e.target.value))} /></label>
          </Card>
        ))}
      </div>
      <button className="btn btn-ghost" onClick={() => setPlan({ ...plan, slots: [...plan.slots, { key: `custom_${Date.now()}`, label: 'New slot', title: '', items: [], avoid: [] }] })}><Plus size={16} /> Add slot</button>

      <Card title="Guidelines (one per line)">
        <textarea rows={5} value={lines(plan.guidelines)} onChange={(e) => setPlan({ ...plan, guidelines: split(e.target.value) })} />
      </Card>

      <div className="sticky-actions">
        <button className="btn btn-primary" disabled={busy} onClick={() => save(false)}>{busy ? <Spinner /> : <><Save size={16} /> Save plan</>}</button>
        {userId && plan.id && <button className="btn btn-soft" disabled={busy} onClick={() => save(true)}>Save as new version</button>}
        {userId && <button className="btn btn-ghost" onClick={saveAsTemplate}><Copy size={16} /> Save as template</button>}
      </div>
    </div>
  );
}
