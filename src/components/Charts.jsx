import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, ReferenceLine, Legend, ComposedChart, Area } from 'recharts';
import { fmt } from '../lib/dates';

const C = { deep: '#1F5E43', fresh: '#3E9F67', sprout: '#A8D5A2', haldi: '#F2A83B', ink: '#1C2A22', grid: '#E7E1D3', red: '#C8553D' };
const axis = { fontSize: 12, fill: '#6B7A70' };
const tip = { contentStyle: { borderRadius: 10, border: '1px solid #E7E1D3', fontSize: 13 } };

export function WeightChart({ data, target, height = 240 }) {
  if (!data?.length) return null;
  const rows = data.map((d) => ({ date: d.log_date, weight: Number(d.weight_kg), waist: d.waist_cm ? Number(d.waist_cm) : null }));
  // 7-point moving average to smooth daily noise
  rows.forEach((r, i) => {
    const win = rows.slice(Math.max(0, i - 6), i + 1);
    r.avg = +(win.reduce((s, x) => s + x.weight, 0) / win.length).toFixed(1);
  });
  const ws = rows.map((r) => r.weight).concat(target ? [Number(target)] : []);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={rows} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
        <CartesianGrid stroke={C.grid} vertical={false} />
        <XAxis dataKey="date" tickFormatter={(d) => fmt(d)} tick={axis} minTickGap={24} />
        <YAxis domain={[Math.floor(Math.min(...ws) - 1), Math.ceil(Math.max(...ws) + 1)]} tick={axis} width={44} />
        <Tooltip {...tip} labelFormatter={(d) => fmt(d, { day: 'numeric', month: 'short', year: 'numeric' })} />
        {target && <ReferenceLine y={Number(target)} stroke={C.haldi} strokeDasharray="5 4" label={{ value: `Target ${target}`, fill: C.haldi, fontSize: 12, position: 'insideTopRight' }} />}
        <Line type="monotone" dataKey="weight" name="Weight (kg)" stroke={C.sprout} strokeWidth={1.5} dot={{ r: 3, fill: C.sprout }} />
        <Line type="monotone" dataKey="avg" name="7-day avg" stroke={C.deep} strokeWidth={3} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function DailyBars({ data, keys, height = 220 }) {
  // keys: [{key, name, color}]
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 10, right: 8, left: -6, bottom: 0 }}>
        <CartesianGrid stroke={C.grid} vertical={false} />
        <XAxis dataKey="date" tickFormatter={(d) => fmt(d)} tick={axis} minTickGap={16} />
        <YAxis allowDecimals={false} tick={axis} width={44} />
        <Tooltip {...tip} labelFormatter={(d) => fmt(d)} />
        {keys.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {keys.map((k) => <Bar key={k.key} dataKey={k.key} name={k.name} stackId={k.stack} fill={k.color} radius={k.stack ? 0 : [4, 4, 0, 0]} />)}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TrendLine({ data, dataKey = 'value', name, color = C.deep, refLow, refHigh, height = 200, unit = '' }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
        <CartesianGrid stroke={C.grid} vertical={false} />
        <XAxis dataKey="date" tickFormatter={(d) => fmt(d, { month: 'short', year: '2-digit' })} tick={axis} />
        <YAxis tick={axis} width={48} />
        <Tooltip {...tip} formatter={(v) => `${v} ${unit}`} labelFormatter={(d) => fmt(d, { day: 'numeric', month: 'short', year: 'numeric' })} />
        {refHigh != null && <ReferenceLine y={refHigh} stroke={C.red} strokeDasharray="4 4" />}
        {refLow != null && <ReferenceLine y={refLow} stroke={C.haldi} strokeDasharray="4 4" />}
        <Area type="monotone" dataKey={dataKey} fill={C.sprout} fillOpacity={0.25} stroke="none" />
        <Line type="monotone" dataKey={dataKey} name={name} stroke={color} strokeWidth={2.5} dot={{ r: 4 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export const COLORS = C;
