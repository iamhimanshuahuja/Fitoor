import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Share2, Copy } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { fmt, daysAgo } from '../../lib/dates';
import { Card, Empty, Spinner } from '../../components/ui';
import { attentionReasons } from './Dashboard';
import { useAuth } from '../../lib/auth';
import Avatar from '../../components/Avatar';
import { useCoaches, signupLink } from '../../lib/coaches';

export function InviteButtons({ code, label = 'Copy signup link' }) {
  const [copied, setCopied] = useState(false);
  const link = signupLink(code);
  const msg = `Join me on Fitoor 🥗 Plate se PR tak. Track your thali, gym sets and progress with me 🥗💪\nSign up here: ${link}`;
  const copy = async () => { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div className="row gap wrap">
      <button className="btn btn-ghost btn-sm" onClick={copy} title={link}><Copy size={15} /> {copied ? 'Link copied' : label}</button>
      <a className="btn btn-pop btn-sm" href={`https://wa.me/?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer"><Share2 size={15} /> Invite on WhatsApp</a>
    </div>
  );
}

export default function Users() {
  const { isSuper, profile } = useAuth();
  const [coaches] = useCoaches(isSuper);
  const [coach, setCoach] = useState(() => new URLSearchParams(location.search).get('coach') || '');
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState('');
  const [plan, setPlan] = useState('');
  const [sort, setSort] = useState('name');
  useEffect(() => { supabase.from('user_activity').select('*').then(({ data }) => setRows(data || [])); }, []);
  if (!rows) return <div className="center-pad"><Spinner /></div>;

  const plans = [...new Set(rows.map((r) => r.plan_name).filter(Boolean))];
  const last = (u) => [u.last_meal, u.last_weight, u.last_workout].filter(Boolean).sort().at(-1);
  const coachName = (id) => coaches.find((c) => c.id === id)?.full_name;
  let list = rows.filter((r) => (!coach || (coach === 'none' ? !r.coach_id : r.coach_id === coach)) && (!plan || r.plan_name === plan) && (!q || `${r.full_name} ${r.email}`.toLowerCase().includes(q.toLowerCase())));
  list = [...list].sort((a, b) =>
    sort === 'name' ? (a.full_name || '').localeCompare(b.full_name || '')
    : sort === 'recent' ? (last(b) || '').localeCompare(last(a) || '')
    : (b.followed_7d / (b.meals_7d || 1)) - (a.followed_7d / (a.meals_7d || 1)));

  return (
    <div className="page">
      <div className="page-head"><h1>{isSuper ? 'All clients' : 'My clients'}</h1><InviteButtons code={profile?.coach_code} label={profile?.coach_code ? `Copy my signup link (${profile.coach_code})` : 'Copy signup link'} /></div>
      <Card>
        <div className="row gap wrap">
          <div className="search grow"><Search size={16} /><input placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          {isSuper && (
            <select value={coach} onChange={(e) => setCoach(e.target.value)} aria-label="Coach">
              <option value="">All coaches</option><option value="none">Waiting for a coach</option>
              {coaches.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </select>
          )}
          <select value={plan} onChange={(e) => setPlan(e.target.value)}><option value="">All plans</option>{plans.map((p) => <option key={p}>{p}</option>)}</select>
          <select value={sort} onChange={(e) => setSort(e.target.value)}><option value="name">Name</option><option value="recent">Last active</option><option value="adherence">Adherence</option></select>
        </div>
        {list.length ? (
          <div className="table-wrap">
            <table className="table users-table">
              <thead><tr><th>Client</th>{isSuper && <th>Coach</th>}<th>Plan</th><th>Weight</th><th>Last active</th><th>On plan (7d)</th><th>Workouts (7d)</th><th></th></tr></thead>
              <tbody>
                {list.map((u) => {
                  const ch = u.latest_weight && u.first_weight ? +(u.latest_weight - u.first_weight).toFixed(1) : null;
                  const l = last(u);
                  const reasons = attentionReasons(u);
                  return (
                    <tr key={u.user_id}>
                      <td><div className="person"><Avatar path={u.avatar_path} name={u.full_name} size={36} /><div><Link to={`/admin/users/${u.user_id}`}><b>{u.full_name}</b></Link><div className="muted small">{u.email}</div></div></div></td>
                      {isSuper && <td>{u.coach_id ? coachName(u.coach_id) || '—' : <span className="tag warn">no coach</span>}</td>}
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
        ) : <Empty>{rows.length ? 'No clients match these filters.' : <>No clients yet. Share your signup link: <code>{signupLink(profile?.coach_code)}</code></>}</Empty>}
      </Card>
    </div>
  );
}
