import { useEffect, useState } from 'react';
import { Send, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { fmt, fmtTime } from '../lib/dates';
import { Empty } from './ui';

/** Notes thread on a user's record. date = null shows all notes (newest first). */
export default function Comments({ userId, date = null, context = 'general', placeholder }) {
  const { user, isAdmin } = useAuth();
  const [list, setList] = useState([]);
  const [text, setText] = useState('');
  const [ctx, setCtx] = useState(context);

  const load = async () => {
    let q = supabase.from('comments').select('*, author:author_id(full_name, role)').eq('user_id', userId).order('created_at', { ascending: !!date });
    if (date) q = q.eq('log_date', date);
    const { data } = await q.limit(100);
    setList(data || []);
  };
  useEffect(() => { load(); }, [userId, date]);

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    await supabase.from('comments').insert({ user_id: userId, author_id: user.id, log_date: date, context: ctx, body: text.trim() });
    setText(''); load();
  };
  const del = async (c) => { await supabase.from('comments').delete().eq('id', c.id); load(); };

  return (
    <div className="comments">
      {list.length ? list.map((c) => (
        <div key={c.id} className={`comment ${c.author?.role === 'admin' ? 'from-coach' : 'from-user'}`}>
          <div className="comment-meta">
            <b>{c.author?.role === 'admin' ? `Coach${c.author?.full_name ? ' · ' + c.author.full_name : ''}` : c.author?.full_name || 'You'}</b>
            {c.context !== 'general' && <span className="tag">{c.context}</span>}
            <small className="muted">{!date && c.log_date ? fmt(c.log_date) + ' · ' : ''}{fmtTime(c.created_at)}</small>
            {(c.author_id === user.id || isAdmin) && <button className="icon-btn sm" onClick={() => del(c)} aria-label="Delete"><Trash2 size={14} /></button>}
          </div>
          <p>{c.body}</p>
        </div>
      )) : <Empty>No notes yet.</Empty>}
      <form className="comment-form" onSubmit={send}>
        {isAdmin && (
          <select value={ctx} onChange={(e) => setCtx(e.target.value)} aria-label="Note type">
            {['general', 'meal', 'weight', 'workout', 'lab', 'health'].map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder || (isAdmin ? 'Add a health note or feedback…' : 'Reply to your coach…')} />
        <button className="btn btn-primary" aria-label="Send"><Send size={16} /></button>
      </form>
    </div>
  );
}
