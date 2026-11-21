import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarPlus, Trash2, Check, X, CalendarClock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { today, fmt, fmtLong, addDays } from '../lib/dates';
import { JUICE_GROUPS, suggestGroup } from '../lib/juices';
import { useJuiceDays, nextJuiceDay, daysUntil, REMIND_DAYS, requestChange, cancelRequest, decideRequest, downloadIcs } from '../lib/juiceDays';
import { Card, Empty, Spinner } from './ui';

const when = (n) => (n === 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${n} days`);

/** Small form the client uses to ask for another date. */
function RequestForm({ jd, onDone }) {
  const [day, setDay] = useState(jd.request_day || addDays(jd.day, 1));
  const [reason, setReason] = useState(jd.request_reason || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const send = async (e) => {
    e.preventDefault();
    if (day === jd.day) return setErr('Pick a different date.');
    setBusy(true); setErr('');
    const { error } = await requestChange(jd.id, day, reason.trim());
    setBusy(false);
    if (error) return setErr(error.message);
    onDone();
  };
  return (
    <form className="jd-request" onSubmit={send}>
      <label>New date<input type="date" value={day} min={today()} onChange={(e) => setDay(e.target.value)} required /></label>
      <label className="grow">Why? <span className="muted">(optional)</span>
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Office lunch that day" maxLength={200} />
      </label>
      {err && <p className="error small">{err}</p>}
      <div className="row gap">
        <button className="btn btn-pop btn-sm" disabled={busy}>{busy ? 'Sending…' : 'Send request to coach'}</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onDone(false)}>Cancel</button>
      </div>
    </form>
  );
}

/** Status line + actions for one upcoming juice day (client side). */
function RequestStatus({ jd, onChanged }) {
  const [open, setOpen] = useState(false);
  if (open) return <RequestForm jd={jd} onDone={() => { setOpen(false); onChanged(); }} />;
  return (
    <div className="jd-actions">
      {jd.request_status === 'pending' ? (
        <span className="jd-pill pending">⏳ You asked for {fmt(jd.request_day)} · waiting for coach
          <button className="link-btn" onClick={async () => { await cancelRequest(jd.id); onChanged(); }}>withdraw</button></span>
      ) : (
        <>
          {jd.request_status === 'declined' && <span className="jd-pill declined">Coach kept this date</span>}
          {jd.request_status === 'approved' && <span className="jd-pill approved">✓ Moved by your coach</span>}
          <button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}><CalendarClock size={15} /> Request another day</button>
        </>
      )}
      <button className="btn btn-ghost btn-sm" onClick={() => downloadIcs(jd.day, jd.note)}><CalendarPlus size={15} /> Add to my calendar</button>
    </div>
  );
}

/** Today page: banner from 2 days before a juice day, and on the day itself. */
export function JuiceReminder({ userId }) {
  const [days, reload] = useJuiceDays(userId);
  if (!days) return null;
  const next = nextJuiceDay(days);
  if (!next) return null;
  const n = daysUntil(next.day);
  if (n > REMIND_DAYS) {
    return (
      <Link to="/app/plan?tab=juices" className="jd-next">🧃 Next juice day: <b>{fmtLong(next.day)}</b> · {when(n)}</Link>
    );
  }
  return (
    <section className={`jd-banner ${n === 0 ? 'is-today' : ''}`} role="status">
      <div className="jd-banner-top">
        <span className="jd-emoji" aria-hidden>🧃</span>
        <div className="grow">
          <b>{n === 0 ? 'Juice day today. Only juices, no other food.' : `Juice day ${when(n)} · ${fmtLong(next.day)}`}</b>
          <p>{n === 0
            ? 'Follow the juice times below. Sip slowly, rest more, and message your coach if you feel dizzy.'
            : 'Be ready: buy beetroot, carrot, amla, cucumber, ash gourd, greens and coconut water. Eat light the night before.'}</p>
          {next.note && <p className="jd-note">Coach: {next.note}</p>}
        </div>
      </div>
      {n > 0 && <RequestStatus jd={next} onChanged={reload} />}
    </section>
  );
}

/** Plan → Juices tab: all upcoming days with request buttons, and past days. */
export function MyJuiceDays({ userId }) {
  const [days, reload] = useJuiceDays(userId);
  if (!days) return <div className="center-pad"><Spinner /></div>;
  const up = days.filter((d) => d.day >= today());
  const past = days.filter((d) => d.day < today()).reverse().slice(0, 6);
  return (
    <Card title="🧃 My juice days">
      {up.length ? (
        <ul className="jd-list">
          {up.map((d) => (
            <li key={d.id}>
              <div className="jd-row"><b>{fmtLong(d.day)}</b><span className="muted small">{when(daysUntil(d.day))}</span></div>
              {d.note && <p className="small muted">Coach: {d.note}</p>}
              {daysUntil(d.day) > 0 && <RequestStatus jd={d} onChanged={reload} />}
            </li>
          ))}
        </ul>
      ) : <Empty>No juice day booked yet. Your coach will pick the dates.</Empty>}
      {past.length > 0 && (
        <p className="small muted" style={{ marginTop: 10 }}>Past: {past.map((d) => `${fmt(d.day)}${d.status === 'done' ? ' ✓' : d.status === 'missed' ? ' ✗' : ''}`).join(' · ')}</p>
      )}
    </Card>
  );
}

/** Coach: book juice days for one client, set amounts, handle change requests. */
export function CoachJuiceDays({ userId, profile, updateProfile, egfr }) {
  const [days, reload] = useJuiceDays(userId);
  const [day, setDay] = useState(addDays(today(), 7));
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const add = async (e) => {
    e.preventDefault(); setErr('');
    const { error } = await supabase.from('juice_days').insert({ user_id: userId, day, note: note.trim() || null });
    if (error) return setErr(error.code === '23505' ? 'That date is already booked.' : error.message);
    setNote(''); reload();
  };
  const del = async (id) => { if (confirm('Remove this juice day?')) { await supabase.from('juice_days').delete().eq('id', id); reload(); } };
  const setStatus = async (id, status) => { await supabase.from('juice_days').update({ status }).eq('id', id); reload(); };
  const month = day.slice(0, 7);
  const inMonth = (days || []).filter((d) => d.day.slice(0, 7) === month).length;
  const sug = egfr ? suggestGroup(egfr.value) : null;

  return (
    <Card title="🧃 Juice days">
      <p className="small muted">Juice days are booked by you, usually once or twice a month. The client gets a reminder 2 days before, can ask to move it, and can’t log other food on the day.</p>
      <label>Juice amounts
        <select value={profile.juice_group || ''} onChange={(e) => updateProfile({ juice_group: e.target.value || null })}>
          <option value="">Not set</option>
          {Object.entries(JUICE_GROUPS).map(([k, g]) => <option key={k} value={k}>{g.label} · {g.total}</option>)}
        </select>
      </label>
      <p className="small muted">
        {egfr ? <>Latest eGFR <b>{egfr.value}</b> ({fmt(egfr.date)}) → suggests <b>{JUICE_GROUPS[sug]?.label || 'below 30: not on this plan'}</b>. </> : 'No eGFR in lab reports yet. '}
        {sug && profile.juice_group !== sug && <button type="button" className="link-btn" onClick={() => updateProfile({ juice_group: sug })}>Use suggested</button>}
      </p>

      <form className="jd-add" onSubmit={add}>
        <label>Date<input type="date" value={day} min={today()} onChange={(e) => setDay(e.target.value)} required /></label>
        <label className="grow">Note for client <span className="muted">(optional)</span><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Start with red juice at 7 am" maxLength={200} /></label>
        <button className="btn btn-pop btn-sm"><CalendarPlus size={15} /> Book juice day</button>
      </form>
      {inMonth >= 2 && <p className="small warn-text">Already {inMonth} juice day{inMonth > 1 ? 's' : ''} in {fmt(month + '-01', { month: 'long' })}.</p>}
      {!profile.juice_group && <p className="small warn-text">Set the juice amounts so the client sees how much to drink.</p>}
      {err && <p className="error small">{err}</p>}

      {!days ? <Spinner /> : days.length === 0 ? <Empty>No juice days booked.</Empty> : (
        <ul className="jd-list">
          {[...days].reverse().map((d) => (
            <li key={d.id} className={d.day < today() ? 'is-past' : ''}>
              <div className="jd-row">
                <b>{fmtLong(d.day)}</b>
                <span className={`jd-pill ${d.status}`}>{d.status === 'scheduled' ? (d.day < today() ? 'not marked' : when(daysUntil(d.day))) : d.status}</span>
                <span className="grow" />
                {d.day <= today() && d.status !== 'done' && <button className="btn btn-ghost btn-sm" onClick={() => setStatus(d.id, 'done')}><Check size={14} /> Done</button>}
                {d.day <= today() && d.status !== 'missed' && <button className="btn btn-ghost btn-sm" onClick={() => setStatus(d.id, 'missed')}><X size={14} /> Missed</button>}
                <button className="icon-btn" aria-label="Remove juice day" onClick={() => del(d.id)}><Trash2 size={16} /></button>
              </div>
              {d.note && <p className="small muted">Note: {d.note}</p>}
              {d.request_status === 'pending' && <RequestDecision jd={d} onDone={reload} />}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function RequestDecision({ jd, onDone, showName }) {
  const [busy, setBusy] = useState(false);
  const go = async (ok) => {
    setBusy(true);
    const { error } = await decideRequest(jd, ok);
    setBusy(false);
    if (error) alert(error.code === '23505' ? 'There is already a juice day on that date.' : error.message);
    onDone();
  };
  return (
    <div className="jd-decide">
      <span>⏳ {showName ? <b>{jd.profiles?.full_name}: </b> : ''}wants <b>{fmt(jd.day)}</b> → <b>{fmtLong(jd.request_day)}</b>{jd.request_reason ? ` · “${jd.request_reason}”` : ''}</span>
      <div className="row gap">
        <button className="btn btn-pop btn-sm" disabled={busy} onClick={() => go(true)}><Check size={14} /> Move it</button>
        <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => go(false)}><X size={14} /> Keep date</button>
      </div>
    </div>
  );
}

/** Coach overview: pending change requests + juice days in the next 7 days, across all clients. */
export function CoachJuiceOverview() {
  const [rows, setRows] = useState(null);
  const load = async () => {
    const { data } = await supabase.from('juice_days').select('*, profiles!juice_days_user_id_fkey(full_name)')
      .gte('day', today()).lte('day', addDays(today(), 30)).eq('status', 'scheduled').order('day');
    setRows(data || []);
  };
  useEffect(() => { load(); }, []);
  if (!rows || !rows.length) return null;
  const pending = rows.filter((r) => r.request_status === 'pending');
  const soon = rows.filter((r) => daysUntil(r.day) <= 7);
  return (
    <Card title="🧃 Juice days">
      {pending.map((r) => <RequestDecision key={r.id} jd={r} onDone={load} showName />)}
      {soon.length > 0 ? (
        <ul className="jd-list compact">
          {soon.map((r) => (
            <li key={r.id} className="jd-row">
              <Link to={`/admin/users/${r.user_id}?tab=access`}><b>{r.profiles?.full_name}</b></Link>
              <span>{fmtLong(r.day)}</span><span className="jd-pill scheduled">{when(daysUntil(r.day))}</span>
            </li>
          ))}
        </ul>
      ) : !pending.length && <Empty>No juice days in the next week.</Empty>}
    </Card>
  );
}
