import { useRef, useState } from 'react';
import { Camera, Trash2 } from 'lucide-react';
import { useSignedUrl, setAvatar, removeAvatar } from '../lib/media';
import { useAuth } from '../lib/auth';
import { cheer } from '../lib/cheer';

const TONES = ['var(--lime)', 'var(--lav)', 'var(--sky)', 'var(--haldi)', '#FFD0DC'];
const initials = (name = '') => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '🙂';
const toneOf = (name = '') => TONES[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % TONES.length];

/** Round profile photo, or coloured initials when there's no photo. */
export default function Avatar({ path, name, size = 40, className = '' }) {
  const url = useSignedUrl(path, 'avatars');
  return (
    <span className={`avatar-pic ${className}`} style={{ width: size, height: size, fontSize: Math.round(size * 0.4), background: url ? '#fff' : toneOf(name) }}
      role="img" aria-label={name ? `${name}’s photo` : 'Profile photo'}>
      {url ? <img src={url} alt="" /> : initials(name)}
    </span>
  );
}

/** Your own photo with Change / Remove (Me page for clients, My profile for coaches). */
export function AvatarEditor({ onMessage }) {
  const { user, profile, refresh } = useAuth();
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const pick = async (e) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    if (f.size > 15 * 1024 * 1024) return onMessage?.('That photo is too big. Pick one under 15 MB.', 'bad');
    setBusy(true);
    try { await setAvatar(user.id, f, profile?.avatar_path); await refresh?.(); cheer('profile'); }
    catch (err) { onMessage?.(err.message, 'bad'); }
    setBusy(false);
  };
  const remove = async () => {
    setBusy(true);
    try { await removeAvatar(user.id, profile?.avatar_path); await refresh?.(); onMessage?.('Photo removed'); }
    catch (err) { onMessage?.(err.message, 'bad'); }
    setBusy(false);
  };
  return (
    <div className="avatar-editor">
      <Avatar path={profile?.avatar_path} name={profile?.full_name} size={88} />
      <div className="avatar-editor-actions">
        <b>Profile photo</b>
        <span className="small muted">{profile?.role === 'user' ? 'Your coach sees it next to your name.' : 'Your clients see it on their “My coach” card and next to your notes.'} Only people you work with can see it.</span>
        <div className="avatar-editor-btns">
          <button type="button" className="btn btn-pop btn-sm" onClick={() => input.current?.click()} disabled={busy}><Camera size={16} /> {busy ? 'Saving…' : profile?.avatar_path ? 'Change photo' : 'Add photo'}</button>
          {profile?.avatar_path && <button type="button" className="btn btn-ghost btn-sm" onClick={remove} disabled={busy}><Trash2 size={16} /> Remove</button>}
        </div>
        <input ref={input} type="file" accept="image/*" hidden onChange={pick} aria-label="Choose a profile photo" />
      </div>
    </div>
  );
}
