import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../lib/auth';
import { cheerText } from '../lib/cheer';

/** One global success toast. Clients get a motivating line; coaches a plain confirmation. */
export default function CheerToast() {
  const { isAdmin } = useAuth() || {};
  const [t, setT] = useState(null);
  const timer = useRef(null);
  useEffect(() => {
    const on = (e) => {
      const c = cheerText(e.detail?.kind, e.detail?.text);
      setT(isAdmin && !c.bad ? { emoji: '✅', title: e.detail?.kind === 'removed' ? 'Removed' : 'Saved', line: 'Updated for your client.', id: Date.now() } : { ...c, id: Date.now() });
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setT(null), 3600);
    };
    window.addEventListener('ft:cheer', on);
    return () => { window.removeEventListener('ft:cheer', on); clearTimeout(timer.current); };
  }, [isAdmin]);
  return (
    <div className="cheer-wrap" aria-live="polite" role="status">
      {t && (
        <button key={t.id} className={`cheer ${t.bad ? 'cheer-bad' : ''}`} onClick={() => setT(null)} aria-label="Dismiss">
          <span className="cheer-emoji" aria-hidden>{t.emoji}</span>
          <span><b>{t.title}</b><small>{t.line}</small></span>
        </button>
      )}
    </div>
  );
}
