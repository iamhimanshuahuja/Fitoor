import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Printer, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { SLOTS } from '../lib/constants';
import { JUICES, JUICE_GROUPS } from '../lib/juices';
import { fmtLong, today } from '../lib/dates';
import { Spinner } from '../components/ui';

const TRACK_ROWS = [
  '🌅 Detox water', '🥤 Green smoothie', '🥞 Protein breakfast', '🍛 Lunch on plan', '🥜 Nuts + seeds',
  '🥣 Light dinner by 8', '💧 8+ glasses water', '🏋️ Gym / walk', '⏱️ 12-hr fast', '🥤 All juices',
];
const SWAPS = [
  ['Poha / upma', 'Besan chilla'], ['Chai + biscuits', 'Green tea + makhana'], ['White rice dosa', 'Moong dal idli'],
  ['Bread / flakes', 'Overnight oats'], ['Namkeen', 'Roasted chana'], ['Paratha at dinner', 'Moong dal soup'],
];

/** Printable diet chart. /print/plan (self) or /print/plan/:id (coach). */
export default function PrintPlan() {
  const { id } = useParams();
  const { user, isAdmin } = useAuth();
  const nav = useNavigate();
  const uid = id || user.id;
  const [d, setD] = useState(null);

  useEffect(() => {
    Promise.all([
      supabase.from('profiles').select('full_name, goal, start_weight, target_weight, juice_group, plans(name)').eq('id', uid).maybeSingle(),
      supabase.from('diet_plans').select('*').eq('user_id', uid).eq('is_active', true).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('weight_logs').select('weight_kg, log_date').eq('user_id', uid).order('log_date', { ascending: false }).limit(1).maybeSingle(),
    ]).then(([p, pl, w]) => setD({ profile: p.data, plan: pl.data, weight: w.data }));
  }, [uid]);

  useEffect(() => { if (d?.profile) document.title = `${d.profile.full_name || 'My'} — Fitoor plan`; return () => { document.title = 'Fitoor — Plate se PR tak'; }; }, [d]);

  if (!d) return <div className="center-screen"><Spinner size={28} /></div>;
  const { profile, plan, weight } = d;
  if (!plan) return <div className="center-screen"><p>No active diet plan to print yet.</p></div>;
  const first = (profile?.full_name || 'Your').split(' ')[0];
  const slotMeta = (k) => SLOTS.find((s) => s.key === k) || {};
  const group = profile?.juice_group;
  const t12 = (hhmm) => { if (!hhmm) return ''; const [h, m] = hhmm.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`; };

  return (
    <div className="pp">
      <div className="pp-toolbar">
        <button className="btn btn-ghost" onClick={() => nav(-1)}><ArrowLeft size={16} /> Back</button>
        <span className="muted small">A4 · tip: in the print dialog choose “Save as PDF” and turn on “Background graphics”.</span>
        <button className="btn btn-pop" onClick={() => window.print()}><Printer size={16} /> Print / Save PDF</button>
      </div>

      {/* ---------------- Page 1: the plan ---------------- */}
      <section className="pp-page">
        <header className="pp-head">
          <img src="/logo-inline.svg" alt="Fitoor" className="pp-logo" />
          <span className="pp-tag">Plate se PR tak.</span>
        </header>

        <div className="pp-hero">
          <div>
            <p className="pp-kicker">Made for {profile?.full_name || 'you'}</p>
            <h1 className="pp-title">{first}’s plate plan</h1>
            <p className="pp-sub">{plan.title}</p>
          </div>
          <div className="pp-chips">
            {profile?.goal && <span className="pp-chip lime">🎯 {profile.goal}</span>}
            {(profile?.start_weight || weight) && (
              <span className="pp-chip sky">⚖️ {profile?.start_weight || weight?.weight_kg} kg{profile?.target_weight ? ` → ${profile.target_weight} kg` : ''}</span>
            )}
            <span className="pp-chip haldi">📅 {fmtLong(today())}</span>
          </div>
        </div>

        <div className="pp-grid">
          <div className="pp-timeline">
            {(plan.slots || []).map((s) => {
              const meta = slotMeta(s.key);
              return (
                <div key={s.key} className="pp-slot">
                  <div className="pp-time">
                    <span className="pp-emoji" aria-hidden>{meta.emoji || '🍽️'}</span>
                    <b>{t12(meta.time)}</b>
                  </div>
                  <div className="pp-slot-body">
                    <h3>{s.label}{s.title && <span> · {s.title}</span>}</h3>
                    {s.items?.length > 0 && <p className="pp-items">{s.items.map((it, i) => <span key={it}>{i > 0 && <i className="pp-dot"> • </i>}{it}</span>)}</p>}
                    {s.avoid?.length > 0 && <p className="pp-avoid">✕ Skip: {s.avoid.join(', ')}</p>}
                  </div>
                </div>
              );
            })}
          </div>

          <aside className="pp-side">
            {plan.notes && (
              <div className="pp-note">
                <b>A note from your coach</b>
                <p>{plan.notes}</p>
              </div>
            )}
            <div className="pp-box">
              <h4>Your plate</h4>
              <svg viewBox="0 0 120 120" className="pp-plate" role="img" aria-label="Half vegetables, a quarter protein, a quarter whole grains">
                <circle cx="60" cy="60" r="58" fill="#12261B" />
                <circle cx="60" cy="60" r="53" fill="#fff" />
                <path d="M60 60V12A48 48 0 0 0 60 108Z" fill="#C8F25A" stroke="#12261B" strokeWidth="1.5" />
                <path d="M60 60V12A48 48 0 0 1 108 60Z" fill="#BBA8FF" stroke="#12261B" strokeWidth="1.5" />
                <path d="M60 60H108A48 48 0 0 1 60 108Z" fill="#FFB627" stroke="#12261B" strokeWidth="1.5" />
                <text x="36" y="64" textAnchor="middle" className="pp-plate-t">50%</text>
                <text x="80" y="44" textAnchor="middle" className="pp-plate-t">25%</text>
                <text x="80" y="84" textAnchor="middle" className="pp-plate-t">25%</text>
              </svg>
              <ul className="pp-legend">
                <li><i style={{ background: '#C8F25A' }} /> Veggies & salad</li>
                <li><i style={{ background: '#BBA8FF' }} /> Protein</li>
                <li><i style={{ background: '#FFB627' }} /> Whole grains</li>
              </ul>
            </div>
            {group && (
              <div className="pp-box">
                <h4>🥤 Juice day · {JUICE_GROUPS[group].label}</h4>
                <table className="pp-juice">
                  <tbody>{JUICES.map((j) => <tr key={j.key}><td>{j.emoji}</td><td>{j.name}</td><td>{j.window}</td><td><b>{j.ml[group]} ml</b></td></tr>)}</tbody>
                </table>
              </div>
            )}
            {plan.guidelines?.length > 0 && (
              <div className="pp-box">
                <h4>House rules</h4>
                <ul className="pp-rules">{plan.guidelines.map((g) => <li key={g}>{g}</li>)}</ul>
              </div>
            )}
          </aside>
        </div>
        <footer className="pp-foot">
          <span>🥗 Plate se PR tak. One plate, one rep, one day at a time.</span>
          <span>fitoor · {isAdmin && id ? 'prepared by your coach' : 'your plan'}</span>
        </footer>
      </section>

      {/* ---------------- Page 2: fridge tracker ---------------- */}
      <section className="pp-page pp-break">
        <header className="pp-head">
          <img src="/logo-inline.svg" alt="Fitoor" className="pp-logo" />
          <span className="pp-tag">Week of ____ / ____</span>
        </header>
        <h2 className="pp-title2">{first}’s week on the fridge 🧲</h2>
        <p className="pp-sub">Tick a box every time you show up. Seven ticks in a row = a streak worth bragging about.</p>
        <table className="pp-track">
          <thead><tr><th />{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((x) => <th key={x}>{x}</th>)}</tr></thead>
          <tbody>
            {TRACK_ROWS.filter((r) => group || !r.includes('juices')).map((r) => <tr key={r}><td>{r}</td>{Array.from({ length: 7 }).map((_, i) => <td key={i}><span className="pp-box-tick" /></td>)}</tr>)}
            <tr className="pp-weight"><td>⚖️ Weight (kg)</td>{Array.from({ length: 7 }).map((_, i) => <td key={i} />)}</tr>
          </tbody>
        </table>
        <div className="pp-bottom">
          <div className="pp-box">
            <h4>Craving? Swap it</h4>
            <ul className="pp-swaps">{SWAPS.map(([a, b]) => <li key={a}><s>{a}</s> → <b>{b}</b></li>)}</ul>
          </div>
          <div className="pp-box pp-reflect">
            <h4>This week I’m proud of…</h4>
            <div className="pp-lines"><span /><span /><span /></div>
          </div>
        </div>
        <footer className="pp-foot">
          <span>Log it in Fitoor too. Your coach sees it the same day.</span>
          <span>🔥🔥🔥🔥🔥🔥🔥</span>
        </footer>
      </section>
    </div>
  );
}
