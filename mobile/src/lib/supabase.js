import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
export const isConfigured = !!(url && key);
export const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL || 'https://fitoor.life';

// Same project, same public anon key as the website. RLS on the server decides what each person can see.
export const supabase = createClient(url || 'https://not-configured.supabase.co', key || 'missing-anon-key', {
  auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
});

// Refresh the session only while the app is in the foreground.
AppState.addEventListener('change', (s) => { if (s === 'active') supabase.auth.startAutoRefresh(); else supabase.auth.stopAutoRefresh(); });
