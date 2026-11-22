import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';

/** Today's AI allowance: { tier, tier_name, limit, used, remaining, can_ask, until, unlimited } (null until loaded / before migration v15). */
export function useAiQuota(userId) {
  const [q, setQ] = useState(null);
  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('ai_quota', userId ? { p_uid: userId } : {});
    if (!error) setQ(data);
  }, [userId]);
  useEffect(() => {
    load();
    window.addEventListener('ft:ai-used', load);
    return () => window.removeEventListener('ft:ai-used', load);
  }, [load]);
  return [q, load];
}
export const aiUsed = () => window.dispatchEvent(new Event('ft:ai-used'));

export const quotaText = (q) => (!q ? '' : q.unlimited ? 'Unlimited AI' : `${q.remaining} of ${q.limit} AI chats left today`);

/** Ask to move to a paid plan; the super admin sees the request under Pricing. */
export async function requestTier(userId, tier) {
  return supabase.from('profiles').update({ tier_requested: tier, tier_requested_at: tier ? new Date().toISOString() : null }).eq('id', userId);
}

export function useTiers() {
  const [tiers, setTiers] = useState(null);
  const load = useCallback(() => supabase.from('ai_tiers').select('*').order('sort').then(({ data }) => setTiers(data || [])), []);
  useEffect(() => { load(); }, [load]);
  return [tiers, load];
}
export const inr = (n) => (Number(n) ? `₹${Number(n).toLocaleString('en-IN')}` : '₹0');
