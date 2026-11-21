import { useEffect, useMemo, useState } from 'react';
import { Pencil, Trash2, Info } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { today, fmtLong } from '../lib/dates';
import { cheer } from '../lib/cheer';
import { downloadCSV } from '../lib/csv';
import { SITES, SITE_KEYS, getUnit, setUnitPref, toUnit, fromUnit, fmtVal, measureStats, loadMeasurements } from '../lib/measure';
import { TrendLine } from './Charts';
import { Card, Empty, Spinner, useToast } from './ui';

/** Body measurements (inches) — used by the client's Weight page and the coach's client Weight tab. */
export default function Measurements({ userId, coach = false }) {
  const [rows, setRows] = useState(null);
  const [unit, setUnit] = useState(getUnit());
  const [site, setSite] = useState('waist');
  const [open, setOpen] = useState(false);
  const [showHow, setShowHow] = useState(false);
  const [date, setDate] = useState(today());
  const [vals, setVals] = useState({});
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, show] = useToast();

  const load = () => loadMeasurements(userId).then(setRows);
  useEffect(() => { load(); }, [userId]);
  useEffect(() => {
    const reload = () => load();
    window.addEventListener('ft:data-changed', reload);
    return () => window.removeEventListener('ft:data-changed', reload);
  }, [userId]);
  useEffect(() => {
    if (window.location.hash === '#inches') { setOpen(true); setTimeout(() => document.getElementById('inches')?.scrollIntoView({ behavior: 'smooth' }), 300); }
  }, []);

  const stats = useMemo(() => measureStats(rows || []), [rows]);
  const latest = rows?.at(-1);
  const byDate = useMemo(() => Object.fromEntries((rows || []).map((r) => [r.log_date, r])), [rows]);

  // fill the form from the row for the chosen date (edit) or leave empty (new)
  useEffect(() => {
    const r = byDate[date];
    setVals(Object.fromEntries(SITE_KEYS.map((k) => [k, r?.[k] != null ? String(toUnit(Number(r[k]), unit)) : ''])));
    setNote(r?.note || '');
  }, [date, byDate, unit]);

  const changeUnit = (u) => { setUnit(u); setUnitPref(u); };
  const u = unit === 'cm' ? 'cm' : 'in';
  const sign = (c) => (c > 0 ? '+' : c < 0 ? '−' : '±');
  const fmtChange = (c) => (c == null ? null : `${sign(c)}${fmtVal(Math.abs(toUnit(c, unit)))} ${u}`);

  const save = async (e) => {
    e.preventDefault();
    const row = { user_id: userId, log_date: date, note: note.trim() || null };
    let any = false;
    for (const k of SITE_KEYS) {
      const v = fromUnit(vals[k], unit);
      if (v != null && (v <= 3 || v >= 90)) return show(`${SITES.find((s) => s.key === k).label} looks off. Check the number and unit (${u}).`, 'bad');
      row[k] = v;
      if (v != null) any = true;
    }
    if (!any) return show('Add at least one measurement', 'bad');
    setBusy(true);
    const { error } = await supabase.from('body_measurements').upsert(row, { onConflict: 'user_id,log_date' });
    setBusy(false);
    if (error) return show(error.message, 'bad');
    if (coach) show('Saved · Updated for your client.'); else cheer('measure');
    setOpen(false); load();
  };
  const remove = async (r) => {
    if (!confirm(`Delete measurements for ${fmtLong(r.log_date)}?`)) return;
    const { error } = await supabase.from('body_measurements').delete().eq('id', r.id);
    if (error) return show(error.message, 'bad');
    load();
  };
  const edit = (r) => { setDate(r.log_date); setOpen(true); document.getElementById('inches')?.scrollIntoView({ behavior: 'smooth' }); };

  if (!rows) return <Card title="Body measurements"><Spinner /></Card>;

  const lost = stats.totalSites ? -stats.total : null;
  const chart = rows.filter((r) => r[site] != null).map((r) => ({ date: r.log_date, value: toUnit(Number(r[site]), unit) }));
  const unitSeg = (
    <div className="seg" role="group" aria-label="Unit">
      {[['in', 'inches'], ['cm', 'cm']].map(([k, l]) => <button key={k} type="button" className={unit === k ? 'on' : ''} aria-pressed={unit === k} onClick={() => changeUnit(k)}>{l}</button>)}
    </div>
  );

  return (
    <div id="inches" className="bm">
      {toast}
      <Card title="📏 Body measurements" action={unitSeg}>
        {rows.length ? (
          <>
            <div className="bm-hero">
              {lost == null ? (
                <div className="bm-total"><b>✓</b><span>Starting point saved. Measure again in 1–2 weeks to see your change.</span></div>
              ) : (
                <div className={`bm-total ${lost > 0 ? 'good' : lost < 0 ? 'up' : ''}`}>
                  <b>{fmtVal(Math.abs(toUnit(lost, unit)))}<small> {u}</small></b>
                  <span>{lost > 0 ? `lost in total since ${fmtLong(rows[0].log_date)}` : lost < 0 ? `gained in total since ${fmtLong(rows[0].log_date)}` : `no change since ${fmtLong(rows[0].log_date)}`}</span>
                </div>
              )}
              <p className="small muted">Last measured {fmtLong(latest.log_date)}. Inches often drop even when the scale doesn’t move.</p>
            </div>
            <ul className="bm-sites">
              {SITES.filter((s) => stats.sites[s.key]).map((s) => {
                const x = stats.sites[s.key];
                return (
                  <li key={s.key}>
                    <button type="button" className={site === s.key ? 'on' : ''} aria-pressed={site === s.key} onClick={() => setSite(s.key)}>
                      <span className="bm-site-name">{s.emoji} {s.label}</span>
                      <b>{fmtVal(toUnit(x.last, unit))}<small> {u}</small></b>
                      {x.change != null && <span className={`bm-chg ${x.change < 0 ? 'down' : x.change > 0 ? 'up' : ''}`}>{fmtChange(x.change)}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
            {chart.length > 1
              ? <><h3 className="bm-chart-title">{SITES.find((s) => s.key === site).label} trend</h3><TrendLine data={chart} name={SITES.find((s) => s.key === site).label} unit={u} height={190} /></>
              : <p className="small muted">Tap a spot above to see its trend once it has two or more entries.</p>}
          </>
        ) : <Empty>Track inches at 8 spots: neck, chest, arm, waist, belly, hips, thigh and calf. Measure every 1–2 weeks, same time of day, before breakfast.</Empty>}

        {!open ? (
          <button type="button" className="btn btn-pop" onClick={() => { setDate(today()); setOpen(true); }}>📏 {rows.length ? 'Add new measurements' : 'Add first measurements'}</button>
        ) : (
          <form className="bm-form" onSubmit={save}>
            <div className="row gap wrap bm-form-top">
              <label>Date<input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value || today())} /></label>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowHow(!showHow)} aria-expanded={showHow}><Info size={15} /> How to measure</button>
            </div>
            {byDate[date] && <p className="small muted">You already have measurements for this date. Saving updates them.</p>}
            {showHow && <p className="small bm-how-intro">Use a soft tape. Keep it snug, not tight, and level all the way round. Measure on bare skin, in the morning, before eating.</p>}
            <div className="bm-grid">
              {SITES.map((s) => {
                const prev = latest && !byDate[date] && latest[s.key] != null ? toUnit(Number(latest[s.key]), unit) : null;
                return (
                  <label key={s.key} className="bm-field">
                    <span>{s.emoji} {s.label} <small>({u})</small></span>
                    <input type="number" inputMode="decimal" step={unit === 'cm' ? '0.5' : '0.25'} min="0" value={vals[s.key] ?? ''} onChange={(e) => setVals({ ...vals, [s.key]: e.target.value })} placeholder={prev != null ? `last ${prev}` : 'optional'} />
                    {showHow && <small className="bm-how">{s.how}</small>}
                  </label>
                );
              })}
            </div>
            <label>Note (optional)<input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="e.g. measured after periods, new tape" /></label>
            <div className="row gap">
              <button className="btn btn-primary" disabled={busy}>{busy ? <Spinner /> : 'Save measurements'}</button>
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
            </div>
          </form>
        )}
      </Card>

      {rows.length > 0 && (
        <Card title="Measurement history" action={<button className="btn btn-ghost btn-sm" onClick={() => downloadCSV('measurements.csv', rows.map((r) => ({ date: r.log_date, ...Object.fromEntries(SITE_KEYS.map((k) => [`${k}_${u}`, r[k] != null ? toUnit(Number(r[k]), unit) : ''])), note: r.note || '' })))}>Export CSV</button>}>
          <div className="table-wrap">
            <table className="table bm-table">
              <thead><tr><th>Date</th>{SITES.map((s) => <th key={s.key}>{s.label}</th>)}<th></th></tr></thead>
              <tbody>
                {[...rows].reverse().map((r) => (
                  <tr key={r.id}>
                    <td>{fmtLong(r.log_date)}{r.note && <div className="small muted">{r.note}</div>}</td>
                    {SITES.map((s) => <td key={s.key}>{r[s.key] != null ? fmtVal(toUnit(Number(r[s.key]), unit)) : ''}</td>)}
                    <td className="nowrap">
                      <button className="icon-btn sm" onClick={() => edit(r)} aria-label={`Edit ${r.log_date}`}><Pencil size={14} /></button>
                      <button className="icon-btn sm" onClick={() => remove(r)} aria-label={`Delete ${r.log_date}`}><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="small muted">Values in {unit === 'cm' ? 'centimetres' : 'inches'}.</p>
        </Card>
      )}
    </div>
  );
}
