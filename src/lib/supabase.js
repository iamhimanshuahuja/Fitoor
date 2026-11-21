import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isConfigured = Boolean(url && key && !url.includes('YOUR-PROJECT'));

/**
 * "Keep me signed in" (login page checkbox, on by default):
 *  - on  → session lives in localStorage and is refreshed automatically, so you stay signed in on this device.
 *  - off → session lives in sessionStorage and ends when the browser tab/window is closed.
 * The choice itself is stored in localStorage as ft_remember ('1' / '0').
 */
const REMEMBER_KEY = 'ft_remember';
const safe = (fn, fallback = null) => { try { return fn(); } catch { return fallback; } };
export const rememberMe = () => safe(() => localStorage.getItem(REMEMBER_KEY) !== '0', true);
export const setRememberMe = (on) => safe(() => localStorage.setItem(REMEMBER_KEY, on ? '1' : '0'));

const authStorage = {
  getItem: (k) => safe(() => sessionStorage.getItem(k)) ?? safe(() => localStorage.getItem(k)),
  setItem: (k, v) => {
    if (rememberMe()) { safe(() => localStorage.setItem(k, v)); safe(() => sessionStorage.removeItem(k)); }
    else { safe(() => sessionStorage.setItem(k, v)); safe(() => localStorage.removeItem(k)); }
  },
  removeItem: (k) => { safe(() => localStorage.removeItem(k)); safe(() => sessionStorage.removeItem(k)); },
};

export const supabase = createClient(url || 'http://localhost', key || 'missing', {
  auth: { persistSession: true, autoRefreshToken: true, storage: authStorage },
});
