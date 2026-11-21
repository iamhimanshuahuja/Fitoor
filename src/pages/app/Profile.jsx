import { Link } from 'react-router-dom';
import { LEGAL_CONTACT } from '../../lib/legal';
import { cheer } from '../../lib/cheer';
import { WomensHealthForm, PeriodTracker } from '../../components/WomensHealth';
import { isFemale } from '../../lib/cycle';
import { LoginHistory } from '../../components/ActivityLog';
import { useEffect, useState } from 'react';
import { Smartphone, Share } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { FEATURES } from '../../lib/constants';
import { Card, Spinner, useToast } from '../../components/ui';
import Avatar, { AvatarEditor } from '../../components/Avatar';

/** Shows the client's current coach (RLS lets a client read only their own coach's profile). */
function MyCoach({ coachId }) {
  const [c, setC] = useState(undefined);
  useEffect(() => {
    if (!coachId) { setC(null); return; }
    supabase.from('profiles').select('full_name, avatar_path').eq('id', coachId).maybeSingle().then(({ data }) => setC(data || null));
  }, [coachId]);
  if (c === undefined) return null;
  return (
    <Card title="My coach">
      {c ? (
        <div className="my-coach"><Avatar path={c.avatar_path} name={c.full_name} size={48} /><div><b>{c.full_name}</b><div className="small muted">Sees your logs, plan and reports, and replies in notes.</div></div></div>
      ) : <p className="small muted">You don’t have a coach yet. We’ll match you with one soon.</p>}
    </Card>
  );
}

export default function Profile() {
  const { profile, refresh, features, isAdmin } = useAuth();
  const [f, setF] = useState(null);
  const [busy, setBusy] = useState(false);
  const [toast, show] = useToast();
  useEffect(() => { if (profile) setF(profile); }, [profile]);
  useEffect(() => { if (f && location.hash === '#womens-health') setTimeout(() => document.getElementById('womens-health')?.scrollIntoView({ behavior: 'smooth' }), 200); }, [!!f]);
  if (!f) return <div className="center-pad"><button className="btn btn-primary" onClick={refresh}>Reload profile</button></div>;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    if (f.dob) {
      const d = new Date(f.dob + 'T00:00:00'), now = new Date();
      const age = now.getFullYear() - d.getFullYear() - (now < new Date(now.getFullYear(), d.getMonth(), d.getDate()) ? 1 : 0);
      if (d > now) return show('Date of birth can’t be in the future', 'bad');
      if (age < 18) return show('Fitoor is for people aged 18 and over (see our Terms).', 'bad');
    }
    setBusy(true);
    const { error } = await supabase.from('profiles').update({
      full_name: f.full_name, phone: f.phone || null, gender: f.gender || null, dob: f.dob || null,
      height_cm: f.height_cm || null, start_weight: f.start_weight || null, target_weight: f.target_weight || null, goal: f.goal || null, diet_pref: f.diet_pref || null,
    }).eq('id', f.id);
    setBusy(false);
    if (error) show(error.message, 'bad'); else cheer('profile');
    refresh();
  };
  const isIOS = /iphone|ipad/i.test(navigator.userAgent);
  const standalone = window.matchMedia('(display-mode: standalone)').matches;

  return (
    <div className="page">
      {toast}
      <div className="page-head"><h1>My profile</h1></div>
      {!standalone && (
        <Card className="install">
          <Smartphone size={22} />
          <div>
            <b>Install Fitoor on your phone</b>
            <p className="small">{isIOS ? <>In Safari tap <Share size={13} /> Share → <b>Add to Home Screen</b>.</> : <>In Chrome tap ⋮ → <b>Install app</b> / Add to Home screen.</>}</p>
          </div>
        </Card>
      )}
      <Card><AvatarEditor onMessage={show} /></Card>
      <Card title="Details">
        <form className="form" onSubmit={save}>
          <label>Full name<input value={f.full_name || ''} onChange={set('full_name')} required /></label>
          <div className="row gap">
            <label className="grow">Mobile<input type="tel" value={f.phone || ''} onChange={set('phone')} /></label>
            <label className="grow">Gender<select value={f.gender || ''} onChange={set('gender')}><option value="">—</option><option>Male</option><option>Female</option><option>Other</option></select></label>
          </div>
          <div className="row gap">
            <label className="grow">Date of birth<input type="date" value={f.dob || ''} onChange={set('dob')} /></label>
            <label className="grow">Height (cm)<input type="number" inputMode="decimal" value={f.height_cm || ''} onChange={set('height_cm')} /></label>
          </div>
          <div className="row gap">
            <label className="grow">Starting weight (kg)<input type="number" step="0.1" inputMode="decimal" value={f.start_weight || ''} onChange={set('start_weight')} /></label>
            <label className="grow">Target weight (kg)<input type="number" step="0.1" inputMode="decimal" value={f.target_weight || ''} onChange={set('target_weight')} /></label>
          </div>
          <label>I eat<select value={f.diet_pref || ''} onChange={set('diet_pref')}><option value="">Not set</option><option value="veg">Veg</option><option value="egg">Eggetarian (veg + egg)</option><option value="nonveg">Non-veg</option></select></label>
          <label>My goal<textarea rows={2} value={f.goal || ''} onChange={set('goal')} placeholder="e.g. Lose 8 kg, improve cholesterol, build strength" /></label>
          <button className="btn btn-primary" disabled={busy}>{busy ? <Spinner /> : 'Save'}</button>
        </form>
      </Card>
      <MyCoach coachId={profile.coach_id} />
      {isFemale(f) && (
        <div id="womens-health">
          <WomensHealthForm profile={profile} onSaved={refresh} />
          {profile.track_cycle && <PeriodTracker userId={profile.id} />}
        </div>
      )}
      <Card title="My plan">
        <p><b>{profile.plans?.name || 'No plan yet'}</b>{isAdmin && ' · Staff'}</p>
        <div className="chips-row">
          {FEATURES.map((x) => <span key={x.key} className={`chip ${features.includes(x.key) ? 'on ok' : 'off'}`}>{x.label}</span>)}
        </div>
        <p className="small muted">Your coach controls which features are switched on.</p>
      </Card>
      <LoginHistory userId={profile.id} limit={5} title="Recent sign-ins on your account" compact />
      <p className="small muted">Don’t recognise a sign-in? Change your password from the login page (Forgot password) and tell your coach.</p>
      <Card title="Privacy & terms">
        <p className="small">{profile.terms_accepted_at ? `You agreed to our Terms and Privacy Policy on ${new Date(profile.terms_accepted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}.` : 'Terms not agreed yet.'}</p>
        <div className="row gap wrap">
          <Link className="btn btn-ghost btn-sm" to="/terms">Terms of Service</Link>
          <Link className="btn btn-ghost btn-sm" to="/privacy">Privacy Policy</Link>
          <Link className="btn btn-ghost btn-sm" to="/privacy#ai">How we use AI</Link>
        </div>
        <p className="small muted">Want a copy of your data, a correction, or your account deleted? Email <a href={`mailto:${LEGAL_CONTACT}?subject=Fitoor%20data%20request&body=Account%20email%3A%20${encodeURIComponent(profile.email || '')}%0A%0ARequest%3A%20`}>{LEGAL_CONTACT}</a> from your account email. We reply within 30 days.</p>
      </Card>
    </div>
  );
}
