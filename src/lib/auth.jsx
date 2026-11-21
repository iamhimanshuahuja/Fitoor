import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase, isConfigured } from './supabase';
import { trackLogin, trackResume, clearSessionMark } from './track';

const AuthCtx = createContext(null);

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
      if (data.session) trackResume();
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setTimeout(() => loadProfile(s), 0); // avoid deadlock inside the auth callback
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  // Re-sync plan/features when the app comes back to the foreground (coach may have changed them)
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible' && session) loadProfile(session); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [session, loadProfile]);

  const value = {
    session, profile, features, loading, profileError,
    user: session?.user || null,
    isAdmin: profile?.role === 'admin',
    has: (f) => profile?.role === 'admin' || features.includes(f),
    refresh: () => loadProfile(session),
    signOut: async () => { await trackLogin('sign_out'); clearSessionMark(); return supabase.auth.signOut(); },
  };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
