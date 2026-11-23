import { Link } from 'react-router-dom';
import { SITES as MEASURE_SITES } from '../lib/measure';
import { cheer } from '../lib/cheer';
import { useEffect, useRef, useState } from 'react';
import { Sparkles, X, Send, Camera, ImagePlus, Check, Trash2 } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { uploadMedia, toBase64 } from '../lib/media';
import { askChat, saveAction, notifyDataChanged, actionAllowed } from '../lib/chatLog';
import { SLOTS, HABITS, SUPPLEMENTS, DAY_LABELS, slotLabel } from '../lib/constants';
import { today, addDays, fmt } from '../lib/dates';
import { useAiQuota, aiUsed } from '../lib/aiQuota';
import { SignedImg, Spinner } from './ui';

const EXAMPLES = [
  'Lunch: 2 roti, dal, salad and sabzi',
  'Weighed 88.7 this morning',
  '30 min incline walk at 8, then 3×12 leg press at 60 kg',
  'Drank 3 glasses of water and had my whey',
];
const ICON = { meal: '🍛', weight: '⚖️', water: '💧', habit: '✅', supplement: '💊', workout: '🏋️', period: '🩸', measure: '📏' };
const dayName = (d) => (!d || d === today() ? 'Today' : d === addDays(today(), -1) ? 'Yesterday' : fmt(d));
const uid = () => Math.random().toString(36).slice(2, 10);

/** Floating "log by chat" assistant for clients. Turns text/photos into entries; nothing is saved until the user taps Save. */
export default function ChatLog() {
  const { user, has } = useAuth();
  const key = `ft_chat_${user.id}`;
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState(() => { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; } });
  const [text, setText] = useState('');
  const [img, setImg] = useState(null); // { file, url }
  const [busy, setBusy] = useState(false);
  const listRef = useRef(null);
  const [quota] = useAiQuota();
  const out = quota && !quota.unlimited && quota.remaining <= 0;
  const cam = useRef(null);
  const gal = useRef(null);

  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(msgs.slice(-40))); } catch { /* storage full or blocked */ } }, [msgs, key]);
  useEffect(() => { if (open) listRef.current?.scrollTo(0, listRef.current.scrollHeight); }, [msgs, open, busy]);
  useEffect(() => { document.body.classList.toggle('chat-open', open); return () => document.body.classList.remove('chat-open'); }, [open]);

  if (!has('ai')) return null;

  const pick = (e) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (f) setImg({ file: f, url: URL.createObjectURL(f) });
  };

  const send = async (override, photoOverride) => {
    const body = (override ?? text).trim();
    const img0 = photoOverride !== undefined ? photoOverride : img;
    if ((!body && !img0) || busy || out) return;
    const mine = { id: uid(), role: 'user', text: body, at: Date.now() };
    const history = msgs.filter((m) => m.text).slice(-8);
    setMsgs((m) => [...m, { ...mine, localImg: img0?.url }]);
    setText(''); setBusy(true);
    const photo = img0; setImg(null);
    try {
      let image, mime, photoPath;
      if (photo) {
        const up = await uploadMedia(user.id, 'meals', photo.file);
        photoPath = up.path; image = await toBase64(up.file); mime = up.file.type;
        setMsgs((m) => m.map((x) => (x.id === mine.id ? { ...x, photo: photoPath, localImg: undefined } : x)));
      }
      const r = await askChat({ userId: user.id, text: body, image, mime, history });
      const allowed = (r.actions || []).filter((a) => actionAllowed(a, has));
      const dropped = (r.actions || []).length - allowed.length;
      setMsgs((m) => [...m, {
        id: uid(), role: 'ai', at: Date.now(), photoPath,
        text: r.reply + (dropped ? ' (Some of this isn’t switched on for your plan, so I left it out.)' : ''),
        actions: allowed.map((a) => ({ ...a, _id: uid(), _status: 'pending' })),
      }]);
    } catch (e) {
      const id = uid();
      const final = !!e.code; // off topic / daily limit / not on plan: say why, no retry
      if (!final) retries.current[id] = { body, photo, userMsg: mine.id };
      setMsgs((m) => [...m, { id, role: 'ai', at: Date.now(), error: true, retry: !final, text: final ? e.message : `Couldn’t read that: ${e.message}` }]);
    }
    setBusy(false); aiUsed();
  };
  // Resend a failed message (same text and photo). Kept in memory only, so it works until the page is reloaded.
  const retries = useRef({});
  const retry = (m) => {
    const r = retries.current[m.id];
    setMsgs((all) => all.filter((x) => x.id !== m.id && x.id !== r?.userMsg));
    if (r) send(r.body, r.photo || null);
  };

  const patch = (msgId, actId, changes) =>
    setMsgs((m) => m.map((x) => (x.id !== msgId ? x : { ...x, actions: x.actions.map((a) => (a._id === actId ? { ...a, ...changes } : a)) })));

  const save = async (msg, a) => {
    patch(msg.id, a._id, { _status: 'saving', _msg: '' });
    try {
      const done = await saveAction(user.id, a, msg.photoPath);
      patch(msg.id, a._id, { _status: 'saved', _msg: done });
      notifyDataChanged();
      cheer(a.type === 'meal' && a.plan_check === 'on_plan' ? 'on_plan' : a.type === 'workout' ? 'workout' : a.type === 'weight' ? 'weight' : a.type === 'period' ? 'period' : a.type === 'measure' ? 'measure' : 'chat');
    } catch (e) {
      patch(msg.id, a._id, { _status: 'pending', _msg: e.message });
    }
  };
  const saveAll = async (msg) => { for (const a of msg.actions.filter((x) => x._status === 'pending')) await save(msg, a); };

  return (
    <>
      {!open && (
        <button className="chat-fab" onClick={() => setOpen(true)} aria-label="Log with AI chat">
          <Sparkles size={20} /><span>Log by chat</span>
        </button>
      )}
      {open && (
        <div className="chat-panel" role="dialog" aria-label="Log by chat">
          <div className="chat-head">
            <div><b>✨ Log by chat</b><small>Type or snap it. I’ll log it after you check.</small></div>
            {msgs.length > 0 && <button className="icon-btn sm" onClick={() => confirm('Clear this chat? Saved entries stay saved.') && setMsgs([])} aria-label="Clear chat"><Trash2 size={16} /></button>}
            <button className="icon-btn" onClick={() => setOpen(false)} aria-label="Close"><X size={20} /></button>
          </div>

          <div className="chat-list" ref={listRef}>
            {msgs.length === 0 && (
              <div className="chat-empty">
                <p>Tell me what you ate, weighed, drank or did at the gym, in your own words. Or add a photo of your plate or scale.</p>
                <div className="chat-examples">{EXAMPLES.map((e) => <button key={e} className="chip" onClick={() => send(e)}>{e}</button>)}</div>
                <p className="small muted chat-legal">Your message and photo go to our AI provider to make log cards. Nothing is logged until you tap Save. The text of your chat is kept 30 days for quality checks; photos aren’t kept. Only questions about your Fitoor tracking get an answer. <Link to="/privacy#ai">How we use AI</Link></p>
              </div>
            )}
            {msgs.map((m) => (
              <div key={m.id} className={`chat-msg ${m.role} ${m.error ? 'err' : ''}`}>
                {(m.photo || m.localImg) && (m.localImg ? <img className="chat-photo" src={m.localImg} alt="" /> : <SignedImg path={m.photo} className="chat-photo" />)}
                {m.text && <p>{m.text}</p>}
                {m.error && m.retry && retries.current[m.id] && <button type="button" className="btn btn-pop btn-sm" disabled={busy} onClick={() => retry(m)}>↻ Try again</button>}
                {m.actions?.length > 0 && (
                  <div className="chat-actions">
                    {m.actions.map((a) => <ActionCard key={a._id} a={a} onChange={(c) => patch(m.id, a._id, c)} onSave={() => save(m, a)} onSkip={() => patch(m.id, a._id, { _status: 'skipped' })} />)}
                    {m.actions.filter((a) => a._status === 'pending').length > 1 && (
                      <button className="btn btn-primary btn-sm" onClick={() => saveAll(m)}><Check size={15} /> Save all</button>
                    )}
                  </div>
                )}
              </div>
            ))}
            {busy && <div className="chat-msg ai"><p><Spinner size={14} /> Reading that…</p></div>}
          </div>

          {quota && !quota.unlimited && (
            <div className={`chat-quota ${out ? 'out' : ''}`}>
              {out ? <>You’ve used all {quota.limit} AI chats for today on {quota.tier_name}. They reset at midnight. <Link to="/app/profile">Get more</Link></> : `${quota.remaining} of ${quota.limit} AI chats left today`}
            </div>
          )}
          <form className="chat-input" onSubmit={(e) => { e.preventDefault(); send(); }}>
            {img && (
              <div className="chat-attach"><img src={img.url} alt="" /><button type="button" className="icon-btn sm" onClick={() => setImg(null)} aria-label="Remove photo"><X size={14} /></button></div>
            )}
            <div className="chat-row">
              <button type="button" className="icon-btn" onClick={() => cam.current.click()} aria-label="Take photo"><Camera size={19} /></button>
              <button type="button" className="icon-btn" onClick={() => gal.current.click()} aria-label="Add photo from gallery"><ImagePlus size={19} /></button>
              <textarea rows={1} value={text} placeholder="What did you eat or do?" onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
              <button className="icon-btn send" disabled={busy || (!text.trim() && !img)} aria-label="Send"><Send size={18} /></button>
            </div>
            <input ref={cam} type="file" accept="image/*" capture="environment" hidden onChange={pick} />
            <input ref={gal} type="file" accept="image/*" hidden onChange={pick} />
          </form>
        </div>
      )}
    </>
  );
}

function ActionCard({ a, onChange, onSave, onSkip }) {
  const done = a._status === 'saved', skipped = a._status === 'skipped', saving = a._status === 'saving';
  const locked = done || skipped || saving;
  const num = (k, label, step = 'any') => (
    <label>{label}<input type="number" inputMode="decimal" step={step} value={a[k] ?? ''} disabled={locked} onChange={(e) => onChange({ [k]: e.target.value })} /></label>
  );
  let title = '', body = null;
  if (a.type === 'meal') {
    title = `${slotLabel(a.slot) || 'Meal'}`;
    body = (<>
      <label className="full">What<input value={a.description || ''} disabled={locked} onChange={(e) => onChange({ description: e.target.value })} /></label>
      <label>Slot<select value={a.slot || 'other'} disabled={locked} onChange={(e) => onChange({ slot: e.target.value })}>{SLOTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select></label>
      {num('kcal', 'kcal', '1')}{num('protein_g', 'Protein g', '1')}{num('carbs_g', 'Carbs g', '1')}{num('fat_g', 'Fat g', '1')}
      {a.plan_note && <small className={`ai-note ${a.plan_check} full`}><Sparkles size={12} /> {a.plan_note}</small>}
      {a.uses_photo && <small className="muted full">📷 Photo will be attached</small>}
    </>);
  } else if (a.type === 'weight') {
    title = 'Weight';
    body = <>{num('weight_kg', 'kg', '0.1')}{num('waist_cm', 'Waist cm', '0.5')}</>;
  } else if (a.type === 'measure') {
    title = 'Measurements (inches)';
    body = <>{MEASURE_SITES.filter((s) => a[s.key] != null).map((s) => <span key={s.key}>{num(s.key, s.label, '0.25')}</span>)}</>;
  } else if (a.type === 'water') {
    title = 'Water';
    body = <>{num('glasses', 'Glasses', '1')}</>;
  } else if (a.type === 'habit') {
    title = HABITS.find((h) => h.key === a.key)?.label || 'Habit';
  } else if (a.type === 'period') {
    title = a.event === 'end' ? 'Period ended' : 'Period started';
  } else if (a.type === 'supplement') {
    title = SUPPLEMENTS.find((s) => s.key === a.key)?.label || 'Supplement';
  } else if (a.type === 'workout') {
    title = `Workout${a.day_label ? ` · ${a.day_label}` : ''}`;
    body = (<>
      <label>Day<select value={a.day_label || ''} disabled={locked} onChange={(e) => onChange({ day_label: e.target.value || null })}><option value="">—</option>{DAY_LABELS.map((d) => <option key={d}>{d}</option>)}</select></label>
      {num('duration_min', 'Minutes', '1')}
      <ul className="chat-ex full">
        {(a.exercises || []).map((e, i) => (
          <li key={i}><b>{e.name}</b> {(e.sets || []).map((s) => [s.reps && `${s.reps} reps`, s.weight_kg && `${s.weight_kg} kg`, s.duration_min && `${s.duration_min} min`, s.incline && `incline ${s.incline}`, s.distance_km && `${s.distance_km} km`].filter(Boolean).join(' · ')).filter(Boolean).join(' / ')}</li>
        ))}
      </ul>
    </>);
  }
  return (
    <div className={`chat-card ${a._status}`}>
      <div className="chat-card-head"><span aria-hidden>{ICON[a.type]}</span><b>{title}</b><span className="chat-day">{dayName(a.date)}</span></div>
      {body && <div className="chat-fields">{body}</div>}
      {a._msg && <p className={`small ${done ? 'ok-text' : 'error'}`}>{a._msg}</p>}
      {!done && !skipped && (
        <div className="row gap">
          <button className="btn btn-pop btn-sm" disabled={saving} onClick={onSave}>{saving ? <Spinner size={14} /> : <Check size={15} />} Save</button>
          <button className="btn btn-ghost btn-sm" disabled={saving} onClick={onSkip}>Skip</button>
        </div>
      )}
      {skipped && <p className="small muted">Skipped</p>}
    </div>
  );
}
