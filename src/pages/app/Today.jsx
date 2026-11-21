import CalorieScanner from '../../components/CalorieScanner';
import { TodayWomensHealth } from '../../components/WomensHealth';
import { isFemale } from '../../lib/cycle';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { today, addDays } from '../../lib/dates';
import { DateStrip } from '../../components/ui';
import { fmt } from '../../lib/dates';
import DayView from '../../components/DayView';
import { JuiceReminder } from '../../components/JuiceDays';

/** Days in a row with anything logged (meal, weight or workout), counting back from today/yesterday. */
function useStreak(userId) {
  const [streak, setStreak] = useState(null);
  useEffect(() => {
    const since = addDays(today(), -90);
    Promise.all([
      supabase.from('meal_logs').select('log_date').eq('user_id', userId).gte('log_date', since),
      supabase.from('weight_logs').select('log_date').eq('user_id', userId).gte('log_date', since),
      supabase.from('workouts').select('log_date').eq('user_id', userId).gte('log_date', since),
    ]).then((rs) => {
      const days = new Set(rs.flatMap((r) => (r.data || []).map((x) => x.log_date)));
      let d = days.has(today()) ? today() : addDays(today(), -1), n = 0;
      while (days.has(d)) { n++; d = addDays(d, -1); }
      setStreak(n);
    });
  }, [userId]);
  return streak;
}

/** Banner for coach notes the client hasn't seen yet (seen-time kept on this device). */
function CoachNoteBanner({ userId, onOpen }) {
  const key = `ft_notes_seen_${userId}`;
  const [note, setNote] = useState(null);
  useEffect(() => {
    let seen = '';
    try { seen = localStorage.getItem(key) || ''; } catch { /* storage unavailable */ }
    supabase.from('comments').select('id, body, log_date, created_at, author:author_id(role)').eq('user_id', userId)
      .neq('author_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => { if (data && data.created_at > seen) setNote(data); });
  }, [userId]);
  if (!note) return null;
  const dismiss = () => { try { localStorage.setItem(key, note.created_at); } catch { /* ignore */ } setNote(null); };
  return (
    <div className="coach-banner" role="status">
      <span className="coach-banner-emoji" aria-hidden>💬</span>
      <div className="grow">
        <b>New note from your coach{note.log_date ? ` · ${fmt(note.log_date)}` : ''}</b>
        <p>{note.body}</p>
      </div>
      <div className="coach-banner-actions">
        {note.log_date && <button className="btn btn-ghost btn-sm" onClick={() => { onOpen(note.log_date); dismiss(); }}>Open day</button>}
        <button className="btn btn-pop btn-sm" onClick={dismiss}>Got it</button>
      </div>
    </div>
  );
}

export default function Today() {
  const { user, profile, has } = useAuth();
  const [sp, setSp] = useSearchParams();
  const [scan, setScan] = useState(false);
  const date = sp.get('date') || today();
  const streak = useStreak(user.id);
  const hour = new Date().getHours();
  const greet = hour < 5 ? 'Up late' : hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  return (
    <div className="page">
      <div className="page-head">
        <div className="greet-row">
          <h1><span className="phone-only">{greet}, {profile?.full_name?.split(' ')[0] || 'there'}</span><span className="desk-only">Your day</span></h1>
          {streak != null && (
            <span className={`streak ${streak ? '' : 'cold'}`} title="Days in a row with something logged">
              {streak ? `🔥 ${streak}-day streak` : '🌱 Start your streak today'}
            </span>
          )}
        </div>
        <DateStrip value={date} onChange={(d) => setSp(d === today() ? {} : { date: d })} />
      </div>
      {has('ai') && (
        <button type="button" className="scan-cta" onClick={() => setScan(true)}>
          <span className="scan-cta-emoji" aria-hidden>📸</span>
          <span><b>Guess calories from a photo</b><small>Snap your plate, AI adds it up. Log it or just check.</small></span>
        </button>
      )}
      {scan && <CalorieScanner date={date} onClose={() => setScan(false)} />}
      <JuiceReminder userId={user.id} />
      {profile && isFemale(profile) && <TodayWomensHealth profile={profile} />}
      <CoachNoteBanner userId={user.id} onOpen={(d) => setSp(d === today() ? {} : { date: d })} />
      <DayView userId={user.id} date={date} mode="user" />
    </div>
  );
}
