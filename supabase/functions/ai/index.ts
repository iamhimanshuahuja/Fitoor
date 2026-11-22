// Fitoor AI function (Supabase Edge Function, Deno)
// Tasks: scale | meal | machine | lab | summary (coach) | chat (log-by-chat assistant, text and/or image)
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
 "breakdown": [{"item": string, "portion": string (e.g. "2 rotis", "1 katori ~150 g"), "kcal": number, "protein_g": number}],
 "confidence": "high"|"medium"|"low" (low if portions are hidden, the photo is unclear or it is mostly oil/gravy),
 "swap_tip": string (one lighter swap for next time, max 16 words, Indian foods, no shaming; "" if the plate is already balanced),
 "plan_check": "on_plan"|"partly"|"off_plan"|"unknown", "plan_note": string (max 20 words, friendly)}
The breakdown kcal must add up to the total kcal. Count visible oil/ghee, chutneys and drinks.
If the photo is not food, return items [] and kcal 0 with plan_note "No food found in this photo".
Estimates are approximate; never refuse — give your best estimate.`,

  machine: (b) => `This is a photo of gym equipment.
Identify the machine/equipment and suggest exercises done on it.
Prefer names from this library when they match: ${JSON.stringify((b.library || []).slice(0, 200))}.
Return JSON only:
{"machine": string, "how_to": string (max 25 words),
 "exercises": [{"name": string, "muscle_group": "chest"|"back"|"legs"|"shoulders"|"arms"|"core"|"full_body"|"cardio",
                "equipment": "barbell"|"dumbbell"|"machine"|"cable"|"bodyweight"|"cardio_machine"|"other"}] (1-4 items)}`,

  chat: (b) => `You are Fitoor's logging assistant inside an Indian diet & fitness app. The user writes casually (English or Hinglish) and may attach a photo.
Turn what they say into log entries. Today is ${b.today} (${b.weekday}), time now ${b.now}. "yesterday" = the day before today.
Meal slots (key: label, usual time): ${JSON.stringify(b.slots)}. Pick the slot from their words, else from the time of day.
Their diet plan per slot (title / avoid list): ${JSON.stringify(b.plan || {}).slice(0, 4000)}
Habit keys: ${JSON.stringify(b.habits)}. Supplement keys: ${JSON.stringify(b.supplements)}.
Day labels for workouts: ${JSON.stringify(b.day_labels)}. Prefer these exercise names when they match: ${JSON.stringify((b.library || []).slice(0, 200))}.
Recent chat (oldest first): ${JSON.stringify((b.history || []).slice(-8)).slice(0, 3000)}
User message: ${JSON.stringify(b.text || '')}
${b.image ? 'A photo is attached. If it is food, log it as a meal (uses_photo true). If it is a weighing scale, read the number as a weight (uses_photo true). If it is gym equipment, name it in the reply and suggest exercises; only log a workout if they gave sets/time.' : ''}
Rules:
- Only log what they actually said or showed. Never invent foods, sets or numbers. Indian portions (1 roti ~ 100 kcal, 1 katori dal ~ 150 kcal).
- Meals: estimate kcal / protein / carbs / fat. Plan check uses the coach's rules: plate ~50% veg, 25% protein, 25% whole grains; flag high-GI/refined foods (poha, rava upma, idli, white rice, bread, biscuits, namkeen, bakery, paratha) and acidic items (milk tea/coffee, sugar/jaggery, fried snacks, alcohol), and anything on that slot's avoid list.
- Water: count glasses (1 glass = 250 ml; 1 L = 4 glasses).
- Body measurements: neck, chest, arm, waist, belly, hips, thigh, calf in INCHES. If they give cm, convert (÷2.54, 1 decimal). Include only the spots they gave. "Waist" alone with a weight → put it on the measure action, not waist_cm, unless they said cm with the weight.
- Periods: if they say their period/periods started or ended, log a period entry (event start or end). Never comment on fertility or pregnancy.
- If something important is missing or unclear (e.g. which day, a number), log what is clear and ask ONE short question in reply.
- If they only ask a question or chat, return no actions and answer briefly. No medical advice; for lab or health questions say to talk to their doctor or coach.
- reply: friendly, short (max 35 words), second person, can use one emoji.
Return JSON only:
{"reply": string,
 "actions": [
  {"type":"meal","date":"YYYY-MM-DD","slot":slot key,"description":string,"kcal":number,"protein_g":number,"carbs_g":number,"fat_g":number,"plan_check":"on_plan"|"partly"|"off_plan"|"unknown","plan_note":string (max 18 words),"uses_photo":boolean}
  | {"type":"weight","date":"YYYY-MM-DD","weight_kg":number,"waist_cm":number|null,"uses_photo":boolean}
  | {"type":"water","date":"YYYY-MM-DD","glasses":number}
  | {"type":"habit","date":"YYYY-MM-DD","key":habit key}
  | {"type":"supplement","date":"YYYY-MM-DD","key":supplement key}
  | {"type":"period","date":"YYYY-MM-DD","event":"start"|"end"}
  | {"type":"measure","date":"YYYY-MM-DD","neck":number,"chest":number,"arm":number,"waist":number,"belly":number,"hips":number,"thigh":number,"calf":number} (inches; omit spots not given)
  | {"type":"workout","date":"YYYY-MM-DD","day_label":string|null,"duration_min":number|null,"notes":string|null,
     "exercises":[{"name":string,"kind":"strength"|"cardio"|"mobility","muscle_group":"chest"|"back"|"legs"|"shoulders"|"arms"|"core"|"full_body"|"cardio","equipment":"barbell"|"dumbbell"|"machine"|"cable"|"bodyweight"|"cardio_machine"|"other",
       "sets":[{"reps":number|null,"weight_kg":number|null,"duration_min":number|null,"incline":number|null,"distance_km":number|null}]}]}
 ]}`,
  summary: (b) => `You are helping a diet & fitness coach in India review one client's last 7 days.
Client data (JSON): ${JSON.stringify(b.data).slice(0, 30000)}
Write a short, warm, specific review the coach can send. Vegetarian-friendly Indian food suggestions only.
Do not give medical advice or diagnose; for lab values say "discuss with your doctor".
Meals with "cheat": true are planned, guilt-free treats agreed with the coach: never list them under "watch" or criticise them; at most mention kindly that a treat was enjoyed. Judge plan adherence on the other meals only.
Never comment on body size; praise effort and consistency.
Return JSON only:
{"headline": string (max 12 words), "wins": [string] (2-4), "watch": [string] (1-3), "suggestions": [string] (2-4),
 "message_to_client": string (60-110 words, friendly, second person)}`,

  ask: (b) => `You are Fitoor's assistant in an Indian diet & fitness coaching app. ${b.about === 'client'
    ? 'A coach is asking about one of their clients. Answer the coach directly and practically.'
    : 'The user is asking about their own logs. Answer them directly, warmly, in second person.'}
Data (JSON, most recent first, may be partial): ${JSON.stringify(b.data || {}).slice(0, 40000)}
Question: ${String(b.question || '').slice(0, 600)}
Rules: base the answer on the data; say plainly when the data doesn't show something. Use numbers from the data where useful.
Keep it short (max ~150 words), plain sentences or a few bullet lines. Indian, vegetarian-friendly food ideas only if asked for food.
Never diagnose or give medical advice; for symptoms, medicines or lab values say to discuss with their doctor. Never comment on body size.
Cheat meals are planned treats agreed with the coach; don't criticise them.
Return JSON only: {"answer": string, "follow_ups": [string] (0-3 short follow-up questions they might ask next)}`,

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
  const [{ data: prof }, { data: feats }, { data: quota }] = await Promise.all([
    sb.from('profiles').select('role').eq('id', u.user.id).single(),
    sb.rpc('my_features'),
    sb.rpc('ai_quota'),
  ]);
  const staff = ['coach', 'super_admin'].includes(prof?.role);
  if (!staff && !(feats || []).includes('ai')) return json({ error: 'AI features are not enabled on your plan' }, 403);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  const task = body.task as string;
  if (!PROMPTS[task]) return json({ error: `Unknown task "${task}"` }, 400);
  const TEXT_ONLY = ['summary', 'chat', 'ask'];
  // Daily AI allowance by pricing tier (chat logs + Ask AI). Super admin is unlimited; coaches have the same tiers as clients.
  if (task === 'chat' || task === 'ask') {
    if (task === 'ask' && quota && !quota.can_ask) return json({ error: 'Ask AI is part of the Pro plan. Ask us to upgrade from Me → Plan.', code: 'upgrade' }, 403);
    if (task === 'ask' && !String(body.question || '').trim()) return json({ error: 'Type a question' }, 400);
    if (quota && !quota.unlimited && quota.remaining <= 0) {
      return json({ error: `You’ve used all ${quota.limit} AI chats for today on ${quota.tier_name}. It resets at midnight, or upgrade for more from Me → Plan.`, code: 'limit', quota }, 429);
    }
  }
  const data = body.image || body.file;
  if (!data && !TEXT_ONLY.includes(task)) return json({ error: 'No image/file provided' }, 400);
  if (data && data.length > 6_000_000) return json({ error: 'File too large (max ~4 MB)' }, 413);
  if (task === 'summary' && !staff) return json({ error: 'Coach only' }, 403);
  if (task === 'chat' && !data && !String(body.text || '').trim()) return json({ error: 'Type something or add a photo' }, 400);

  // Usage log (activity_logs is read-only for clients; written here with the service role)
  const t0 = Date.now();
  const logUse = async (ok: boolean, extra: Record<string, unknown> = {}) => {
    try {
      const svc = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (!svc) return;
      await createClient(Deno.env.get('SUPABASE_URL')!, svc, { auth: { persistSession: false } }).from('activity_logs').insert({
        user_id: u.user.id, actor_id: u.user.id, action: `ai_${task}`,
        detail: { ok, ms: Date.now() - t0, photo: !!data || undefined, ...extra },
      });
    } catch { /* logging must never break the AI call */ }
  };

  try {
    const text = await callAI(PROMPTS[task]({ ...body, image: !!data }), data ? { data, mime: body.mime || 'image/webp' } : null);
    if (task === 'lab') {
      const result = parseLab(text);
      if (!result.results.length) { await logUse(false, { reason: 'no results' }); return json({ error: 'Could not read any test results from this file' }, 422); }
      await logUse(true, { tests: result.results.length });
      return json({ result });
    }
    const result = parseJSON(text);
    if (task === 'chat') {
      const actions = Array.isArray(result?.actions) ? result.actions.slice(0, 12) : [];
      await logUse(true, { actions: actions.map((a: any) => a?.type).filter(Boolean) });
      return json({ result: { reply: String(result?.reply || ''), actions } });
    }
    if (task === 'ask') {
      await logUse(true, { about: body.about === 'client' ? 'client' : 'self' });
      return json({ result: { answer: String(result?.answer || ''), follow_ups: Array.isArray(result?.follow_ups) ? result.follow_ups.slice(0, 3).map(String) : [] } });
    }
    await logUse(true);
    return json({ result });
  } catch (e) {
    console.error(task, e);
    await logUse(false, { error: String((e as Error).message).slice(0, 120) });
    return json({ error: `AI failed: ${(e as Error).message}` }, 502);
  }
});
