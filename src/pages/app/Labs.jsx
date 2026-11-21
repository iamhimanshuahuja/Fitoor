import { cheer } from '../../lib/cheer';
import { useEffect, useMemo, useState } from 'react';
import { FileUp, Sparkles, Trash2, Plus, Save } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { fmt, today } from '../../lib/dates';
import { uploadMedia, toBase64 } from '../../lib/media';
import { runAI } from '../../lib/ai';
import { Card, Empty, Spinner, Tabs, useToast } from '../../components/ui';
import { TrendLine } from '../../components/Charts';
import { labKey } from '../../lib/labNames';
import { downloadCSV } from '../../lib/csv';
import Comments from '../../components/Comments';

export const refLabel = (r) =>
  r.ref_low != null && r.ref_high != null ? `${r.ref_low} – ${r.ref_high}`
  : r.ref_high != null ? `< ${r.ref_high}` : r.ref_low != null ? `> ${r.ref_low}` : (r.ref_text || '');

export const flagOf = (v, lo, hi) => {
  if (v == null || isNaN(v)) return null;
  if (lo != null && v < lo) return 'low';
  if (hi != null && v > hi) return 'high';
  return 'normal';
};

/** Date-wise comparison: rows = tests, columns = report dates. */
export function LabCompare({ userId, refreshKey }) {
  const [reports, setReports] = useState([]);
  const [results, setResults] = useState([]);
  const [panel, setPanel] = useState('');
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const [sel, setSel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  useEffect(() => {
    setLoading(true);
    Promise.all([
      supabase.from('lab_reports').select('*').eq('user_id', userId).order('report_date'),
      supabase.from('lab_results').select('*').eq('user_id', userId),
    ]).then(([r, x]) => { setReports(r.data || []); setResults(x.data || []); setLoading(false); });
  }, [userId, refreshKey]);

  const panels = [...new Set(results.map((r) => r.panel).filter(Boolean))];
  const tests = useMemo(() => {
    const m = new Map();
    results.forEach((r) => {
      if (panel && r.panel !== panel) return;
      const k = labKey(r.test_name);
      if (!m.has(k)) m.set(k, { key: k, name: r.test_name.trim(), panel: r.panel, unit: r.unit, ref: refLabel(r), lo: r.ref_low, hi: r.ref_high, byReport: {} });
      m.get(k).byReport[r.report_id] = r;
    });
    let arr = [...m.values()];
    if (onlyFlagged) arr = arr.filter((t) => Object.values(t.byReport).some((r) => r.flag && r.flag !== 'normal'));
    return arr.sort((a, b) => (a.panel || '').localeCompare(b.panel || '') || a.name.localeCompare(b.name));
  }, [results, panel, onlyFlagged]);

  const saveCell = async (row, raw) => {
    const n = raw === '' || isNaN(Number(raw)) ? null : Number(raw);
    const patch = { value: n, value_text: n == null ? raw || null : null, flag: n == null ? null : flagOf(n, row.ref_low, row.ref_high) };
    if (String(row.value ?? row.value_text ?? '') === raw) return;
    const { error } = await supabase.from('lab_results').update(patch).eq('id', row.id);
    if (!error) setResults(results.map((x) => (x.id === row.id ? { ...x, ...patch } : x)));
  };
  const delReport = async (r) => {
    if (!confirm(`Delete the report from ${fmt(r.report_date)} and all its results?`)) return;
    if (r.file_path) await supabase.storage.from('media').remove([r.file_path]);
    await supabase.from('lab_reports').delete().eq('id', r.id);
    setReports(reports.filter((x) => x.id !== r.id)); setResults(results.filter((x) => x.report_id !== r.id));
  };
  const openFile = async (r) => {
    const { data } = await supabase.storage.from('media').createSignedUrl(r.file_path, 600);
    if (data) window.open(data.signedUrl, '_blank');
  };

  if (loading) return <div className="center-pad"><Spinner /></div>;
  if (!reports.length) return <Card><Empty>No lab reports yet.</Empty></Card>;

  const trend = sel ? reports.filter((r) => sel.byReport[r.id]?.value != null).map((r) => ({ date: r.report_date, value: Number(sel.byReport[r.id].value) })) : [];
  const flagged = results.filter((r) => r.flag === 'high' || r.flag === 'low');
  const latest = reports.at(-1);
  const latestFlags = flagged.filter((r) => r.report_id === latest.id);

  return (
    <>
      {latestFlags.length > 0 && (
        <Card title={`Outside reference range · ${fmt(latest.report_date, { day: 'numeric', month: 'short', year: 'numeric' })}`}>
          <div className="flag-list">
            {latestFlags.map((r) => <span key={r.id} className={`flag-pill ${r.flag}`}>{r.test_name}: <b>{r.value ?? r.value_text}</b> {r.unit} {r.flag === 'high' ? '↑' : '↓'}</span>)}
          </div>
          <p className="small muted">Talk to your doctor about these values. This app does not give medical advice.</p>
        </Card>
      )}
      <Card title="Compare reports" action={
        <div className="row gap wrap">
          <select value={panel} onChange={(e) => setPanel(e.target.value)}><option value="">All panels</option>{panels.map((p) => <option key={p}>{p}</option>)}</select>
          <label className="check inline"><input type="checkbox" checked={onlyFlagged} onChange={(e) => setOnlyFlagged(e.target.checked)} /> Only out of range</label>
          <button className="btn btn-sm btn-ghost" onClick={() => downloadCSV('lab-reports.csv', tests.map((t) => ({ panel: t.panel || '', test: t.name, unit: t.unit || '', reference: t.ref, ...Object.fromEntries(reports.map((r) => [r.report_date, t.byReport[r.id]?.value ?? t.byReport[r.id]?.value_text ?? ''])) })))}>Export CSV</button>
          <button className={`btn btn-sm ${editMode ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setEditMode(!editMode)}>{editMode ? 'Done editing' : 'Edit values'}</button>
        </div>
      }>
        <div className="table-wrap">
          <table className="table lab-table">
            <thead>
              <tr>
                <th className="sticky">Test</th><th>Reference</th>
                {reports.map((r) => (
                  <th key={r.id} className="date-col">
                    {fmt(r.report_date, { day: 'numeric', month: 'short', year: '2-digit' })}
                    <span className="col-actions">
                      {r.file_path && <button className="link" onClick={() => openFile(r)}>file</button>}
                      <button className="link danger" onClick={() => delReport(r)}>delete</button>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tests.map((t, i) => (
                <tr key={t.key} className={sel?.key === t.key ? 'selected' : ''} onClick={() => setSel(t)}>
                  <td className="sticky">
                    {(i === 0 || tests[i - 1].panel !== t.panel) && t.panel && <div className="panel-name">{t.panel}</div>}
                    {t.name}
                  </td>
                  <td className="muted small">{t.ref} {t.unit}</td>
                  {reports.map((r, j) => {
                    const v = t.byReport[r.id];
                    const prev = j > 0 ? t.byReport[reports[j - 1].id] : null;
                    const delta = v?.value != null && prev?.value != null ? Number(v.value) - Number(prev.value) : null;
                    return (
                      <td key={r.id} className={v?.flag && v.flag !== 'normal' ? `flag ${v.flag}` : ''}>
                        {editMode && v ? (
                          <input className="cell-input" defaultValue={v.value ?? v.value_text ?? ''} onClick={(e) => e.stopPropagation()}
                            onBlur={(e) => saveCell(v, e.target.value)} />
                        ) : v ? <>{v.value ?? v.value_text}{delta ? <small className="delta">{delta > 0 ? '▲' : '▼'}{Math.abs(+delta.toFixed(2))}</small> : null}</> : <span className="muted">—</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small muted">Tap a test to see its trend.</p>
      </Card>
      {sel && trend.length > 0 && (
        <Card title={`${sel.name} trend`}>
          <TrendLine data={trend} name={sel.name} unit={sel.unit || ''} refLow={sel.lo} refHigh={sel.hi} />
        </Card>
      )}
    </>
  );
}

/** Upload a report → AI extracts results → review → save. Also manual entry. */
export function LabUploader({ userId, onSaved }) {
  const { has } = useAuth();
  const [date, setDate] = useState(today());
  const [lab, setLab] = useState('');
  const [file, setFile] = useState(null);
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState('');
  const [toast, show] = useToast();

  const pick = (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) setFile(f); };
  const extract = async () => {
    if (!file) return;
    if (file.size > 4.2 * 1024 * 1024) return show('File is over 4 MB — upload just the result pages, or enter values manually', 'bad');
    setBusy('Reading report with AI… this can take 30–60 s');
    try {
      const { data: prev } = await supabase.from('lab_results').select('test_name').eq('user_id', userId).limit(500);
      const known = [...new Set((prev || []).map((x) => x.test_name))];
      const r = await runAI('lab', { file: await toBase64(file), mime: file.type || 'application/pdf', known });
      if (r?.report_date) setDate(r.report_date);
      if (r?.lab_name) setLab(r.lab_name);
      setRows((r?.results || []).map((x) => ({ ...x, flag: x.flag || flagOf(x.value, x.ref_low, x.ref_high) })));
      show(`Found ${r?.results?.length || 0} tests — please review`);
    } catch (e) { show(e.message, 'bad'); }
    setBusy('');
  };
  const upd = (i, k, v) => setRows(rows.map((r, j) => {
    if (j !== i) return r;
    const n = { ...r, [k]: v };
    if (['value', 'ref_low', 'ref_high'].includes(k)) n.flag = flagOf(num(n.value), num(n.ref_low), num(n.ref_high));
    return n;
  }));
  const save = async () => {
    if (!rows.length) return show('Nothing to save', 'bad');
    setBusy('Saving…');
    try {
      let file_path = null;
      if (file) file_path = (await uploadMedia(userId, 'labs', file, { compress: false })).path;
      const { data: rep, error } = await supabase.from('lab_reports').insert({ user_id: userId, report_date: date, lab_name: lab || null, file_path }).select().single();
      if (error) throw error;
      const { error: e2 } = await supabase.from('lab_results').insert(rows.filter((r) => r.test_name).map((r) => ({
        report_id: rep.id, user_id: userId, panel: r.panel || null, test_name: r.test_name,
        value: num(r.value), value_text: num(r.value) == null ? (r.value_text || String(r.value ?? '')) : null,
        unit: r.unit || null, ref_low: num(r.ref_low), ref_high: num(r.ref_high), ref_text: r.ref_text || null,
        flag: r.flag || flagOf(num(r.value), num(r.ref_low), num(r.ref_high)),
      })));
      if (e2) throw e2;
      setRows([]); setFile(null); setLab('');
      cheer('lab'); onSaved();
    } catch (e) { show(e.message, 'bad'); }
    setBusy('');
  };

  return (
    <Card title="Add a lab report">
      {toast}
      <div className="row gap wrap">
        <label className="grow">Report date<input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} /></label>
        <label className="grow">Lab<input value={lab} onChange={(e) => setLab(e.target.value)} placeholder="e.g. June Health" /></label>
      </div>
      <div className="row gap wrap">
        <label className="btn btn-soft"><FileUp size={18} /> {file ? file.name : 'Choose PDF or photo'}<input type="file" accept="application/pdf,image/*" hidden onChange={pick} /></label>
        {has('ai') && <button className="btn btn-primary" disabled={!file || !!busy} onClick={extract}><Sparkles size={16} /> Extract with AI</button>}
        <button className="btn btn-ghost" onClick={() => setRows([...rows, { panel: rows.at(-1)?.panel || '', test_name: '', value: '', unit: '', ref_low: '', ref_high: '' }])}><Plus size={16} /> Add row</button>
      </div>
      {busy && <p className="muted small"><Spinner size={14} /> {busy}</p>}
      {rows.length > 0 && (
        <>
          <div className="table-wrap">
            <table className="table edit-table">
              <thead><tr><th>Panel</th><th>Test</th><th>Value</th><th>Unit</th><th>Low</th><th>High</th><th></th><th></th></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className={r.flag && r.flag !== 'normal' ? `flag ${r.flag}` : ''}>
                    <td><input value={r.panel || ''} onChange={(e) => upd(i, 'panel', e.target.value)} /></td>
                    <td><input value={r.test_name || ''} onChange={(e) => upd(i, 'test_name', e.target.value)} /></td>
                    <td><input value={r.value ?? r.value_text ?? ''} onChange={(e) => upd(i, 'value', e.target.value)} /></td>
                    <td><input value={r.unit || ''} onChange={(e) => upd(i, 'unit', e.target.value)} /></td>
                    <td><input value={r.ref_low ?? ''} onChange={(e) => upd(i, 'ref_low', e.target.value)} /></td>
                    <td><input value={r.ref_high ?? ''} onChange={(e) => upd(i, 'ref_high', e.target.value)} /></td>
                    <td className="small">{r.flag === 'high' ? '↑' : r.flag === 'low' ? '↓' : ''}</td>
                    <td><button className="icon-btn sm" onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label="Remove"><Trash2 size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="btn btn-primary btn-block" disabled={!!busy} onClick={save}><Save size={16} /> Save {rows.length} results</button>
        </>
      )}
    </Card>
  );
}

const num = (v) => (v === '' || v == null || isNaN(Number(v)) ? null : Number(v));

export default function Labs() {
  const { user } = useAuth();
  const [tab, setTab] = useState('compare');
  const [key, setKey] = useState(0);
  return (
    <div className="page">
      <div className="page-head"><h1>Lab reports</h1>
        <Tabs tabs={[{ key: 'compare', label: 'Compare' }, { key: 'add', label: 'Add report' }, { key: 'notes', label: 'Health notes' }]} value={tab} onChange={setTab} />
      </div>
      {tab === 'compare' && <LabCompare userId={user.id} refreshKey={key} />}
      {tab === 'add' && <LabUploader userId={user.id} onSaved={() => { setKey(key + 1); setTab('compare'); }} />}
      {tab === 'notes' && <Card title="Health notes from your coach"><Comments userId={user.id} context="health" /></Card>}
    </div>
  );
}
