import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Send, Lock } from 'lucide-react';
import { runAI } from '../lib/ai';
import { useAuth } from '../lib/auth';
import { buildAskData } from '../lib/askData';
import { useAiQuota, aiUsed, quotaText, requestTier } from '../lib/aiQuota';
import { Card, Spinner } from './ui';

const SELF = ['How was my protein this week?', 'Which lifts have improved most?', 'What should I fix in my diet first?', 'Am I on track for my goal weight?'];
const CLIENT = ['How did they do this week?', 'Where are they slipping on the plan?', 'Which lifts improved?', 'Anything in the labs to discuss with their doctor?'];

/**
 * Ask AI about logged data. about="self" (client asking about themselves) or "client" (coach asking about userId).
 * Needs Ask AI on the caller's plan (Pro, or a custom offer); each question counts toward the daily AI allowance.
 */
export default function AskAI({ userId, about = 'self', name }) {
  const { user, profile } = useAuth();
  const [quota] = useAiQuota();
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [thread, setThread] = useState([]); // [{q, a, follow_ups, error}]
  const [asked, setAsked] = useState(false);

  const ask = async (question) => {
    const text = (question ?? q).trim();
    if (!text || busy) return;
    setBusy(true); setQ('');
    try {
      const data = await buildAskData(userId);
      const r = await runAI('ask', { question: text, about, data, subject_id: about === 'client' ? userId : undefined });
      setThread((t) => [{ q: text, a: r.answer, follow_ups: r.follow_ups || [] }, ...t]);
    } catch (e) {
      setThread((t) => [{ q: text, error: e.message }, ...t]);
    }
    aiUsed();
    setBusy(false);
  };

  const title = about === 'client' ? `Ask AI about ${name?.split(' ')[0] || 'this client'}` : 'Ask AI about your progress';
  if (quota && !quota.can_ask) {
    const req = profile?.tier_requested;
    return (
      <Card title={<span className="row gap-sm"><Lock size={16} /> {title}</span>} className="ask-card locked">
        <p className="small">Ask anything about {about === 'client' ? 'your client’s' : 'your'} meals, workouts, weight and labs, and get an answer from {about === 'client' ? 'their' : 'your'} own logs. Part of the <b>Pro</b> plan.</p>
        {req ? <p className="small muted">Upgrade requested. We’ll switch it on soon.</p>
          : <button type="button" className="btn btn-pop btn-sm" disabled={asked} onClick={async () => { await requestTier(user.id, 'pro'); setAsked(true); }}>{asked ? 'Requested ✓' : 'Ask for Pro'}</button>}
        <Link to="/#pricing" className="small link-btn">See plans</Link>
      </Card>
    );
  }
  return (
    <Card title={<span className="row gap-sm"><Sparkles size={16} /> {title}</span>} action={quota && <small className="muted">{quotaText(quota)}</small>} className="ask-card">
      <form className="ask-form" onSubmit={(e) => { e.preventDefault(); ask(); }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={about === 'client' ? 'e.g. How was their protein this week?' : 'e.g. How was my protein this week?'} maxLength={500} aria-label="Your question" />
        <button className="btn btn-primary btn-sm" disabled={busy || !q.trim() || quota?.remaining === 0}>{busy ? <Spinner size={14} /> : <Send size={15} />}</button>
      </form>
      {!thread.length && <div className="chips-row">{(about === 'client' ? CLIENT : SELF).map((s) => <button key={s} type="button" className="chip" disabled={busy} onClick={() => ask(s)}>{s}</button>)}</div>}
      {quota?.remaining === 0 && <p className="small warn-text">You’ve used today’s AI chats. They reset at midnight.</p>}
      {thread.map((t, i) => (
        <div key={i} className="ask-item">
          <p className="ask-q">{t.q}</p>
          {t.error ? <p className="error small">{t.error}</p> : <p className="ask-a">{t.a}</p>}
          {i === 0 && t.follow_ups?.length > 0 && <div className="chips-row">{t.follow_ups.map((f) => <button key={f} type="button" className="chip" disabled={busy} onClick={() => ask(f)}>{f}</button>)}</div>}
        </div>
      ))}
      <p className="small muted">AI answers from {about === 'client' ? 'the client’s' : 'your'} logs and can be wrong. Not medical advice. Questions and answers are kept 30 days for quality checks.</p>
    </Card>
  );
}
