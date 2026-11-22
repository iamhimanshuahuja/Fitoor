import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useAiQuota, useTiers, requestTier, inr } from '../lib/aiQuota';
import { fmt } from '../lib/dates';
import { Card } from './ui';

/** Your pricing plan: AI allowance today, offer end, and a request to upgrade (the super admin switches it on). */
export default function PlanCard() {
  const { user, profile, refresh } = useAuth();
  const [q] = useAiQuota();
  const [tiers] = useTiers();
  const [busy, setBusy] = useState(false);
  if (!q || !tiers) return null;
  if (q.unlimited) return <Card title="Your plan"><p><b>Super admin</b> · unlimited AI</p></Card>;
  const cur = tiers.find((t) => t.key === q.tier);
  const ask = async (key) => { setBusy(true); await requestTier(user.id, key); await refresh?.(); setBusy(false); };
  const pct = q.limit ? Math.min(100, Math.round((q.used / q.limit) * 100)) : 0;
  return (
    <Card title="Your plan" action={<Link to="/#pricing" className="small link-btn">Compare plans</Link>}>
      <p><b>{cur?.name || q.tier_name}</b>{cur?.price_inr ? ` · ${inr(profile?.tier_price ?? cur.price_inr)}/month` : ' · ₹0'}{q.until && !q.expired ? ` · until ${fmt(q.until)}` : ''}</p>
      {profile?.tier_note && <p className="small muted">{profile.tier_note}</p>}
      {q.expired && <p className="small warn-text">Your offer ended, so you’re back on Free. Ask us to renew it.</p>}
      <div className="quota-bar" role="progressbar" aria-valuemin={0} aria-valuemax={q.limit} aria-valuenow={q.used} aria-label="AI chats used today"><span style={{ width: `${pct}%` }} /></div>
      <p className="small">{q.used} of {q.limit} AI chats used today{q.can_ask ? ' · Ask AI included' : ''}. Resets at midnight.</p>
      <p className="small muted">Every Fitoor feature is included on every plan. Plans only change how much AI you get.</p>
      {profile?.tier_requested ? (
        <p className="small">Upgrade to <b>{tiers.find((t) => t.key === profile.tier_requested)?.name || profile.tier_requested}</b> requested. We’ll confirm payment and switch it on. <button type="button" className="link-btn" disabled={busy} onClick={() => ask(null)}>Cancel request</button></p>
      ) : (
        <div className="row gap wrap">
          {tiers.filter((t) => t.active && t.key !== q.tier && t.price_inr > (cur?.price_inr || 0)).map((t) => (
            <button key={t.key} type="button" className="btn btn-pop btn-sm" disabled={busy} onClick={() => ask(t.key)}>Get {t.name} · {inr(t.price_inr)}/mo</button>
          ))}
        </div>
      )}
    </Card>
  );
}
