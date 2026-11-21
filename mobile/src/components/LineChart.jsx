import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { fmt } from '../shared/dates';
import { C } from '../theme';

/** Simple trend line. data = [{ date: 'YYYY-MM-DD', value: number }] (sorted). */
export default function LineChart({ data, height = 170, unit = '', color = C.deep, refLine }) {
  const [w, setW] = useState(0);
  const pts = data.filter((d) => Number.isFinite(Number(d.value)));
  if (pts.length < 2) return null;
  const vals = pts.map((d) => Number(d.value)).concat(refLine != null ? [refLine] : []);
  const lo = Math.min(...vals), hi = Math.max(...vals), pad = Math.max((hi - lo) * 0.15, 0.5);
  const y0 = lo - pad, y1 = hi + pad;
  const L = 36, Rr = 10, T = 10, B = 22, W = Math.max(w - L - Rr, 1), H = height - T - B;
  const x = (i) => L + (pts.length === 1 ? W / 2 : (i / (pts.length - 1)) * W);
  const y = (v) => T + H - ((v - y0) / (y1 - y0)) * H;
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(Number(p.value)).toFixed(1)}`).join(' ');
  const ticks = [y0 + (y1 - y0) * 0.1, (y0 + y1) / 2, y1 - (y1 - y0) * 0.1];
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height }} accessibilityLabel={`Trend from ${pts[0].value}${unit} to ${pts.at(-1).value}${unit}`}>
      {w > 0 && (
        <Svg width={w} height={height}>
          {ticks.map((t, i) => (
            <Line key={i} x1={L} x2={w - Rr} y1={y(t)} y2={y(t)} stroke={C.line} strokeWidth={1} />
          ))}
          {ticks.map((t, i) => <SvgText key={`t${i}`} x={L - 4} y={y(t) + 4} fontSize={10} fill={C.muted} textAnchor="end">{Math.abs(t) >= 100 ? Math.round(t) : t.toFixed(1)}</SvgText>)}
          {refLine != null && <Line x1={L} x2={w - Rr} y1={y(refLine)} y2={y(refLine)} stroke={C.haldi} strokeDasharray="5 4" strokeWidth={1.5} />}
          <Path d={d} stroke={color} strokeWidth={2.5} fill="none" />
          {pts.map((p, i) => <Circle key={i} cx={x(i)} cy={y(Number(p.value))} r={pts.length > 30 ? 1.5 : 3.5} fill={color} />)}
          <SvgText x={L} y={height - 5} fontSize={10} fill={C.muted}>{fmt(pts[0].date)}</SvgText>
          <SvgText x={w - Rr} y={height - 5} fontSize={10} fill={C.muted} textAnchor="end">{fmt(pts.at(-1).date)}</SvgText>
        </Svg>
      )}
    </View>
  );
}
