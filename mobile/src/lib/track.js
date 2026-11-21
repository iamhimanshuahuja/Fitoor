import { supabase } from './supabase';
/** Sign-in log (server adds IP, approximate place and device). Best effort, never throws. */
export async function trackLogin(event) {
  try { await supabase.functions.invoke('track', { body: { event, remember: true, app: 'mobile' } }); } catch { /* ignore */ }
}
