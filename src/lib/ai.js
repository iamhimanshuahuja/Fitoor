import { supabase } from './supabase';

/**
 * Calls the Supabase Edge Function "ai" (supabase/functions/ai).
 * tasks: 'scale' (weight from scale photo), 'meal' (items + calories + plan check),
 *        'machine' (gym machine → exercises), 'lab' (PDF/image → lab results)
 * payload: { image | file: base64 (no data: prefix), mime, ...task fields }
 */
const isNetworkError = (e) => /load failed|failed to fetch|networkerror|network request failed|fetch failed|timed out/i.test(String(e?.message || e));

export async function runAI(task, payload) {
  // Mobile data drops requests now and then ("Load failed" on iPhone): retry once before giving up.
  let res;
  for (let attempt = 0; attempt < 2; attempt++) {
    try { res = await supabase.functions.invoke('ai', { body: { task, ...payload } }); } catch (e) { res = { error: e }; }
    if (!res.error || !isNetworkError(res.error) || attempt === 1) break;
    await new Promise((r) => setTimeout(r, 1500));
  }
  const { data, error } = res;
  if (error) {
    // Try to surface the function's own error message
    let msg = error.message;
    try { const j = await error.context?.json?.(); if (j?.error) msg = j.error; } catch { /* ignore */ }
    throw new Error(isNetworkError(msg) ? 'Connection dropped. Check your internet and tap Try again.' : msg);
  }
  return data.result;
}
