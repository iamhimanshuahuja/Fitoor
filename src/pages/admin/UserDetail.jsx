import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { FEATURES } from '../../lib/constants';
import { addDays, today, fmt, fmtLong } from '../../lib/dates';
import { Card, Spinner, Tabs, Toggle, DateStrip, Stat, Empty, useToast } from '../../components/ui';
import DayView from '../../components/DayView';
import CalendarView from '../../components/CalendarView';
import Comments from '../../components/Comments';
import DietPlanEditor from '../../components/DietPlanEditor';
import { DailyBars, COLORS } from '../../components/Charts';
import AiWeeklySummary from '../../components/AiWeeklySummary';
import ProgressDashboard from '../../components/ProgressDashboard';
import { CoachJuiceDays } from '../../components/JuiceDays';
import { LoginHistory, FeatureActivity } from '../../components/ActivityLog';
import { useAuth } from '../../lib/auth';
import { CoachWomensHealth } from '../../components/WomensHealth';
import { isFemale, needsCare } from '../../lib/cycle';
import { useCoaches } from '../../lib/coaches';
import { labKey } from '../../lib/labNames';
import { WeightPanel } from '../app/Weight';
import { GymPanel } from '../app/Gym';
import { LabCompare, LabUploader } from '../app/Labs';

export default function UserDetail() {
  const { id } = useParams();
  const { isSuper } = useAuth();
  const [sp, setSp] = useSearchParams();
  const tab = sp.get('tab') || 'overview';
  const date = sp.get('date') || today();
  const [profile, setProfile] = useState(null);
  const [plans, setPlans] = useState([]);
  const [overrides, setOverrides] = useState([]);
  const [labRefresh, setLabRefresh] = useState(0);
  const [egfr, setEgfr] = useState(null);
  const [toast, show] = useToast();

  const load = async () => {
    const [p, pl, uf] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', id).single(),
      supabase.from('plans').select('*').order('name'),
      supabase.from('user_features').select('*').eq('user_id', id),
    ]);
    setProfile(p.data); setPlans(pl.data || []); setOverrides(uf.data || []);
    const { data: labs } = await supabase.from('lab_results').select('test_name, value, lab_reports(report_date)').eq('user_id', id);
    const e = (labs || []).filter((r) => labKey(r.test_name) === 'egfr' && r.value != null)
      .sort((a, b) => (b.lab_reports?.report_date || '').localeCompare(a.lab_reports?.report_date || ''))[0];
    setEgfr(e ? { value: Number(e.value), date: e.lab_reports?.report_date } : null);
  };
  useEffect(() => { load(); }, [id]);

  const plan = plans.find((p) => p.id === profile?.plan_id);
  const effective = useMemo(() => FEATURES.map((f) => f.key).filter((k) => {
    const o = overrides.find((x) => x.feature === k);
    return o ? o.enabled : (plan?.features || []).includes(k);
  }), [overrides, plan]);

  if (!profile) return <div className="center-pad"><Spinner /></div>;
  const go = (t, extra = {}) => setSp({ tab: t, ...extra });

  const updateProfile = async (patch) => {
    const { error } = await supabase.from('profiles').update(patch).eq('id', id);
    show(error ? error.message : 'Saved', error ? 'bad' : 'ok'); load();
  };
  const setFeature = async (k, enabled) => {
    const fromPlan = (plan?.features || []).includes(k);
    const res = enabled === fromPlan
      ? await supabase.from('user_features').delete().eq('user_id', id).eq('feature', k)   // back to plan default
      : await supabase.from('user_features').upsert({ user_id: id, feature: k, enabled });
    show(res.error ? res.error.message : 'Feature updated', res.error ? 'bad' : 'ok'); load();
  };

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'calendar', label: 'Calendar' },
    { key: 'day', label: 'Daily log' },
    effective.includes('weight') && { key: 'weight', label: 'Weight' },
    effective.includes('gym') && { key: 'gym', label: 'Gym' },
    { key: 'labs', label: 'Labs' },
    { key: 'diet', label: 'Diet plan' },
    { key: 'access', label: 'Plan & access' },
    { key: 'notes', label: 'Notes' },
    { key: 'activity', label: 'Activity' },
  ].filter(Boolean);

  return (
    <div className="page">
      {toast}
      <Link to="/admin/users" className="back"><ArrowLeft size={16} /> Clients</Link>
      <div className="page-head user-head">
        <div>
          <h1>{profile.full_name}</h1>
        {needsCare(profile) && <span className="tag bad">🤰 {profile.pregnancy === 'pregnant' ? 'Pregnant' : 'Breastfeeding'}</span>}{profile.pcos === 'yes' && <span className="tag warn">PCOS/PCOD</span>}
          <p className="muted small">{profile.email}{profile.phone ? ` · ${profile.phone}` : ''} · {plan?.name || 'No plan'}{profile.goal ? ` · Goal: ${profile.goal}` : ''}</p>
        </div>
      </div>
      <Tabs tabs={tabs} value={tab} onChange={(t) => go(t)} />

      {tab === 'overview' && <Overview userId={id} profile={profile} onOpenDay={(d) => go('day', { date: d })} onProfileSaved={load} />}
      {tab === 'calendar' && <CalendarView userId={id} mode="admin" features={effective} />}
      {tab === 'day' && (
        <>
          <DateStrip value={date} onChange={(d) => go('day', { date: d })} />
          <DayView key={date} userId={id} date={date} mode="admin" features={effective} />
        </>
      )}
      {tab === 'weight' && <WeightPanel userId={id} profile={profile} coach />}
      {tab === 'gym' && <GymPanel userId={id} />}
      {tab === 'labs' && (
        <>
          <LabCompare userId={id} refreshKey={labRefresh} />
          <LabUploader userId={id} onSaved={() => setLabRefresh(labRefresh + 1)} />
          <Card title="Health notes"><Comments userId={id} context="health" /></Card>
        </>
      )}
      {tab === 'diet' && (<>
        <div className="row gap" style={{ justifyContent: 'flex-end', marginBottom: 10 }}><Link className="btn btn-pop btn-sm" to={`/print/plan/${id}`}>🖨️ Print / PDF for client</Link></div>
        <DietPlanEditor userId={id} />
      </>)}
      {tab === 'access' && (
        <div className="grid-2">
          {isSuper && <CoachAssign userId={id} profile={profile} updateProfile={updateProfile} />}
          <Card title="Plan">
            {isSuper ? (<>
              <label>Assigned plan
                <select value={profile.plan_id || ''} onChange={(e) => updateProfile({ plan_id: e.target.value || null })}>
                  <option value="">No plan</option>
                  {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
              <Toggle label="Account active" hint="Paused users can't open the app" checked={profile.active} onChange={(v) => updateProfile({ active: v })} />
            </>) : (<>
              <p><b>{plans.find((p) => p.id === profile.plan_id)?.name || 'No plan'}</b>{profile.active === false && <span className="tag bad">paused</span>}</p>
              <p className="small muted">Plans and feature switches are managed by the super admin.</p>
            </>)}
          </Card>
          <CoachJuiceDays userId={id} profile={profile} updateProfile={updateProfile} egfr={egfr} />
          <Card title="Features for this client">
            <p className="small muted">Defaults come from the plan. Switching one here overrides it for this client only.</p>
            {FEATURES.map((f) => {
              const o = overrides.find((x) => x.feature === f.key);
              return (
                <Toggle key={f.key} label={<>{f.label} {o && <span className="tag">custom</span>}</>} hint={f.hint} disabled={!isSuper}
                  checked={effective.includes(f.key)} onChange={(v) => setFeature(f.key, v)} />
              );
            })}
          </Card>
        </div>
      )}
      {tab === 'notes' && <Card title="All notes"><Comments userId={id} /></Card>}
      {tab === 'activity' && <><FeatureActivity userId={id} />{isSuper && <LoginHistory userId={id} />}</>}
    </div>
  );
}

/** Super admin: assign / change / remove this client's coach, with the assignment history. */
function CoachAssign({ userId, profile, updateProfile }) {
  const [coaches] = useCoaches(true);
  const [hist, setHist] = useState([]);
  const loadHist = () => supabase.from('coach_assignments').select('*').eq('user_id', userId).order('started_at', { ascending: false }).then(({ data }) => setHist(data || []));
  useEffect(() => { loadHist(); }, [userId, profile.coach_id]);
  const name = (cid) => coaches.find((c) => c.id === cid)?.full_name || 'Removed coach';
  const change = async (cid) => {
    const to = cid ? name(cid) : 'no coach';
    const msg = profile.coach_id
      ? `Move ${profile.full_name} to ${to}?\n\nThe current coach loses access right away. ${cid ? 'The new coach sees the full history, but not who the previous coach was.' : ''}`
      : `Assign ${profile.full_name} to ${to}?`;
    if (!confirm(msg)) return;
    await updateProfile({ coach_id: cid || null });
  };
  return (
    <Card title="Coach">
      <label>Assigned coach
        <select value={profile.coach_id || ''} onChange={(e) => change(e.target.value)}>
          <option value="">— Waiting for a coach —</option>
          {coaches.map((c) => <option key={c.id} value={c.id}>{c.full_name}{c.role === 'super_admin' ? ' (super admin)' : ''}</option>)}
        </select>
      </label>
      {hist.length > 0 && (
        <ul className="coach-hist">
          {hist.map((h) => (
            <li key={h.id}><b>{name(h.coach_id)}</b> <span className="muted small">{fmt(h.started_at.slice(0, 10))} → {h.ended_at ? fmt(h.ended_at.slice(0, 10)) : 'now'}</span></li>
          ))}
        </ul>
      )}
      <p className="small muted">Only you see coach names and this history.</p>
    </Card>
  );
}

function Overview({ userId, profile, onOpenDay, onProfileSaved }) {
  const [d, setD] = useState(null);
  useEffect(() => {
    const since = addDays(today(), -29);
    Promise.all([
      supabase.from('meal_logs').select('log_date, followed, kcal').eq('user_id', userId).gte('log_date', since),
      supabase.from('weight_logs').select('log_date, weight_kg').eq('user_id', userId).order('log_date'),
      supabase.from('workouts').select('log_date').eq('user_id', userId).gte('log_date', since),
      supabase.from('habit_logs').select('log_date, habits').eq('user_id', userId).gte('log_date', since),
    ]).then(([m, w, wo, h]) => setD({ meals: m.data || [], weights: w.data || [], workouts: wo.data || [], habits: h.data || [], since }));
  }, [userId]);
  if (!d) return <div className="center-pad"><Spinner /></div>;

  const days = Array.from({ length: 30 }, (_, i) => addDays(d.since, i));
  const rows = days.map((date) => {
    const ms = d.meals.filter((x) => x.log_date === date);
    return {
      date, on: ms.filter((x) => x.followed === true).length, off: ms.filter((x) => x.followed !== true).length,
      kcal: Math.round(ms.reduce((s, x) => s + (Number(x.kcal) || 0), 0)),
      workout: d.workouts.some((x) => x.log_date === date), weight: d.weights.find((x) => x.log_date === date)?.weight_kg,
      water: Number(d.habits.find((x) => x.log_date === date)?.habits?.water_glasses || 0),
    };
  });
  const total = d.meals.length, on = d.meals.filter((x) => x.followed === true).length;
  const w = d.weights;
  const change = w.length > 1 ? +(w.at(-1).weight_kg - w[0].weight_kg).toFixed(1) : null;
  const loggedDays = rows.filter((r) => r.on + r.off > 0 || r.workout || r.weight).length;

  return (
    <>
      <ProgressDashboard userId={userId} profile={profile} />
      {isFemale(profile) && <CoachWomensHealth profile={profile} onSaved={onProfileSaved} />}
      <AiWeeklySummary userId={userId} profile={profile} />
      <div className="stats">
        <Stat label="Days logged (30d)" value={`${loggedDays}/30`} tone={loggedDays >= 20 ? 'good' : 'warn'} />
        <Stat label="Meals on plan (30d)" value={total ? `${Math.round((on / total) * 100)}%` : '—'} sub={`${on}/${total} meals`} />
        <Stat label="Weight change" value={change != null ? `${change > 0 ? '+' : ''}${change} kg` : '—'} tone={change < 0 ? 'good' : change > 0 ? 'warn' : ''} sub={w[0] && `since ${fmtLong(w[0].log_date)}`} />
        <Stat label="Workouts (30d)" value={d.workouts.length} />
      </div>
      <Card title="Last 30 days — tap a day to open it">
        <div className="heatmap">
          {rows.map((r) => {
            const score = (r.on + r.off ? r.on / (r.on + r.off) : 0) * 0.6 + (r.workout ? 0.25 : 0) + (r.weight ? 0.15 : 0);
            return (
              <button key={r.date} className="heat" style={{ '--a': score }} onClick={() => onOpenDay(r.date)}
                title={`${fmtLong(r.date)}\n${r.on}/${r.on + r.off} meals on plan${r.workout ? '\nWorkout ✔' : ''}${r.weight ? `\n${r.weight} kg` : ''}`}>
                <span>{new Date(r.date + 'T00:00').getDate()}</span>
                {r.workout && <i className="dot" />}
              </button>
            );
          })}
        </div>
        <p className="small muted">Darker = better day (meals on plan, workout, weigh-in). Dot = workout.</p>
      </Card>
      <div className="grid-2">
        <Card title="Meals per day"><DailyBars data={rows} keys={[{ key: 'on', name: 'On plan', color: COLORS.fresh, stack: 'a' }, { key: 'off', name: 'Off / unmarked', color: COLORS.haldi, stack: 'a' }]} /></Card>
        <Card title="Estimated calories (AI)">{rows.some((r) => r.kcal) ? <DailyBars data={rows} keys={[{ key: 'kcal', name: 'kcal', color: COLORS.deep }]} /> : <Empty>No calorie estimates yet.</Empty>}</Card>
      </div>
      <WeightPanel userId={userId} profile={profile} coach />
    </>
  );
}
