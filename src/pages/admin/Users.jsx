import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Share2, Copy } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { fmt, daysAgo } from '../../lib/dates';
import { Card, Empty, Spinner } from '../../components/ui';
import { attentionReasons } from './Dashboard';

function InviteButtons() {
  const [copied, setCopied] = useState(false);
  const link = `${location.origin}/signup`;
  const msg = `Join me on Fitoor 🥗 Plate se PR tak. Track your thali, gym sets and progress with me 🥗💪\nSign up here: ${link}`;
  const copy = async () => { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div className="row gap wrap">
      <button className="btn btn-ghost btn-sm" onClick={copy}><Copy size={15} /> {copied ? 'Link copied' : 'Copy signup link'}</button>
      <a className="btn btn-pop btn-sm" href={`https://wa.me/?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer"><Share2 size={15} /> Invite on WhatsApp</a>
    </div>
  );
}

export default function Users() {
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState('');
  const [plan, setPlan] = useState('');
  const [sort, setSort] = useState('name');
  useEffect(() => { supabase.from('user_activity').select('*').then(({ data }) => setRows(data || [])); }, []);
  if (!rows) return <div className="center-pad"><Spinner /></div>;

  const plans = [...new Set(rows.map((r) => r.plan_name).filter(Boolean))];
  const last = (u) => [u.last_meal, u.last_weight, u.last_workout].filter(Boolean).sort().at(-1);
  let list = rows.filter((r) => (!plan || r.plan_name === plan) && (!q || `${r.full_name} ${r.email}`.toLowerCase().includes(q.toLowerCase())));
  list = [...list].sort((a, b) =>
    sort === 'name' ? (a.full_name || '').localeCompare(b.full_name || '')
    : sort === 'recent' ? (last(b) || '').localeCompare(last(a) || '')
    : (b.followed_7d / (b.meals_7d || 1)) - (a.followed_7d / (a.meals_7d || 1)));

  return (
    <div className="page">
      <div className="page-head"><h1>Clients</h1><InviteButtons /></div>
      <Card>
        <div className="row gap wrap">
          <div className="search grow"><Search size={16} /><input placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <select value={plan} onChange={(e) => setPlan(e.target.value)}><option value="">All plans</option>{plans.map((p) => <option key={p}>{p}</option>)}</select>
          <select value={sort} onChange={(e) => setSort(e.target.value)}><option value="name">Name</option><option value="recent">Last active</option><option value="adherence">Adherence</option></select>
        </div>
        {list.length ? (
          <div className="table-wrap">
            <table className="table users-table">
              <thead><tr><th>Client</th><th>Plan</th><th>Weight</th><th>Last active</th><th>On plan (7d)</th><th>Workouts (7d)</th><th></th></tr></thead>
              <tbody>
                {list.map((u) => {
                  const ch = u.latest_weight && u.first_weight ? +(u.latest_weight - u.first_weight).toFixed(1) : null;
                  const l = last(u);
                  const reasons = attentionReasons(u);
                  return (
                    <tr key={u.user_id}>
                      <td><Link to={`/admin/users/${u.user_id}`}><b>{u.full_name}</b></Link><div className="muted small">{u.email}</div></td>
                      <td>{u.plan_name || '—'}{!u.active && <span className="tag bad">paused</span>}</td>
                      <td>{u.latest_weight ? `${u.latest_weight} kg` : '—'} {ch != null && <small className={ch < 0 ? 'good' : ch > 0 ? 'warn' : ''}>({ch > 0 ? '+' : ''}{ch})</small>}</td>
                      <td>{l ? (daysAgo(l) === 0 ? 'Today' : `${fmt(l)} · ${daysAgo(l)}d ago`) : 'Never'}</td>
                      <td>{u.meals_7d ? `${u.followed_7d}/${u.meals_7d}` : '—'}</td>
                      <td>{u.workouts_7d || 0}</td>
                      <td>{reasons.length > 0 && <span className="tag warn" title={reasons.join('\n')}>attention</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <Empty>No clients yet. Share the signup link: <code>{location.origin}/signup</code></Empty>}
      </Card>
    </div>
  );
}
