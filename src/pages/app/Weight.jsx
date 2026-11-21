import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { fmtLong } from '../../lib/dates';
import { Card, Stat, Empty, SignedImg, Lightbox } from '../../components/ui';
import { WeightChart } from '../../components/Charts';
import ProgressPhotos from '../../components/ProgressPhotos';
import { downloadCSV } from '../../lib/csv';

export function WeightPanel({ userId, profile }) {
  const [rows, setRows] = useState([]);
  const [range, setRange] = useState(90);
  const [lb, setLb] = useState(null);
  useEffect(() => {
    supabase.from('weight_logs').select('*').eq('user_id', userId).order('log_date').then(({ data }) => setRows(data || []));
  }, [userId]);
  const shown = range ? rows.slice(-range) : rows;
  const first = rows[0], last = rows.at(-1);
  const change = first && last ? +(last.weight_kg - first.weight_kg).toFixed(1) : null;
  const week = rows.length > 7 ? +(last.weight_kg - rows.at(-8).weight_kg).toFixed(1) : null;
  const bmi = last && profile?.height_cm ? (last.weight_kg / (profile.height_cm / 100) ** 2).toFixed(1) : null;
  const toGo = last && profile?.target_weight ? +(last.weight_kg - profile.target_weight).toFixed(1) : null;

  return (
    <>
      <div className="stats">
        <Stat label="Current" value={last ? `${last.weight_kg} kg` : null} sub={last && fmtLong(last.log_date)} />
        <Stat label="Total change" value={change != null ? `${change > 0 ? '+' : ''}${change} kg` : null} tone={change < 0 ? 'good' : change > 0 ? 'warn' : ''} sub={first && `since ${fmtLong(first.log_date)}`} />
        <Stat label="Last 7 entries" value={week != null ? `${week > 0 ? '+' : ''}${week} kg` : null} tone={week < 0 ? 'good' : week > 0 ? 'warn' : ''} />
        <Stat label={bmi ? 'BMI' : 'To target'} value={bmi || (toGo != null ? `${toGo} kg` : null)} sub={bmi && toGo != null ? `${toGo} kg to target` : null} />
      </div>
      <Card title="Trend" action={
        <div className="seg">{[[30, '1M'], [90, '3M'], [365, '1Y'], [0, 'All']].map(([v, l]) => <button key={l} className={range === v ? 'on' : ''} onClick={() => setRange(v)}>{l}</button>)}</div>
      }>
        {shown.length ? <WeightChart data={shown} target={profile?.target_weight} /> : <Empty>Log your weight on the Today screen to see your trend.</Empty>}
      </Card>
      <ProgressPhotos userId={userId} />
      <Card title="History" action={rows.length > 0 && <button className="btn btn-ghost btn-sm" onClick={() => downloadCSV('weight.csv', rows.map((r) => ({ date: r.log_date, weight_kg: r.weight_kg, waist_cm: r.waist_cm ?? '', source: r.source })))}>Export CSV</button>}>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Date</th><th>Weight</th><th>Change</th><th>Waist</th><th></th></tr></thead>
            <tbody>
              {[...rows].reverse().map((r, i, arr) => {
                const prev = arr[i + 1];
                const d = prev ? +(r.weight_kg - prev.weight_kg).toFixed(1) : null;
                return (
                  <tr key={r.id}>
                    <td>{fmtLong(r.log_date)}</td>
                    <td><b>{r.weight_kg}</b> kg {r.source === 'ai' && <span className="tag">AI</span>}</td>
                    <td className={d < 0 ? 'good' : d > 0 ? 'warn' : ''}>{d != null ? `${d > 0 ? '+' : ''}${d}` : ''}</td>
                    <td>{r.waist_cm || ''}</td>
                    <td>{r.photo_path && <SignedImg path={r.photo_path} className="thumb xs" onClick={() => setLb(r.photo_path)} />}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <Lightbox path={lb} onClose={() => setLb(null)} />
    </>
  );
}

export default function Weight() {
  const { user, profile } = useAuth();
  return (
    <div className="page">
      <div className="page-head"><h1>Weight</h1></div>
      <WeightPanel userId={user.id} profile={profile} />
    </div>
  );
}
