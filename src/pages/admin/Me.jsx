import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { cheer } from '../../lib/cheer';
import { Card, useToast } from '../../components/ui';
import { AvatarEditor } from '../../components/Avatar';

/** Coach / super admin: own name, phone and profile photo (clients see these next to coach notes and on "My coach"). */
export default function AdminMe() {
  const { profile, refresh, isSuper } = useAuth();
  const [f, setF] = useState({ full_name: '', phone: '' });
  const [busy, setBusy] = useState(false);
  const [toast, show] = useToast();
  useEffect(() => { if (profile) setF({ full_name: profile.full_name || '', phone: profile.phone || '' }); }, [profile]);
  const save = async (e) => {
    e.preventDefault();
    if (!f.full_name.trim()) return show('Add your name', 'bad');
    setBusy(true);
    const { error } = await supabase.from('profiles').update({ full_name: f.full_name.trim(), phone: f.phone.trim() || null }).eq('id', profile.id);
    setBusy(false);
    if (error) return show(error.message, 'bad');
    cheer('profile'); refresh();
  };
  return (
    <div className="page">
      <div className="page-head"><h1>My profile</h1></div>
      <Card><AvatarEditor onMessage={show} /></Card>
      <Card title="Details">
        <form onSubmit={save} className="form">
          <label>Full name<input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} required /></label>
          <label>Mobile<input type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></label>
          <p className="small muted">Your clients see your name and photo on their “My coach” card and next to your notes.{profile?.coach_code ? ` Your coach code: ${profile.coach_code}` : ''}{isSuper ? ' · Super admin' : ''}</p>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </form>
      </Card>
      {toast}
    </div>
  );
}
