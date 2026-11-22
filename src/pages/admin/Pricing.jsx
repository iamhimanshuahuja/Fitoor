import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useTiers, inr } from '../../lib/aiQuota';
import { cheer } from '../../lib/cheer';
import { fmt } from '../../lib/dates';
import { Card, Empty, Spinner } from '../../components/ui';
import Avatar from '../../components/Avatar';
import TierEditor from '../../components/TierEditor';

/** Super admin: pricing tiers (shown on the home page), upgrade requests and everyone on a paid plan or offer. */
export default function Pricing() {
  const [tiers, reload] = useTiers();
  const [rows, setRows] = useState(null);
  const [people, setPeople] = useState(null);
  const [open, setOpen] = useState(null);
  const [filter, setFilter] = useState('requests');
  useEffect(() => { if (tiers) setRows(tiers.map((t) => ({ ...t }))); }, [tiers]);
  const loadPeople = () => supabase.from('profiles').select('id, full_name, email, role, avatar_path, tier, tier_until, ai_chat_limit, ai_ask, tier_price, tier_note, tier_requested, tier_requested_at')
    .order('tier_requested_at', { ascending: false, nullsFirst: false }).then(({ data }) => setPeople(data || []));
  useEffect(() => { loadPeople(); }, []);

  const upd = (i, k, v) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const saveTier = async (r) => {
    const { error } = await supabase.from('ai_tiers').update({ name: r.name, price_inr: Number(r.price_inr) || 0, chat_per_day: Number(r.chat_per_day) || 0, can_ask: !!r.can_ask, blurb: r.blurb || null, active: !!r.active, sort: Number(r.sort) || 0, updated_at: new Date().toISOString() }).eq('key', r.key);
    if (error) return cheer('error', error.message);
    cheer('saved'); reload();
  };
  const addTier = async () => {
    const key = prompt('Short key for the new plan (letters only, e.g. "team")')?.trim().toLowerCase().replace(/[^a-z]/g, '');
    if (!key) return;
    const { error } = await supabase.from('ai_tiers').insert({ key, name: key[0].toUpperCase() + key.slice(1), price_inr: 0, chat_per_day: 3, sort: (rows?.length || 0) + 1, active: false });
    if (error) return cheer('error', error.message);
    reload();
  };

  const list = (people || []).filter((p) => filter === 'requests' ? p.tier_requested : filter === 'paid' ? (p.tier !== 'free' || p.ai_chat_limit != null || p.ai_ask != null) : true);
  return (
    <div className="page">
      <div className="page-head"><h1>Pricing</h1><Link to="/#pricing" className="btn btn-ghost btn-sm" target="_blank">See on home page</Link></div>
      <Card title="Plans" action={<button type="button" className="btn btn-ghost btn-sm" onClick={addTier}>+ Add plan</button>}>
        <p className="small muted">Every feature is on every plan; plans set the daily AI allowance (chat logs + Ask AI questions) for clients and coaches. Changes apply right away. Active plans show on the home page.</p>
        {!rows ? <Spinner /> : (
          <div className="tier-cards">{rows.map((r, i) => (
            <div key={r.key} className="tier-card">
              <div className="grid-form">
                <label>Plan name <span className="muted">({r.key})</span><input value={r.name} onChange={(e) => upd(i, 'name', e.target.value)} /></label>
                <label>₹ per month<input type="number" min="0" inputMode="numeric" value={r.price_inr} onChange={(e) => upd(i, 'price_inr', e.target.value)} /></label>
                <label>AI chats per day<input type="number" min="0" inputMode="numeric" value={r.chat_per_day} onChange={(e) => upd(i, 'chat_per_day', e.target.value)} /></label>
                <label>Order on home page<input type="number" inputMode="numeric" value={r.sort} onChange={(e) => upd(i, 'sort', e.target.value)} /></label>
                <label className="span-all">Line on home page<input value={r.blurb || ''} onChange={(e) => upd(i, 'blurb', e.target.value)} maxLength={120} /></label>
              </div>
              <div className="row gap wrap tier-card-foot">
                <label className="check"><input type="checkbox" checked={!!r.can_ask} onChange={(e) => upd(i, 'can_ask', e.target.checked)} /> Ask AI included</label>
                <label className="check"><input type="checkbox" checked={!!r.active} onChange={(e) => upd(i, 'active', e.target.checked)} /> Show on home page</label>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => saveTier(r)}>Save {r.name}</button>
              </div>
            </div>
          ))}</div>
        )}
      </Card>

      <Card title="People" action={
        <div className="chips-row">{[['requests', 'Upgrade requests'], ['paid', 'Paid & offers'], ['all', 'Everyone']].map(([k, l]) => <button key={k} type="button" className={`chip ${filter === k ? 'on' : ''}`} onClick={() => setFilter(k)}>{l}{k === 'requests' && people ? ` (${people.filter((p) => p.tier_requested).length})` : ''}</button>)}</div>
      }>
        {!people ? <Spinner /> : !list.length ? <Empty>{filter === 'requests' ? 'No upgrade requests right now.' : 'Nobody here yet.'}</Empty> : list.map((p) => (
          <div key={p.id} className="tier-person">
            <button type="button" className="tier-person-head" onClick={() => setOpen(open === p.id ? null : p.id)} aria-expanded={open === p.id}>
              <span className="person"><Avatar path={p.avatar_path} name={p.full_name} size={32} /><span><b>{p.full_name || p.email}</b> <span className="muted small">{p.role === 'user' ? 'client' : p.role === 'coach' ? 'coach' : 'super admin'}</span></span></span>
              <span className="small">{tiers?.find((t) => t.key === p.tier)?.name || p.tier}{p.tier_until ? ` · until ${fmt(p.tier_until)}` : ''}{p.tier_price != null ? ` · ${inr(p.tier_price)}` : ''}{p.tier_requested ? <b> · wants {tiers?.find((t) => t.key === p.tier_requested)?.name || p.tier_requested}</b> : ''}</span>
            </button>
            {open === p.id && <TierEditor profile={p} compact onSaved={loadPeople} />}
          </div>
        ))}
      </Card>
    </div>
  );
}
