// Mobile copy of src/lib/aiQuota.js (uses the RN event emitter instead of window events).
import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { emit, on } from './events';

/** Today's AI allowance: { tier, tier_name, limit, used, remaining, can_ask, until, expired, unlimited } (null until loaded / before migration v15). */
export function useAiQuota(userId) {
  const [q, setQ] = useState(null);
  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('ai_quota', userId ? { p_uid: userId } : {});
    if (!error) setQ(data);
  }, [userId]);
  useEffect(() => { load(); return on('ai-used', load); }, [load]);
  return [q, load];
}
export const aiUsed = () => emit('ai-used');

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
