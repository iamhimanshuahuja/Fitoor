import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { TERMS_VERSION } from '../lib/legal';
import { Spinner } from './ui';

/**
 * One-time "agree to Terms & Privacy" screen for signed-in people (clients and coaches).
 * Shows when profiles.terms_version is not the current TERMS_VERSION. If they ticked the box at
 * signup (user_metadata.terms_version), we record it silently. Server sets terms_accepted_at.
 */
export default function TermsGate() {
  const { user, profile, refresh, isAdmin, signOut } = useAuth();
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const need = !!(user && profile && profile.terms_version !== TERMS_VERSION);
  const atSignup = user?.user_metadata?.terms_version === TERMS_VERSION;

  const accept = async () => {
    setBusy(true); setErr('');
    const { error } = await supabase.from('profiles').update({ terms_version: TERMS_VERSION }).eq('id', user.id);
    setBusy(false);
    if (error) return setErr(error.message);
    refresh?.();
  };
  useEffect(() => { if (need && atSignup) accept(); }, [need, atSignup]);

  if (!need || atSignup) return null;
  const updated = !!profile.terms_version;
  return (
    <div className="gate" role="dialog" aria-modal="true" aria-labelledby="gate-title">
      <div className="gate-card">
        <h2 id="gate-title">{updated ? 'We’ve updated our terms' : 'One quick thing before you continue'}</h2>
        <p>Fitoor keeps health data (meals, weight, photos, lab reports{isAdmin ? ' of your clients' : ''}), so we want you to know how it’s handled:</p>
        <ul>
          <li>Only {isAdmin ? 'you (for your own clients) and the Fitoor admin' : 'you, your coach and the Fitoor admin'} can see logs.</li>
          <li>AI features send the photo or text you choose to our AI provider to make an estimate. You check every result before it’s saved. New: the text of AI chat and Ask AI messages is kept 30 days so the Fitoor admin can check quality and misuse (photos aren’t kept).</li>
          <li>Fitoor is not medical advice. Talk to your doctor about health decisions.</li>
          {isAdmin && <li>As a coach you keep client data confidential and use it only for coaching on Fitoor.</li>}
          <li>We don’t sell your data or show ads. You can ask us to delete it any time.</li>
        </ul>
        <label className="check gate-check">
          <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} />
          <span>I’m 18 or older and I agree to the <Link to="/terms" target="_blank">Terms of Service</Link> and <Link to="/privacy" target="_blank">Privacy Policy</Link>, including the processing of my health data and the use of AI features as described.</span>
        </label>
        {err && <p className="error small">{err}</p>}
        <div className="row gap wrap">
          <button className="btn btn-primary" disabled={!ok || busy} onClick={accept}>{busy ? <Spinner /> : 'Agree & continue'}</button>
          <button className="btn btn-ghost" onClick={signOut}>Not now, sign out</button>
        </div>
      </div>
    </div>
  );
}
