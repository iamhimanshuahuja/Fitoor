import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAiQuota, useTiers, inr } from '../lib/aiQuota';
import { cheer } from '../lib/cheer';
import { Card } from './ui';

/** Super admin: one person's AI plan + custom offer (client or coach). */
export default function TierEditor({ profile, onSaved, compact = false }) {
  const [tiers] = useTiers();
  const [q, reloadQ] = useAiQuota(profile.id);
  const blank = (p) => ({ tier: p.tier || 'free', tier_until: p.tier_until || '', ai_chat_limit: p.ai_chat_limit ?? '', ai_ask: p.ai_ask == null ? '' : String(p.ai_ask), tier_price: p.tier_price ?? '', tier_note: p.tier_note || '' });
  const [f, setF] = useState(blank(profile));
  const [busy, setBusy] = useState(false);
  useEffect(() => setF(blank(profile)), [profile]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async (extra = {}) => {
    setBusy(true);
    const { error } = await supabase.from('profiles').update({
      tier: f.tier, tier_until: f.tier_until || null, ai_chat_limit: f.ai_chat_limit === '' ? null : Number(f.ai_chat_limit),
      ai_ask: f.ai_ask === '' ? null : f.ai_ask === 'true', tier_price: f.tier_price === '' ? null : Number(f.tier_price), tier_note: f.tier_note.trim() || null,
      ...extra,
    }).eq('id', profile.id);
    setBusy(false);
    if (error) return cheer('error', error.message);
    cheer('saved'); reloadQ(); onSaved?.();
  };
  const t = tiers?.find((x) => x.key === f.tier);
  const body = (
    <div className="tier-editor">
      {profile.tier_requested && (
        <div className="tier-req">
          Asked for <b>{tiers?.find((x) => x.key === profile.tier_requested)?.name || profile.tier_requested}</b>
          <button type="button" className="btn btn-pop btn-sm" disabled={busy} onClick={() => { setF({ ...f, tier: profile.tier_requested }); save({ tier: profile.tier_requested, tier_requested: null, tier_requested_at: null }); }}>Approve</button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => save({ tier_requested: null, tier_requested_at: null })}>Dismiss</button>
        </div>
      )}
      <div className="grid-form">
        <label>Plan<select value={f.tier} onChange={set('tier')}>{(tiers || []).map((x) => <option key={x.key} value={x.key}>{x.name} · {inr(x.price_inr)}/mo · {x.chat_per_day}/day{x.can_ask ? ' + Ask AI' : ''}</option>)}</select></label>
        <label>Offer ends <span className="muted">(empty = no end)</span><input type="date" value={f.tier_until} onChange={set('tier_until')} /></label>
        <label>AI chats per day <span className="muted">(empty = plan’s {t?.chat_per_day ?? '–'})</span><input type="number" min="0" inputMode="numeric" value={f.ai_chat_limit} onChange={set('ai_chat_limit')} /></label>
        <label>Ask AI<select value={f.ai_ask} onChange={set('ai_ask')}><option value="">Plan default ({t?.can_ask ? 'on' : 'off'})</option><option value="true">On</option><option value="false">Off</option></select></label>
        <label>Agreed price ₹/month <span className="muted">(empty = list price)</span><input type="number" min="0" inputMode="numeric" value={f.tier_price} onChange={set('tier_price')} /></label>
        <label>Note<input value={f.tier_note} onChange={set('tier_note')} placeholder="e.g. Diwali offer, 3 months" maxLength={200} /></label>
      </div>
      <div className="row gap wrap">
        <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => save()}>Save plan</button>
        {q && !q.unlimited && <small className="muted">Today: {q.used}/{q.limit} AI chats{q.can_ask ? ' · Ask AI on' : ''}{q.expired ? ' · offer ended → Free' : ''}</small>}
      </div>
    </div>
  );
  return compact ? body : <Card title="AI plan & offer">{body}</Card>;
}
