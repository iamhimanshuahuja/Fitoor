import { supabase } from './supabase';

/**
 * Calls the Supabase Edge Function "ai" (supabase/functions/ai).
 * tasks: 'scale' (weight from scale photo), 'meal' (items + calories + plan check),
 *        'machine' (gym machine → exercises), 'lab' (PDF/image → lab results)
 * payload: { image | file: base64 (no data: prefix), mime, ...task fields }
 */
export async function runAI(task, payload) {
  const { data, error } = await supabase.functions.invoke('ai', { body: { task, ...payload } });
  if (error) {
    // Try to surface the function's own error message
    let msg = error.message;
    try { const j = await error.context?.json?.(); if (j?.error) msg = j.error; } catch { /* ignore */ }
    throw new Error(msg);
  }
  return data.result;
}
