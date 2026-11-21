import { useState } from 'react';
import { Sparkles, Send } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { runAI } from '../lib/ai';
import { addDays, today } from '../lib/dates';
import { Card, Spinner, useToast } from './ui';

/** Coach-only: AI drafts a 7-day review; the coach edits it and sends it as a note. */
export default function AiWeeklySummary({ userId, profile }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const [msg, setMsg] = useState('');
  const [toast, show] = useToast();

  const generate = async () => {
    setBusy(true); setRes(null);
    try {
      const since = addDays(today(), -6);
      const [m, w, wo, h, labs, plan] = await Promise.all([
        supabase.from('meal_logs').select('log_date, slot, description, followed, kcal, protein_g').eq('user_id', userId).gte('log_date', since).order('log_date'),
        supabase.from('weight_logs').select('log_date, weight_kg, waist_cm').eq('user_id', userId).order('log_date', { ascending: false }).limit(14),
        supabase.from('workouts').select('log_date, day_label, duration_min, workout_sets(reps, weight_kg, duration_min, exercises(name))').eq('user_id', userId).gte('log_date', since),
        supabase.from('habit_logs').select('log_date, habits, supplements').eq('user_id', userId).gte('log_date', since),
        supabase.from('lab_results').select('test_name, value, unit, flag').eq('user_id', userId).in('flag', ['high', 'low']).limit(30),
        supabase.from('diet_plans').select('title, guidelines').eq('user_id', userId).eq('is_active', true).maybeSingle(),
      ]);
      const data = {
        client: { name: profile?.full_name, goal: profile?.goal, start_weight: profile?.start_weight, target_weight: profile?.target_weight },
        plan: plan.data, meals: m.data, weights: w.data,
        workouts: (wo.data || []).map((x) => ({ date: x.log_date, day: x.day_label, mins: x.duration_min, exercises: [...new Set((x.workout_sets || []).map((s) => s.exercises?.name))] })),
        habits: h.data, flagged_labs: labs.data,
      };
      const r = await runAI('summary', { data });
      setRes(r); setMsg(r?.message_to_client || '');
    } catch (e) { show(e.message, 'bad'); }
    setBusy(false);
  };

  const send = async () => {
    const body = msg.trim(); if (!body) return;
    const { error } = await supabase.from('comments').insert({ user_id: userId, author_id: user.id, log_date: today(), context: 'general', body });
    show(error ? error.message : 'Sent to client', error ? 'bad' : 'ok');
    if (!error) setRes(null);
  };

  return (
    <Card title="Weekly check-in" action={
      <button className="btn btn-pop btn-sm" onClick={generate} disabled={busy}>{busy ? <Spinner size={14} /> : <Sparkles size={15} />} {res ? 'Regenerate' : 'Draft with AI'}</button>
    }>
      {toast}
      {!res && !busy && <p className="muted small">AI reads the last 7 days (meals, weight, workouts, habits, flagged lab values) and drafts a review. You edit it before anything is sent.</p>}
      {busy && <p className="muted small"><Spinner size={14} /> Reading the week…</p>}
      {res && (
        <div className="ai-summary">
          <h3>{res.headline}</h3>
          {res.wins?.length > 0 && <><h4>🏆 Wins</h4><ul>{res.wins.map((x) => <li key={x}>{x}</li>)}</ul></>}
          {res.watch?.length > 0 && <><h4>👀 Watch</h4><ul>{res.watch.map((x) => <li key={x}>{x}</li>)}</ul></>}
          {res.suggestions?.length > 0 && <><h4>💡 Suggestions</h4><ul>{res.suggestions.map((x) => <li key={x}>{x}</li>)}</ul></>}
          <label>Message to client (edit before sending)
            <textarea rows={5} value={msg} onChange={(e) => setMsg(e.target.value)} />
          </label>
          <button className="btn btn-primary" onClick={send}><Send size={15} /> Send as note</button>
        </div>
      )}
    </Card>
  );
}
