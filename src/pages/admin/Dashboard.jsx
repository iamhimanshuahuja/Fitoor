import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { addDays, today, fmt, daysAgo, fmtTime } from '../../lib/dates';
import { slotLabel } from '../../lib/constants';
import { Card, Stat, Empty, Spinner, SignedImg, Lightbox } from '../../components/ui';
import { DailyBars, COLORS } from '../../components/Charts';
import { CoachJuiceOverview } from '../../components/JuiceDays';

/** Rules for the "needs attention" list */
export function attentionReasons(u) {
  const r = [];
  const last = [u.last_meal, u.last_weight, u.last_workout].filter(Boolean).sort().at(-1);
  if (!last) r.push('Has not logged anything yet');
  else if (daysAgo(last) >= 2) r.push(`No logs for ${daysAgo(last)} days`);
  if (u.meals_7d >= 5 && u.followed_7d / u.meals_7d < 0.5) r.push(`Only ${Math.round((u.followed_7d / u.meals_7d) * 100)}% meals on plan (7d)`);
  if (u.latest_weight && u.first_weight && u.latest_weight > u.first_weight + 1) r.push(`Weight up ${(u.latest_weight - u.first_weight).toFixed(1)} kg since start`);
  return r;
}

export default function Dashboard() {
  const [users, setUsers] = useState(null);
  const [daily, setDaily] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [lb, setLb] = useState(null);

  useEffect(() => {
    const since = addDays(today(), -29);
    Promise.all([
      supabase.from('user_activity').select('*'),
      supabase.from('meal_logs').select('log_date, followed').gte('log_date', since),
      supabase.from('weight_logs').select('log_date').gte('log_date', since),
      supabase.from('workouts').select('log_date').gte('log_date', since),
      supabase.from('meal_logs').select('id, user_id, slot, photo_path, log_date, followed, description, profiles(full_name)').not('photo_path', 'is', null).order('created_at', { ascending: false }).limit(12),
    ]).then(([u, m, w, wo, p]) => {
      setUsers(u.data || []);
      const days = Array.from({ length: 30 }, (_, i) => addDays(since, i));
      setDaily(days.map((d) => ({
        date: d,
        on: (m.data || []).filter((x) => x.log_date === d && x.followed === true).length,
        off: (m.data || []).filter((x) => x.log_date === d && x.followed !== true).length,
        weights: (w.data || []).filter((x) => x.log_date === d).length,
        workouts: (wo.data || []).filter((x) => x.log_date === d).length,
      })));
      setPhotos(p.data || []);
    });
  }, []);

  const att = useMemo(() => (users || []).map((u) => ({ ...u, reasons: attentionReasons(u) })).filter((u) => u.reasons.length && u.active), [users]);
  if (!users) return <div className="center-pad"><Spinner /></div>;

  const t = today();
  const activeToday = users.filter((u) => [u.last_meal, u.last_weight, u.last_workout].includes(t)).length;
  const meals7 = users.reduce((s, u) => s + Number(u.meals_7d || 0), 0);
  const fol7 = users.reduce((s, u) => s + Number(u.followed_7d || 0), 0);
  const wo7 = users.reduce((s, u) => s + Number(u.workouts_7d || 0), 0);

  return (
    <div className="page">
      <div className="page-head"><h1>Overview</h1></div>
      <CoachJuiceOverview />
      <div className="stats">
        <Stat label="Clients" value={users.length} sub={`${users.filter((u) => u.active).length} active`} />
        <Stat label="Logged today" value={activeToday} sub={users.length ? `${Math.round((activeToday / users.length) * 100)}% of clients` : ''} />
        <Stat label="Plan adherence (7d)" value={meals7 ? `${Math.round((fol7 / meals7) * 100)}%` : '—'} sub={`${meals7} meals logged`} tone={meals7 && fol7 / meals7 >= 0.7 ? 'good' : 'warn'} />
        <Stat label="Workouts (7d)" value={wo7} />
      </div>

      <div className="grid-2">
        <Card title="Meals logged per day (30d)">
          <DailyBars data={daily} keys={[{ key: 'on', name: 'On plan', color: COLORS.fresh, stack: 'm' }, { key: 'off', name: 'Off / unmarked', color: COLORS.haldi, stack: 'm' }]} />
        </Card>
        <Card title="Weigh-ins & workouts (30d)">
          <DailyBars data={daily} keys={[{ key: 'weights', name: 'Weigh-ins', color: COLORS.deep }, { key: 'workouts', name: 'Workouts', color: COLORS.haldi }]} />
        </Card>
      </div>

      <Card title={<span className="row gap"><AlertTriangle size={18} /> Needs attention</span>}>
        {att.length ? (
          <ul className="attention">
            {att.map((u) => (
              <li key={u.user_id}>
                <Link to={`/admin/users/${u.user_id}`}><b>{u.full_name}</b></Link>
                <span>{u.reasons.join(' · ')}</span>
                <Link to={`/admin/users/${u.user_id}`} className="icon-btn"><ArrowRight size={16} /></Link>
              </li>
            ))}
          </ul>
        ) : <Empty>Everyone is on track 🎉</Empty>}
      </Card>

      <Card title="Latest meal photos" action={<Link to="/admin/users" className="small">All clients →</Link>}>
        {photos.length ? (
          <div className="photo-grid">
            {photos.map((p) => (
              <figure key={p.id}>
                <SignedImg path={p.photo_path} className="photo" onClick={() => setLb(p.photo_path)} />
                <figcaption>
                  <Link to={`/admin/users/${p.user_id}?tab=day&date=${p.log_date}`}>{p.profiles?.full_name}</Link>
                  <small>{slotLabel(p.slot)} · {fmt(p.log_date)} {p.followed === true ? '✅' : p.followed === false ? '⚠️' : ''}</small>
                </figcaption>
              </figure>
            ))}
          </div>
        ) : <Empty>No photos yet.</Empty>}
      </Card>
      <Lightbox path={lb} onClose={() => setLb(null)} />
    </div>
  );
}
