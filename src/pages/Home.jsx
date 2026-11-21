import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, RotateCcw, Smartphone } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { Logo } from '../components/ui';

/* ---------- Build-your-thali demo (the 25% plate rule) ---------- */
const FOODS = [
  { id: 'salad', label: 'Salad', emoji: '🥗', group: 'salad' },
  { id: 'kachumber', label: 'Kachumber', emoji: '🥒', group: 'salad' },
  { id: 'sabzi', label: 'Seasonal sabzi', emoji: '🥦', group: 'veg' },
  { id: 'soup', label: 'Veg soup', emoji: '🍲', group: 'veg' },
  { id: 'dal', label: 'Dal', emoji: '🫘', group: 'protein' },
  { id: 'paneer', label: 'Paneer', emoji: '🧀', group: 'protein' },
  { id: 'rajma', label: 'Rajma', emoji: '🥘', group: 'protein' },
  { id: 'roti', label: 'Roti', emoji: '🫓', group: 'carb' },
  { id: 'rice', label: 'Rice', emoji: '🍚', group: 'carb' },
  { id: 'paratha', label: 'Paratha', emoji: '🥙', group: 'carb', heavy: true },
  { id: 'poha', label: 'Poha', emoji: '🍛', group: 'carb', heavy: true },
  { id: 'namkeen', label: 'Namkeen', emoji: '🍿', group: 'junk' },
  { id: 'gulab', label: 'Gulab jamun', emoji: '🍡', group: 'junk' },
];
const GROUPS = [
  { key: 'salad', label: 'Salad', color: 'var(--lime)' },
  { key: 'veg', label: 'Veggies', color: 'var(--fresh)' },
  { key: 'protein', label: 'Protein', color: 'var(--lav)' },
  { key: 'carb', label: 'Roti / rice', color: 'var(--haldi)' },
];

function scorePlate(items) {
  const count = Object.fromEntries(GROUPS.map((g) => [g.key, 0]));
  let junk = 0, heavy = 0;
  items.forEach((id) => {
    const f = FOODS.find((x) => x.id === id);
    if (f.group === 'junk') junk++; else count[f.group]++;
    if (f.heavy) heavy++;
  });
  const total = Object.values(count).reduce((a, b) => a + b, 0);
  if (!total && !junk) return { count, total, score: null, note: 'Tap foods to build tonight’s plate.' };
  const shares = GROUPS.map((g) => (total ? count[g.key] / total : 0));
  const balance = 1 - shares.reduce((s, x) => s + Math.abs(x - 0.25), 0) / 1.5; // 1 = perfect quarters
  const score = Math.max(0, Math.min(100, Math.round(balance * 100 - junk * 18 - heavy * 6)));
  const missing = GROUPS.filter((g) => !count[g.key]).map((g) => g.label.toLowerCase());
  let note;
  if (junk) note = 'Namkeen and sweets are on the avoid list. Swap for roasted chana or makhana.';
  else if (heavy) note = 'Paratha and poha are high-GI. Try besan chilla or an extra roti-free sabzi instead.';
  else if (missing.length) note = `Add some ${missing.join(' & ')} to fill every quarter.`;
  else if (count.carb > count.salad + count.veg) note = 'Carb-heavy. More salad and sabzi, less roti.';
  else if (score >= 85) note = 'Quarter-perfect plate. Your coach would approve. ✅';
  else note = 'Nearly there. Balance the four quarters.';
  return { count, total, score, note };
}

function ThaliBuilder() {
  const [items, setItems] = useState(['dal', 'roti']);
  const { count, total, score, note } = useMemo(() => scorePlate(items), [items]);
  const add = (id) => setItems((xs) => (xs.length >= 10 ? xs : [...xs, id]));
  // quadrant fill = share of that group, so an unbalanced plate looks lopsided
  const r = 92, cx = 110, cy = 110;
  const arc = (i, frac) => {
    const a0 = (i * 90 - 90) * (Math.PI / 180), a1 = ((i + 1) * 90 - 90) * (Math.PI / 180);
    const rr = 26 + (r - 26) * Math.min(1, frac);
    return `M${cx} ${cy} L${cx + rr * Math.cos(a0)} ${cy + rr * Math.sin(a0)} A${rr} ${rr} 0 0 1 ${cx + rr * Math.cos(a1)} ${cy + rr * Math.sin(a1)} Z`;
  };
  return (
    <div className="thali-card" aria-label="Build your thali demo">
      <div className="thali-top">
        <h2>Build tonight’s thali</h2>
        <span className="thali-rule">50% veg · 25% protein · 25% grains</span>
        <button className="icon-btn" onClick={() => setItems([])} aria-label="Clear plate"><RotateCcw size={18} /></button>
      </div>
      <div className="thali-body">
        <svg viewBox="0 0 220 220" className="thali-svg" role="img" aria-label={`Plate balance ${score ?? 0} out of 100`}>
          <circle cx={cx} cy={cy} r="106" fill="var(--ink)" />
          <circle cx={cx} cy={cy} r="98" fill="#fff" />
          {GROUPS.map((g, i) => (
            <path key={g.key} d={arc(i, total ? (count[g.key] / total) * 4 * 0.9 : 0)} fill={g.color} stroke="var(--ink)" strokeWidth="2" className="thali-q" />
          ))}
          <path d="M110 14V206M14 110H206" stroke="var(--ink)" strokeWidth="2" strokeDasharray="4 5" />
          <circle cx={cx} cy={cy} r="24" fill="#fff" stroke="var(--ink)" strokeWidth="2" />
          <text x={cx} y={cy + 7} textAnchor="middle" className="thali-score">{score ?? '–'}</text>
        </svg>
        <div className="thali-side">
          <ul className="thali-legend">
            {GROUPS.map((g) => (
              <li key={g.key}><i style={{ background: g.color }} />{g.label}<b>{count[g.key]}</b></li>
            ))}
          </ul>
          <p className={`thali-note ${score != null && score >= 85 ? 'great' : ''}`} aria-live="polite">{note}</p>
        </div>
      </div>
      <div className="thali-foods">
        {FOODS.map((f) => (
          <button key={f.id} className={`food ${f.group === 'junk' ? 'junk' : ''}`} onClick={() => add(f.id)}>
            <span aria-hidden>{f.emoji}</span> {f.label} <Plus size={13} />
          </button>
        ))}
      </div>
      <p className="thali-plate-items">
        On the plate: {items.length ? items.map((id) => FOODS.find((f) => f.id === id).emoji).join(' ') : 'nothing yet'}
      </p>
    </div>
  );
}

/* ---------- Goal picker ---------- */
const GOALS = {
  lose: { label: 'Lose weight', emoji: '⚖️', lines: ['Daily weigh-ins with a 7-day trend (no panic over one bad day)', 'Meal photos checked against your plan’s avoid list', 'Streaks that make showing up the easy part'] },
  muscle: { label: 'Build muscle', emoji: '💪', lines: ['Sets, reps and kilos for every machine', 'Personal bests and strength graphs per exercise', 'Protein from every meal, estimated from a photo'] },
  labs: { label: 'Fix my reports', emoji: '🧪', lines: ['Upload a lab PDF, every value lands in a table', 'Cholesterol, sugar and vitamins compared report vs report', 'Coach notes next to the numbers that matter'] },
  clean: { label: 'Eat cleaner', emoji: '🥗', lines: ['Your diet chart, slot by slot, on your phone', 'A habit checklist: water, nuts, seeds, walks', 'Gentle nudges, not calorie guilt'] },
};

function GoalPicker() {
  const [g, setG] = useState('lose');
  return (
    <div className="goal">
      <p className="goal-q">I’m here to…</p>
      <div className="goal-chips" role="tablist">
        {Object.entries(GOALS).map(([k, v]) => (
          <button key={k} role="tab" aria-selected={g === k} className={g === k ? 'on' : ''} onClick={() => setG(k)}>
            <span aria-hidden>{v.emoji}</span> {v.label}
          </button>
        ))}
      </div>
      <ul className="goal-lines">{GOALS[g].lines.map((l) => <li key={l}>{l}</li>)}</ul>
    </div>
  );
}

const FAQ = [
  ['Is it free?', 'Yes, signing up is free. Your coach decides which features your plan includes.'],
  ['Do I need to download an app?', 'No. Open it in your phone’s browser and add it to your home screen. It opens full-screen like an app and uses your camera directly.'],
  ['Does it work on iPhone?', 'Yes. In Safari tap Share → Add to Home Screen.'],
  ['Who can see my photos and reports?', 'Only you and your coach. Photos are stored privately and compressed before upload.'],
  ['Is this medical advice?', 'No. Lab values are compared with the reference range printed on your report. Talk to your doctor about results.'],
];

export default function Home() {
  const { user, isAdmin } = useAuth();
  const dest = user ? (isAdmin ? '/admin' : '/app') : null;
  return (
    <div className="h">
      <header className="h-nav">
        <Logo height={38} />
        <nav>
          <Link to="/recipes" className="h-navlink">Recipes</Link>
          <a href="#how" className="h-navlink">How it works</a>
          <a href="#faq" className="h-navlink">FAQ</a>
          {dest ? (
            <Link className="btn btn-pop" to={dest}>Open app</Link>
          ) : (
            <>
              <Link className="btn btn-ghost" to="/login">Log in</Link>
              <Link className="btn btn-pop" to="/signup">Start free</Link>
            </>
          )}
        </nav>
      </header>

      <section className="h-hero">
        <div className="h-hero-copy">
          <h1 className="h-title">
            Thali on point.<br />Reps on track.<br /><span className="h-title-hl">Streak on fire.</span>
          </h1>
          <p className="h-lead">
            Fitoor puts your diet chart, meal photos, gym sets and blood reports in one app, and lets your coach see your day as it happens.
          </p>
          <GoalPicker />
          <div className="h-cta">
            <Link className="btn btn-pop btn-lg" to={dest || '/signup'}>{dest ? 'Go to my day' : 'Create free account'}</Link>
            <span className="h-note"><Smartphone size={16} /> iPhone & Android, no install needed</span>
          </div>
        </div>
        <ThaliBuilder />
      </section>

      <div className="h-marquee" aria-hidden>
        <div className="h-marquee-track">
          {Array.from({ length: 2 }).map((_, k) => (
            <span key={k}>📸 snap every meal ✦ 🔥 daily streaks ✦ 🏋️ sets & PRs ✦ 🧪 lab reports side by side ✦ 💬 notes from your coach ✦ ⚖️ weight trends ✦ 🤖 AI calorie guess ✦ </span>
          ))}
        </div>
      </div>

      <section className="h-bento" aria-label="What you get">
        <article className="b b-snap">
          <h3>Snap it, log it</h3>
          <p>Camera opens straight from the meal slot. AI guesses the dish and calories; you fix it in a tap.</p>
          <div className="b-snap-demo">
            <div className="b-photo">🍛</div>
            <div>
              <b>Lunch · dal, sabzi, 1 roti</b>
              <span className="b-ok">✓ on plan · ~480 kcal</span>
            </div>
          </div>
        </article>
        <article className="b b-streak">
          <div className="b-flame">🔥</div>
          <h3>Streaks</h3>
          <p>Log anything (a meal, a weigh-in, a workout) and the streak lives another day.</p>
        </article>
        <article className="b b-gym">
          <h3>Gym, machine by machine</h3>
          <ul className="b-sets">
            <li><span>Bench press</span><b>10 × 20 kg</b></li>
            <li><span>Lat pulldown</span><b>12 × 35 kg</b></li>
            <li><span>Incline walk</span><b>15 min @ 8%</b></li>
          </ul>
          <p>Don’t know the machine’s name? Snap it.</p>
        </article>
        <article className="b b-labs">
          <h3>Reports, compared</h3>
          <table className="b-table">
            <thead><tr><th>Test</th><th>Apr</th><th>Oct</th></tr></thead>
            <tbody>
              <tr><td>Triglycerides</td><td>360</td><td className="up">420 ↑</td></tr>
              <tr><td>Vitamin D</td><td className="dn">22 ↓</td><td>57</td></tr>
              <tr><td>HbA1c</td><td>5.3</td><td>5.0</td></tr>
            </tbody>
          </table>
        </article>
        <article className="b b-coach">
          <h3>Your coach, in the loop</h3>
          <div className="b-chat">
            <p className="me">Had biscuits with chai 😅</p>
            <p className="them">Happens! Try roasted chana tomorrow, same crunch.</p>
          </div>
        </article>
      </section>

      <section className="h-how" id="how">
        <h2>How it works</h2>
        <ol className="h-steps">
          <li><b>Sign up</b><span>Takes a minute. Your coach assigns a plan: diet, diet + gym, or the full thing.</span></li>
          <li><b>Log your day</b><span>Meals by slot, weight, water, workout. Photos do most of the typing.</span></li>
          <li><b>Get feedback</b><span>Your coach checks in, comments and tweaks your plan as you go.</span></li>
        </ol>
        <div className="h-coach">
          <h3>Are you a coach?</h3>
          <p>See every client’s day, who’s slipping, their weight and lab trends, and switch features on or off per client.</p>
        </div>
      </section>

      <section className="h-faq" id="faq">
        <h2>Questions</h2>
        {FAQ.map(([q, a]) => (
          <details key={q}>
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </section>

      <section className="h-final">
        <h2>Your first streak day is today. Plate se PR tak, shuru.</h2>
        <Link className="btn btn-pop btn-lg" to={dest || '/signup'}>{dest ? 'Open Fitoor' : 'Start free'}</Link>
      </section>

      <footer className="h-footer">
        <Logo full height={56} />
        <nav className="h-footlinks"><Link to="/recipes">Healthy Indian recipes</Link><Link to="/recipes?tag=weight_loss">Weight-loss recipes</Link><Link to="/recipes?tag=high_protein">High-protein recipes</Link><Link to="/recipes?diet=veg">Veg recipes</Link></nav>
        <p>Not medical advice. Talk to your doctor about lab results.</p>
      </footer>
    </div>
  );
}
