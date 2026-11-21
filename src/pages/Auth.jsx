import { TERMS_VERSION } from '../lib/legal';
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase, rememberMe, setRememberMe } from '../lib/supabase';
import { trackLogin, markSessionLogged, clearSessionMark } from '../lib/track';
import { useAuth } from '../lib/auth';
import { Logo, Spinner } from '../components/ui';

function AuthFrame({ title, sub, children }) {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link to="/"><Logo full height={64} /></Link>
        <h1>{title}</h1>
        {sub && <p className="muted">{sub}</p>}
        {children}
        <p className="auth-legal small muted"><Link to="/terms">Terms</Link> · <Link to="/privacy">Privacy</Link></p>
      </div>
    </div>
  );
}

export function Login() {
  const nav = useNavigate();
  const loc = useLocation();
  const { user, isAdmin } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [remember, setRemember] = useState(rememberMe());

  useEffect(() => { if (user) nav(loc.state?.from || (isAdmin ? '/admin' : '/app'), { replace: true }); }, [user, isAdmin]);

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr('');
    setRememberMe(remember);       // decides where the new session is stored
    markSessionLogged();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) { clearSessionMark(); return setErr(error.message); }
    trackLogin('sign_in');
  };
  return (
    <AuthFrame title="Welcome back" sub="Log in to track today's meals and workout.">
      <form onSubmit={submit} className="form">
        <label>Email<input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label>Password<input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        <label className="check remember"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Keep me signed in on this device</label>
        {err && <p className="error">{err}</p>}
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? <Spinner /> : 'Log in'}</button>
        <p className="small muted auth-note">Untick on a shared phone or computer: you’ll be signed out when you close the browser.</p>
      </form>
      <p className="auth-alt"><Link to="/reset">Forgot password?</Link> · New here? <Link to="/signup">Create an account</Link></p>
    </AuthFrame>
  );
}

/** Coach code: optional. From an invite link (?coach=CODE) it's prefilled and locked. Shows the coach's first name when valid. */
function useCoachCode() {
  const fromLink = (new URLSearchParams(location.search).get('coach') || '').trim().toUpperCase();
  const [code, setCode] = useState(fromLink);
  const [coach, setCoach] = useState({ state: 'idle', name: '' }); // idle | checking | ok | bad
  useEffect(() => {
    const c = code.trim();
    if (c.length < 4) { setCoach({ state: 'idle', name: '' }); return; }
    setCoach({ state: 'checking', name: '' });
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc('coach_lookup', { code: c });
      setCoach(data ? { state: 'ok', name: data } : { state: 'bad', name: '' });
    }, 350);
    return () => clearTimeout(t);
  }, [code]);
  return { code, setCode, locked: !!fromLink, coach };
}

export function Signup() {
  const nav = useNavigate();
  const cc = useCoachCode();
  const [f, setF] = useState({ full_name: '', phone: '', email: '', password: '' });
  const [agree, setAgree] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (!agree) return setErr('Please tick the box to agree to the Terms and Privacy Policy.');
    setBusy(true); setErr('');
    setRememberMe(true); markSessionLogged();
    const { data, error } = await supabase.auth.signUp({
      email: f.email, password: f.password,
      options: { data: { full_name: f.full_name, phone: f.phone, coach_code: cc.coach.state === 'ok' ? cc.code.trim().toUpperCase() : '', terms_version: TERMS_VERSION, terms_agreed_at: new Date().toISOString() }, emailRedirectTo: `${location.origin}/app` },
    });
    setBusy(false);
    if (error) { clearSessionMark(); return setErr(error.message); }
    if (data.session) { trackLogin('sign_up'); nav('/app'); } else { clearSessionMark(); setDone(true); }
  };
  if (done) return <AuthFrame title="Check your email" sub={`We sent a confirmation link to ${f.email}. Open it on this phone to finish signing up.`} />;
  return (
    <AuthFrame title="Create your account" sub={cc.coach.state === 'ok' ? `You’re joining ${cc.coach.name}’s coaching on Fitoor.` : 'Your coach will set up your plan after you join.'}>
      <form onSubmit={submit} className="form">
        <label>Full name<input required value={f.full_name} onChange={set('full_name')} autoComplete="name" /></label>
        <label>Mobile (optional)<input type="tel" value={f.phone} onChange={set('phone')} autoComplete="tel" /></label>
        <label>Email<input type="email" required value={f.email} onChange={set('email')} autoComplete="email" /></label>
        <label>Password<input type="password" required minLength={8} value={f.password} onChange={set('password')} autoComplete="new-password" /></label>
        <label>Coach code {cc.locked ? '' : <span className="muted">(optional)</span>}
          <input value={cc.code} readOnly={cc.locked} onChange={(e) => cc.setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            placeholder="e.g. RIYA42" maxLength={12} autoCapitalize="characters" className={cc.locked ? 'locked' : ''} aria-describedby="coach-code-hint" />
        </label>
        <p id="coach-code-hint" className={`small coach-hint ${cc.coach.state}`}>
          {cc.coach.state === 'ok' ? `✓ Coach: ${cc.coach.name}${cc.locked ? ' (from your invite link)' : ''}`
            : cc.coach.state === 'bad' ? 'We couldn’t find that code. You can still sign up and we’ll match you with a coach.'
            : cc.coach.state === 'checking' ? 'Checking code…'
            : 'Got a code from your coach? Enter it here. No code? Leave it empty and we’ll assign a coach.'}
        </p>
        <label className="check signup-agree">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} required />
          <span>I’m 18 or older and I agree to the <Link to="/terms" target="_blank">Terms of Service</Link> and <Link to="/privacy" target="_blank">Privacy Policy</Link>, including the processing of my health data and the use of AI features.</span>
        </label>
        {err && <p className="error">{err}</p>}
        <button className="btn btn-primary btn-block" disabled={busy || !agree}>{busy ? <Spinner /> : 'Sign up'}</button>
        <p className="small muted auth-note">To keep your account safe we log each sign-in: time, IP address, approximate city and device. You can see yours under Me.</p>
      </form>
      <p className="auth-alt">Already have an account? <Link to="/login">Log in</Link></p>
    </AuthFrame>
  );
}

export function ResetPassword() {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  // Arriving from the email link logs the user in → let them set a new password
  if (user) {
    const save = async (e) => {
      e.preventDefault(); setBusy(true);
      const { error } = await supabase.auth.updateUser({ password: pw });
      setBusy(false); setMsg(error ? error.message : 'Password updated. You can continue to the app.');
    };
    return (
      <AuthFrame title="Set a new password">
        <form onSubmit={save} className="form">
          <label>New password<input type="password" minLength={8} required value={pw} onChange={(e) => setPw(e.target.value)} /></label>
          {msg && <p className="muted">{msg}</p>}
          <button className="btn btn-primary btn-block" disabled={busy}>Save password</button>
          <Link to="/app" className="btn btn-ghost btn-block">Go to app</Link>
        </form>
      </AuthFrame>
    );
  }
  const send = async (e) => {
    e.preventDefault(); setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/reset` });
    setBusy(false); setMsg(error ? error.message : 'Check your email for a reset link.');
  };
  return (
    <AuthFrame title="Reset password">
      <form onSubmit={send} className="form">
        <label>Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        {msg && <p className="muted">{msg}</p>}
        <button className="btn btn-primary btn-block" disabled={busy}>Send reset link</button>
      </form>
      <p className="auth-alt"><Link to="/login">Back to log in</Link></p>
    </AuthFrame>
  );
}
