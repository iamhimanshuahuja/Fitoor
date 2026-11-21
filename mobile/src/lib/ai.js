import { supabase } from './supabase';
/** Calls the Supabase Edge Function "ai" — same tasks as the web app (meal, scale, machine, lab, chat, summary). */
export async function runAI(task, payload) {
  const { data, error } = await supabase.functions.invoke('ai', { body: { task, ...payload } });
  if (error) {
    let msg = error.message;
    try { const j = await error.context?.json?.(); if (j?.error) msg = j.error; } catch { /* ignore */ }
    throw new Error(msg);
  }
  return data.result;
}
