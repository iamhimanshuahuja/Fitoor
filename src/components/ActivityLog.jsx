import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { addDays, today } from '../lib/dates';
import { slotLabel } from '../lib/constants';
import { Card, Empty, Spinner } from './ui';

const when = (t) => new Date(t).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const EVENT = { sign_in: 'Signed in', sign_up: 'Created account', session_resume: 'Opened app (stayed signed in)', sign_out: 'Signed out' };
const place = (e) => [e.city, e.region, e.country].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', ');

/** Sign-in history with IP, approximate location and device. */
export function LoginHistory({ userId, limit = 50, title = 'Sign-ins', compact = false }) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    supabase.from('login_events').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(limit)
      .then(({ data }) => setRows(data || []));
  }, [userId, limit]);
  return (
    <Card title={title}>
      {!rows ? <Spinner /> : !rows.length ? <Empty>No sign-ins recorded yet.</Empty> : (
        <div className="table-wrap">
          <table className="log-table">
            <thead><tr><th>When</th><th>What</th><th>Where (approx.)</th>{!compact && <th>IP</th>}<th>Device</th>{!compact && <th>Kept signed in</th>}</tr></thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id}>
                  <td className="nowrap">{when(e.created_at)}</td>
                  <td>{EVENT[e.event] || e.event}</td>
                  <td>{place(e) || <span className="muted">—</span>}{!compact && e.isp && <small className="muted block">{e.isp}</small>}</td>
                  {!compact && <td className="mono">{e.ip || '—'}</td>}
                  <td className="nowrap">{e.device || '—'}</td>
                  {!compact && <td>{e.remember == null ? '—' : e.remember ? 'Yes' : 'No'}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

const AI_NAME = { meal: 'AI meal check', scale: 'AI scale reading', machine: 'AI machine finder', lab: 'AI lab report reader', chat: 'Log by chat', summary: 'AI weekly check-in' };
const FEATURE = (a) => (a.startsWith('ai_') ? AI_NAME[a.slice(3)] || 'AI' : {
  meal_logs: 'Meals', weight_logs: 'Weight', habit_logs: 'Habits', workouts: 'Gym', lab_reports: 'Lab reports',
  comments: 'Notes', juice_days: 'Juice days', diet_plans: 'Diet plan',
}[a.replace(/_(insert|update|delete)$/, '')] || a);

function describe(r) {
  const d = r.detail || {};
  const a = r.action;
  if (a.startsWith('ai_')) {
    const name = AI_NAME[a.slice(3)] || 'AI';
    const extra = d.tests ? ` · ${d.tests} tests` : d.actions?.length ? ` · ${d.actions.join(', ')}` : '';
    return { icon: '✨', text: `${name}${d.ok === false ? ' failed' : ''}${extra}`, sub: d.ms ? `${(d.ms / 1000).toFixed(1)} s` : '' };
  }
  const op = a.endsWith('_delete') ? 'delete' : a.endsWith('_update') ? 'update' : 'insert';
  const t = a.replace(/_(insert|update|delete)$/, '');
  const date = d.date ? ` for ${d.date === today() ? 'today' : d.date}` : '';
  switch (t) {
    case 'meal_logs': return { icon: '🍛', text: op === 'delete' ? 'Deleted a meal' : op === 'update' ? 'Edited a meal' : `Logged ${slotLabel(d.slot) || 'a meal'}${d.photo ? ' with photo' : ''}${date}`, sub: d.source === 'chat' ? 'via chat' : '' };
    case 'weight_logs': return { icon: '⚖️', text: `${op === 'delete' ? 'Deleted weight' : `Weight ${d.kg} kg`}${date}`, sub: d.source === 'ai' ? 'from scale photo' : '' };
    case 'habit_logs': return { icon: '✅', text: `Ticked habits${date}` };
    case 'workouts': return { icon: '🏋️', text: op === 'delete' ? 'Deleted a workout' : `Logged workout${d.label ? ` · ${d.label}` : ''}${date}` };
    case 'lab_reports': return { icon: '🧪', text: op === 'delete' ? 'Deleted a lab report' : `Added lab report${d.lab ? ` · ${d.lab}` : ''}${date}` };
    case 'comments': return { icon: '💬', text: 'Wrote a note' };
    case 'juice_days':
      if (op === 'insert') return { icon: '🧃', text: `Juice day booked${date}` };
      if (op === 'delete') return { icon: '🧃', text: 'Juice day removed' };
      return { icon: '🧃', text: d.request === 'pending' ? 'Asked to move juice day' : d.request === 'approved' ? 'Juice day moved' : d.request === 'declined' ? 'Juice day kept' : `Juice day ${d.status || 'updated'}` };
    case 'diet_plans': return { icon: '📋', text: op === 'insert' ? 'New diet plan' : 'Diet plan updated' };
    default: return { icon: '•', text: a };
  }
}

/** Feature usage summary (30 days) + timeline of everything logged. */
export function FeatureActivity({ userId }) {
  const [rows, setRows] = useState(null);
  const [days, setDays] = useState(30);
  useEffect(() => {
    setRows(null);
    supabase.from('activity_logs').select('*').eq('user_id', userId).gte('created_at', addDays(today(), -(days - 1)) + 'T00:00:00')
      .order('created_at', { ascending: false }).limit(500).then(({ data }) => setRows(data || []));
  }, [userId, days]);
  const usage = useMemo(() => {
    const c = {};
    (rows || []).forEach((r) => { const f = FEATURE(r.action); c[f] = (c[f] || 0) + 1; });
    return Object.entries(c).sort((a, b) => b[1] - a[1]);
  }, [rows]);
  const max = usage[0]?.[1] || 1;
  return (
    <>
      <Card title="Feature usage" action={
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Period">
          <option value={7}>7 days</option><option value={30}>30 days</option><option value={90}>90 days</option>
        </select>}>
        {!rows ? <Spinner /> : !usage.length ? <Empty>Nothing logged in this period.</Empty> : (
          <ul className="usage-bars">
            {usage.map(([f, n]) => <li key={f}><span>{f}</span><i style={{ width: `${Math.max(6, (n / max) * 100)}%` }} /><b>{n}</b></li>)}
          </ul>
        )}
      </Card>
      <Card title="Activity timeline">
        {!rows ? <Spinner /> : !rows.length ? <Empty>No activity yet.</Empty> : (
          <ul className="timeline">
            {rows.slice(0, 200).map((r) => {
              const x = describe(r);
              return (
                <li key={r.id}>
                  <span className="tl-icon" aria-hidden>{x.icon}</span>
                  <div><b>{x.text}</b>{(x.sub || r.detail?.by_coach) && <small className="muted"> · {[x.sub, r.detail?.by_coach && 'by coach'].filter(Boolean).join(' · ')}</small>}</div>
                  <time className="muted small">{when(r.created_at)}</time>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
