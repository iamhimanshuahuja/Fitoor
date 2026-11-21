import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';

/** Super admin only: every staff account (coaches + super admins). Coaches get an empty list (RLS hides others). */
export function useCoaches(enabled = true) {
  const [coaches, setCoaches] = useState([]);
  const load = useCallback(async () => {
    if (!enabled) return;
    const { data } = await supabase.from('profiles').select('id, full_name, email, role, coach_code, active, created_at')
      .in('role', ['coach', 'super_admin']).order('full_name');
    setCoaches(data || []);
  }, [enabled]);
  useEffect(() => { load(); }, [load]);
  return [coaches, load];
}

export const signupLink = (code) => `${location.origin}/signup${code ? `?coach=${encodeURIComponent(code)}` : ''}`;

/** e.g. "Riya Sharma" → "RIYA" + 2 random digits */
export function makeCoachCode(name, email) {
  const base = (String(name || '').trim().split(/\s+/)[0] || String(email || '').split('@')[0] || 'COACH')
    .replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 6) || 'COACH';
  return base + String(Math.floor(Math.random() * 90) + 10);
}
