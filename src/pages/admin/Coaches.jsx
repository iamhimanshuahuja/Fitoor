import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { UserPlus, Pencil, Check, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { useCoaches, makeCoachCode, signupLink } from '../../lib/coaches';
import { Card, Empty, Spinner, useToast } from '../../components/ui';
import { InviteButtons } from './Users';

/** Super admin: manage coach accounts, their codes and client counts. */
export default function Coaches() {
  const { user } = useAuth();
  const [coaches, reload] = useCoaches(true);
  const [counts, setCounts] = useState(null);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState(null); // { id, code }
  const [toast, show] = useToast();

  const loadCounts = async () => {
    const { data } = await supabase.from('profiles').select('coach_id').eq('role', 'user');
    const c = { none: 0 };
    (data || []).forEach((r) => { if (r.coach_id) c[r.coach_id] = (c[r.coach_id] || 0) + 1; else c.none++; });
    setCounts(c);
  };
  useEffect(() => { loadCounts(); }, []);

  const addCoach = async (e) => {
    e.preventDefault();
    const em = email.trim().toLowerCase();
    if (!em) return;
    setBusy(true);
    const { data: p } = await supabase.from('profiles').select('id, full_name, email, role').ilike('email', em).maybeSingle();
    if (!p) { setBusy(false); return show(`No account for ${em}. Ask them to sign up first at ${location.origin}/signup, then add them here.`, 'bad'); }
    if (p.role !== 'user') { setBusy(false); return show(`${p.full_name} is already ${p.role === 'coach' ? 'a coach' : 'a super admin'}.`, 'bad'); }
    if (!confirm(`Make ${p.full_name} (${p.email}) a coach? They will only see clients you assign to them or who sign up with their code.`)) { setBusy(false); return; }
    let error;
    for (let i = 0; i < 4; i++) { // retry if the random code is taken
      ({ error } = await supabase.from('profiles').update({ role: 'coach', coach_code: makeCoachCode(p.full_name, p.email), coach_id: null }).eq('id', p.id));
      if (!error || !/duplicate|unique/i.test(error.message)) break;
    }
    setBusy(false);
    if (error) return show(error.message, 'bad');
    setEmail(''); show(`${p.full_name} is now a coach`); reload(); loadCounts();
  };

  const saveCode = async () => {
    const code = edit.code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length < 4) return show('Use at least 4 letters or digits', 'bad');
    const { error } = await supabase.from('profiles').update({ coach_code: code }).eq('id', edit.id);
    if (error) return show(/duplicate|unique/i.test(error.message) ? 'That code is already used by another coach' : error.message, 'bad');
    setEdit(null); reload(); show('Code updated. Old invite links with the previous code stop assigning.');
  };

  const removeCoach = async (c) => {
    const n = counts?.[c.id] || 0;
    if (!confirm(`Remove ${c.full_name} as a coach?${n ? `\n\nTheir ${n} client${n > 1 ? 's' : ''} will move to "Waiting for a coach" — you can reassign them from Clients.` : ''}\n\nTheir account stays; they become a normal user and lose access to all client data.`)) return;
    const { error: e1 } = await supabase.from('profiles').update({ coach_id: null }).eq('coach_id', c.id).eq('role', 'user');
    if (e1) return show(e1.message, 'bad');
    const { error } = await supabase.from('profiles').update({ role: 'user', coach_code: null }).eq('id', c.id);
    if (error) return show(error.message, 'bad');
    show(`${c.full_name} is no longer a coach`); reload(); loadCounts();
  };

  return (
    <div className="page">
      {toast}
      <div className="page-head"><h1>Coaches</h1></div>
      <Card title="Add a coach">
        <p className="small muted">The coach signs up like a client first. Then enter their email here to turn the account into a coach account. Each coach gets a code; clients who sign up with it (or with the coach’s invite link) are assigned to them automatically.</p>
        <form className="row gap wrap" onSubmit={addCoach}>
          <input className="grow" type="email" placeholder="coach@email.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Coach email" />
          <button className="btn btn-primary" disabled={busy}>{busy ? <Spinner size={16} /> : <UserPlus size={16} />} Make coach</button>
        </form>
      </Card>

      <Card title="Coach team">
        {!coaches.length || !counts ? <Spinner /> : (
          <div className="table-wrap">
            <table className="table coach-table">
              <thead><tr><th>Coach</th><th>Role</th><th>Code</th><th>Clients</th><th>Invite</th><th></th></tr></thead>
              <tbody>
                {coaches.map((c) => (
                  <tr key={c.id}>
                    <td><b>{c.full_name}</b>{c.id === user.id && <span className="tag">you</span>}<div className="muted small">{c.email}</div></td>
                    <td>{c.role === 'super_admin' ? 'Super admin' : 'Coach'}</td>
                    <td className="nowrap">
                      {edit?.id === c.id ? (
                        <span className="row gap">
                          <input value={edit.code} onChange={(e) => setEdit({ ...edit, code: e.target.value })} maxLength={12} style={{ width: 120 }} aria-label="Coach code" />
                          <button className="icon-btn sm" onClick={saveCode} aria-label="Save code"><Check size={15} /></button>
                          <button className="icon-btn sm" onClick={() => setEdit(null)} aria-label="Cancel"><X size={15} /></button>
                        </span>
                      ) : (
                        <span className="row gap"><code className="coach-code">{c.coach_code || '—'}</code>
                          <button className="icon-btn sm" onClick={() => setEdit({ id: c.id, code: c.coach_code || makeCoachCode(c.full_name, c.email) })} aria-label="Edit code"><Pencil size={14} /></button></span>
                      )}
                    </td>
                    <td><Link to={`/admin/users?coach=${c.id}`}>{counts[c.id] || 0}</Link></td>
                    <td>{c.coach_code ? <InviteButtons code={c.coach_code} label="Copy link" /> : '—'}</td>
                    <td>{c.role === 'coach' && <button className="btn btn-ghost btn-sm" onClick={() => removeCoach(c)}>Remove coach</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {counts?.none > 0 && <p className="small" style={{ marginTop: 10 }}><Link to="/admin/users?coach=none"><b>{counts.none} client{counts.none > 1 ? 's' : ''} waiting for a coach →</b></Link></p>}
        {!coaches.length && <Empty>No coaches yet.</Empty>}
      </Card>
      <p className="small muted">Coaches only see clients assigned to them. When a client moves to a new coach, the new coach sees the client’s full history but not the previous coach’s name. Only you see coach names and the assignment history.</p>
      <p className="small muted">Plain signup link without a coach: <code>{signupLink('')}</code></p>
    </div>
  );
}
