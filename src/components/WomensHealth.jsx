import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { today, fmt, fmtLong, daysAgo } from '../lib/dates';
import { PCOS, PREGNANCY, SYMPTOMS, FLOW, cycleStats, pregnancyWeek, needsCare } from '../lib/cycle';
import { Card, Empty, Spinner, Toggle, useToast } from './ui';

export function usePeriods(userId) {
  const [logs, setLogs] = useState(null);
  const load = useCallback(async () => {
    const { data } = await supabase.from('period_logs').select('*').eq('user_id', userId).order('start_date', { ascending: false }).limit(36);
    setLogs(data || []);
  }, [userId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { window.addEventListener('ft:data-changed', load); return () => window.removeEventListener('ft:data-changed', load); }, [load]);
  return [logs, load];
}

const CARE_NOTE = 'Pregnant or breastfeeding: no juice-only days, fasting or calorie cuts without your doctor’s OK. Your coach will plan around this.';

/** The optional questions (client on Me; coach on the client's page). */
export function WomensHealthForm({ profile, onSaved, coachView = false }) {
  const [f, setF] = useState({ pcos: profile.pcos || '', pregnancy: profile.pregnancy || '', due_date: profile.due_date || '', track_cycle: !!profile.track_cycle });
  const [busy, setBusy] = useState(false);
  const [toast, show] = useToast();
  const save = async (e) => {
    e.preventDefault(); setBusy(true);
    const { error } = await supabase.from('profiles').update({
      pcos: f.pcos || null, pregnancy: f.pregnancy || null, due_date: f.pregnancy === 'pregnant' && f.due_date ? f.due_date : null,
      track_cycle: f.track_cycle, wh_updated_at: new Date().toISOString(),
    }).eq('id', profile.id);
    setBusy(false);
    show(error ? error.message : 'Saved', error ? 'bad' : 'ok');
    if (!error) onSaved?.();
  };
  return (
    <Card title="🌸 Women’s health" className="wh-card">
      {toast}
      <p className="small muted">{coachView ? 'Answers from the client. You can update them after a conversation.' : 'Optional. Helps your coach plan food and workouts safely. Only you, your coach and the Fitoor admin can see this.'}</p>
      <form className="form" onSubmit={save}>
        <label>PCOS / PCOD
          <select value={f.pcos} onChange={(e) => setF({ ...f, pcos: e.target.value })}>
            <option value="">Prefer not to say</option>
            {Object.entries(PCOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label>Pregnancy
          <select value={f.pregnancy} onChange={(e) => setF({ ...f, pregnancy: e.target.value })}>
            <option value="">Prefer not to say</option>
            {Object.entries(PREGNANCY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        {f.pregnancy === 'pregnant' && <label>Due date (if known)<input type="date" value={f.due_date || ''} min={today()} onChange={(e) => setF({ ...f, due_date: e.target.value })} /></label>}
        {needsCare(f) && <p className="wh-care">🤰 {CARE_NOTE}</p>}
        <Toggle label="Track my periods" hint="Log start/end dates; see cycle day and when the next one is expected" checked={f.track_cycle} onChange={(v) => setF({ ...f, track_cycle: v })} />
        <button className="btn btn-primary" disabled={busy}>{busy ? <Spinner /> : 'Save'}</button>
      </form>
    </Card>
  );
}

/** Cycle numbers as small stickers. */
export function CycleStats({ stats, compact = false }) {
  if (!stats) return <p className="small muted">No periods logged yet.</p>;
  const s = stats;
  return (
    <div className={`wh-stats ${compact ? 'compact' : ''}`}>
      <div className="wh-stat lav"><b>Day {s.cycleDay}</b><span>{s.ongoing ? 'period ongoing' : 'of cycle'}</span></div>
      <div className="wh-stat sky"><b>{s.avg ? `${s.avg} d` : '—'}</b><span>{s.avg ? `avg cycle${s.min !== s.max ? ` (${s.min}–${s.max})` : ''}` : 'need 2+ periods'}</span></div>
      <div className={`wh-stat ${s.lateBy > 5 ? 'chilli' : 'haldi'}`}><b>{s.lateBy > 0 ? `${s.lateBy} d late` : fmt(s.nextDue)}</b><span>{s.lateBy > 0 ? `expected ${fmt(s.nextDue)}` : `next ${s.estimated ? '(est. 28 d)' : 'expected'}`}</span></div>
      {!compact && <div className={`wh-stat ${s.regular === false ? 'chilli' : 'lime'}`}><b>{s.regular == null ? '—' : s.regular ? 'Regular' : 'Irregular'}</b><span>{s.avgPeriodDays ? `period ~${s.avgPeriodDays} days` : 'pattern'}</span></div>}
    </div>
  );
}

/** Log periods + history. editable: client or coach. */
export function PeriodTracker({ userId, editable = true, title = '🩸 Period tracker' }) {
  const [logs, load] = usePeriods(userId);
  const [form, setForm] = useState(null); // { id?, start_date, end_date, flow, symptoms[], notes }
  const [toast, show] = useToast();
  if (!logs) return <Card title={title}><Spinner /></Card>;
  const stats = cycleStats(logs);
  const open = logs.find((l) => !l.end_date && daysAgo(l.start_date) <= 10);
  const save = async (e) => {
    e?.preventDefault();
    const row = { user_id: userId, start_date: form.start_date, end_date: form.end_date || null, flow: form.flow || null, symptoms: form.symptoms || [], notes: form.notes || null };
    const { error } = form.id ? await supabase.from('period_logs').update(row).eq('id', form.id) : await supabase.from('period_logs').insert(row);
    if (error) return show(/duplicate|unique/i.test(error.message) ? 'There is already a period starting that day' : error.message, 'bad');
    setForm(null); show('Saved'); load();
  };
  const endToday = async () => {
    const { error } = await supabase.from('period_logs').update({ end_date: today() }).eq('id', open.id);
    show(error ? error.message : 'Marked as ended today', error ? 'bad' : 'ok'); load();
  };
  const del = async (l) => { if (confirm(`Delete the period starting ${fmtLong(l.start_date)}?`)) { await supabase.from('period_logs').delete().eq('id', l.id); load(); } };
  const toggleSym = (s) => setForm({ ...form, symptoms: form.symptoms.includes(s) ? form.symptoms.filter((x) => x !== s) : [...form.symptoms, s] });
  const sorted = [...logs].sort((a, b) => a.start_date.localeCompare(b.start_date));
  const lenOf = (l) => { const i = sorted.findIndex((x) => x.id === l.id); return i > 0 ? Math.round((new Date(l.start_date) - new Date(sorted[i - 1].start_date)) / 864e5) : null; };

  return (
    <Card title={title}>
      {toast}
      <CycleStats stats={stats} />
      {editable && !form && (
        <div className="row gap wrap" style={{ marginTop: 10 }}>
          {open ? <button className="btn btn-pop btn-sm" onClick={endToday}>Period ended today</button>
            : <button className="btn btn-pop btn-sm" onClick={() => setForm({ start_date: today(), end_date: '', flow: '', symptoms: [], notes: '' })}>🩸 Period started</button>}
          <button className="btn btn-ghost btn-sm" onClick={() => setForm({ start_date: '', end_date: '', flow: '', symptoms: [], notes: '' })}>Add a past period</button>
        </div>
      )}
      {form && (
        <form className="wh-form" onSubmit={save}>
          <div className="row gap wrap">
            <label className="grow">Started<input type="date" required max={today()} value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></label>
            <label className="grow">Ended <span className="muted">(optional)</span><input type="date" max={today()} min={form.start_date || undefined} value={form.end_date || ''} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></label>
            <label className="grow">Flow<select value={form.flow || ''} onChange={(e) => setForm({ ...form, flow: e.target.value })}><option value="">—</option>{Object.entries(FLOW).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          </div>
          <div className="chips-row">{SYMPTOMS.map((s) => <button type="button" key={s} className={`chip ${form.symptoms.includes(s) ? 'on' : ''}`} aria-pressed={form.symptoms.includes(s)} onClick={() => toggleSym(s)}>{s}</button>)}</div>
          <input placeholder="Notes (optional)" value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="row gap"><button className="btn btn-primary btn-sm">Save</button><button type="button" className="btn btn-ghost btn-sm" onClick={() => setForm(null)}>Cancel</button></div>
        </form>
      )}
      {logs.length > 0 ? (
        <ul className="wh-history">
          {logs.slice(0, 12).map((l) => (
            <li key={l.id}>
              <b>{fmtLong(l.start_date)}</b>
              <span className="muted small">{l.end_date ? `${Math.round((new Date(l.end_date) - new Date(l.start_date)) / 864e5) + 1} days` : 'end not logged'}{l.flow ? ` · ${FLOW[l.flow]}` : ''}{lenOf(l) ? ` · cycle ${lenOf(l)} d` : ''}</span>
              {l.symptoms?.length > 0 && <span className="small">{l.symptoms.join(', ')}</span>}
              {editable && <span className="row gap"><button className="link-btn small" onClick={() => setForm({ ...l, end_date: l.end_date || '' })}>Edit</button><button className="icon-btn sm" onClick={() => del(l)} aria-label="Delete"><Trash2 size={14} /></button></span>}
            </li>
          ))}
        </ul>
      ) : <Empty>No periods logged yet.</Empty>}
      <p className="small muted">Cycle numbers are worked out from the dates you log. They aren’t medical advice; talk to your doctor about anything unusual for you.</p>
    </Card>
  );
}

/** Today: one-time optional question, and a cycle-day strip for those who track. */
export function TodayWomensHealth({ profile }) {
  const [logs] = usePeriods(profile.id);
  if (!profile.wh_updated_at) {
    return (
      <Link to="/app/profile#womens-health" className="wh-prompt">
        🌸 <span><b>Optional: a few women’s health questions</b><small>PCOS/PCOD, pregnancy and period tracking help your coach plan safely.</small></span>
      </Link>
    );
  }
  if (!profile.track_cycle || !logs) return null;
  const s = cycleStats(logs);
  return (
    <Link to="/app/profile#womens-health" className="wh-strip">
      🩸 {s ? <>Cycle day <b>{s.cycleDay}</b>{s.ongoing ? ' · period ongoing' : s.lateBy > 0 ? ` · ${s.lateBy} d late` : ` · next ~${fmt(s.nextDue)}`}</> : 'Log your last period to start tracking'}
    </Link>
  );
}

/** Coach: summary card on the client's overview. */
export function CoachWomensHealth({ profile, onSaved }) {
  const [logs] = usePeriods(profile.id);
  const [editing, setEditing] = useState(false);
  const s = logs ? cycleStats(logs) : null;
  const wk = pregnancyWeek(profile.due_date);
  if (editing) return <><WomensHealthForm profile={profile} coachView onSaved={() => { setEditing(false); onSaved?.(); }} /><button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>Close</button></>;
  return (
    <Card title="🌸 Women’s health" action={<button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>Edit</button>}>
      {!profile.wh_updated_at && <p className="small muted">The client hasn’t answered these questions yet.</p>}
      <div className="wh-tags">
        <span className={`tag ${profile.pcos === 'yes' ? 'warn' : ''}`}>PCOS/PCOD: {PCOS[profile.pcos] || 'not shared'}</span>
        <span className={`tag ${needsCare(profile) ? 'bad' : ''}`}>{PREGNANCY[profile.pregnancy] || 'Pregnancy: not shared'}{wk ? ` · week ${wk}` : ''}{profile.due_date ? ` · due ${fmt(profile.due_date)}` : ''}</span>
      </div>
      {needsCare(profile) && <p className="wh-care">🤰 {CARE_NOTE}</p>}
      {profile.pcos === 'yes' && <p className="small">PCOS/PCOD: favour low-GI meals, protein at every meal and regular strength training; irregular cycles are common.</p>}
      {logs === null ? <Spinner /> : profile.track_cycle || logs.length ? (
        <>
          <CycleStats stats={s} />
          {logs.length > 0 && <p className="small muted" style={{ marginTop: 8 }}>Last periods: {logs.slice(0, 6).map((l) => fmt(l.start_date)).join(' · ')}</p>}
        </>
      ) : <p className="small muted">Not tracking periods.</p>}
    </Card>
  );
}
