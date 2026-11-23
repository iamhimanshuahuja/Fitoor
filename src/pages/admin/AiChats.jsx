import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Image as ImageIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toISO, addDays, today, fmt, fmtTime } from '../../lib/dates';
import { downloadCSV } from '../../lib/csv';
import { Card, Empty, Spinner, Stat } from '../../components/ui';
import { DailyBars } from '../../components/Charts';
import Avatar from '../../components/Avatar';

const STATUS = { ok: 'Answered', off_topic: 'Off topic', error: 'Error', limit: 'Hit daily limit', upgrade: 'Needs Pro' };
const TASK = { chat: 'Log by chat', ask: 'Ask AI' };
const ROLE = { user: 'client', coach: 'coach', super_admin: 'super admin' };
const card = (a) => [a.type, a.description || a.day_label || a.key || a.event || (a.weight_kg && `${a.weight_kg} kg`) || (a.glasses && `${a.glasses} glasses`), a.kcal && `${a.kcal} kcal`, a.exercises?.join(', ')].filter(Boolean).join(' · ');

/** Super admin: every Log-by-chat and Ask AI exchange of the last 30 days (text only; older rows are deleted). */
export default function AiChats() {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const [f, setF] = useState({ who: '', task: '', status: '', q: '', days: 30 });
  useEffect(() => {
    supabase.from('ai_messages')
      .select('id, created_at, user_id, subject_id, role, task, prompt, photo, reply, actions, status, error, ms, who:profiles!ai_messages_user_id_fkey(full_name, email, avatar_path), subject:profiles!ai_messages_subject_id_fkey(full_name)')
      .gte('created_at', new Date(Date.now() - 30 * 864e5).toISOString())
      .order('created_at', { ascending: false }).limit(5000)
      .then(({ data, error }) => { if (error) setErr(error.message); setRows(data || []); });
  }, []);

  const since = Date.now() - f.days * 864e5;
  const inRange = useMemo(() => (rows || []).filter((r) => new Date(r.created_at) >= since), [rows, f.days]);
  const people = useMemo(() => {
    const m = {};
    inRange.forEach((r) => {
      const p = (m[r.user_id] = m[r.user_id] || { id: r.user_id, name: r.who?.full_name || r.who?.email || 'Unknown', avatar: r.who?.avatar_path, role: r.role, n: 0, off: 0, limit: 0, cards: 0 });
      p.n += 1; if (r.status === 'off_topic') p.off += 1; if (r.status === 'limit') p.limit += 1; p.cards += (r.actions || []).length;
    });
    return Object.values(m).sort((a, b) => b.n - a.n);
  }, [inRange]);
  const list = inRange.filter((r) => (!f.who || r.user_id === f.who) && (!f.task || r.task === f.task) && (!f.status || r.status === f.status)
    && (!f.q || `${r.prompt} ${r.reply}`.toLowerCase().includes(f.q.toLowerCase())));
  const daily = useMemo(() => {
    const by = {};
    for (let i = f.days - 1; i >= 0; i--) by[addDays(today(), -i)] = { date: addDays(today(), -i), answered: 0, off: 0, other: 0 };
    inRange.forEach((r) => { const d = by[toISO(new Date(r.created_at))]; if (!d) return; if (r.status === 'ok') d.answered += 1; else if (r.status === 'off_topic') d.off += 1; else d.other += 1; });
    return Object.values(by);
  }, [inRange, f.days]);
  const count = (s) => inRange.filter((r) => r.status === s).length;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const exportCsv = () => downloadCSV(`fitoor-ai-chats-${today()}.csv`, list.map((r) => ({
    time: r.created_at, person: r.who?.full_name || '', email: r.who?.email || '', role: ROLE[r.role] || r.role || '', type: TASK[r.task], about_client: r.subject?.full_name || '',
    status: STATUS[r.status] || r.status, photo: r.photo ? 'yes' : '', message: r.prompt || '', ai_reply: r.reply || '', cards: (r.actions || []).map(card).join(' | '), error: r.error || '', ms: r.ms ?? '',
  })));

  return (
    <div className="page">
      <div className="page-head"><h1>AI chats</h1>{list.length > 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={exportCsv}><Download size={15} /> CSV</button>}</div>
      <p className="small muted">Every Log-by-chat and Ask AI message from clients and coaches, with the AI’s reply. Text only: photos are never kept. Messages older than 30 days are deleted automatically. Only you can see this page.</p>
      {err && <p className="error">{err.includes('ai_messages') ? 'Run supabase/migration_v16_ai_review.sql first.' : err}</p>}
      {!rows ? <Spinner /> : (
        <>
          <div className="stats-row">
            <Stat label={`Messages · ${f.days} days`} value={inRange.length} />
            <Stat label="People using AI" value={people.length} />
            <Stat label="Off topic (refused)" value={count('off_topic')} sub={inRange.length ? `${Math.round((count('off_topic') / inRange.length) * 100)}%` : ''} />
            <Stat label="Hit daily limit" value={count('limit')} sub={count('error') ? `${count('error')} errors` : ''} />
          </div>
          <Card title="Per day">
            <DailyBars data={daily} height={180} keys={[{ key: 'answered', name: 'Answered', color: '#3E9F67', stack: 'a' }, { key: 'off', name: 'Off topic', color: '#C8553D', stack: 'a' }, { key: 'other', name: 'Limit / error', color: '#F2A83B', stack: 'a' }]} />
          </Card>
          <Card title="Who uses it most">
            {!people.length ? <Empty>No AI chats yet.</Empty> : (
              <div className="table-wrap"><table className="table">
                <thead><tr><th>Person</th><th>Messages</th><th>Cards suggested</th><th>Off topic</th><th>Hit limit</th></tr></thead>
                <tbody>{people.slice(0, 15).map((p) => (
                  <tr key={p.id}>
                    <td><button type="button" className="link-btn person" onClick={() => setF({ ...f, who: p.id })}><Avatar path={p.avatar} name={p.name} size={26} /> {p.name} <span className="muted small">{ROLE[p.role] || ''}</span></button></td>
                    <td>{p.n}</td><td>{p.cards}</td><td className={p.off >= 3 ? 'warn-text' : ''}>{p.off}</td><td>{p.limit}</td>
                  </tr>
                ))}</tbody>
              </table></div>
            )}
          </Card>
          <Card title={`Messages (${list.length})`}>
            <div className="ai-filters">
              <select value={f.days} onChange={(e) => setF({ ...f, days: Number(e.target.value) })} aria-label="Period"><option value={1}>Today</option><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option></select>
              <select value={f.who} onChange={set('who')} aria-label="Person"><option value="">Everyone</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
              <select value={f.task} onChange={set('task')} aria-label="Type"><option value="">Chat + Ask AI</option><option value="chat">Log by chat</option><option value="ask">Ask AI</option></select>
              <select value={f.status} onChange={set('status')} aria-label="Result"><option value="">Any result</option>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
              <input value={f.q} onChange={set('q')} placeholder="Search text" aria-label="Search text" />
            </div>
            {!list.length ? <Empty>Nothing matches these filters.</Empty> : list.slice(0, 300).map((r) => (
              <div key={r.id} className={`ai-row st-${r.status}`}>
                <div className="ai-row-head">
                  <span className="person"><Avatar path={r.who?.avatar_path} name={r.who?.full_name} size={24} /><b>{r.who?.full_name || r.who?.email}</b></span>
                  <span className="tag">{TASK[r.task]}</span>
                  {r.status !== 'ok' && <span className={`tag ai-st ${r.status}`}>{STATUS[r.status]}</span>}
                  {r.subject?.full_name && <span className="small">about <Link to={`/admin/users/${r.subject_id}`}>{r.subject.full_name}</Link></span>}
                  <span className="small muted">{fmt(toISO(new Date(r.created_at)))} · {fmtTime(r.created_at)}{r.ms ? ` · ${(r.ms / 1000).toFixed(1)} s` : ''}</span>
                </div>
                <p className="ai-q">{r.photo && <ImageIcon size={14} aria-label="with a photo" />} {r.prompt || (r.photo ? <i className="muted">photo only</i> : '')}</p>
                {r.reply && <p className="ai-a">{r.reply}</p>}
                {r.actions?.length > 0 && <ul className="ai-cards">{r.actions.map((a, i) => <li key={i}>{card(a)}</li>)}</ul>}
                {r.error && <p className="small error">{r.error}</p>}
              </div>
            ))}
            {list.length > 300 && <p className="small muted">Showing the latest 300. Narrow the filters or download the CSV for all {list.length}.</p>}
          </Card>
        </>
      )}
    </div>
  );
}
