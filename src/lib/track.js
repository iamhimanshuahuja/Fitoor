import { supabase, rememberMe } from './supabase';

const SEEN = 'ft_session_logged';
const once = () => { try { if (sessionStorage.getItem(SEEN)) return false; sessionStorage.setItem(SEEN, '1'); return true; } catch { return false; } };

/** Record a sign-in event (server adds IP, approximate location and device). Never throws. */
export async function trackLogin(event) {
  try { await supabase.functions.invoke('track', { body: { event, remember: rememberMe() } }); } catch { /* logging is best effort */ }
}
/** Call right after a password login / signup so the app-open event below isn't logged twice. */
export function markSessionLogged() { once(); }
/** Once per browser session: log that a saved session was reopened (e.g. "kept signed in" users coming back). */
export function trackResume() { if (once()) trackLogin('session_resume'); }
export function clearSessionMark() { try { sessionStorage.removeItem(SEEN); } catch { /* ignore */ } }
