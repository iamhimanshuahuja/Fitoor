import { supabase } from './supabase';
/** Calls the Supabase Edge Function "ai" — same tasks as the web app (meal, scale, machine, lab, chat, summary, ask). */
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
    let msg = error.message, code;
    try { const j = await error.context?.json?.(); if (j?.error) { msg = j.error; code = j.code; } } catch { /* ignore */ }
    const err = new Error(isNetworkError(msg) ? 'Connection dropped. Check your internet and tap Try again.' : msg);
    err.code = code; // 'off_topic' | 'limit' | 'upgrade' — retrying won't help for these
    throw err;
  }
  return data.result;
}
