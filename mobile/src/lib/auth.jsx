import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { supabase, isConfigured } from './supabase';
import { trackLogin } from './track';

const AuthCtx = createContext(null);

/** Same model as the web app: session + profile + effective features. Staff (coach / super_admin) get every feature. */
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [features, setFeatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState(null);

  const loadProfile = useCallback(async (s) => {
    if (!s) { setProfile(null); setFeatures([]); setProfileError(null); return; }
    const [{ data: p, error: e1 }, { data: f, error: e2 }] = await Promise.all([
      supabase.from('profiles').select('*, plans(name)').eq('id', s.user.id).maybeSingle(),
      supabase.rpc('my_features'),
    ]);
    setProfileError(e1?.message || e2?.message || (!p ? 'Profile not found' : null));
    if (p) setProfile(p);
    if (f) setFeatures(f);
  }, []);

  useEffect(() => {
    if (!isConfigured) { setLoading(false); return; }
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await loadProfile(data.session);
      setLoading(false);
      if (data.session) trackLogin('session_resume');
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setTimeout(() => loadProfile(s), 0);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  // Coach may change plan/features: refresh when the app comes back to the foreground.
  useEffect(() => {
    const s = AppState.addEventListener('change', (st) => { if (st === 'active' && session) loadProfile(session); });
    return () => s.remove();
  }, [session, loadProfile]);

  const role = profile?.role || 'user';
  const isSuper = role === 'super_admin';
  const isCoach = role === 'coach';
  const isAdmin = isSuper || isCoach || role === 'admin';
  const value = {
    session, user: session?.user || null, profile, features, loading, profileError, role, isSuper, isCoach, isAdmin,
    has: (k) => isAdmin || features.includes(k),
    refresh: () => loadProfile(session),
    signOut: () => supabase.auth.signOut(),
  };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
