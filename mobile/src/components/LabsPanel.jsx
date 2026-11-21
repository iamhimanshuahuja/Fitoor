import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { runAI } from '../lib/ai';
import { pickDocument, pickImage, uploadFile, uploadMedia } from '../lib/media';
import { cheer } from '../shared/cheer';
import { labKey } from '../shared/labNames';
import { today, fmt, fmtLong } from '../shared/dates';
import { Btn, Card, Empty, Field, Row, Spinner, T, Toggle } from './ui';
import LineChart from './LineChart';
import { C } from '../theme';

export const flagOf = (v, lo, hi) => {
  if (v == null || Number.isNaN(v)) return null;
  if (lo != null && v < lo) return 'low';
  if (hi != null && v > hi) return 'high';
  return 'normal';
};
const num = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v));
const FLAG = { high: { c: C.chilli, t: '↑' }, low: { c: C.sky, t: '↓' }, normal: { c: C.lime, t: '' } };

/** Lab reports for one user: upload → AI reads → review → save; compare by date. */
export default function LabsPanel({ userId }) {
  const { has } = useAuth();
  const [reports, setReports] = useState(null);
  const [results, setResults] = useState([]);
  const load = useCallback(async () => {
    const [r, x] = await Promise.all([
      supabase.from('lab_reports').select('*').eq('user_id', userId).order('report_date'),
      supabase.from('lab_results').select('*').eq('user_id', userId),
    ]);
    setReports(r.data || []); setResults(x.data || []);
  }, [userId]);
  useEffect(() => { load(); }, [load]);
  if (!reports) return <Spinner />;
  return (
    <View style={{ gap: 14 }}>
      {has('labs') && <Uploader userId={userId} known={[...new Set(results.map((r) => r.test_name))]} canAI={has('ai')} onSaved={load} />}
      <Compare reports={reports} results={results} />
      <T small muted>Flags only compare each value with the reference range printed on your report. Talk to your doctor about what they mean for you.</T>
    </View>
  );
}

function Uploader({ userId, known, canAI, onSaved }) {
  const [doc, setDoc] = useState(null);
  const [date, setDate] = useState(today());
  const [lab, setLab] = useState('');
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState('');
  const read = async (d) => {
    setDoc(d); setRows([]);
    if (!canAI) { setRows([{ test_name: '', value: '', unit: '', ref_low: '', ref_high: '' }]); return; }
    setBusy('Reading your report… big PDFs can take a minute');
    try {
      const r = await runAI('lab', { file: d.base64, mime: d.mime, known });
      if (r?.report_date) setDate(r.report_date);
      if (r?.lab_name) setLab(r.lab_name);
      setRows((r?.results || []).map((x) => ({ ...x, value: x.value ?? x.value_text ?? '', ref_low: x.ref_low ?? '', ref_high: x.ref_high ?? '' })));
    } catch (e) { Alert.alert('Couldn’t read it', e.message); }
    setBusy('');
  };
  const pickPdf = async () => { const d = await pickDocument(); if (d) read(d); };
  const pickPhoto = async () => { const p = await pickImage('camera', { max: 2000 }); if (p) read({ ...p, isImage: true }); };
  const set = (i, k, v) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const save = async () => {
    const ok = rows.filter((r) => r.test_name);
    if (!ok.length) return Alert.alert('Nothing to save');
    setBusy('Saving…');
    try {
      const file_path = doc ? (doc.isImage ? await uploadMedia(userId, 'labs', doc) : await uploadFile(userId, 'labs', doc)) : null;
      const { data: rep, error } = await supabase.from('lab_reports').insert({ user_id: userId, report_date: date, lab_name: lab || null, file_path }).select().single();
      if (error) throw error;
      const { error: e2 } = await supabase.from('lab_results').insert(ok.map((r) => ({
        report_id: rep.id, user_id: userId, panel: r.panel || null, test_name: r.test_name,
        value: num(r.value), value_text: num(r.value) == null ? String(r.value_text || r.value || '') || null : null,
        unit: r.unit || null, ref_low: num(r.ref_low), ref_high: num(r.ref_high), ref_text: r.ref_text || null,
        flag: flagOf(num(r.value), num(r.ref_low), num(r.ref_high)),
      })));
      if (e2) throw e2;
      setRows([]); setDoc(null); setLab(''); cheer('lab'); onSaved();
    } catch (e) { Alert.alert('Not saved', e.message); }
    setBusy('');
  };
  return (
    <Card title="Add a lab report">
      <T small muted>{canAI ? 'Upload the PDF or snap the pages. AI pulls out every test, then you check and save.' : 'Upload the report and type the values you want to track.'}</T>
      <Row wrap><Btn small title="📄 Pick PDF / image" onPress={pickPdf} disabled={!!busy} /><Btn small variant="soft" title="📷 Photo of report" onPress={pickPhoto} disabled={!!busy} /></Row>
      {busy ? <><Spinner /><T small muted>{busy}</T></> : null}
      {rows.length > 0 && (
        <>
          <Row gap={8}><Field label="Report date" value={date} onChangeText={setDate} autoCapitalize="none" style={{ flex: 1 }} /><Field label="Lab" value={lab} onChangeText={setLab} style={{ flex: 1 }} /></Row>
          <T small bold>{rows.length} tests found. Check them:</T>
          {rows.map((r, i) => (
            <View key={i} style={{ borderTopWidth: 1, borderTopColor: C.line, paddingTop: 6, gap: 4 }}>
              <Field value={r.test_name} onChangeText={(v) => set(i, 'test_name', v)} placeholder="Test name" />
              <Row gap={6}>
                <Field label="Value" value={String(r.value ?? '')} onChangeText={(v) => set(i, 'value', v)} style={{ flex: 1 }} />
                <Field label="Unit" value={r.unit || ''} onChangeText={(v) => set(i, 'unit', v)} style={{ flex: 1 }} />
                <Field label="Low" value={String(r.ref_low ?? '')} onChangeText={(v) => set(i, 'ref_low', v)} keyboardType="decimal-pad" style={{ flex: 1 }} />
                <Field label="High" value={String(r.ref_high ?? '')} onChangeText={(v) => set(i, 'ref_high', v)} keyboardType="decimal-pad" style={{ flex: 1 }} />
              </Row>
            </View>
          ))}
          <Row wrap><Btn small variant="ghost" title="+ Row" onPress={() => setRows([...rows, { test_name: '', value: '', unit: '', ref_low: '', ref_high: '' }])} /><Btn title="Save report" onPress={save} disabled={!!busy} /></Row>
        </>
      )}
    </Card>
  );
}

function Compare({ reports, results }) {
  const [onlyOut, setOnlyOut] = useState(false);
  const [open, setOpen] = useState(null);
  const tests = useMemo(() => {
    const byKey = {};
    const repDate = Object.fromEntries(reports.map((r) => [r.id, r.report_date]));
    results.forEach((r) => {
      const k = labKey(r.test_name); if (!k) return;
      const t = (byKey[k] ||= { key: k, name: r.test_name, unit: r.unit, panel: r.panel, points: [] });
      t.points.push({ date: repDate[r.report_id], value: r.value, text: r.value_text, flag: r.flag, lo: r.ref_low, hi: r.ref_high });
    });
    return Object.values(byKey).map((t) => ({ ...t, points: t.points.filter((p) => p.date).sort((a, b) => a.date.localeCompare(b.date)) }))
      .sort((a, b) => (a.panel || 'zz').localeCompare(b.panel || 'zz') || a.name.localeCompare(b.name));
  }, [reports, results]);
  if (!reports.length) return <Empty>No lab reports yet.</Empty>;
  const shown = tests.filter((t) => !onlyOut || ['high', 'low'].includes(t.points.at(-1)?.flag));
  return (
    <Card title={`Compare · ${reports.length} report${reports.length > 1 ? 's' : ''}`}>
      <Toggle label="Only out of range (latest)" value={onlyOut} onChange={setOnlyOut} />
      {shown.map((t) => {
        const last = t.points.at(-1), prev = t.points.at(-2);
        const f = FLAG[last?.flag];
        return (
          <Pressable key={t.key} onPress={() => setOpen(open === t.key ? null : t.key)} style={{ borderTopWidth: 1, borderTopColor: C.line, paddingVertical: 6, gap: 4 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <T small style={{ flex: 1 }}>{t.name}</T>
              <T small bold style={f && last.flag !== 'normal' ? { color: last.flag === 'high' ? C.red : '#1C6FA8' } : null}>{last?.value ?? last?.text ?? '–'} {t.unit || ''} {f?.t}</T>
            </Row>
            {prev ? <T small muted>Before: {prev.value ?? prev.text} on {fmt(prev.date)} · ref {last.lo ?? '–'}–{last.hi ?? '–'}</T> : null}
            {open === t.key && (
              <View style={{ gap: 4 }}>
                <ScrollView horizontal><Row gap={12}>{t.points.map((p, i) => <View key={i}><T small muted>{fmt(p.date)}</T><T small bold>{p.value ?? p.text}</T></View>)}</Row></ScrollView>
                {t.points.filter((p) => p.value != null).length >= 2 && <LineChart height={140} data={t.points.filter((p) => p.value != null).map((p) => ({ date: p.date, value: p.value }))} />}
              </View>
            )}
          </Pressable>
        );
      })}
      <T small muted>Tap a test for its history. Latest report: {fmtLong(reports.at(-1).report_date)}.</T>
    </Card>
  );
}
