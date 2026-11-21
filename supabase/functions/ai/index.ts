// Fitoor AI function (Supabase Edge Function, Deno)
// Deploy:  supabase functions deploy ai
// Secrets: supabase secrets set AI_PROVIDER=anthropic AI_API_KEY=... [AI_MODEL=...] [AI_BASE_URL=...]
//
// Tasks: scale | meal | machine | lab — all return strict JSON in { result }.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const PROVIDER = (Deno.env.get('AI_PROVIDER') || 'anthropic').toLowerCase();
const KEY = Deno.env.get('AI_API_KEY') || '';
const DEFAULT_MODEL: Record<string, string> = {
  anthropic: 'claude-sonnet-5-5',
  openai: 'gpt-4o-mini',
  gemini: 'gemini-2.5-flash',
};
const MODEL = Deno.env.get('AI_MODEL') || DEFAULT_MODEL[PROVIDER];
// Optional: route through a proxy / gateway (e.g. an Anthropic-compatible LLM gateway)
const BASE_URL = (Deno.env.get('AI_BASE_URL') || '').replace(/\/$/, '');

// ---------------------------------------------------------------- prompts
const PROMPTS: Record<string, (b: any) => string> = {
  scale: () => `This is a photo of a body weighing scale display.
Read the weight shown. Return JSON only: {"weight_kg": number|null, "confidence": "high"|"medium"|"low"}.
If the display shows lb, convert to kg (1 lb = 0.4536 kg). If unreadable, weight_kg = null.`,

  meal: (b) => `You are a nutrition assistant for an Indian vegetarian-friendly diet app.
Meal slot: ${b.slot || 'unknown'}. User note: ${b.note || 'none'}.
${b.plan ? `The client's plan for this slot — recommended: ${JSON.stringify(b.plan.items)}; avoid: ${JSON.stringify(b.plan.avoid)}.` : 'No plan given.'}
Identify the foods in the photo (use Indian dish names where apt), estimate portion and nutrition.
Coach's general rules: plate should be ~50% vegetables/salad, 25% protein, 25% whole grains.
Flag (plan_check "partly" or "off_plan", and say why in plan_note) high-GI / refined foods, especially at breakfast:
poha, rava upma, idli, white rice, white-rice dosa, bread, cornflakes/wheat flakes, paratha, biscuits, namkeen, bakery;
and acidic / inflammatory items: milk tea or coffee, sugar / jaggery / honey, heavy dairy, alcohol, fried snacks.
Return JSON only:
{"items": [string], "portion_note": string, "kcal": number, "protein_g": number, "carbs_g": number, "fat_g": number,
 "plan_check": "on_plan"|"partly"|"off_plan"|"unknown", "plan_note": string (max 20 words, friendly)}
Estimates are approximate; never refuse — give your best estimate.`,

  machine: (b) => `This is a photo of gym equipment.
Identify the machine/equipment and suggest exercises done on it.
Prefer names from this library when they match: ${JSON.stringify((b.library || []).slice(0, 200))}.
Return JSON only:
{"machine": string, "how_to": string (max 25 words),
 "exercises": [{"name": string, "muscle_group": "chest"|"back"|"legs"|"shoulders"|"arms"|"core"|"full_body"|"cardio",
                "equipment": "barbell"|"dumbbell"|"machine"|"cable"|"bodyweight"|"cardio_machine"|"other"}] (1-4 items)}`,

  summary: (b) => `You are helping a diet & fitness coach in India review one client's last 7 days.
Client data (JSON): ${JSON.stringify(b.data).slice(0, 30000)}
Write a short, warm, specific review the coach can send. Vegetarian-friendly Indian food suggestions only.
Do not give medical advice or diagnose; for lab values say "discuss with your doctor".
Return JSON only:
{"headline": string (max 12 words), "wins": [string] (2-4), "watch": [string] (1-3), "suggestions": [string] (2-4),
 "message_to_client": string (60-110 words, friendly, second person)}`,

  // Lab reports are long: a line-per-test format is far more robust than one big JSON blob.
  lab: (b) => `This is a medical laboratory report (blood test etc.). Extract EVERY test result.
Skip interpretation text, method names, comments and doctor notes.
Output PLAIN TEXT only, no markdown, in exactly this format:
DATE|<sample collection date as YYYY-MM-DD or empty>
LAB|<lab name or empty>
then one line per test:
R|<panel>|<test name>|<value>|<unit>|<ref low>|<ref high>|<reference as printed>
Rules: value is the number only (or the word, e.g. Nil, Negative, Pale Yellow). Leave ref low/high empty when not applicable.
For "< 200" put ref high 200; for "> 50" put ref low 50. Never use the | character inside a field.
${(b.known || []).length ? `This person's earlier reports used these test names. When a test is the same test, write the name EXACTLY as listed: ${JSON.stringify((b.known || []).slice(0, 300))}` : ''}`,
};

// ---------------------------------------------------------------- providers
type Attach = { data: string; mime: string };

async function callAI(prompt: string, att: Attach | null): Promise<string> {
  const isPdf = att?.mime === 'application/pdf';
  if (PROVIDER === 'anthropic') {
    const media = !att ? null : isPdf
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: att.data } }
      : { type: 'image', source: { type: 'base64', media_type: att.mime, data: att.data } };
    const r = await fetch(`${BASE_URL || 'https://api.anthropic.com'}/v1/messages`, {
      method: 'POST',
      headers: { 'x-api-key': KEY, Authorization: `Bearer ${KEY}`, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 16000, messages: [{ role: 'user', content: [...(media ? [media] : []), { type: 'text', text: prompt }] }] }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error?.message || `Anthropic ${r.status}`);
    return j.content?.map((c: any) => c.text || '').join('') || '';
  }
  if (PROVIDER === 'openai') {
    const url = att ? `data:${att.mime};base64,${att.data}` : '';
    const media = !att ? null : isPdf ? { type: 'file', file: { filename: 'report.pdf', file_data: url } } : { type: 'image_url', image_url: { url } };
    const r = await fetch(`${BASE_URL || 'https://api.openai.com/v1'}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, response_format: { type: 'json_object' }, messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, ...(media ? [media] : [])] }] }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error?.message || `OpenAI ${r.status}`);
    return j.choices?.[0]?.message?.content || '';
  }
  if (PROVIDER === 'gemini') {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, ...(att ? [{ inline_data: { mime_type: att.mime, data: att.data } }] : [])] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error?.message || `Gemini ${r.status}`);
    return j.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || '';
  }
  throw new Error(`Unknown AI_PROVIDER "${PROVIDER}"`);
}

function parseJSON(text: string) {
  const t = text.replace(/```json|```/g, '').trim();
  const s = t.indexOf('{'), e = t.lastIndexOf('}');
  const body = s >= 0 ? t.slice(s, e + 1) : t;
  try { return JSON.parse(body); } catch {
    // tolerate trailing commas / smart quotes
    return JSON.parse(body.replace(/,\s*([}\]])/g, '$1').replace(/[\u201C\u201D]/g, '"'));
  }
}

const num = (v: string) => { const n = Number(String(v ?? '').replace(/,/g, '').trim()); return v !== '' && v != null && !isNaN(n) ? n : null; };
function parseLab(text: string) {
  let report_date: string | null = null, lab_name: string | null = null;
  const results: any[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim().replace(/^[-*]\s*/, '');
    if (line.startsWith('DATE|')) { const d = line.slice(5).trim(); report_date = /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null; continue; }
    if (line.startsWith('LAB|')) { lab_name = line.slice(4).trim() || null; continue; }
    if (!line.startsWith('R|')) continue;
    const [, panel, test_name, value, unit, lo, hi, ref_text] = line.split('|').map((x) => (x ?? '').trim());
    if (!test_name) continue;
    const v = num(value), ref_low = num(lo), ref_high = num(hi);
    const flag = v == null ? null : ref_low != null && v < ref_low ? 'low' : ref_high != null && v > ref_high ? 'high' : 'normal';
    results.push({ panel: panel || null, test_name, value: v, value_text: v == null ? value || null : null, unit: unit || null, ref_low, ref_high, ref_text: ref_text || null, flag });
  }
  return { report_date, lab_name, results };
}

// ---------------------------------------------------------------- handler
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  if (!KEY) return json({ error: 'AI is not configured (set AI_API_KEY secret)' }, 500);

  // Caller must be signed in and have the 'ai' feature (admins always allowed)
  const auth = req.headers.get('Authorization') || '';
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
  const { data: u } = await sb.auth.getUser();
  if (!u?.user) return json({ error: 'Not signed in' }, 401);
  const [{ data: prof }, { data: feats }] = await Promise.all([
    sb.from('profiles').select('role').eq('id', u.user.id).single(),
    sb.rpc('my_features'),
  ]);
  if (prof?.role !== 'admin' && !(feats || []).includes('ai')) return json({ error: 'AI features are not enabled on your plan' }, 403);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  const task = body.task as string;
  if (!PROMPTS[task]) return json({ error: `Unknown task "${task}"` }, 400);
  const TEXT_ONLY = ['summary'];
  const data = body.image || body.file;
  if (!data && !TEXT_ONLY.includes(task)) return json({ error: 'No image/file provided' }, 400);
  if (data && data.length > 6_000_000) return json({ error: 'File too large (max ~4 MB)' }, 413);
  if (task === 'summary' && prof?.role !== 'admin') return json({ error: 'Coach only' }, 403);

  try {
    const text = await callAI(PROMPTS[task](body), data ? { data, mime: body.mime || 'image/webp' } : null);
    if (task === 'lab') {
      const result = parseLab(text);
      if (!result.results.length) return json({ error: 'Could not read any test results from this file' }, 422);
      return json({ result });
    }
    return json({ result: parseJSON(text) });
  } catch (e) {
    console.error(task, e);
    return json({ error: `AI failed: ${(e as Error).message}` }, 502);
  }
});
